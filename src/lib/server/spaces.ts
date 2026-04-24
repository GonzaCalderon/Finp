import { Types } from 'mongoose'
import { Space, SpaceEntry, SpaceInvite, SpaceParticipant, User } from '@/lib/models'
import {
    buildSpaceSummary,
    extractId,
} from '@/lib/utils/spaces'
import type {
    ISpace,
    ISpaceDetailPayload,
    ISpaceEntry,
    ISpaceListItem,
    ISpaceParticipant,
    ISpacePendingAction,
    ISpacePendingConfirmation,
    ISpacePendingInvite,
} from '@/types'

function dedupeIds(ids: Array<string | undefined>) {
    return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

function sortParticipants(participants: ISpaceParticipant[]) {
    const rolePriority = { owner: 0, admin: 1, participant: 2 }

    return [...participants].sort((left, right) => {
        const roleDiff = rolePriority[left.role] - rolePriority[right.role]
        if (roleDiff !== 0) return roleDiff
        return left.displayName.localeCompare(right.displayName, 'es')
    })
}

export async function getAccessibleSpaceContext(spaceId: string, userId: string) {
    if (!Types.ObjectId.isValid(spaceId)) {
        return null
    }

    const [space, currentParticipant, participants] = await Promise.all([
        Space.findById(spaceId).lean<ISpace | null>(),
        SpaceParticipant.findOne({
            spaceId,
            userId,
            isActive: true,
        }).lean<ISpaceParticipant | null>(),
        SpaceParticipant.find({ spaceId, isActive: true })
            .sort({ createdAt: 1 })
            .lean<ISpaceParticipant[]>(),
    ])

    if (!space) return null

    const isOwner = extractId(space.ownerUserId) === userId
    if (!isOwner && !currentParticipant) return null

    return {
        space,
        currentParticipant:
            currentParticipant ??
            participants.find((participant) => extractId(participant.userId) === userId) ??
            null,
        participants: sortParticipants(participants),
        isOwner,
    }
}

export async function getSpaceEntries(spaceId: string) {
    return SpaceEntry.find({ spaceId })
        .sort({ date: -1, createdAt: -1 })
        .populate('categoryId', 'name color type')
        .lean<ISpaceEntry[]>()
}

export async function buildSpaceListItems(userId: string) {
    const memberships = await SpaceParticipant.find({
        userId,
        isActive: true,
    }).lean<ISpaceParticipant[]>()

    const ownerSpaces = await Space.find({ ownerUserId: userId })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean<ISpace[]>()

    const spaceIds = dedupeIds([
        ...memberships.map((membership) => extractId(membership.spaceId)),
        ...ownerSpaces.map((space) => extractId(space._id)),
    ])

    if (spaceIds.length === 0) {
        return [] as ISpaceListItem[]
    }

    const [spaces, participants, entries] = await Promise.all([
        Space.find({ _id: { $in: spaceIds } })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean<ISpace[]>(),
        SpaceParticipant.find({ spaceId: { $in: spaceIds }, isActive: true })
            .sort({ createdAt: 1 })
            .lean<ISpaceParticipant[]>(),
        SpaceEntry.find({ spaceId: { $in: spaceIds } })
            .sort({ date: -1, createdAt: -1 })
            .populate('categoryId', 'name color type')
            .lean<ISpaceEntry[]>(),
    ])

    const participantsBySpace = new Map<string, ISpaceParticipant[]>()
    participants.forEach((participant) => {
        const key = extractId(participant.spaceId)
        if (!key) return
        const current = participantsBySpace.get(key) ?? []
        current.push(participant)
        participantsBySpace.set(key, current)
    })

    const entriesBySpace = new Map<string, ISpaceEntry[]>()
    entries.forEach((entry) => {
        const key = extractId(entry.spaceId)
        if (!key) return
        const current = entriesBySpace.get(key) ?? []
        current.push(entry)
        entriesBySpace.set(key, current)
    })

    return spaces.map<ISpaceListItem>((space) => {
        const spaceId = extractId(space._id) ?? ''
        const spaceParticipants = sortParticipants(participantsBySpace.get(spaceId) ?? [])
        const spaceEntries = entriesBySpace.get(spaceId) ?? []

        return {
            space,
            participants: spaceParticipants,
            summary: buildSpaceSummary({
                space,
                entries: spaceEntries,
                participants: spaceParticipants,
                currentUserId: userId,
            }),
            recentEntries: spaceEntries.slice(0, 4),
        }
    })
}

export async function getPendingSpaceActions(userId: string, onlySpaceId?: string) {
    const participantFilter: Record<string, unknown> = {
        userId,
        isActive: true,
    }

    if (onlySpaceId) {
        participantFilter.spaceId = onlySpaceId
    }

    const participantMemberships = await SpaceParticipant.find(participantFilter).lean<ISpaceParticipant[]>()
    const participantIds = dedupeIds(
        participantMemberships.map((participant) => extractId(participant._id))
    )
    const spaceIds = dedupeIds(
        participantMemberships.map((participant) => extractId(participant.spaceId))
    )

    if (spaceIds.length === 0) {
        return [] as ISpacePendingAction[]
    }

    const [spaces, participants, pendingEntries, pendingInvites] = await Promise.all([
        Space.find({
            _id: { $in: onlySpaceId ? [onlySpaceId] : spaceIds },
        }).lean<ISpace[]>(),
        SpaceParticipant.find({
            spaceId: { $in: onlySpaceId ? [onlySpaceId] : spaceIds },
            isActive: true,
        }).lean<ISpaceParticipant[]>(),
        SpaceEntry.find({
            spaceId: { $in: onlySpaceId ? [onlySpaceId] : spaceIds },
            status: 'pending_confirmation',
            paidByParticipantId: { $in: participantIds },
        })
            .sort({ date: -1, createdAt: -1 })
            .populate('categoryId', 'name color type')
            .lean<ISpaceEntry[]>(),
        SpaceInvite.find({
            participantId: { $in: participantIds },
            status: 'pending',
        })
            .sort({ createdAt: -1 })
            .lean(),
    ])

    const senderIds = dedupeIds(
        pendingInvites.map((invite) => extractId(invite.senderUserId))
    )
    const senders = senderIds.length
        ? await User.find({ _id: { $in: senderIds } }, { displayName: 1 }).lean()
        : []

    const spacesById = new Map(spaces.map((space) => [extractId(space._id) ?? '', space]))
    const participantsById = new Map(
        participants.map((participant) => [extractId(participant._id) ?? '', participant])
    )
    const sendersById = new Map(
        senders.map((sender) => [extractId(sender._id) ?? '', sender.displayName])
    )

    const inviteActions = pendingInvites
        .map<ISpacePendingInvite | null>((invite) => {
            const participant = participantsById.get(extractId(invite.participantId) ?? '')
            const space = spacesById.get(extractId(invite.spaceId) ?? '')
            if (!participant || !space) return null

            return {
                kind: 'invite',
                space,
                participant,
                invite,
                invitedByName:
                    sendersById.get(extractId(invite.senderUserId) ?? '') ?? 'Un usuario',
            }
        })
        .filter((action): action is ISpacePendingInvite => Boolean(action))

    const confirmationActions = pendingEntries
        .map<ISpacePendingConfirmation | null>((entry) => {
            const space = spacesById.get(extractId(entry.spaceId) ?? '')
            if (!space) return null

            return {
                kind: 'confirmation',
                space,
                entry,
                requestedByParticipant:
                    participantsById.get(extractId(entry.createdByParticipantId) ?? ''),
                paidByParticipant:
                    participantsById.get(extractId(entry.paidByParticipantId) ?? ''),
            }
        })
        .filter((action): action is ISpacePendingConfirmation => Boolean(action))

    return [...inviteActions, ...confirmationActions].sort((left, right) => {
        const leftDate =
            left.kind === 'invite'
                ? new Date(left.invite.createdAt).getTime()
                : new Date(left.entry.createdAt).getTime()
        const rightDate =
            right.kind === 'invite'
                ? new Date(right.invite.createdAt).getTime()
                : new Date(right.entry.createdAt).getTime()

        return rightDate - leftDate
    })
}

export async function buildSpaceDetailPayload(spaceId: string, userId: string) {
    const context = await getAccessibleSpaceContext(spaceId, userId)
    if (!context) return null

    const [entries, pendingActions] = await Promise.all([
        getSpaceEntries(spaceId),
        getPendingSpaceActions(userId, spaceId),
    ])

    return {
        space: context.space,
        participants: context.participants,
        entries,
        summary: buildSpaceSummary({
            space: context.space,
            entries,
            participants: context.participants,
            currentUserId: userId,
        }),
        pendingActions,
        currentUserId: userId,
    } satisfies ISpaceDetailPayload
}

export async function getEntryConfirmationContext(entryId: string, userId: string) {
    if (!Types.ObjectId.isValid(entryId)) {
        return null
    }

    const entry = await SpaceEntry.findById(entryId)
        .populate('categoryId', 'name color type')
        .lean<ISpaceEntry | null>()

    if (!entry) return null

    const [space, participants] = await Promise.all([
        Space.findById(entry.spaceId).lean<ISpace | null>(),
        SpaceParticipant.find({
            spaceId: entry.spaceId,
            isActive: true,
        }).lean<ISpaceParticipant[]>(),
    ])

    if (!space) return null

    const sortedParticipants = sortParticipants(participants)
    const paidByParticipant = sortedParticipants.find(
        (participant) => extractId(participant._id) === extractId(entry.paidByParticipantId)
    )

    if (!paidByParticipant || extractId(paidByParticipant.userId) !== userId) {
        return null
    }

    return {
        entry,
        space,
        participants: sortedParticipants,
        paidByParticipant,
        requestedByParticipant:
            sortedParticipants.find(
                (participant) =>
                    extractId(participant._id) === extractId(entry.createdByParticipantId)
            ) ?? null,
    }
}
