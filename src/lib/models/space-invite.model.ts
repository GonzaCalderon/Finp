import mongoose, { Schema } from 'mongoose'
import type { ISpaceInvite } from '@/types'
import {
    SPACE_INVITE_STATUSES,
    SPACE_INVITE_TYPES,
    SPACE_PARTICIPANT_ROLES,
} from '@/lib/constants'

const DIRECT_INVITE_STATUSES = [
    SPACE_INVITE_STATUSES.PENDING,
    SPACE_INVITE_STATUSES.ACCEPTED,
    SPACE_INVITE_STATUSES.DECLINED,
    SPACE_INVITE_STATUSES.REVOKED,
    SPACE_INVITE_STATUSES.EXPIRED,
]

const LINK_INVITE_STATUSES = [
    SPACE_INVITE_STATUSES.ACTIVE,
    SPACE_INVITE_STATUSES.REVOKED,
    SPACE_INVITE_STATUSES.EXPIRED,
]

const SpaceInviteSchema = new Schema<ISpaceInvite>(
    {
        spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
        inviteType: {
            type: String,
            enum: Object.values(SPACE_INVITE_TYPES),
            required: true,
            default: SPACE_INVITE_TYPES.DIRECT,
        },
        participantId: { type: Schema.Types.ObjectId, ref: 'SpaceParticipant' },
        senderUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        recipientUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        tokenHash: { type: String },
        tokenPreview: { type: String },
        status: {
            type: String,
            enum: Object.values(SPACE_INVITE_STATUSES),
            required: true,
            default: SPACE_INVITE_STATUSES.PENDING,
        },
        defaultRole: {
            type: String,
            enum: Object.values(SPACE_PARTICIPANT_ROLES),
            default: SPACE_PARTICIPANT_ROLES.PARTICIPANT,
        },
        expiresAt: { type: Date },
        usedCount: { type: Number, required: true, default: 0 },
        lastUsedAt: { type: Date },
        revokedAt: { type: Date },
        revokedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        message: { type: String, trim: true },
        respondedAt: { type: Date },
    },
    { timestamps: true }
)

SpaceInviteSchema.path('status').validate(function validateStatusByInviteType(value: string) {
    const inviteType = this.inviteType ?? SPACE_INVITE_TYPES.DIRECT
    return inviteType === SPACE_INVITE_TYPES.LINK
        ? LINK_INVITE_STATUSES.includes(value as never)
        : DIRECT_INVITE_STATUSES.includes(value as never)
}, 'Estado de invitacion invalido para el tipo de invitacion.')

SpaceInviteSchema.path('tokenHash').validate(function validateLinkToken(value?: string) {
    if ((this.inviteType ?? SPACE_INVITE_TYPES.DIRECT) !== SPACE_INVITE_TYPES.LINK) return true
    return typeof value === 'string' && value.length > 0
}, 'El link de invitacion requiere token.')

SpaceInviteSchema.index({ recipientUserId: 1, status: 1, createdAt: -1 })
SpaceInviteSchema.index({ spaceId: 1, participantId: 1 })
SpaceInviteSchema.index({ tokenHash: 1 }, { unique: true, sparse: true })
SpaceInviteSchema.index(
    { spaceId: 1, inviteType: 1, status: 1 },
    {
        unique: true,
        partialFilterExpression: {
            inviteType: SPACE_INVITE_TYPES.LINK,
            status: SPACE_INVITE_STATUSES.ACTIVE,
        },
        name: 'unique_active_link_invite_per_space',
    }
)

export const SpaceInvite =
    (mongoose.models.SpaceInvite as mongoose.Model<ISpaceInvite> | undefined) ||
    mongoose.model<ISpaceInvite>('SpaceInvite', SpaceInviteSchema)
