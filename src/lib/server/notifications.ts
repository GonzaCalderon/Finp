import { Types } from 'mongoose'
import { Notification } from '@/lib/models'
import {
    NOTIFICATION_STATUSES,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TYPES,
    NOTIFICATION_ACTION_STATUSES,
} from '@/lib/constants'
import type { NotificationActionStatus } from '@/lib/constants'
import type { INotification } from '@/types/notification'
import type { SpacePersonalPendingActionType, SpacePersonalImpactSourceType } from '@/lib/constants'

// Tipos locales que reflejan los de personal-sync-events (evita dependencia circular)
interface PendingActionTargetLike {
    userId: string
    actionType: SpacePersonalPendingActionType
    amount: number
    currency: string
    counterpartyNameSnapshot?: string
}

interface PersonalSyncEventLike {
    actorUserId: string
    spaceId: string
    entryId: string
    sourceType: SpacePersonalImpactSourceType
    debtId?: string
    debtMovementId?: string
}

type CreateNotificationInput = Omit<INotification, '_id' | 'createdAt' | 'updatedAt'>

export interface ResolveNotificationsForTargetParams {
    recipientUserId?: string
    pendingActionId?: string
    spaceEntryId?: string
    debtId?: string
    personalImpactId?: string
    actionStatus: NotificationActionStatus
}

// ─── Creación ────────────────────────────────────────────────────────────────

export async function createNotification(input: CreateNotificationInput): Promise<INotification> {
    return Notification.create(input) as Promise<INotification>
}

export async function safeCreateNotification(input: CreateNotificationInput): Promise<void> {
    try {
        await createNotification(input)
    } catch (err) {
        console.error('[notifications] createNotification failed:', err)
    }
}

export async function upsertNotificationByDedupeKey(
    input: CreateNotificationInput & { dedupeKey: string }
): Promise<INotification> {
    const { dedupeKey, ...rest } = input

    const isReopening =
        input.actionStatus === NOTIFICATION_ACTION_STATUSES.PENDING ||
        input.status === NOTIFICATION_STATUSES.UNREAD

    const updateOp: Record<string, unknown> = {
        $set: { ...rest, dedupeKey },
        $setOnInsert: { createdAt: new Date() },
    }

    if (isReopening) {
        updateOp.$unset = { readAt: '', dismissedAt: '', archivedAt: '', resolvedAt: '' }
    }

    const result = await Notification.findOneAndUpdate(
        { dedupeKey },
        updateOp,
        { upsert: true, new: true }
    ).lean()
    return result as INotification
}

export async function safeUpsertNotificationByDedupeKey(
    input: CreateNotificationInput & { dedupeKey: string }
): Promise<void> {
    try {
        await upsertNotificationByDedupeKey(input)
    } catch (err) {
        console.error('[notifications] upsertNotificationByDedupeKey failed:', err)
    }
}

// ─── Estado ──────────────────────────────────────────────────────────────────

export async function markNotificationAsRead(
    userId: string,
    notificationId: string
): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
        { _id: new Types.ObjectId(notificationId), recipientUserId: new Types.ObjectId(userId) },
        { $set: { status: NOTIFICATION_STATUSES.READ, readAt: new Date() } },
        { new: true }
    ).lean() as Promise<INotification | null>
}

export async function markAllNotificationsAsRead(userId: string): Promise<number> {
    const result = await Notification.updateMany(
        { recipientUserId: new Types.ObjectId(userId), status: NOTIFICATION_STATUSES.UNREAD },
        { $set: { status: NOTIFICATION_STATUSES.READ, readAt: new Date() } }
    )
    return result.modifiedCount
}

export async function dismissNotification(
    userId: string,
    notificationId: string
): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
        { _id: new Types.ObjectId(notificationId), recipientUserId: new Types.ObjectId(userId) },
        { $set: { status: NOTIFICATION_STATUSES.DISMISSED, dismissedAt: new Date() } },
        { new: true }
    ).lean() as Promise<INotification | null>
}

