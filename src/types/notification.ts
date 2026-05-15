import type { Types } from 'mongoose'

export interface INotificationEntityRefs {
    spaceId?: Types.ObjectId
    spaceEntryId?: Types.ObjectId
    debtId?: Types.ObjectId
    debtMovementId?: Types.ObjectId
    transactionId?: Types.ObjectId
    personalImpactId?: Types.ObjectId
}

export interface INotificationAction {
    label: string
    href?: string
    actionType?: string
}

export interface INotification {
    _id: Types.ObjectId
    recipientUserId: Types.ObjectId
    actorUserId?: Types.ObjectId
    type: string
    category: 'space' | 'debt' | 'personal_impact' | 'system' | 'insight'
    priority: 'low' | 'normal' | 'high'
    status: 'unread' | 'read' | 'dismissed'
    actionStatus?: 'none' | 'pending' | 'completed' | 'ignored' | 'cancelled'
    title: string
    body?: string
    amount?: number
    currency?: string
    pendingActionId?: Types.ObjectId
    entityRefs?: INotificationEntityRefs
    action?: INotificationAction
    metadata?: Record<string, unknown>
    dedupeKey?: string
    readAt?: Date
    dismissedAt?: Date
    resolvedAt?: Date
    expiresAt?: Date
    createdAt: Date
    updatedAt: Date
}
