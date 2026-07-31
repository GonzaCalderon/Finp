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
import {
    safeUpsertNotificationByDedupeKey,
    buildNotificationFromPendingAction,
    resolveNotificationsForTarget,
} from './notifications'
import { buildEntryShares, extractId, roundAmount } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceParticipant } from '@/types'

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
 * Quiénes tienen que decidir si registran este movimiento en su Finp.
 *
 * Es la misma regla al crear y al editar a propósito: si cada superficie la
 * calculara por su cuenta, una edición podría crear pendientes que el alta nunca
 * habría creado, o dejar afuera a alguien que sí corresponde.
 */
export function buildEntryPendingTargets(params: {
    entry: ISpaceEntry
    participants: ISpaceParticipant[]
    /** Usuario que ejecuta la acción. */
    actorUserId?: string
    /** El actor ya resolvió su impacto: no necesita un pendiente. */
    actorAlreadyLinked?: boolean
}): PendingActionTarget[] {
    const { entry, participants, actorUserId, actorAlreadyLinked = false } = params
    const targets: PendingActionTarget[] = []

    const skipActor = (userId: string) =>
        Boolean(actorAlreadyLinked && actorUserId && userId === actorUserId)

    const findParticipant = (participantId: unknown) =>
        participants.find((participant) => extractId(participant._id) === extractId(participantId))

    const payer = findParticipant(entry.paidByParticipantId)
    const payerUserId = extractId(payer?.userId)

    if (entry.type === 'settlement') {
        if (payer && payerUserId && !skipActor(payerUserId)) {
            const firstReceiverId = extractId(entry.sharedWithParticipantIds?.[0])
            const firstReceiver = firstReceiverId ? findParticipant(firstReceiverId) : undefined
            targets.push({
                userId: payerUserId,
                participantId: extractId(payer._id) ?? '',
                impactKind: 'settlement_paid',
                actionType: 'impact_space_payment',
                amount: roundAmount(entry.amount),
                currency: entry.currency,
                counterpartyParticipantId: firstReceiverId,
                counterpartyNameSnapshot: firstReceiver?.displayName,
            })
        }

        for (const sharedId of entry.sharedWithParticipantIds ?? []) {
            const shared = findParticipant(sharedId)
            const sharedUserId = extractId(shared?.userId)
            if (!shared || !sharedUserId || skipActor(sharedUserId)) continue
            targets.push({
                userId: sharedUserId,
                participantId: extractId(shared._id) ?? '',
                impactKind: 'settlement_received',
                actionType: 'impact_space_collect',
                amount: roundAmount(entry.amount),
                currency: entry.currency,
                counterpartyParticipantId: extractId(entry.paidByParticipantId),
                counterpartyNameSnapshot: payer?.displayName,
            })
        }

        return targets
    }

    const shares = buildEntryShares(entry, participants)

    if (payer && payerUserId && !skipActor(payerUserId)) {
        const payerShare = shares.find(
            (share) => share.participantId === extractId(payer._id)
        )
        targets.push({
            userId: payerUserId,
            participantId: extractId(payer._id) ?? '',
            impactKind: 'payer_full_amount',
            actionType: 'impact_space_expense',
            // El pagador pone el total en su cuenta, pero sólo su parte es gasto
            // operacional propio.
            amount: roundAmount(payerShare?.amount ?? entry.amount),
            currency: entry.currency,
            accountImpactAmount: roundAmount(entry.amount),
            operationalAmount: payerShare ? roundAmount(payerShare.amount) : undefined,
        })
    }

    for (const sharedId of entry.sharedWithParticipantIds ?? []) {
        const shared = findParticipant(sharedId)
        const sharedUserId = extractId(shared?.userId)
        if (!shared || !sharedUserId) continue
        if (extractId(shared._id) === extractId(payer?._id)) continue
        if (skipActor(sharedUserId)) continue
        const share = shares.find((item) => item.participantId === extractId(shared._id))
        if (!share) continue
        targets.push({
            userId: sharedUserId,
            participantId: extractId(shared._id) ?? '',
            impactKind: 'participant_share',
            actionType: 'impact_space_expense',
            amount: roundAmount(share.amount),
            currency: entry.currency,
            counterpartyParticipantId: extractId(payer?._id),
            counterpartyNameSnapshot: payer?.displayName,
        })
    }

    return targets
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

            // Obtener o crear el pending — idempotente
            let pendingId: string
            const existingPending = await SpaceEntryPersonalImpact.findOne({
                userId: userObjId,
                entryId: entryObjId,
                actionType: target.actionType,
                status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
            }).lean()

            if (existingPending) {
                pendingId = existingPending._id.toString()
            } else {
                const created = await SpaceEntryPersonalImpact.create({
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
                pendingId = created._id.toString()
            }

            const notificationTarget: PendingActionTarget = {
                userId: target.userId,
                participantId: target.participantId,
                impactKind: target.impactKind,
                actionType: target.actionType,
                amount: target.amount,
                currency: target.currency,
                ...(target.accountImpactAmount !== undefined && {
                    accountImpactAmount: target.accountImpactAmount,
                }),
                ...(target.operationalAmount !== undefined && {
                    operationalAmount: target.operationalAmount,
                }),
                ...(target.counterpartyParticipantId && {
                    counterpartyParticipantId: target.counterpartyParticipantId,
                }),
                ...(target.counterpartyNameSnapshot && {
                    counterpartyNameSnapshot: target.counterpartyNameSnapshot,
                }),
            }

            // Siempre upsert la notificación — idempotente por dedupeKey
            await safeUpsertNotificationByDedupeKey(
                buildNotificationFromPendingAction(notificationTarget, event, pendingId)
            )
        })
    )
}

