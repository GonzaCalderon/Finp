import mongoose, { Schema } from 'mongoose'
import type { ISpaceInvite } from '@/types'
import { SPACE_INVITE_STATUSES } from '@/lib/constants'

const SpaceInviteSchema = new Schema<ISpaceInvite>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
        participantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant', required: true },
        senderUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: {
            type: String,
            enum: Object.values(SPACE_INVITE_STATUSES),
            required: true,
            default: SPACE_INVITE_STATUSES.PENDING,
        },
        message: { type: String, trim: true },
        respondedAt: { type: Date },
    },
    { timestamps: true }
)

SpaceInviteSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 })
SpaceInviteSchema.index({ spaceId: 1, participantId: 1 })

export const SpaceInvite =
    (mongoose.models.SpaceInvite as mongoose.Model<ISpaceInvite> | undefined) ||
    mongoose.model<ISpaceInvite>('SpaceInvite', SpaceInviteSchema)
