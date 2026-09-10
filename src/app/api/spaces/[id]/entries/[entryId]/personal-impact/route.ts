import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { z } from 'zod'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { ServiceError } from '@/lib/server/errors'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import {
    getPersonalImpactForEntries,
    resolveCurrentUserEntryShare,
} from '@/lib/server/space-personal-impact'
import { resolveSuggestedPersonalCategory } from '@/lib/server/space-personal-settings'
import { resolveSpacePersonalImpactV2 } from '@/lib/server/space-personal-impact-service-v2'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'

const personalImpactDecisionV2Schema = z.object({
    impactId: z.string().min(1),
    expectedRevision: z.number().int().nonnegative(),
    decision: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('create_transaction'),
            accountId: z.string().optional(),
            categoryId: z.string().optional(),
            description: z.string().trim().max(200).optional(),
        }).strict(),
        z.object({ type: z.literal('link_existing'), transactionId: z.string().min(1) }).strict(),
        z.object({ type: z.literal('ignore') }).strict(),
        z.object({ type: z.literal('keep_review') }).strict(),
        z.object({ type: z.literal('sync_transaction') }).strict(),
        z.object({ type: z.literal('remove_transaction') }).strict(),
    ]),
}).strict()

type Params = Promise<{ id: string; entryId: string }>

async function assertV2Entry(id: string, entryId: string) {
    const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }, { contractVersion: 1 })
        .lean<{ contractVersion?: number } | null>()
    if (!entry) throw new ServiceError(404, 'SPACE_ENTRY_NOT_FOUND', 'Movimiento no encontrado.')
    if (entry.contractVersion !== 2) {
        throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este movimiento requiere migración antes de modificar Mi Finp.')
    }
}

export async function GET(_request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }
        await connectDB()
        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }).lean<ISpaceEntry | null>()
        if (!entry) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        const impacts = await getPersonalImpactForEntries(id, session.user.id, [entryId])
        const suggestion = resolveCurrentUserEntryShare(entry, context.participants, session.user.id)
        const categorySuggestion = context.currentParticipant
            ? await resolveSuggestedPersonalCategory({
                userId: session.user.id,
                space: context.space,
                participant: context.currentParticipant,
                entry,
            })
            : null
        const entryImpact = impacts[entryId]
        return NextResponse.json({
            impact: entryImpact?.linkedImpact ?? null,
            reviewImpact: entryImpact?.reviewImpact ?? null,
            pendingActions: entryImpact?.pendingActions ?? [],
            suggestion: suggestion ? {
                amount: suggestion.amount,
                currency: entry.currency,
                impactKind: suggestion.impactKind,
                categoryId: categorySuggestion?.categoryId,
                categoryStrategy: categorySuggestion?.strategy,
            } : null,
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo obtener el impacto personal.')
    }
}

export async function POST(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }
        const body: unknown = await request.json()
        await connectDB()
        await assertV2Entry(id, entryId)
        const parsed = personalImpactDecisionV2Schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                error: 'La decisión personal no es válida.',
                code: 'SPACE_PERSONAL_IMPACT_DECISION_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        const execution = await resolveSpacePersonalImpactV2({
            actorUserId: session.user.id,
            spaceId: id,
            entryId,
            impactId: parsed.data.impactId,
            expectedRevision: parsed.data.expectedRevision,
            idempotencyKey: requireIdempotencyKey(request),
            decision: parsed.data.decision,
        })
        return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo resolver el impacto personal.')
    }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }
        const revisionHeader = request.headers.get('Expected-Revision')
        const expectedRevision = Number(revisionHeader)
        if (!revisionHeader || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
            return NextResponse.json({
                error: 'La operación requiere Expected-Revision.',
                code: 'EXPECTED_REVISION_REQUIRED',
                failureState: 'not_started',
                retryable: false,
            }, { status: 400 })
        }
        await connectDB()
        await assertV2Entry(id, entryId)
        const impact = await SpaceEntryPersonalImpact.findOne({
            spaceId: id,
            entryId,
            userId: session.user.id,
            contractVersion: 2,
            status: { $in: [SPACE_PERSONAL_IMPACT_STATUSES.LINKED, SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW] },
        }).lean<ISpaceEntryPersonalImpact | null>()
        if (!impact) {
            throw new ServiceError(404, 'SPACE_PERSONAL_IMPACT_NOT_FOUND', 'El impacto personal no existe.')
        }
        const execution = await resolveSpacePersonalImpactV2({
            actorUserId: session.user.id,
            spaceId: id,
            entryId,
            impactId: impact._id.toString(),
            expectedRevision,
            idempotencyKey: requireIdempotencyKey(request),
            decision: { type: 'remove_transaction' },
        })
        return NextResponse.json(toSpaceMutationResult(execution))
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo desvincular el impacto personal.')
    }
}
