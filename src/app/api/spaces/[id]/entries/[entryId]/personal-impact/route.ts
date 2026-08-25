import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import {
    createPersonalImpactFromSpaceEntry,
    getPersonalImpactForEntries,
    resolveCurrentUserEntryShare,
} from '@/lib/server/space-personal-impact'
import { resolveSuggestedPersonalCategory } from '@/lib/server/space-personal-settings'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spacePersonalImpactSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'
import {
    deleteAuthorizedPersonalTransactions,
    removePersonalImpactWithoutTransaction,
} from '@/lib/server/transaction-teardown'
import { isServiceError } from '@/lib/server/errors'
import {
    requireIdempotencyKey,
    spaceApiErrorResponse,
    toSpaceMutationResult,
} from '@/lib/server/space-api-contract'
import { resolveSpacePersonalImpactV2 } from '@/lib/server/space-personal-impact-service-v2'
import { enterLegacySpaceWriteFacade } from '@/lib/server/space-legacy-write-facade'

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

export async function GET(_request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }).lean<ISpaceEntry | null>()
        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        const impacts = await getPersonalImpactForEntries(
            id,
            session.user.id,
            [entryId],
            [entry],
            context.participants
        )
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
            pendingActions: entryImpact?.pendingActions ?? [],
            suggestion: suggestion
                ? {
                    amount: suggestion.amount,
                    currency: entry.currency,
                    impactKind: suggestion.impactKind,
                    categoryId: categorySuggestion?.categoryId,
                    categoryStrategy: categorySuggestion?.strategy,
                }
                : null,
        })
    } catch (error) {
        console.error('Error al obtener impacto personal:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params
        if (!Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        const body: unknown = await request.json()
        await connectDB()
        const entryContract = await SpaceEntry.findOne(
            { _id: entryId, spaceId: id },
            { contractVersion: 1 }
        ).lean<{ contractVersion?: number } | null>()
        if (!entryContract) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        if (entryContract.contractVersion === 2) {
            const parsedV2 = personalImpactDecisionV2Schema.safeParse(body)
            if (!parsedV2.success) {
                return NextResponse.json({
                    error: 'La decisión personal no es válida.',
                    code: 'SPACE_PERSONAL_IMPACT_DECISION_INVALID',
                    failureState: 'not_started',
                    retryable: false,
                    details: parsedV2.error.flatten(),
                }, { status: 400 })
            }
            const execution = await resolveSpacePersonalImpactV2({
                actorUserId: session.user.id,
                spaceId: id,
                entryId,
                impactId: parsedV2.data.impactId,
                expectedRevision: parsedV2.data.expectedRevision,
                idempotencyKey: requireIdempotencyKey(request),
                decision: parsedV2.data.decision,
            })
            return NextResponse.json(toSpaceMutationResult(execution), { status: 201 })
        }
        enterLegacySpaceWriteFacade(entryContract)
        const parsed = spacePersonalImpactSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de impacto personal invalidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context || !context.currentParticipant) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const entry = await SpaceEntry.findOne({ _id: entryId, spaceId: id }).lean<ISpaceEntry | null>()
        if (!entry) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }

        if (entry.isVoided) {
            return NextResponse.json({ error: 'Este movimiento esta anulado.' }, { status: 409 })
        }

        try {
            const impact = await createPersonalImpactFromSpaceEntry({
                spaceId: id,
                entry,
                participants: context.participants,
                userId: session.user.id,
                participantId: extractId(context.currentParticipant._id) ?? '',
                mode: parsed.data.mode,
                accountId: parsed.data.accountId,
                categoryId: parsed.data.categoryId,
                linkedTransactionId: parsed.data.linkedTransactionId,
                impactKind: parsed.data.impactKind,
                amount: parsed.data.amount,
                spaceNameSnapshot: context.space.name,
                space: context.space,
                currentParticipant: context.currentParticipant,
            })

            return NextResponse.json({ impact }, { status: 201 })
        } catch (error) {
            if (error instanceof Error && error.name === 'DuplicatePersonalImpactError') {
                return NextResponse.json({ error: error.message }, { status: 409 })
            }

            if (isServiceError(error)) {
                return NextResponse.json(
                    { error: error.message, code: error.code },
                    { status: error.status }
                )
            }

            return NextResponse.json(
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'No se pudo registrar el impacto personal.',
                },
                { status: 400 }
            )
        }
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo resolver el impacto personal.')
    }
}

