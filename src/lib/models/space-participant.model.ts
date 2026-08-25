import mongoose, { Schema } from 'mongoose'
import type { ISpaceParticipant } from '@/types'
import {
    SPACE_INVITE_STATUSES,
    SPACE_PERSONAL_CATEGORY_STRATEGIES,
    SPACE_PARTICIPANT_KINDS,
    SPACE_PARTICIPANT_ROLES,
} from '@/lib/constants'

const PersonalCategoryMappingSchema = new Schema(
    {
        spaceCategoryId: { type: Schema.Types.ObjectId, ref: 'SpaceCategory', required: true },
        personalCategoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    },
    { _id: false }
)

const PersonalSettingsSchema = new Schema(
    {
        categoryStrategy: {
            type: String,
            enum: Object.values(SPACE_PERSONAL_CATEGORY_STRATEGIES),
            required: true,
            default: SPACE_PERSONAL_CATEGORY_STRATEGIES.MANUAL,
        },
        defaultPersonalCategoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
        categoryMappings: { type: [PersonalCategoryMappingSchema], default: [] },
        updatedAt: { type: Date },
    },
    { _id: false }
)

const SpaceParticipantSchema = new Schema<ISpaceParticipant>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
        kind: {
            type: String,
            enum: Object.values(SPACE_PARTICIPANT_KINDS),
            required: true,
        },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        displayName: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        role: {
            type: String,
            enum: Object.values(SPACE_PARTICIPANT_ROLES),
            required: true,
            default: SPACE_PARTICIPANT_ROLES.PARTICIPANT,
        },
        inviteStatus: {
            type: String,
            enum: Object.values(SPACE_INVITE_STATUSES),
            required: true,
            default: SPACE_INVITE_STATUSES.ACCEPTED,
        },
        isActive: { type: Boolean, required: true, default: true },
        personalSettings: { type: PersonalSettingsSchema },
        revision: { type: Number, min: 0, default: 0 },
    },
    { timestamps: true }
)

SpaceParticipantSchema.index({ spaceId: 1, isActive: 1, createdAt: 1 })
SpaceParticipantSchema.index({ userId: 1, inviteStatus: 1 })
SpaceParticipantSchema.index(
    { spaceId: 1, userId: 1 },
    {
        unique: true,
        partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } },
        name: 'unique_participant_per_space_per_user',
    }
)

const existingSpaceParticipantModel = mongoose.models.SpaceParticipant as
    | mongoose.Model<ISpaceParticipant>
    | undefined
const needsParticipantSchemaRefresh = Boolean(
    existingSpaceParticipantModel && !existingSpaceParticipantModel.schema.path('revision')
)
if (needsParticipantSchemaRefresh) delete mongoose.models.SpaceParticipant

export const SpaceParticipant =
    (needsParticipantSchemaRefresh ? undefined : existingSpaceParticipantModel) ||
    mongoose.model<ISpaceParticipant>('SpaceParticipant', SpaceParticipantSchema)
