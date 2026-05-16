import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import { SPACE_INVITE_STATUSES, SPACE_INVITE_TYPES } from '@/lib/constants'

const mocks = vi.hoisted(() => {
    const lean = <T>(result: T) => ({ lean: vi.fn().mockResolvedValue(result) })

    return {
        lean,
        SpaceInvite: {
            findOne: vi.fn(),
            updateMany: vi.fn(),
            updateOne: vi.fn(),
            create: vi.fn(),
            findOneAndUpdate: vi.fn(),
        },
        Space: { findById: vi.fn() },
        SpaceParticipant: {
            findOne: vi.fn(),
            create: vi.fn(),
        },
        User: { findById: vi.fn() },
        createSpaceActivityEvent: vi.fn().mockResolvedValue({}),
    }
})

vi.mock('@/lib/models', () => ({
    SpaceInvite: mocks.SpaceInvite,
    Space: mocks.Space,
    SpaceParticipant: mocks.SpaceParticipant,
    User: mocks.User,
}))

vi.mock('@/lib/server/space-activity', () => ({
    createSpaceActivityEvent: mocks.createSpaceActivityEvent,
}))

const {
    acceptSpaceInviteToken,
    createOrReuseSpaceInviteLink,
    getPublicSpaceInviteByToken,
    hashInviteToken,
    isValidInviteStatusForType,
    normalizeInviteType,
} = await import('@/lib/server/space-invites')

function invite(overrides: Record<string, unknown> = {}) {
    return {
        _id: new Types.ObjectId(),
        spaceId: new Types.ObjectId(),
        inviteType: SPACE_INVITE_TYPES.LINK,
        tokenHash: hashInviteToken('token-seguro'),
        tokenPreview: 'token-',
        status: SPACE_INVITE_STATUSES.ACTIVE,
        defaultRole: 'participant',
        expiresAt: new Date(Date.now() + 86_400_000),
        usedCount: 0,
        createdAt: new Date('2026-05-16T10:00:00Z'),
        updatedAt: new Date('2026-05-16T10:00:00Z'),
        ...overrides,
    }
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.SpaceInvite.findOne.mockReturnValue(mocks.lean(null))
    mocks.SpaceInvite.updateMany.mockResolvedValue({ modifiedCount: 0 })
    mocks.SpaceInvite.updateOne.mockResolvedValue({ modifiedCount: 0 })
    mocks.SpaceInvite.findOneAndUpdate.mockReturnValue(mocks.lean(null))
    mocks.SpaceInvite.create.mockImplementation(async (payload: Record<string, unknown>) => ({
        _id: new Types.ObjectId(),
        createdAt: new Date('2026-05-16T10:00:00Z'),
        updatedAt: new Date('2026-05-16T10:00:00Z'),
        ...payload,
        toObject() {
            return {
                _id: this._id,
                createdAt: this.createdAt,
                updatedAt: this.updatedAt,
                ...payload,
            }
        },
    }))
    mocks.Space.findById.mockReturnValue(mocks.lean({ _id: new Types.ObjectId(), name: 'Viaje', type: 'travel' }))
    mocks.User.findById.mockReturnValue(mocks.lean({ _id: new Types.ObjectId(), email: 'ana@finp.test', displayName: 'Ana' }))
    mocks.SpaceParticipant.findOne.mockReturnValue(mocks.lean(null))
    mocks.SpaceParticipant.create.mockImplementation(async (payload: Record<string, unknown>) => ({
        _id: new Types.ObjectId(),
        ...payload,
        toObject() {
            return { _id: this._id, ...payload }
        },
    }))
})

