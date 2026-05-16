import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import { resolveNotificationsForTarget } from '@/lib/server/notifications'
import { NOTIFICATION_ACTION_STATUSES, SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { resolveCurrentUserEntryShare } from '@/lib/server/space-personal-impact'
import { buildEntryShares, extractId, roundAmount } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'

type Params = Promise<{ id: string; entryId: string }>

export async function POST(_request: Request, { params }: { params: Params }) {
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

        if (entry.isVoided) {
            return NextResponse.json({ error: 'El movimiento está anulado, no se puede sincronizar.' }, { status: 409 })
        }

        const impact = await SpaceEntryPersonalImpact.findOne({
            spaceId: id,
            entryId,
            userId: session.user.id,
            status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
        }).lean<ISpaceEntryPersonalImpact | null>()

        if (!impact) {
            return NextResponse.json({ error: 'No hay impacto pendiente de revisión' }, { status: 404 })
        }

        if (!impact.transactionId) {
            return NextResponse.json({ error: 'El impacto no tiene transacción vinculada' }, { status: 409 })
        }

        // Recalculate the user's share from the current (updated) entry
        const share = resolveCurrentUserEntryShare(entry, context.participants, session.user.id)
        if (!share) {
            return NextResponse.json({ error: 'No se pudo calcular tu participación en este movimiento' }, { status: 400 })
        }

        const newAmount = roundAmount(share.amount)

        // Calculate operationalAmount for payer case
        let operationalAmount: number | undefined
        if (share.impactKind === 'payer_full_amount') {
            const currentParticipantId = extractId(share.participant._id)
            const payerShare = currentParticipantId
                ? buildEntryShares(entry, context.participants).find(
                    (s) => s.participantId === currentParticipantId
                )
                : undefined
            if (payerShare && payerShare.amount < newAmount) {
                operationalAmount = roundAmount(payerShare.amount)
            }
        }

        // Update the personal transaction
        const txUpdate: Record<string, unknown> = {
            amount: newAmount,
            currency: entry.currency,
            date: entry.date,
            description: entry.title,
        }
        if (operationalAmount !== undefined) {
            txUpdate.operationalAmount = operationalAmount
        }

        await Transaction.updateOne(
            { _id: impact.transactionId, userId: session.user.id },
            { $set: txUpdate }
        )

        // Transition impact: needs_review → linked
        await SpaceEntryPersonalImpact.updateOne(
            { _id: impact._id },
            {
                $set: {
                    status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                    amount: newAmount,
                    reviewedAt: new Date(),
                    reviewedResolution: 'kept',
                },
            }
        )

        await resolveNotificationsForTarget({
            personalImpactId: impact._id.toString(),
            actionStatus: NOTIFICATION_ACTION_STATUSES.COMPLETED,
        })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al sincronizar impacto personal:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
