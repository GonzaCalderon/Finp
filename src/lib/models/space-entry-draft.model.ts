import { randomUUID } from 'node:crypto'
import mongoose, { Schema } from 'mongoose'

import {
    SPACE_ENTRY_DRAFT_INTENTS,
    SPACE_ENTRY_DRAFT_STATUSES,
    SPACE_SPLIT_MODES,
} from '@/lib/constants'
import { conversionSnapshotSchema, moneySchema } from '@/lib/models/space-money.schemas'
import type { ISpaceEntryDraft } from '@/types'

const draftSplitAllocationSchema = new Schema(
    {
        participantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant', required: true },
        percentage: { type: Number },
        amount: { type: Number },
    },
    { _id: false }
)

const draftPersonalImpactSchema = new Schema(
    {
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        description: { type: String, trim: true, maxlength: 200 },
        linkedTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    },
    { _id: false }
)

const draftAttachmentSchema = new Schema(
    {
        _id: { type: Schema.Types.ObjectId, required: true },
        uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        uploadIdempotencyKey: { type: String, required: true, maxlength: 200 },
        status: {
            type: String,
            enum: ['preparing', 'ready', 'upload_failed', 'cleanup_pending', 'deleted'],
            required: true,
        },
        fileName: { type: String, trim: true, maxlength: 160 },
        declaredMimeType: { type: String, trim: true, maxlength: 100 },
        mimeType: { type: String, trim: true, maxlength: 100 },
        size: { type: Number, min: 1 },
        contentSha256: { type: String, minlength: 64, maxlength: 64 },
        storageProvider: { type: String, enum: ['vercel_blob'], required: true },
        storageKey: { type: String, trim: true },
        createdAt: { type: Date, required: true },
        lastAttemptAt: { type: Date, required: true },
        confirmedAt: { type: Date },
        deletedAt: { type: Date },
        lastErrorCode: { type: String, trim: true, maxlength: 80 },
    },
    { _id: false }
)

const SpaceEntryDraftSchema = new Schema<ISpaceEntryDraft>(
    {
        contractVersion: { type: Number, enum: [2], required: true, immutable: true },
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, immutable: true },
        creatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
        intent: {
            type: String,
            enum: Object.values(SPACE_ENTRY_DRAFT_INTENTS),
            required: true,
            immutable: true,
        },
        status: {
            type: String,
            enum: Object.values(SPACE_ENTRY_DRAFT_STATUSES),
            required: true,
            default: SPACE_ENTRY_DRAFT_STATUSES.ACTIVE,
        },
        revision: { type: Number, required: true, min: 0, default: 0 },
        step: { type: Number, enum: [1, 2, 3, 4], required: true, default: 1 },
        expectedSpaceRevision: { type: Number, required: true, min: 0 },
        publishIdempotencyKey: {
            type: String,
            required: true,
            immutable: true,
            default: () => randomUUID(),
        },
        title: { type: String, trim: true, maxlength: 200 },
        description: { type: String, trim: true, maxlength: 1000 },
        amount: { type: Number },
        money: { type: moneySchema },
        currency: { type: String, uppercase: true, trim: true, maxlength: 12 },
        exchangeRate: { type: Number },
        exchangeRateDecimal: { type: String, trim: true },
        conversionSnapshot: { type: conversionSnapshotSchema },
        expectedQuoteFingerprint: { type: String, trim: true, maxlength: 64 },
        dateKey: { type: String, trim: true },
        timezone: { type: String, trim: true, maxlength: 100 },
        paidByParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },
        sharedWithParticipantIds: [{ type: Schema.Types.ObjectId, ref: 'SpaceParticipant' }],
        splitMode: { type: String, enum: Object.values(SPACE_SPLIT_MODES) },
        splitAllocations: { type: [draftSplitAllocationSchema], default: undefined },
        spaceCategoryId: { type: Schema.Types.ObjectId, ref: 'SpaceCategory' },
        notes: { type: String, trim: true, maxlength: 1000 },
        actorPersonalImpact: { type: draftPersonalImpactSchema },
        attachments: { type: [draftAttachmentSchema], default: undefined },
        publishedEntryId: { type: Schema.Types.ObjectId, ref: 'SpaceEntry' },
        publishedAt: { type: Date },
        discardedAt: { type: Date },
    },
    {
        timestamps: true,
        autoIndex: false,
    }
)

SpaceEntryDraftSchema.index(
    { _id: 1, 'attachments.uploadIdempotencyKey': 1 },
    { name: 'v2_draft_attachment_idempotency' }
)

const existingSpaceEntryDraftModel = mongoose.models.SpaceEntryDraft as mongoose.Model<ISpaceEntryDraft> | undefined
const draftNeedsSchemaRefresh = Boolean(
    existingSpaceEntryDraftModel && !existingSpaceEntryDraftModel.schema.path('attachments')
)
if (draftNeedsSchemaRefresh) delete mongoose.models.SpaceEntryDraft

export const SpaceEntryDraft =
    (draftNeedsSchemaRefresh ? undefined : existingSpaceEntryDraftModel) ||
    mongoose.model<ISpaceEntryDraft>('SpaceEntryDraft', SpaceEntryDraftSchema)
