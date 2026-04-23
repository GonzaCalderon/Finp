import mongoose, { Schema } from 'mongoose'
import type { ISpaceEntry } from '@/types'
import {
    CURRENCIES,
    SPACE_ENTRY_STATUSES,
    SPACE_ENTRY_TYPES,
    SPACE_SPLIT_MODES,
} from '@/lib/constants'

const splitAllocationSchema = new Schema(
    {
        participantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant', required: true },
        percentage: { type: Number },
        amount: { type: Number },
    },
    { _id: false }
)

const attachmentSchema = new Schema(
    {
        uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        fileName: { type: String, required: true, trim: true },
        mimeType: { type: String, required: true, trim: true },
        size: { type: Number, required: true },
        storageProvider: { type: String, required: true, default: 'vercel_blob' },
        storageKey: { type: String, required: true, trim: true },
        createdAt: { type: Date, required: true, default: () => new Date() },
    },
    { _id: true }
)

const SpaceEntrySchema = new Schema<ISpaceEntry>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
        createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        createdByParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },
        type: { type: String, enum: Object.values(SPACE_ENTRY_TYPES), required: true },
        status: {
            type: String,
            enum: Object.values(SPACE_ENTRY_STATUSES),
            required: true,
            default: SPACE_ENTRY_STATUSES.RECORDED,
        },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        amount: { type: Number, required: true },
        currency: { type: String, enum: Object.values(CURRENCIES), required: true },
        reportingAmount: { type: Number, required: true },
        exchangeRate: { type: Number },
        date: { type: Date, required: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        paidByParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },
        sharedWithParticipantIds: [{ type: Schema.Types.ObjectId, ref: 'SpaceParticipant' }],
        splitMode: {
            type: String,
            enum: Object.values(SPACE_SPLIT_MODES),
            required: true,
            default: SPACE_SPLIT_MODES.NONE,
        },
        splitAllocations: [splitAllocationSchema],
        notes: { type: String, trim: true },
        linkedTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        confirmationRequired: { type: Boolean, required: true, default: false },
        confirmedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        confirmedAt: { type: Date },
        rejectedAt: { type: Date },
        attachments: [attachmentSchema],
    },
    { timestamps: true }
)

SpaceEntrySchema.index({ spaceId: 1, date: -1, createdAt: -1 })
SpaceEntrySchema.index({ paidByParticipantId: 1, status: 1, createdAt: -1 })
SpaceEntrySchema.index({ linkedTransactionId: 1 })

export const SpaceEntry =
    (mongoose.models.SpaceEntry as mongoose.Model<ISpaceEntry> | undefined) ||
    mongoose.model<ISpaceEntry>('SpaceEntry', SpaceEntrySchema)
