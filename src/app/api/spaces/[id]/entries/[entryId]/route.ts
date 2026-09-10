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
import { editSpaceEntryV2 } from '@/lib/server/space-entry-history-service-v2'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { getPersonalImpactForEntries } from '@/lib/server/space-personal-impact'
import { moneyDtoSchema } from '@/lib/validations/space-money-v2'
import type { ISpaceEntry } from '@/types'

const spaceEntryEditV2Schema = z.object({
    expectedRevision: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional(),
    amount: z.number().finite().positive(),
    money: moneyDtoSchema.optional(),
    currency: z.string().min(1).max(12),
    exchangeRate: z.number().finite().positive().optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paidByParticipantId: z.string().min(1),
    sharedWithParticipantIds: z.array(z.string().min(1)).min(1).max(100),
    splitMode: z.enum(['none', 'equal', 'percentage', 'fixed']),
    splitAllocations: z.array(z.object({
        participantId: z.string().min(1),
        percentage: z.number().finite().nonnegative().optional(),
        amount: z.number().finite().nonnegative().optional(),
    }).strict()).max(100).optional(),
    spaceCategoryId: z.string().optional(),
    notes: z.string().trim().max(1000).optional(),
}).strict()

type Params = Promise<{ id: string; entryId: string }>

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

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id })
            .populate('categoryId', 'name color type')
            .populate('spaceCategoryId', 'name color type isArchived')
            .lean<ISpaceEntry | null>()
        if (!entry) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

        const [laterSettlements, allLinkedImpacts, currentUserReviewImpact, personalImpacts] = await Promise.all([
            SpaceEntry.countDocuments({
                spaceId: id,
                type: 'settlement',
                isVoided: { $ne: true },
                status: { $ne: 'rejected' },
                createdAt: { $gt: entry.createdAt },
            }),
            SpaceEntryPersonalImpact.find({
                entryId,
                status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
            }).lean(),
            SpaceEntryPersonalImpact.findOne({
                entryId,
                userId: new Types.ObjectId(session.user.id),
                status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
            }).lean(),
            getPersonalImpactForEntries(id, session.user.id, [entryId]),
        ])
        const currentUserHasLinkedImpact = Boolean(personalImpacts[entryId]?.linkedImpact)
        return NextResponse.json({
            entry,
            hasLinkedTransaction: currentUserHasLinkedImpact,
            hasSubsequentSettlement: laterSettlements > 0,
            linkedImpactsCount: allLinkedImpacts.length,
            affectedUsersCount: allLinkedImpacts.length,
            currentUserHasLinkedImpact,
            currentUserNeedsReview: Boolean(currentUserReviewImpact),
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo obtener el movimiento.')
    }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }
        const body: unknown = await request.json()
        await connectDB()
        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }, { contractVersion: 1 })
            .lean<{ contractVersion?: number } | null>()
        if (!entry) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        if (entry.contractVersion !== 2) {
            throw new ServiceError(409, 'SPACE_LEGACY_WRITE_RETIRED', 'Este movimiento requiere migración antes de editarse.')
        }

        const parsed = spaceEntryEditV2Schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({
                error: 'Datos de movimiento inválidos',
                code: 'SPACE_ENTRY_INVALID',
                failureState: 'not_started',
                retryable: false,
                details: parsed.error.flatten(),
            }, { status: 400 })
        }
        const execution = await editSpaceEntryV2({
            actorUserId: session.user.id,
            spaceId: id,
            entryId,
            idempotencyKey: requireIdempotencyKey(request),
            ...parsed.data,
        })
        return NextResponse.json(toSpaceMutationResult(execution))
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo editar el movimiento.')
    }
}
