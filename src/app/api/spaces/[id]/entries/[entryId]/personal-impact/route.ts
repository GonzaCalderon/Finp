import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import {
    createPersonalImpactFromSpaceEntry,
    getPersonalImpactForEntries,
    resolveCurrentUserEntryShare,
} from '@/lib/server/space-personal-impact'
import { resolveNotificationsForTarget } from '@/lib/server/notifications'
import { NOTIFICATION_ACTION_STATUSES, SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spacePersonalImpactSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'

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

        const entryImpact = impacts[entryId]
        return NextResponse.json({
            impact: entryImpact?.linkedImpact ?? null,
            pendingActions: entryImpact?.pendingActions ?? [],
            suggestion: suggestion
                ? {
                    amount: suggestion.amount,
                    currency: entry.currency,
                    impactKind: suggestion.impactKind,
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

        // Remover impacto: cubre tanto LINKED como NEEDS_REVIEW
        // El badge "En tu Finp" desaparece; la transacción personal NO se elimina
        const removed = await SpaceEntryPersonalImpact.findOneAndUpdate(
            {
                spaceId: id,
                entryId,
                userId: session.user.id,
                status: { $in: [SPACE_PERSONAL_IMPACT_STATUSES.LINKED, SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW] },
            },
            {
                $set: {
                    status: SPACE_PERSONAL_IMPACT_STATUSES.REMOVED,
                    removedAt: new Date(),
                    reviewedAt: new Date(),
                    reviewedResolution: 'removed',
                },
                $unset: { transactionId: 1, accountId: 1 },
            },
            { new: false }
        ).lean<ISpaceEntryPersonalImpact | null>()

        if (removed) {
            await resolveNotificationsForTarget({
                personalImpactId: removed._id.toString(),
                actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
            })
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al desvincular impacto personal:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
