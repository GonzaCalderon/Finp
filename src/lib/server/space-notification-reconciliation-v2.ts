import { Types } from 'mongoose'

import { Notification, SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import {
    buildReviewNotification,
    buildNotificationFromPendingAction,
    resolveNotificationsForTarget,
    upsertNotificationByDedupeKey,
} from '@/lib/server/notifications'
import type { ISpaceEntryPersonalImpact } from '@/types'
import { extractId } from '@/lib/utils/spaces'

export interface SpaceNotificationReconciliationV2Result {
    inspected: number
    reconciled: number
    failures: Array<{ pendingActionId: string; errorName: string }>
}

function pendingDedupeKey(impact: ISpaceEntryPersonalImpact) {
    return `pending-action:${impact.userId.toString()}:${impact.entryId.toString()}:${impact.actionType}`
}

/**
 * Reconstruye presentación desde pendientes persistidos. Un fallo se devuelve
 * como evidencia reintentable y nunca repite la operación financiera origen.
 */
export async function reconcileSpacePendingNotificationsV2(input: {
    pendingActionIds?: string[]
    limit?: number
} = {}): Promise<SpaceNotificationReconciliationV2Result> {
    const ids = (input.pendingActionIds ?? [])
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id))
    const filter: Record<string, unknown> = {
        contractVersion: 2,
    }
    if (input.pendingActionIds) filter._id = { $in: ids }

    const pending = await SpaceEntryPersonalImpact.find(filter)
        .sort({ createdAt: 1 })
        .limit(Math.min(Math.max(input.limit ?? 100, 1), 500))
        .lean<ISpaceEntryPersonalImpact[]>()
    const result: SpaceNotificationReconciliationV2Result = {
        inspected: pending.length,
        reconciled: 0,
        failures: [],
    }

    for (const impact of pending) {
        const pendingActionId = extractId(impact._id)
        const actorUserId = extractId(impact.actorUserId)
        const spaceId = extractId(impact.spaceId)
        const entryId = extractId(impact.entryId)
        if (!pendingActionId || !spaceId || !entryId) {
            result.failures.push({ pendingActionId: pendingActionId ?? 'invalid', errorName: 'InvalidPendingAction' })
            continue
        }
        try {
            if (impact.status === 'needs_review') {
                if (!actorUserId) throw new Error('InvalidReviewImpactActor')
                const entry = await SpaceEntry.findOne({ _id: entryId, spaceId }).select('title').lean<{ title: string } | null>()
                if (!entry || !impact.reviewReason) throw new Error('InvalidReviewImpact')
                await upsertNotificationByDedupeKey(buildReviewNotification({
                    recipientUserId: impact.userId.toString(),
                    actorUserId,
                    entryId,
                    spaceId,
                    entryTitle: entry.title,
                    reason: impact.reviewReason,
                    impactId: pendingActionId,
                    changedFields: impact.reviewChangedFields,
                    transactionId: extractId(impact.transactionId),
                }))
            } else if (impact.status === 'pending') {
                if (!actorUserId || !impact.actionType) throw new Error('InvalidPendingAction')
                await upsertNotificationByDedupeKey(buildNotificationFromPendingAction({
                    userId: impact.userId.toString(),
                    actionType: impact.actionType,
                    amount: impact.impactKind === 'advance'
                        ? impact.accountImpactAmount ?? impact.amount
                        : impact.ownShareAmount ?? impact.amount,
                    currency: impact.currency,
                    counterpartyNameSnapshot: impact.counterpartyNameSnapshot,
                }, {
                    actorUserId,
                    spaceId,
                    entryId,
                    sourceType: impact.sourceType ?? 'space_entry',
                    debtId: extractId(impact.debtId),
                    debtMovementId: extractId(impact.debtMovementId),
                }, pendingActionId))
            } else {
                const actionStatus = impact.status === 'ignored'
                    ? 'ignored' as const
                    : impact.status === 'cancelled'
                        ? 'cancelled' as const
                        : 'completed' as const
                await resolveNotificationsForTarget({
                    recipientUserId: impact.userId.toString(),
                    pendingActionId,
                    personalImpactId: pendingActionId,
                    actionStatus,
                })
            }
            result.reconciled += 1
        } catch (error) {
            result.failures.push({
                pendingActionId,
                errorName: error instanceof Error ? error.name : 'UnknownError',
            })
        }
    }
    return result
}

export async function countSpacePendingNotificationsMissingV2() {
    const pending = await SpaceEntryPersonalImpact.find({
        contractVersion: 2,
        status: 'pending',
        actionType: { $exists: true },
    }).select('_id userId entryId actionType').lean<ISpaceEntryPersonalImpact[]>()
    if (pending.length === 0) return 0
    const dedupeKeys = pending.map(pendingDedupeKey)
    const present = await Notification.distinct('dedupeKey', { dedupeKey: { $in: dedupeKeys } })
    return dedupeKeys.length - new Set(present).size
}
