import mongoose, { Schema } from 'mongoose'
import type { ISpaceEntryPersonalImpact } from '@/types'
import {
    SPACE_PERSONAL_IMPACT_KINDS,
    SPACE_PERSONAL_IMPACT_STATUSES,
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
    },
    { timestamps: true }
)

SpaceEntryPersonalImpactSchema.index({ spaceId: 1, entryId: 1 })
SpaceEntryPersonalImpactSchema.index({ userId: 1, entryId: 1 })
SpaceEntryPersonalImpactSchema.index({ transactionId: 1 })
SpaceEntryPersonalImpactSchema.index(
    { userId: 1, entryId: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: { status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED },
    }
)

export const SpaceEntryPersonalImpact =
    (mongoose.models.SpaceEntryPersonalImpact as mongoose.Model<ISpaceEntryPersonalImpact> | undefined) ||
    mongoose.model<ISpaceEntryPersonalImpact>(
        'SpaceEntryPersonalImpact',
        SpaceEntryPersonalImpactSchema
    )
