import { createHash, randomBytes } from 'crypto'
import { Types } from 'mongoose'
import {
    SPACE_ACTIVITY_ENTITY_TYPES,
    SPACE_ACTIVITY_EVENT_TYPES,
    SPACE_INVITE_STATUSES,
    SPACE_INVITE_TYPES,
    SPACE_PARTICIPANT_ROLES,
} from '@/lib/constants'
import { Space, SpaceInvite, SpaceParticipant, User } from '@/lib/models'
import { createSpaceActivityEvent } from '@/lib/server/space-activity'
import { extractId } from '@/lib/utils/spaces'
import type { ISpace, ISpaceInvite, ISpaceParticipant, IUser } from '@/types'

const LINK_INVITE_DURATION_DAYS = [1, 3, 7] as const
const DIRECT_INVITE_STATUSES = new Set<string>([
    SPACE_INVITE_STATUSES.PENDING,
    SPACE_INVITE_STATUSES.ACCEPTED,
    SPACE_INVITE_STATUSES.DECLINED,
    SPACE_INVITE_STATUSES.REVOKED,
    SPACE_INVITE_STATUSES.EXPIRED,
])
const LINK_INVITE_STATUSES = new Set<string>([
    SPACE_INVITE_STATUSES.ACTIVE,
    SPACE_INVITE_STATUSES.REVOKED,
    SPACE_INVITE_STATUSES.EXPIRED,
])

type LinkInviteDurationDays = (typeof LINK_INVITE_DURATION_DAYS)[number]

export type PublicSpaceInviteStatus = 'valid' | 'expired' | 'revoked' | 'invalid'

export function normalizeInviteType(invite?: Pick<ISpaceInvite, 'inviteType'> | null) {
    return invite?.inviteType ?? SPACE_INVITE_TYPES.DIRECT
}

export function isValidInviteStatusForType(inviteType: string | undefined, status: string) {
    const resolvedType = inviteType ?? SPACE_INVITE_TYPES.DIRECT
    return resolvedType === SPACE_INVITE_TYPES.LINK
        ? LINK_INVITE_STATUSES.has(status)
        : DIRECT_INVITE_STATUSES.has(status)
}

export function hashInviteToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
}

export function generateInviteToken() {
    return randomBytes(32).toString('base64url')
}

export function buildInviteUrl(origin: string, token: string) {
    const normalizedOrigin = origin.replace(/\/$/, '')
    return `${normalizedOrigin}/spaces/invite/${token}`
}

function clampInviteDuration(expiresInDays?: number): LinkInviteDurationDays {
    return LINK_INVITE_DURATION_DAYS.includes(expiresInDays as LinkInviteDurationDays)
        ? (expiresInDays as LinkInviteDurationDays)
        : 7
}

function addDays(days: number) {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date
}

function isExpired(invite: Pick<ISpaceInvite, 'expiresAt'>) {
    return Boolean(invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now())
}

function serializeInviteMetadata(invite: ISpaceInvite) {
    return {
        id: extractId(invite._id),
        hasActiveInvite: true,
        expiresAt: invite.expiresAt,
        usedCount: invite.usedCount ?? 0,
        createdAt: invite.createdAt,
        tokenPreview: invite.tokenPreview,
        tokenAvailable: false,
    }
}

export async function expireStaleLinkInvites(spaceId?: string) {
    const filter: Record<string, unknown> = {
        inviteType: SPACE_INVITE_TYPES.LINK,
        status: SPACE_INVITE_STATUSES.ACTIVE,
        expiresAt: { $lte: new Date() },
    }

    if (spaceId && Types.ObjectId.isValid(spaceId)) {
        filter.spaceId = new Types.ObjectId(spaceId)
    }

    await SpaceInvite.updateMany(filter, {
        $set: { status: SPACE_INVITE_STATUSES.EXPIRED },
    })
}

export async function getActiveLinkInvite(spaceId: string) {
    if (!Types.ObjectId.isValid(spaceId)) return null
    await expireStaleLinkInvites(spaceId)

    return SpaceInvite.findOne({
        spaceId,
        inviteType: SPACE_INVITE_TYPES.LINK,
        status: SPACE_INVITE_STATUSES.ACTIVE,
        expiresAt: { $gt: new Date() },
    }).lean<ISpaceInvite | null>()
}