describe('space invite helpers', () => {
    it('trata invitaciones legacy sin inviteType como direct y valida estados por tipo', () => {
        expect(normalizeInviteType({})).toBe(SPACE_INVITE_TYPES.DIRECT)
        expect(isValidInviteStatusForType(undefined, SPACE_INVITE_STATUSES.PENDING)).toBe(true)
        expect(isValidInviteStatusForType(undefined, SPACE_INVITE_STATUSES.ACTIVE)).toBe(false)
        expect(isValidInviteStatusForType(SPACE_INVITE_TYPES.LINK, SPACE_INVITE_STATUSES.ACTIVE)).toBe(true)
        expect(isValidInviteStatusForType(SPACE_INVITE_TYPES.LINK, SPACE_INVITE_STATUSES.PENDING)).toBe(false)
    })

    it('hashea tokens sin guardar el valor plano', () => {
        const token = 'token-seguro'
        const hash = hashInviteToken(token)

        expect(hash).not.toBe(token)
        expect(hash).toBe(hashInviteToken(token))
        expect(hash).toHaveLength(64)
    })

    it('si ya existe link activo devuelve metadata sin reconstruir el enlace completo', async () => {
        const existing = invite()
        mocks.SpaceInvite.findOne.mockReturnValue(mocks.lean(existing))

        const result = await createOrReuseSpaceInviteLink({
            spaceId: existing.spaceId.toString(),
            userId: new Types.ObjectId().toString(),
            origin: 'https://finp.test',
            expiresInDays: 7,
        })

        expect(result.created).toBe(false)
        expect(result.inviteUrl).toBeNull()
        expect(result.tokenAvailable).toBe(false)
        expect(mocks.SpaceInvite.create).not.toHaveBeenCalled()
    })

    it('regenerar revoca el activo y crea un token nuevo', async () => {
        const existing = invite()
        mocks.SpaceInvite.findOne.mockReturnValue(mocks.lean(existing))

        const result = await createOrReuseSpaceInviteLink({
            spaceId: existing.spaceId.toString(),
            userId: new Types.ObjectId().toString(),
            origin: 'https://finp.test',
            expiresInDays: 3,
            regenerate: true,
        })

        expect(mocks.SpaceInvite.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                spaceId: existing.spaceId.toString(),
                inviteType: SPACE_INVITE_TYPES.LINK,
                status: SPACE_INVITE_STATUSES.ACTIVE,
            }),
            expect.objectContaining({
                $set: expect.objectContaining({ status: SPACE_INVITE_STATUSES.REVOKED }),
            })
        )
        expect(mocks.SpaceInvite.create).toHaveBeenCalledOnce()
        expect(result.inviteUrl).toMatch(/^https:\/\/finp\.test\/spaces\/invite\//)
    })

    it('marca expirado al consultar un token vencido', async () => {
        const expired = invite({ expiresAt: new Date(Date.now() - 1_000) })
        mocks.SpaceInvite.findOne.mockReturnValue(mocks.lean(expired))

        const result = await getPublicSpaceInviteByToken('token-seguro')

        expect(result.status).toBe('expired')
        expect(mocks.SpaceInvite.updateOne).toHaveBeenCalledWith(
            { _id: expired._id },
            { $set: { status: SPACE_INVITE_STATUSES.EXPIRED } }
        )
    })

    it('aceptar no duplica participante si el usuario ya pertenece', async () => {
        const validInvite = invite()
        const participant = { _id: new Types.ObjectId(), spaceId: validInvite.spaceId, userId: new Types.ObjectId(), isActive: true }
        mocks.SpaceInvite.findOne.mockReturnValue(mocks.lean(validInvite))
        mocks.SpaceParticipant.findOne.mockReturnValue(mocks.lean(participant))

        const result = await acceptSpaceInviteToken({
            token: 'token-seguro',
            userId: participant.userId.toString(),
        })

        expect(result.ok).toBe(true)
        expect(result.alreadyParticipant).toBe(true)
        expect(mocks.SpaceParticipant.create).not.toHaveBeenCalled()
        expect(mocks.SpaceInvite.updateOne).not.toHaveBeenCalled()
    })
})
