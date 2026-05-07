import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

const mocks = vi.hoisted(() => ({
    SpaceParticipant: {
        find: vi.fn(),
    },
    SpaceActivityEvent: {
        create: vi.fn(),
        find: vi.fn(),
        countDocuments: vi.fn(),
        updateMany: vi.fn(),
    },
    User: {
        find: vi.fn(),
    },
}))

vi.mock('@/lib/models', () => ({
    SpaceParticipant: mocks.SpaceParticipant,
    SpaceActivityEvent: mocks.SpaceActivityEvent,
    User: mocks.User,
}))

const {
    buildActivityAudience,
    createSpaceActivityEvent,
    getUnreadActivityCount,
    markSpaceActivityRead,
    markUserSpacesActivityRead,
} = await import('@/lib/server/space-activity')

function findLeanResult<T>(items: T[]) {
    return {
        lean: vi.fn().mockResolvedValue(items),
    }
}

describe('space activity helpers', () => {
    const spaceId = new Types.ObjectId().toString()
    const actorUserId = new Types.ObjectId().toString()
    const otherUserId = new Types.ObjectId().toString()
    const actorParticipantId = new Types.ObjectId().toString()
    const entryId = new Types.ObjectId().toString()

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.SpaceParticipant.find.mockReturnValue(findLeanResult([
            {
                kind: 'finp_user',
                isActive: true,
                userId: new Types.ObjectId(actorUserId),
            },
            {
                kind: 'finp_user',
                isActive: true,
                userId: new Types.ObjectId(otherUserId),
            },
            {
                kind: 'external',
                isActive: true,
            },
        ]))
        mocks.User.find.mockReturnValue(findLeanResult([
            { _id: new Types.ObjectId(actorUserId) },
            { _id: new Types.ObjectId(otherUserId) },
        ]))
        mocks.SpaceActivityEvent.create.mockImplementation(async (payload) => ({
            _id: new Types.ObjectId(),
            ...payload,
            createdAt: new Date(),
        }))
        mocks.SpaceActivityEvent.updateMany.mockResolvedValue({ modifiedCount: 1 })
        mocks.SpaceActivityEvent.countDocuments.mockResolvedValue(2)
    })

    it('builds audience from active Finp participants with userId', async () => {
        const audience = await buildActivityAudience(spaceId)

        expect(audience).toEqual([actorUserId, otherUserId])
        expect(mocks.SpaceParticipant.find).toHaveBeenCalledWith({
            spaceId,
            kind: 'finp_user',
            isActive: true,
            userId: { $exists: true, $ne: null },
        })
        expect(mocks.User.find).toHaveBeenCalledWith(
            { _id: { $in: [actorUserId, otherUserId] } },
            { _id: 1 }
        )
    })

    it('marks the actor as read when creating an event', async () => {
        await createSpaceActivityEvent({
            spaceId,
            actorUserId,
            actorParticipantId,
            type: 'entry_edited',
            entityType: 'entry',
            entityId: entryId,
            title: 'Gonzalo editó Mercado',
        })

        const payload = mocks.SpaceActivityEvent.create.mock.calls[0][0]
        expect(payload.type).toBe('entry_edited')
        expect(payload.entityType).toBe('entry')
        expect(payload.visibleToUserIds.map((id: Types.ObjectId) => id.toString())).toEqual([
            actorUserId,
            otherUserId,
        ])
        expect(payload.readByUserIds.map((id: Types.ObjectId) => id.toString())).toEqual([
            actorUserId,
        ])
    })

    it('marks specific space events as read', async () => {
        const eventId = new Types.ObjectId().toString()

        await markSpaceActivityRead(spaceId, otherUserId, [eventId])

        const [filter, update] = mocks.SpaceActivityEvent.updateMany.mock.calls[0]
        expect(filter).toMatchObject({
            spaceId,
            visibleToUserIds: otherUserId,
        })
        expect(filter._id.$in.map((id: Types.ObjectId) => id.toString())).toEqual([eventId])
        expect(update.$addToSet.readByUserIds.toString()).toBe(otherUserId)
    })

    it('marks global activity as read', async () => {
        await markUserSpacesActivityRead(otherUserId)

        const [filter, update] = mocks.SpaceActivityEvent.updateMany.mock.calls[0]
        expect(filter).toEqual({
            visibleToUserIds: otherUserId,
        })
        expect(update.$addToSet.readByUserIds.toString()).toBe(otherUserId)
    })

    it('counts unread global activity excluding already read events', async () => {
        const count = await getUnreadActivityCount(otherUserId)

        expect(count).toBe(2)
        expect(mocks.SpaceActivityEvent.countDocuments).toHaveBeenCalledWith({
            visibleToUserIds: otherUserId,
            readByUserIds: { $ne: otherUserId },
        })
    })
})
