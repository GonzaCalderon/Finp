import mongoose, { Schema } from 'mongoose'
import type { INotification } from '@/types/notification'
import {
    NOTIFICATION_STATUSES,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_PRIORITIES,
    NOTIFICATION_ACTION_STATUSES,
    NOTIFICATION_TYPES,
} from '@/lib/constants'

const NotificationSchema = new Schema<INotification>(
    {
        recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
        category: { type: String, enum: Object.values(NOTIFICATION_CATEGORIES), required: true },
        priority: {
            type: String,
            enum: Object.values(NOTIFICATION_PRIORITIES),
            default: NOTIFICATION_PRIORITIES.NORMAL,
        },
        status: {
            type: String,
            enum: Object.values(NOTIFICATION_STATUSES),
            default: NOTIFICATION_STATUSES.UNREAD,
        },
        actionStatus: { type: String, enum: Object.values(NOTIFICATION_ACTION_STATUSES) },
        title: { type: String, required: true },
        body: { type: String },
        amount: { type: Number },
        currency: { type: String },
        pendingActionId: { type: Schema.Types.ObjectId, ref: 'SpaceEntryPersonalImpact' },
        entityRefs: {
            spaceId: { type: Schema.Types.ObjectId },
            spaceEntryId: { type: Schema.Types.ObjectId },
            debtId: { type: Schema.Types.ObjectId },
            debtMovementId: { type: Schema.Types.ObjectId },
            transactionId: { type: Schema.Types.ObjectId },
            personalImpactId: { type: Schema.Types.ObjectId },
        },
        action: {
            label: { type: String },
            href: { type: String },
            actionType: { type: String },
        },
        metadata: { type: Schema.Types.Mixed },
        dedupeKey: { type: String },
        readAt: { type: Date },
        dismissedAt: { type: Date },
        archivedAt: { type: Date },
        resolvedAt: { type: Date },
        expiresAt: { type: Date },
    },
    { timestamps: true }
)

NotificationSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 })
NotificationSchema.index({ recipientUserId: 1, actionStatus: 1, createdAt: -1 })
NotificationSchema.index({ recipientUserId: 1, category: 1, createdAt: -1 })
NotificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true })
NotificationSchema.index({ 'entityRefs.spaceId': 1 })
NotificationSchema.index({ 'entityRefs.debtId': 1 })
NotificationSchema.index({ pendingActionId: 1 })

export const Notification =
    (mongoose.models.Notification as mongoose.Model<INotification> | undefined) ||
    mongoose.model<INotification>('Notification', NotificationSchema)
