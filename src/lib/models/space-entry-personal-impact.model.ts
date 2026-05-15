import mongoose, { Schema } from 'mongoose'
import type { ISpaceEntryPersonalImpact } from '@/types'
import {
    SPACE_PERSONAL_IMPACT_KINDS,
    SPACE_PERSONAL_IMPACT_STATUSES,
    SPACE_PERSONAL_PENDING_ACTION_TYPES,
    SPACE_PERSONAL_IMPACT_SOURCE_TYPES,
} from '@/lib/constants'

const SpaceEntryPersonalImpactSchema = new Schema<ISpaceEntryPersonalImpact>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
        entryId: { type: Schema.Types.ObjectId, ref: 'SpaceEntry', required: true },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        participantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant', required: true },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        impactKind: {
            type: String,
            enum: Object.values(SPACE_PERSONAL_IMPACT_KINDS),
            required: true,
        },
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
        status: {
            type: String,
            enum: Object.values(SPACE_PERSONAL_IMPACT_STATUSES),
            required: true,
            default: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
        },
        // Fase 6F.1 — campos de pendiente accionable
        actionType: {
            type: String,
            enum: Object.values(SPACE_PERSONAL_PENDING_ACTION_TYPES),
        },
        sourceType: {
            type: String,
            enum: Object.values(SPACE_PERSONAL_IMPACT_SOURCE_TYPES),
        },
        actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        counterpartyParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },
        counterpartyNameSnapshot: { type: String },
        debtId: { type: Schema.Types.ObjectId, ref: 'Debt' },
        debtMovementId: { type: Schema.Types.ObjectId, ref: 'DebtMovement' },
        accountImpactAmount: { type: Number },
        operationalAmount: { type: Number },
        resolvedAt: { type: Date },
        ignoredAt: { type: Date },
        removedAt: { type: Date },
        // Fase 6F.4 — campos de revisión
        reviewReason: { type: String, enum: ['entry_voided', 'entry_edited'] },
        reviewRequestedAt: { type: Date },
        reviewChangedFields: { type: [String] },
        reviewedAt: { type: Date },
        reviewedResolution: { type: String, enum: ['kept', 'removed'] },
    },
    { timestamps: true }
)

SpaceEntryPersonalImpactSchema.index({ spaceId: 1, entryId: 1 })
SpaceEntryPersonalImpactSchema.index({ userId: 1, entryId: 1 })
SpaceEntryPersonalImpactSchema.index({ transactionId: 1 })

// Un solo linked vigente por (userId, entryId)
SpaceEntryPersonalImpactSchema.index(
    { userId: 1, entryId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED },
    }
)

// Un solo pending por (userId, entryId, actionType) — idempotencia de pendientes
SpaceEntryPersonalImpactSchema.index(
    { userId: 1, entryId: 1, actionType: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: { status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING },
        name: 'pending_unique_per_user_entry_action',
    }
)

export const SpaceEntryPersonalImpact =
    (mongoose.models.SpaceEntryPersonalImpact as mongoose.Model<ISpaceEntryPersonalImpact> | undefined) ||
    mongoose.model<ISpaceEntryPersonalImpact>(
        'SpaceEntryPersonalImpact',
        SpaceEntryPersonalImpactSchema
    )