export interface PendingActionsSyncResult {
    created: number
    updated: number
    cancelled: number
}

/** Un pendiente vive por (usuario, movimiento, tipo de acción). */
function pendingKey(userId: string, actionType: string) {
    return `${userId}:${actionType}`
}

function samePendingAmounts(
    pending: {
        amount?: number
        currency?: string
        impactKind?: string
        accountImpactAmount?: number
        operationalAmount?: number
    },
    target: PendingActionTarget
) {
    return (
        pending.amount === target.amount &&
        pending.currency === target.currency &&
        pending.impactKind === target.impactKind &&
        (pending.accountImpactAmount ?? null) === (target.accountImpactAmount ?? null) &&
        (pending.operationalAmount ?? null) === (target.operationalAmount ?? null)
    )
}

/**
 * Reconcilia los pendientes de un movimiento que cambió su reparto.
 *
 * Regla explícita, en tres casos:
 *
 * 1. **Sigue participando con otro monto**: se actualiza el pendiente existente y
 *    se refresca su notificación. No se cancela y se recrea porque la identidad
 *    del pendiente es (usuario, movimiento, tipo) y el usuario todavía tiene la
 *    misma decisión por tomar, sólo con otras cifras. Un pendiente no es historia
 *    financiera: nada se reescribe, porque todavía no se registró nada.
 * 2. **Ya no participa**: se cancela el pendiente y se resuelve su notificación,
 *    igual que al anular el movimiento. Dejarlo vivo pediría registrar un gasto
 *    que ya no le corresponde.
 * 3. **Se agregó al reparto**: recibe un pendiente nuevo con la misma regla del
 *    alta, y sin duplicar si ya tenía uno.
 *
 * Quien ya registró su impacto (`linked`) no se toca acá: ese camino es
 * `markLinkedImpactsAsNeedsReview`, porque sí hay historia que revisar.
 */
export async function syncPendingActionsForEntryChange(
    event: PersonalSyncEvent
): Promise<PendingActionsSyncResult> {
    const result: PendingActionsSyncResult = { created: 0, updated: 0, cancelled: 0 }
    const entryObjId = new Types.ObjectId(event.entryId)

    const currentPendings = await SpaceEntryPersonalImpact.find({
        entryId: entryObjId,
        status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
    }).lean<Array<{
        _id: Types.ObjectId
        userId: Types.ObjectId
        actionType?: string
        amount?: number
        currency?: string
        impactKind?: string
        accountImpactAmount?: number
        operationalAmount?: number
    }>>()

    const pendingTargetByKey = new Map(
        event.pendingTargets.map((target) => [pendingKey(target.userId, target.actionType), target])
    )

    await Promise.allSettled(
        currentPendings.map(async (pending) => {
            const key = pendingKey(pending.userId.toString(), pending.actionType ?? '')
            const target = pendingTargetByKey.get(key)

            if (!target) {
                await SpaceEntryPersonalImpact.updateOne(
                    { _id: pending._id },
                    {
                        $set: {
                            status: SPACE_PERSONAL_IMPACT_STATUSES.CANCELLED,
                            resolvedAt: new Date(),
                        },
                    }
                )
                await resolveNotificationsForTarget({
                    recipientUserId: pending.userId.toString(),
                    pendingActionId: pending._id.toString(),
                    actionStatus: 'cancelled',
                })
                result.cancelled += 1
                return
            }

            // Atendido: lo que quede en el mapa son participantes nuevos.
            pendingTargetByKey.delete(key)

            if (samePendingAmounts(pending, target)) return

            await SpaceEntryPersonalImpact.updateOne(
                { _id: pending._id },
                {
                    $set: {
                        impactKind: target.impactKind,
                        amount: target.amount,
                        currency: target.currency,
                        ...(target.accountImpactAmount !== undefined && {
                            accountImpactAmount: target.accountImpactAmount,
                        }),
                        ...(target.operationalAmount !== undefined && {
                            operationalAmount: target.operationalAmount,
                        }),
                        ...(target.counterpartyNameSnapshot && {
                            counterpartyNameSnapshot: target.counterpartyNameSnapshot,
                        }),
                    },
                    ...(target.accountImpactAmount === undefined ||
                    target.operationalAmount === undefined
                        ? {
                            $unset: {
                                ...(target.accountImpactAmount === undefined && {
                                    accountImpactAmount: '',
                                }),
                                ...(target.operationalAmount === undefined && {
                                    operationalAmount: '',
                                }),
                            },
                        }
                        : {}),
                }
            )

            // El aviso vuelve a estado pendiente: las cifras que anunciaba cambiaron.
            await safeUpsertNotificationByDedupeKey(
                buildNotificationFromPendingAction(target, event, pending._id.toString())
            )
            result.updated += 1
        })
    )

    const newTargets = Array.from(pendingTargetByKey.values())
    if (newTargets.length > 0) {
        await createPersonalPendingActions({ ...event, pendingTargets: newTargets })
        result.created = newTargets.length
    }

    return result
}

/**
 * Emite un evento de sincronización personal: crea pendientes y notificaciones
 * de forma idempotente para cada target involucrado.
 */
export async function emitPersonalSyncEvent(event: PersonalSyncEvent): Promise<void> {
    try {
        await createPersonalPendingActions(event)
        console.log(
            `[personal-sync] ${event.sourceType} | space=${event.spaceId} | entry=${event.entryId} | targets=${event.pendingTargets.length}`
        )
    } catch (err) {
        console.error('[personal-sync] Error al emitir evento:', err)
    }
}