export async function getSpaceInviteLinkState(spaceId: string) {
    const activeInvite = await getActiveLinkInvite(spaceId)
    if (!activeInvite) {
        return {
            hasActiveInvite: false,
            invite: null,
            tokenAvailable: false,
        }
    }

    return {
        hasActiveInvite: true,
        invite: serializeInviteMetadata(activeInvite),
        tokenAvailable: false,
    }
}

export async function createOrReuseSpaceInviteLink({
    spaceId,
    userId,
    origin,
    expiresInDays,
    regenerate,
}: {
    spaceId: string
    userId: string
    origin: string
    expiresInDays?: number
    regenerate?: boolean
}) {
    const duration = clampInviteDuration(expiresInDays)
    const existingInvite = await getActiveLinkInvite(spaceId)

    if (existingInvite && !regenerate) {
        return {
            created: false,
            regenerated: false,
            invite: serializeInviteMetadata(existingInvite),
            inviteUrl: null,
            tokenAvailable: false,
        }
    }

    if (existingInvite && regenerate) {
        await SpaceInvite.updateMany(
            {
                spaceId,
                inviteType: SPACE_INVITE_TYPES.LINK,
                status: SPACE_INVITE_STATUSES.ACTIVE,
            },
            {
                $set: {
                    status: SPACE_INVITE_STATUSES.REVOKED,
                    revokedAt: new Date(),
                    revokedByUserId: new Types.ObjectId(userId),
                },
            }
        )
    }

    const token = generateInviteToken()
    const expiresAt = addDays(duration)
    const invite = await SpaceInvite.create({
        spaceId: new Types.ObjectId(spaceId),
        inviteType: SPACE_INVITE_TYPES.LINK,
        createdByUserId: new Types.ObjectId(userId),
        tokenHash: hashInviteToken(token),
        tokenPreview: token.slice(0, 6),
        status: SPACE_INVITE_STATUSES.ACTIVE,
        defaultRole: SPACE_PARTICIPANT_ROLES.PARTICIPANT,
        expiresAt,
        usedCount: 0,
    })

    return {
        created: true,
        regenerated: Boolean(existingInvite && regenerate),
        invite: {
            ...serializeInviteMetadata(invite.toObject() as ISpaceInvite),
            tokenAvailable: true,
        },
        inviteUrl: buildInviteUrl(origin, token),
        tokenAvailable: true,
    }
}

export async function revokeSpaceInviteLink({
    spaceId,
    inviteId,
    userId,
}: {
    spaceId: string
    inviteId: string
    userId: string
}) {
    if (!Types.ObjectId.isValid(spaceId) || !Types.ObjectId.isValid(inviteId)) {
        return null
    }

    return SpaceInvite.findOneAndUpdate(
        {
            _id: inviteId,
            spaceId,
            inviteType: SPACE_INVITE_TYPES.LINK,
            status: SPACE_INVITE_STATUSES.ACTIVE,
        },
        {
            $set: {
                status: SPACE_INVITE_STATUSES.REVOKED,
                revokedAt: new Date(),
                revokedByUserId: new Types.ObjectId(userId),
            },
        },
        { new: true }
    ).lean<ISpaceInvite | null>()
}

async function findLinkInviteByToken(token: string) {
    const tokenHash = hashInviteToken(token)
    const invite = await SpaceInvite.findOne({
        tokenHash,
        inviteType: SPACE_INVITE_TYPES.LINK,
    }).lean<ISpaceInvite | null>()

    if (invite?.status === SPACE_INVITE_STATUSES.ACTIVE && isExpired(invite)) {
        await SpaceInvite.updateOne(
            { _id: invite._id },
            { $set: { status: SPACE_INVITE_STATUSES.EXPIRED } }
        )
        return { ...invite, status: SPACE_INVITE_STATUSES.EXPIRED }
    }

    return invite
}

function resolvePublicStatus(invite?: ISpaceInvite | null): PublicSpaceInviteStatus {
    if (!invite) return 'invalid'
    if (invite.status === SPACE_INVITE_STATUSES.REVOKED) return 'revoked'
    if (invite.status === SPACE_INVITE_STATUSES.EXPIRED || isExpired(invite)) return 'expired'
    if (invite.status !== SPACE_INVITE_STATUSES.ACTIVE) return 'invalid'
    return 'valid'
}

async function getAlreadyParticipant(spaceId: string | undefined, userId?: string | null) {
    if (!spaceId || !userId) return null
    return SpaceParticipant.findOne({
        spaceId,
        userId,
        isActive: true,
    }).lean<ISpaceParticipant | null>()
}

