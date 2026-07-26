import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import {
    createPersonalImpactFromSpaceEntry,
    getPersonalImpactForEntries,
    resolveCurrentUserEntryShare,
} from '@/lib/server/space-personal-impact'
import { resolveSuggestedPersonalCategory } from '@/lib/server/space-personal-settings'
import { resolveNotificationsForTarget } from '@/lib/server/notifications'
import { NOTIFICATION_ACTION_STATUSES, SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spacePersonalImpactSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'
import { unlinkTransactionDependents } from '@/lib/server/transaction-teardown'

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

        const body = await request.json()
        const parsed = spacePersonalImpactSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de impacto personal invalidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

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
        console.error('Error al crear impacto personal:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
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

        const impact = await SpaceEntryPersonalImpact.findOne(
            {
                spaceId: id,
                entryId,
                userId: session.user.id,
                status: { $in: [SPACE_PERSONAL_IMPACT_STATUSES.LINKED, SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW] },
            }
        ).lean<ISpaceEntryPersonalImpact | null>()

        if (!impact) {
            return NextResponse.json({ ok: true, deletedTransaction: false })
        }

        let deletedTransaction = false
        if (impact.transactionId) {
            const transaction = await Transaction.findOneAndDelete({
                _id: impact.transactionId,
                userId: session.user.id,
            })

            if (transaction) {
                deletedTransaction = true
                // El teardown es la única regla que marca el impacto como REMOVED,
                // suelta sus referencias y cancela dependencias de la transacción.
                await unlinkTransactionDependents(session.user.id, transaction)
            }
        }

        // Compatibilidad con impactos cuyo movimiento ya no existe: quitar sigue
        // siendo idempotente y deja el estado personal cerrado.
        if (!deletedTransaction) {
            await SpaceEntryPersonalImpact.updateOne(
                { _id: impact._id, userId: session.user.id },
                {
                    $set: {
                        status: SPACE_PERSONAL_IMPACT_STATUSES.REMOVED,
                        removedAt: new Date(),
                        reviewedAt: new Date(),
                        reviewedResolution: 'removed',
                    },
                    $unset: { transactionId: 1, accountId: 1 },
                }
            )
        }

        if (impact) {
            await resolveNotificationsForTarget({
                personalImpactId: impact._id.toString(),
                actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
            })
        }

        return NextResponse.json({ ok: true, deletedTransaction })
    } catch (error) {
        console.error('Error al desvincular impacto personal:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
