import mongoose, { Schema } from 'mongoose'
import type { ISpaceActivityEvent } from '@/types'
import {
    SPACE_ACTIVITY_ENTITY_TYPES,
    SPACE_ACTIVITY_EVENT_TYPES,
} from '@/lib/constants'

const SpaceActivityEventSchema = new Schema<ISpaceActivityEvent>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true, immutable: true },
        actorUserId: { type: Schema.Types.ObjectId, ref: 'User', immutable: true },
        actorParticipantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant', immutable: true },
        type: {
            type: String,
            enum: Object.values(SPACE_ACTIVITY_EVENT_TYPES),
            required: true,
            immutable: true,
        },
        entityType: {
            type: String,
            enum: Object.values(SPACE_ACTIVITY_ENTITY_TYPES),
            required: true,
            immutable: true,
        },
        entityId: { type: Schema.Types.ObjectId, immutable: true },
        title: { type: String, required: true, trim: true, immutable: true },
        description: { type: String, trim: true, immutable: true },
        metadata: { type: Schema.Types.Mixed, immutable: true },
        operationId: { type: Schema.Types.ObjectId, ref: 'SpaceOperation', immutable: true },
        visibleToUserIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
        readByUserIds: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    },
    { timestamps: { createdAt: true, updatedAt: false } }
)

SpaceActivityEventSchema.index({ spaceId: 1, createdAt: -1 })
SpaceActivityEventSchema.index({ visibleToUserIds: 1, createdAt: -1 })
SpaceActivityEventSchema.index({ spaceId: 1, type: 1, createdAt: -1 })

const existingSpaceActivityEventModel = mongoose.models.SpaceActivityEvent as
    | mongoose.Model<ISpaceActivityEvent>
    | undefined
const needsActivitySchemaRefresh = Boolean(
    existingSpaceActivityEventModel &&
    !existingSpaceActivityEventModel.schema.path('operationId')
)

if (needsActivitySchemaRefresh) delete mongoose.models.SpaceActivityEvent

export const SpaceActivityEvent =
    (needsActivitySchemaRefresh ? undefined : existingSpaceActivityEventModel) ||
    mongoose.model<ISpaceActivityEvent>('SpaceActivityEvent', SpaceActivityEventSchema)
