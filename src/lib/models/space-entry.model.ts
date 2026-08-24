import mongoose, { Schema } from 'mongoose'
import type { ISpaceEntry } from '@/types'
import {
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

const entrySnapshotSchema = new Schema(
    {
        snapshotAt: { type: Date, required: true },
        editedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true },
        description: { type: String },
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
        reportingAmount: { type: Number, required: true },
        exchangeRate: { type: Number },
        date: { type: Date, required: true },
        dateKey: { type: String, trim: true },
        timezone: { type: String, trim: true },
        spaceCategoryId: { type: Schema.Types.ObjectId },
        paidByParticipantId: { type: Schema.Types.ObjectId },
        sharedWithParticipantIds: [{ type: Schema.Types.ObjectId }],
        splitMode: { type: String },
        splitAllocations: [splitAllocationSchema],
        notes: { type: String },
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
        contractVersion: { type: Number, enum: [2] },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
        reportingAmount: { type: Number, required: true },
        exchangeRate: { type: Number },
        date: { type: Date, required: true },
        dateKey: { type: String, trim: true },
        timezone: { type: String, trim: true },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        spaceCategoryId: { type: Schema.Types.ObjectId, ref: 'SpaceCategory' },
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
        confirmationRequired: {
            type: Boolean,
            default: function legacyConfirmationDefault(this: { contractVersion?: number }) {
                return this.contractVersion === 2 ? undefined : false
            },
        },
        confirmedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        confirmedAt: { type: Date },
        rejectedAt: { type: Date },
        attachments: [attachmentSchema],
        // Anulación lógica
        isVoided: { type: Boolean, required: true, default: false },
        voidedAt: { type: Date },
        voidedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        voidReason: { type: String, trim: true, maxlength: 200 },
        // Edición con historial
        editedAt: { type: Date },
        editedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        editCount: { type: Number, required: true, default: 0 },
        previousVersions: { type: [entrySnapshotSchema], default: undefined },
        revision: { type: Number, min: 0, default: 0 },
        operationId: { type: Schema.Types.ObjectId, ref: 'SpaceOperation' },
    },
    { timestamps: true }
)

SpaceEntrySchema.index({ spaceId: 1, date: -1, createdAt: -1 })
SpaceEntrySchema.index({ paidByParticipantId: 1, status: 1, createdAt: -1 })
SpaceEntrySchema.index({ linkedTransactionId: 1 })
SpaceEntrySchema.index({ spaceId: 1, isVoided: 1, date: -1 })

const existingSpaceEntryModel = mongoose.models.SpaceEntry as mongoose.Model<ISpaceEntry> | undefined

const currentStatusEnum = existingSpaceEntryModel?.schema.path('status')?.options?.enum as string[] | undefined
const needsSchemaRefresh =
    !!existingSpaceEntryModel &&
    (!existingSpaceEntryModel.schema.path('confirmationRequired') ||
        !existingSpaceEntryModel.schema.path('confirmedByUserId') ||
        !currentStatusEnum?.includes(SPACE_ENTRY_STATUSES.CONFIRMED) ||
        !currentStatusEnum?.includes('voided') ||
        !existingSpaceEntryModel.schema.path('contractVersion') ||
        !existingSpaceEntryModel.schema.path('dateKey') ||
        !existingSpaceEntryModel.schema.path('timezone') ||
        !existingSpaceEntryModel.schema.path('revision') ||
        !existingSpaceEntryModel.schema.path('operationId'))

if (needsSchemaRefresh) {
    delete mongoose.models.SpaceEntry
} else if (existingSpaceEntryModel && !existingSpaceEntryModel.schema.path('spaceCategoryId')) {
    existingSpaceEntryModel.schema.add({
        spaceCategoryId: { type: Schema.Types.ObjectId, ref: 'SpaceCategory' },
    })
}

export const SpaceEntry =
    (needsSchemaRefresh ? undefined : existingSpaceEntryModel) ||
    mongoose.model<ISpaceEntry>('SpaceEntry', SpaceEntrySchema)
