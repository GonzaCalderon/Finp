import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    const dbSession = {
        withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
        endSession: vi.fn(),
    }
    return {
        dbSession,
        startSession: vi.fn(async () => dbSession),
        findOne: vi.fn(),
        create: vi.fn(),
        updateOne: vi.fn(),
    }
})

vi.mock('mongoose', async (importOriginal) => {
    const actual = await importOriginal<typeof import('mongoose')>()
    return {
        ...actual,
        default: { ...actual.default, startSession: mocks.startSession },
    }
})

vi.mock('@/lib/models', () => ({
    SpaceOperation: {
        findOne: mocks.findOne,
        create: mocks.create,
        updateOne: mocks.updateOne,
    },
}))

const { executeSpaceOperation, hashSpaceOperationValue } = await import('@/lib/server/space-operation-executor')

const actorUserId = new Types.ObjectId().toString()
const spaceId = new Types.ObjectId().toString()

function findResult(value: unknown) {
    return { lean: vi.fn().mockResolvedValue(value) }
}

describe('space operation executor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.findOne.mockReturnValue(findResult(null))
        mocks.create.mockResolvedValue([{ _id: new Types.ObjectId() }])
        mocks.updateOne.mockResolvedValue({ modifiedCount: 1 })
    })

    it('hash estable no depende del orden de las claves', () => {
        expect(hashSpaceOperationValue({ b: 2, a: 1 })).toBe(hashSpaceOperationValue({ a: 1, b: 2 }))
    })

    it('confirma intención y resultado dentro de una sola sesión', async () => {
        const run = vi.fn().mockResolvedValue({ value: { ok: true }, resultRefs: {} })
        const result = await executeSpaceOperation({
            actorUserId,
            spaceId,
            type: 'create_entry',
            idempotencyKey: 'opaque-key-123456789',
            payload: { amount: 10 },
            run,
        })
        expect(result.replayed).toBe(false)
        expect(run).toHaveBeenCalledWith(mocks.dbSession, expect.any(Types.ObjectId))
        expect(mocks.updateOne).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'pending' }),
            expect.objectContaining({ $set: expect.objectContaining({ status: 'committed' }) }),
            { session: mocks.dbSession }
        )
        expect(mocks.dbSession.endSession).toHaveBeenCalledOnce()
    })

    it('repite el resultado confirmado sin ejecutar otra escritura', async () => {
        const operationId = new Types.ObjectId()
        mocks.findOne.mockReturnValue(findResult({
            _id: operationId,
            payloadHash: hashSpaceOperationValue({ amount: 10 }),
            status: 'committed',
            resultRefs: { spaceEntryId: new Types.ObjectId() },
        }))
        const run = vi.fn()
        const result = await executeSpaceOperation({
            actorUserId,
            spaceId,
            type: 'create_entry',
            idempotencyKey: 'opaque-key-123456789',
            payload: { amount: 10 },
            run,
        })
        expect(result).toMatchObject({ operationId: operationId.toString(), replayed: true })
        expect(run).not.toHaveBeenCalled()
        expect(mocks.startSession).not.toHaveBeenCalled()
    })

    it('rechaza reutilizar la clave con otro payload', async () => {
        mocks.findOne.mockReturnValue(findResult({
            _id: new Types.ObjectId(),
            payloadHash: hashSpaceOperationValue({ amount: 9 }),
            status: 'committed',
            resultRefs: {},
        }))
        await expect(executeSpaceOperation({
            actorUserId,
            spaceId,
            type: 'create_entry',
            idempotencyKey: 'opaque-key-123456789',
            payload: { amount: 10 },
            run: vi.fn(),
        })).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_CONFLICT', status: 409 })
    })
})
