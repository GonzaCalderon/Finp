import { Types } from 'mongoose'
import { SpaceEntryPersonalImpact } from '@/lib/models'
import {
    SPACE_PERSONAL_IMPACT_STATUSES,
} from '@/lib/constants'
import type {
    SpacePersonalImpactKind,
    SpacePersonalPendingActionType,
    SpacePersonalImpactSourceType,
} from '@/lib/constants'

export interface PendingActionTarget {
    userId: string
    participantId: string
    impactKind: SpacePersonalImpactKind
    actionType: SpacePersonalPendingActionType
    amount: number
    currency: string
    accountImpactAmount?: number
    operationalAmount?: number
    counterpartyParticipantId?: string
    counterpartyNameSnapshot?: string
}

export interface PersonalSyncEvent {
    actorUserId: string
    spaceId: string
    entryId: string
    sourceType: SpacePersonalImpactSourceType
    debtId?: string
    debtMovementId?: string
    pendingTargets: PendingActionTarget[]
}

/**
 * Crea pendientes accionables de forma idempotente para los usuarios involucrados
 * en un movimiento de espacio. No lanza si falla un usuario individual.
 */
async function createPersonalPendingActions(event: PersonalSyncEvent): Promise<void> {
    const { spaceId, entryId, actorUserId, sourceType, debtId, debtMovementId, pendingTargets } = event

    if (pendingTargets.length === 0) return

    const entryObjId = new Types.ObjectId(entryId)

    await Promise.allSettled(
        pendingTargets.map(async (target) => {
            const userObjId = new Types.ObjectId(target.userId)

            // Skip si ya existe un linked vigente para (userId, entryId)
            const existingLinked = await SpaceEntryPersonalImpact.findOne({
                userId: userObjId,
                entryId: entryObjId,
                status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
            }).lean()
            if (existingLinked) return

            // Skip si ya existe un pending para (userId, entryId, actionType) — idempotente
            const existingPending = await SpaceEntryPersonalImpact.findOne({
                userId: userObjId,
                entryId: entryObjId,
                actionType: target.actionType,
                status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
            }).lean()
            if (existingPending) return

            await SpaceEntryPersonalImpact.create({
                spaceId: new Types.ObjectId(spaceId),
                entryId: entryObjId,
                userId: userObjId,
                participantId: new Types.ObjectId(target.participantId),
                impactKind: target.impactKind,
                amount: target.amount,
                currency: target.currency,
                status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
                actionType: target.actionType,
                sourceType,
                actorUserId: new Types.ObjectId(actorUserId),
                ...(target.counterpartyParticipantId && {
                    counterpartyParticipantId: new Types.ObjectId(target.counterpartyParticipantId),
                }),
                ...(target.counterpartyNameSnapshot && {
                    counterpartyNameSnapshot: target.counterpartyNameSnapshot,
                }),
                ...(debtId && { debtId: new Types.ObjectId(debtId) }),
                ...(debtMovementId && { debtMovementId: new Types.ObjectId(debtMovementId) }),
                ...(target.accountImpactAmount !== undefined && {
                    accountImpactAmount: target.accountImpactAmount,
                }),
                ...(target.operationalAmount !== undefined && {
                    operationalAmount: target.operationalAmount,
                }),
            })
        })
    )
}

/**
 * Emite un evento de sincronización personal: crea pendientes y deja un hook
 * para que Fase 6F.2 enganche la creación de Notification records.
 */
export async function emitPersonalSyncEvent(event: PersonalSyncEvent): Promise<void> {
    try {
        await createPersonalPendingActions(event)
        console.log(
            `[personal-sync] ${event.sourceType} | space=${event.spaceId} | entry=${event.entryId} | targets=${event.pendingTargets.length}`
        )
        // Fase 6F.2: aquí se creará el Notification record para cada target
    } catch (err) {
        console.error('[personal-sync] Error al emitir evento:', err)
    }
}