export async function archiveNotification(
    userId: string,
    notificationId: string
): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
        { _id: new Types.ObjectId(notificationId), recipientUserId: new Types.ObjectId(userId) },
        { $set: { status: NOTIFICATION_STATUSES.ARCHIVED, archivedAt: new Date() } },
        { new: true }
    ).lean() as Promise<INotification | null>
}

export async function unarchiveNotification(
    userId: string,
    notificationId: string
): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
        { _id: new Types.ObjectId(notificationId), recipientUserId: new Types.ObjectId(userId) },
        {
            $set: { status: NOTIFICATION_STATUSES.READ },
            $unset: { archivedAt: '' },
        },
        { new: true }
    ).lean() as Promise<INotification | null>
}

export async function resolveNotificationsForTarget(
    params: ResolveNotificationsForTargetParams
): Promise<void> {
    const { recipientUserId, pendingActionId, spaceEntryId, debtId, personalImpactId, actionStatus } =
        params

    const query: Record<string, unknown> = {
        actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
        status: { $ne: NOTIFICATION_STATUSES.DISMISSED },
    }

    if (recipientUserId) query.recipientUserId = new Types.ObjectId(recipientUserId)
    if (pendingActionId) query.pendingActionId = new Types.ObjectId(pendingActionId)
    if (spaceEntryId) query['entityRefs.spaceEntryId'] = new Types.ObjectId(spaceEntryId)
    if (debtId) query['entityRefs.debtId'] = new Types.ObjectId(debtId)
    if (personalImpactId) query['entityRefs.personalImpactId'] = new Types.ObjectId(personalImpactId)

    // Necesita al menos un identificador de entidad además del estado
    const hasEntityFilter = pendingActionId || spaceEntryId || debtId || personalImpactId
    if (!hasEntityFilter) return

    await Notification.updateMany(query, {
        $set: { actionStatus, resolvedAt: new Date() },
    })
}

// ─── Builders ─────────────────────────────────────────────────────────────────

export function buildNotificationHref(notification: Pick<INotification, 'category' | 'entityRefs'>): string | undefined {
    const refs = notification.entityRefs
    if (!refs) return undefined

    if (notification.category === NOTIFICATION_CATEGORIES.PERSONAL_IMPACT || notification.category === NOTIFICATION_CATEGORIES.SPACE) {
        if (refs.spaceId) {
            const base = `/spaces/${refs.spaceId.toString()}`
            return refs.spaceEntryId ? `${base}?entryId=${refs.spaceEntryId.toString()}` : base
        }
    }

    if (notification.category === NOTIFICATION_CATEGORIES.DEBT) {
        if (refs.debtId) return `/debts?debtId=${refs.debtId.toString()}`
    }

    return undefined
}

function actionLabelFor(actionType: string): string {
    switch (actionType) {
        case 'impact_space_expense': return 'Ver gasto'
        case 'impact_space_payment': return 'Ver pago'
        case 'impact_space_collect': return 'Ver cobro'
        default: return 'Ver detalle'
    }
}

function notificationCopyFor(
    actionType: string,
    counterparty: string | undefined,
    amount: number,
    currency: string
): { title: string; body: string } {
    const who = counterparty ?? 'Alguien'
    switch (actionType) {
        case 'impact_space_expense':
            return {
                title: 'Nuevo gasto compartido',
                body: `${who} registró un gasto de ${amount} ${currency}`,
            }
        case 'impact_space_payment':
            return {
                title: 'Registraron un pago tuyo',
                body: `${who} registró que pagaste ${amount} ${currency}`,
            }
        case 'impact_space_collect':
            return {
                title: 'Registraron un cobro para vos',
                body: counterparty
                    ? `${counterparty} registró que te pagó ${amount} ${currency}`
                    : 'Podés registrar la entrada en tu Finp si corresponde.',
            }
        default:
            return {
                title: 'Nueva notificación',
                body: `${who} realizó una acción que te involucra`,
            }
    }
}

