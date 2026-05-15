import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { syncSpaceDebtsForActiveParticipants } from '@/lib/server/debt-sync'
import { getPersonalImpactForEntries, markLinkedImpactsAsNeedsReview } from '@/lib/server/space-personal-impact'
import { resolveNotificationsForTarget, buildReviewNotification, safeUpsertNotificationByDedupeKey } from '@/lib/server/notifications'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'
import { spaceEntryVoidSchema } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry } from '@/types'

type Params = Promise<{ id: string; entryId: string }>

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
        const parsed = spaceEntryVoidSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
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

        if (entry.isVoided) {
            return NextResponse.json({ error: 'El movimiento ya está anulado' }, { status: 409 })
        }

        // Verificar permisos: creador, owner o admin
        const currentParticipant = context.currentParticipant
        const isCreator = extractId(entry.createdByUserId) === session.user.id
        const isPrivileged = currentParticipant?.role === 'owner' || currentParticipant?.role === 'admin'

        if (!isCreator && !isPrivileged) {
            return NextResponse.json({ error: 'No tenés permiso para anular este movimiento' }, { status: 403 })
        }

        // Detectar settlements posteriores (conservador: por createdAt)
        const laterSettlements = await SpaceEntry.countDocuments({
            spaceId: id,
            type: 'settlement',
            isVoided: { $ne: true },
            status: { $nin: ['rejected', 'pending_confirmation'] },
            createdAt: { $gt: entry.createdAt },
        })
        const hasSubsequentSettlement = laterSettlements > 0
        const personalImpactsByEntryId = await getPersonalImpactForEntries(
            id,
            session.user.id,
            [entryId],
            [entry],
            context.participants
        )
        const hasPersonalImpact = Boolean(personalImpactsByEntryId[entryId]?.linkedImpact)

        // Pre-query linked impacts for all users before voiding (to notify them after)
        const linkedImpactsBeforeVoid = await SpaceEntryPersonalImpact.find({
            entryId,
            status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
        }).lean()

        const voidedEntry = await SpaceEntry.findByIdAndUpdate(
            entryId,
            {
                $set: {
                    isVoided: true,
                    voidedAt: new Date(),
                    voidedByUserId: new Types.ObjectId(session.user.id),
                    ...(parsed.data.voidReason ? { voidReason: parsed.data.voidReason } : {}),
                },
            },
            { new: true }
        )
            .populate('categoryId', 'name color type')
            .populate('spaceCategoryId', 'name color type isArchived')
            .lean<ISpaceEntry | null>()

        if (voidedEntry) {
            createSpaceActivityEvent({
                spaceId: id,
                actorUserId: session.user.id,
                actorParticipantId: extractId(context.currentParticipant?._id),
                type: 'entry_voided',
                entityType: 'entry',
                entityId: extractId(voidedEntry._id),
                title: `${context.currentParticipant?.displayName ?? session.user.name ?? 'Un participante'} anuló ${voidedEntry.title}`,
                description: 'El movimiento ya no impacta en el balance.',
                metadata: {
                    entryTitle: voidedEntry.title,
                    amount: voidedEntry.amount,
                    currency: voidedEntry.currency,
                    voidReason: parsed.data.voidReason,
                    hasLinkedTransaction: hasPersonalImpact,
                    hasSubsequentSettlement,
                },
            }).catch((err) => console.error('[space-activity]', err))
        }

        // Cancelar pendientes del entry anulado (sistema, no usuario)
        try {
            await SpaceEntryPersonalImpact.updateMany(
                { entryId, status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING },
                { $set: { status: SPACE_PERSONAL_IMPACT_STATUSES.CANCELLED, resolvedAt: new Date() } }
            )
        } catch (err) {
            console.error('[personal-sync] void cancel pending:', err)
        }

        // Resolver notificaciones pendientes del entry anulado (para todos los usuarios)
        resolveNotificationsForTarget({
            spaceEntryId: entryId,
            actionStatus: 'cancelled',
        }).catch((err) => console.error('[notifications] resolve on void:', err))

        // Marcar impactos LINKED como needs_review y notificar a los usuarios afectados
        try {
            const affectedImpacts = await markLinkedImpactsAsNeedsReview(entryId, 'entry_voided')
            const spaceId = id
            const entryTitle = voidedEntry?.title ?? entry.title

            await Promise.allSettled(
                affectedImpacts.map((impact) => {
                    const userId = impact.userId.toString()
                    return safeUpsertNotificationByDedupeKey(
                        buildReviewNotification({
                            recipientUserId: userId,
                            actorUserId: session.user.id,
                            entryId,
                            spaceId,
                            entryTitle,
                            reason: 'entry_voided',
                            impactId: impact._id.toString(),
                        })
                    )
                })
            )
        } catch (err) {
            console.error('[personal-sync] void review notifications:', err)
        }

        try {
            await syncSpaceDebtsForActiveParticipants(id)
        } catch (err) {
            console.error('[debt-sync] entries void:', err)
        }

        return NextResponse.json({
            entry: voidedEntry,
            hasLinkedTransaction: hasPersonalImpact,
            hasSubsequentSettlement,
            affectedUsersCount: linkedImpactsBeforeVoid.length,
        })
    } catch (error) {
        console.error('Error al anular movimiento:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
