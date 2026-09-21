import mongoose, { Schema } from 'mongoose'
import type { ISpaceEntryPersonalImpact } from '@/types'
import {
    SPACE_PERSONAL_IMPACT_KINDS,
    SPACE_PERSONAL_IMPACT_STATUSES,
    SPACE_PERSONAL_PENDING_ACTION_TYPES,
    SPACE_PERSONAL_IMPACT_SOURCE_TYPES,
} from '@/lib/constants'
import { moneySchema } from '@/lib/models/space-money.schemas'

const financialLinkSchema = new Schema(
    {
        legId: { type: String, required: true },
        currency: { type: String, required: true, uppercase: true },
        amountMoney: { type: moneySchema, required: true },
        accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
        status: { type: String, enum: ['pending', 'linked', 'ignored', 'removed'], required: true },
    },
    { _id: false }
)

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
        contractVersion: { type: Number, enum: [2] },
        amount: { type: Number, required: true },
        amountMoney: { type: moneySchema },
        financialLinks: { type: [financialLinkSchema], default: undefined },
        ownShareAmount: { type: Number, min: 0 },
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
        originSnapshot: {
            _id: false,
            entryRevision: { type: Number },
            entryStatus: { type: String, enum: ['recorded', 'voided'] },
            payerParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },
            amount: { type: Number },
            reportingAmount: { type: Number },
            currency: { type: String },
            reportingCurrency: { type: String },
            exchangeRate: { type: Number },
            dateKey: { type: String },
            timezone: { type: String },
        },
        revision: { type: Number, min: 0, default: 0 },
        operationId: { type: Schema.Types.ObjectId, ref: 'SpaceOperation' },
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

const existingPersonalImpactModel = mongoose.models.SpaceEntryPersonalImpact as
    | mongoose.Model<ISpaceEntryPersonalImpact>
    | undefined
const needsPersonalImpactSchemaRefresh = Boolean(
    existingPersonalImpactModel &&
    (!existingPersonalImpactModel.schema.path('contractVersion') ||
        !existingPersonalImpactModel.schema.path('ownShareAmount') ||
        !existingPersonalImpactModel.schema.path('originSnapshot.entryRevision') ||
        !existingPersonalImpactModel.schema.path('revision') ||
        !existingPersonalImpactModel.schema.path('operationId') ||
        !existingPersonalImpactModel.schema.path('financialLinks'))
)

if (needsPersonalImpactSchemaRefresh) delete mongoose.models.SpaceEntryPersonalImpact

export const SpaceEntryPersonalImpact =
    (needsPersonalImpactSchemaRefresh ? undefined : existingPersonalImpactModel) ||
    mongoose.model<ISpaceEntryPersonalImpact>(
        'SpaceEntryPersonalImpact',
        SpaceEntryPersonalImpactSchema
    )