export function buildReviewNotification(params: {
    recipientUserId: string
    actorUserId: string
    entryId: string
    spaceId: string
    entryTitle: string
    reason: 'entry_voided' | 'entry_edited'
    impactId: string
    changedFields?: string[]
    transactionId?: string
}): CreateNotificationInput & { dedupeKey: string } {
    const { recipientUserId, actorUserId, entryId, spaceId, entryTitle, reason, impactId, changedFields, transactionId } = params
    const isVoided = reason === 'entry_voided'
    const title = isVoided ? 'Un movimiento vinculado fue anulado' : 'Un movimiento vinculado fue modificado'
    const fieldsSuffix = !isVoided && changedFields?.length ? ` (${changedFields.join(', ')})` : ''
    const body = isVoided
        ? `"${entryTitle}" fue anulado. Revisá tu transacción vinculada para mantener tus finanzas consistentes.`
        : `"${entryTitle}" fue editado${fieldsSuffix}. Revisá tu transacción vinculada para mantener tus finanzas consistentes.`

    const actionHref = transactionId
        ? `/transactions?transactionId=${transactionId}&hint=review`
        : `/spaces/${spaceId}?entryId=${entryId}`

    return {
        recipientUserId: new Types.ObjectId(recipientUserId),
        actorUserId: new Types.ObjectId(actorUserId),
        type: isVoided ? NOTIFICATION_TYPES.SPACE_ENTRY_VOIDED_REVIEW : NOTIFICATION_TYPES.SPACE_ENTRY_EDITED_REVIEW,
        category: NOTIFICATION_CATEGORIES.PERSONAL_IMPACT,
        priority: 'high',
        status: NOTIFICATION_STATUSES.UNREAD,
        actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
        title,
        body,
        pendingActionId: new Types.ObjectId(impactId),
        entityRefs: {
            spaceId: new Types.ObjectId(spaceId),
            spaceEntryId: new Types.ObjectId(entryId),
            personalImpactId: new Types.ObjectId(impactId),
        },
        action: {
            label: 'Ver movimiento',
            href: actionHref,
        },
        dedupeKey: `review:${reason}:${recipientUserId}:${entryId}`,
    }
}

export function buildNotificationFromPendingAction(
    target: PendingActionTargetLike,
    event: PersonalSyncEventLike,
    pendingId: string
): CreateNotificationInput & { dedupeKey: string } {
    const { title, body } = notificationCopyFor(
        target.actionType,
        target.counterpartyNameSnapshot,
        target.amount,
        target.currency
    )

    const spaceId = new Types.ObjectId(event.spaceId)
    const spaceEntryId = new Types.ObjectId(event.entryId)
    const href = `/spaces/${event.spaceId}?entryId=${event.entryId}`

    return {
        recipientUserId: new Types.ObjectId(target.userId),
        actorUserId: new Types.ObjectId(event.actorUserId),
        type: NOTIFICATION_TYPES.PERSONAL_IMPACT_PENDING,
        category: NOTIFICATION_CATEGORIES.PERSONAL_IMPACT,
        priority: 'normal',
        status: NOTIFICATION_STATUSES.UNREAD,
        actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
        title,
        body,
        amount: target.amount,
        currency: target.currency,
        pendingActionId: new Types.ObjectId(pendingId),
        entityRefs: {
            spaceId,
            spaceEntryId,
            ...(event.debtId && { debtId: new Types.ObjectId(event.debtId) }),
            ...(event.debtMovementId && { debtMovementId: new Types.ObjectId(event.debtMovementId) }),
            personalImpactId: new Types.ObjectId(pendingId),
        },
        action: {
            label: actionLabelFor(target.actionType),
            href,
            actionType: target.actionType,
        },
        dedupeKey: `pending-action:${target.userId}:${event.entryId}:${target.actionType}`,
    }
}