export async function DELETE(request: Request, { params }: { params: Params }) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, entryId } = await params
        const transactionId = new URL(request.url).searchParams.get('transactionId')?.trim()
        if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(entryId)) {
            return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })
        }
        if (transactionId && !Types.ObjectId.isValid(transactionId)) {
            return NextResponse.json(
                {
                    error: 'La transacción seleccionada no es válida.',
                    code: 'INVALID_TRANSACTION_ID',
                },
                { status: 400 }
            )
        }
        await connectDB()

        const v2Impact = await SpaceEntryPersonalImpact.findOne({
            spaceId: id,
            entryId,
            userId: session.user.id,
            contractVersion: 2,
            status: { $in: [SPACE_PERSONAL_IMPACT_STATUSES.LINKED, SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW] },
        }).lean<ISpaceEntryPersonalImpact | null>()
        if (v2Impact?.contractVersion === 2) {
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
            const execution = await resolveSpacePersonalImpactV2({
                actorUserId: session.user.id,
                spaceId: id,
                entryId,
                impactId: v2Impact._id.toString(),
                expectedRevision,
                idempotencyKey: requireIdempotencyKey(request),
                decision: { type: 'remove_transaction' },
            })
            return NextResponse.json(toSpaceMutationResult(execution))
        }
        if (!transactionId || !Types.ObjectId.isValid(transactionId)) {
            return NextResponse.json(
                {
                    error: 'La transacción seleccionada no es válida.',
                    code: 'INVALID_TRANSACTION_ID',
                },
                { status: 400 }
            )
        }

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const impact = await SpaceEntryPersonalImpact.findOne(
            {
                spaceId: id,
                entryId,
                userId: session.user.id,
                status: { $in: [SPACE_PERSONAL_IMPACT_STATUSES.LINKED, SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW] },
            }
        ).lean<ISpaceEntryPersonalImpact | null>()

        if (!impact) {
            const deletion = await deleteAuthorizedPersonalTransactions(
                session.user.id,
                [{ transactionId, spaceId: id, spaceEntryId: entryId }]
            )
            const deletedTransaction = deletion.deletedTransactions.length === 1

            return NextResponse.json({
                ok: true,
                deletedTransaction,
                orphanTransactionDeleted: deletedTransaction,
            })
        }

        const linkedTransactionId = extractId(impact.transactionId)
        if (linkedTransactionId && linkedTransactionId !== transactionId) {
            return NextResponse.json(
                {
                    error: 'La transacción seleccionada no coincide con este impacto personal.',
                    code: 'PERSONAL_IMPACT_TRANSACTION_MISMATCH',
                },
                { status: 409 }
            )
        }

        const deletion = linkedTransactionId
            ? await deleteAuthorizedPersonalTransactions(
                session.user.id,
                [{ transactionId, spaceId: id, spaceEntryId: entryId }]
            )
            : { deletedTransactions: [] }
        const deletedTransaction = deletion.deletedTransactions.length === 1

        // Si el impacto sobrevivió a una eliminación anterior, se cierra sin
        // inferir otra transacción. La operación sigue siendo idempotente.
        if (!deletedTransaction) {
            await removePersonalImpactWithoutTransaction(
                session.user.id,
                impact._id.toString()
            )
        }

        return NextResponse.json({
            ok: true,
            deletedTransaction,
            orphanTransactionDeleted: false,
        })
    } catch (error) {
        return spaceApiErrorResponse(error, 'No se pudo desvincular el impacto personal.')
    }
}
