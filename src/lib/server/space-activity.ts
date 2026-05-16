import { Types } from 'mongoose'
import { SpaceActivityEvent, SpaceParticipant, User } from '@/lib/models'
import type {
    SpaceActivityEntityType,
    SpaceActivityEventType,
} from '@/lib/constants'
import type { ISpaceActivityEvent, ISpaceParticipant } from '@/types'

type ActivityOptions = {
    limit?: number
    skip?: number
}

type CreateSpaceActivityEventParams = {
    spaceId: string
    actorUserId?: string
    actorParticipantId?: string
    type: SpaceActivityEventType
    entityType: SpaceActivityEntityType
    entityId?: string
    title: string
    description?: string
    metadata?: Record<string, unknown>
    visibleToUserIds?: string[]
}

function clampPagination(options?: ActivityOptions) {
    return {
        limit: Math.min(Math.max(options?.limit ?? 20, 1), 100),
        skip: Math.max(options?.skip ?? 0, 0),
    }
}

function toObjectId(value?: string) {
    if (!value || !Types.ObjectId.isValid(value)) return undefined
    return new Types.ObjectId(value)
}

export function uniqueValidObjectIds(ids: Array<string | undefined>) {
    return Array.from(
        new Set(
            ids.filter((id): id is string => typeof id === 'string' && Types.ObjectId.isValid(id))
        )
    )
        .map((id) => new Types.ObjectId(id))
}

export async function buildActivityAudience(spaceId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(spaceId)) return []

    const participants = await SpaceParticipant.find({
        spaceId,
        kind: 'finp_user',
        isActive: true,
        userId: { $exists: true, $ne: null },
    }).lean<ISpaceParticipant[]>()

    const participantUserIds = Array.from(
        new Set(
            participants
                .map((participant) => participant.userId?.toString())
                .filter((userId): userId is string => typeof userId === 'string' && Types.ObjectId.isValid(userId))
        )
    )

    if (participantUserIds.length === 0) return []

    const users = await User.find(
        { _id: { $in: participantUserIds } },
        { _id: 1 }
    ).lean<Array<{ _id: Types.ObjectId }>>()

    return users.map((user) => user._id.toString())
}

export async function createSpaceActivityEvent(
    params: CreateSpaceActivityEventParams
): Promise<ISpaceActivityEvent> {
    const spaceObjectId = toObjectId(params.spaceId)
    if (!spaceObjectId) {
        throw new Error('Espacio invalido para actividad')
    }

    const audience = params.visibleToUserIds ?? await buildActivityAudience(params.spaceId)
    const visibleToUserIds = uniqueValidObjectIds(audience)
    const readByUserIds = uniqueValidObjectIds([params.actorUserId])
    const actorUserId = toObjectId(params.actorUserId)
    const actorParticipantId = toObjectId(params.actorParticipantId)
    const entityId = toObjectId(params.entityId)

    return SpaceActivityEvent.create({
        spaceId: spaceObjectId,
        actorUserId,
        actorParticipantId,
        type: params.type,
        entityType: params.entityType,
        entityId,
        title: params.title,
        description: params.description,
        metadata: params.metadata,
        visibleToUserIds,
        readByUserIds,
    })
}

export async function getSpaceActivity(
    spaceId: string,
    userId: string,
    options?: ActivityOptions
) {
    const { limit, skip } = clampPagination(options)
    const filter = {
        spaceId,
        visibleToUserIds: userId,
    }
    const unreadFilter = {
        ...filter,
        readByUserIds: { $ne: userId },
    }

    const [events, unreadCount, total] = await Promise.all([
        SpaceActivityEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean<ISpaceActivityEvent[]>(),
        SpaceActivityEvent.countDocuments(unreadFilter),
        SpaceActivityEvent.countDocuments(filter),
    ])

    return { events, unreadCount, total }
}

export async function markSpaceActivityRead(
    spaceId: string,
    userId: string,
    eventIds?: string[]
) {
    const eventObjectIds = uniqueValidObjectIds(eventIds ?? [])
    await SpaceActivityEvent.updateMany(
        {
            spaceId,
            visibleToUserIds: userId,
            ...(eventIds ? { _id: { $in: eventObjectIds } } : {}),
        },
        { $addToSet: { readByUserIds: new Types.ObjectId(userId) } }
    )
}

export async function getUserSpacesActivity(userId: string, options?: ActivityOptions) {
    const { limit, skip } = clampPagination(options)
    const filter = {
        visibleToUserIds: userId,
    }
    const unreadFilter = {
        ...filter,
        readByUserIds: { $ne: userId },
    }

    const [events, unreadCount, total] = await Promise.all([
        SpaceActivityEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean<ISpaceActivityEvent[]>(),
        SpaceActivityEvent.countDocuments(unreadFilter),
        SpaceActivityEvent.countDocuments(filter),
    ])

    return { events, unreadCount, total }
}

export async function markUserSpacesActivityRead(userId: string, eventIds?: string[]) {
    const eventObjectIds = uniqueValidObjectIds(eventIds ?? [])
    await SpaceActivityEvent.updateMany(
        {
            visibleToUserIds: userId,
            ...(eventIds ? { _id: { $in: eventObjectIds } } : {}),
        },
        { $addToSet: { readByUserIds: new Types.ObjectId(userId) } }
    )
}

export async function getUnreadActivityCount(userId: string) {
    return SpaceActivityEvent.countDocuments({
        visibleToUserIds: userId,
        readByUserIds: { $ne: userId },
    })
}