export async function getPublicSpaceInviteByToken(token: string, userId?: string | null) {
    const invite = await findLinkInviteByToken(token)
    const status = resolvePublicStatus(invite)

    if (!invite) {
        return {
            status,
            isAuthenticated: Boolean(userId),
            alreadyParticipant: false,
        }
    }

    const [space, inviter, alreadyParticipant] = await Promise.all([
        Space.findById(invite.spaceId).lean<ISpace | null>(),
        invite.createdByUserId
            ? User.findById(invite.createdByUserId, { displayName: 1 }).lean<Pick<IUser, 'displayName'> | null>()
            : Promise.resolve(null),
        getAlreadyParticipant(extractId(invite.spaceId), userId),
    ])

    return {
        status,
        spaceName: space?.name,
        spaceType: space?.type,
        inviterName: inviter?.displayName,
        expiresAt: invite.expiresAt,
        isAuthenticated: Boolean(userId),
        alreadyParticipant: Boolean(alreadyParticipant),
        spaceId: alreadyParticipant ? extractId(invite.spaceId) : undefined,
    }
}

function resolveParticipantDisplayName(user: Pick<IUser, 'displayName' | 'email'>) {
    return user.displayName || user.email?.split('@')[0] || 'Participante'
}

async function findLinkableExternalParticipant(spaceId: string, user: Pick<IUser, '_id' | 'email'>) {
    if (!user.email) return null

    return SpaceParticipant.findOne({
        spaceId,
        kind: 'external',
        email: user.email.toLowerCase(),
        isActive: true,
    })
}

export async function acceptSpaceInviteToken({
    token,
    userId,
}: {
    token: string
    userId: string
}) {
    const invite = await findLinkInviteByToken(token)
    const status = resolvePublicStatus(invite)
    if (!invite || status !== 'valid') {
        return { ok: false as const, status }
    }

    const [space, user] = await Promise.all([
        Space.findById(invite.spaceId).lean<ISpace | null>(),
        User.findById(userId).lean<IUser | null>(),
    ])

    if (!space || !user) {
        return { ok: false as const, status: 'invalid' as PublicSpaceInviteStatus }
    }

    const spaceId = extractId(invite.spaceId) ?? ''
    const existingParticipant = await getAlreadyParticipant(spaceId, userId)
    if (existingParticipant) {
        return {
            ok: true as const,
            alreadyParticipant: true,
            spaceId,
            participant: existingParticipant,
        }
    }

    const externalParticipant = await findLinkableExternalParticipant(spaceId, user)
    let participant: ISpaceParticipant

    if (externalParticipant) {
        externalParticipant.kind = 'finp_user'
        externalParticipant.userId = new Types.ObjectId(userId)
        externalParticipant.displayName =
            externalParticipant.displayName || resolveParticipantDisplayName(user)
        externalParticipant.inviteStatus = SPACE_INVITE_STATUSES.ACCEPTED
        await externalParticipant.save()
        participant = externalParticipant.toObject() as ISpaceParticipant
    } else {
        const createdParticipant = await SpaceParticipant.create({
            spaceId: new Types.ObjectId(spaceId),
            userId: new Types.ObjectId(userId),
            kind: 'finp_user',
            displayName: resolveParticipantDisplayName(user),
            email: user.email?.toLowerCase(),
            role: invite.defaultRole ?? SPACE_PARTICIPANT_ROLES.PARTICIPANT,
            inviteStatus: SPACE_INVITE_STATUSES.ACCEPTED,
            isActive: true,
        })
        participant = createdParticipant.toObject() as ISpaceParticipant
    }

    await SpaceInvite.updateOne(
        { _id: invite._id },
        {
            $inc: { usedCount: 1 },
            $set: { lastUsedAt: new Date() },
        }
    )

    await createSpaceActivityEvent({
        spaceId,
        actorUserId: userId,
        actorParticipantId: extractId(participant._id),
        type: SPACE_ACTIVITY_EVENT_TYPES.PARTICIPANT_JOINED,
        entityType: SPACE_ACTIVITY_ENTITY_TYPES.PARTICIPANT,
        entityId: extractId(participant._id),
        title: `${resolveParticipantDisplayName(user)} se unió al espacio`,
    }).catch(() => null)

    return {
        ok: true as const,
        alreadyParticipant: false,
        spaceId,
        participant,
    }
}
