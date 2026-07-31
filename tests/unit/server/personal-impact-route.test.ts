import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn().mockResolvedValue(undefined),
    getAccessibleSpaceContext: vi.fn(),
    impactFindOne: vi.fn(),
    impactUpdateOne: vi.fn(),
    transactionFindOneAndDelete: vi.fn(),
    unlinkTransactionDependents: vi.fn(),
    resolveNotificationsForTarget: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    SpaceEntry: { findOne: vi.fn() },
    SpaceEntryPersonalImpact: {
        findOne: mocks.impactFindOne,
        updateOne: mocks.impactUpdateOne,
    },
    Transaction: {
        findOneAndDelete: mocks.transactionFindOneAndDelete,
    },
}))
vi.mock('@/lib/server/spaces', () => ({
    getAccessibleSpaceContext: mocks.getAccessibleSpaceContext,
}))
vi.mock('@/lib/server/transaction-teardown', () => ({
    unlinkTransactionDependents: mocks.unlinkTransactionDependents,
}))
vi.mock('@/lib/server/notifications', () => ({
    resolveNotificationsForTarget: mocks.resolveNotificationsForTarget,
}))
vi.mock('@/lib/server/space-personal-impact', () => ({
    createPersonalImpactFromSpaceEntry: vi.fn(),
    getPersonalImpactForEntries: vi.fn(),
    resolveCurrentUserEntryShare: vi.fn(),
}))
vi.mock('@/lib/server/space-personal-settings', () => ({
    resolveSuggestedPersonalCategory: vi.fn(),
}))

const { DELETE } = await import(
    '@/app/api/spaces/[id]/entries/[entryId]/personal-impact/route'
)

const spaceId = '64b000000000000000000001'
const entryId = '64b000000000000000000002'
const impactId = '64b000000000000000000003'
const transactionId = '64b000000000000000000004'

function leanResult<T>(value: T) {
    return { lean: vi.fn().mockResolvedValue(value) }
}

describe('DELETE personal-impact', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.getAccessibleSpaceContext.mockResolvedValue({ space: { _id: spaceId } })
        mocks.impactFindOne.mockReturnValue(leanResult({
            _id: { toString: () => impactId },
            transactionId,
        }))
        mocks.transactionFindOneAndDelete.mockResolvedValue({
            _id: { toString: () => transactionId },
        })
        mocks.unlinkTransactionDependents.mockResolvedValue({
            unlinkedPersonalImpact: true,
            resolvedNotifications: 0,
        })
        mocks.resolveNotificationsForTarget.mockResolvedValue(undefined)
        mocks.impactUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    })

    it('borra la transacción, deja que el teardown marque REMOVED y resuelve avisos', async () => {
        const response = await DELETE(
            new Request(`https://finp.test/api/spaces/${spaceId}/entries/${entryId}/personal-impact`, {
                method: 'DELETE',
            }),
            { params: Promise.resolve({ id: spaceId, entryId }) }
        )
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toEqual({ ok: true, deletedTransaction: true })
        expect(mocks.transactionFindOneAndDelete).toHaveBeenCalledWith({
            _id: transactionId,
            userId: 'user-1',
        })
        expect(mocks.unlinkTransactionDependents).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({ _id: expect.anything() })
        )
        expect(mocks.impactUpdateOne).not.toHaveBeenCalled()
        expect(mocks.resolveNotificationsForTarget).toHaveBeenCalledWith({
            personalImpactId: impactId,
            actionStatus: 'completed',
        })
    })

    it('es idempotente cuando el impacto ya no está vigente', async () => {
        mocks.impactFindOne.mockReturnValue(leanResult(null))

        const response = await DELETE(
            new Request(`https://finp.test/api/spaces/${spaceId}/entries/${entryId}/personal-impact`, {
                method: 'DELETE',
            }),
            { params: Promise.resolve({ id: spaceId, entryId }) }
        )

        expect(await response.json()).toEqual({ ok: true, deletedTransaction: false })
        expect(mocks.transactionFindOneAndDelete).not.toHaveBeenCalled()
        expect(mocks.resolveNotificationsForTarget).not.toHaveBeenCalled()
    })

    it('marca REMOVED si la transacción personal ya no existe', async () => {
        mocks.transactionFindOneAndDelete.mockResolvedValue(null)

        await DELETE(
            new Request(`https://finp.test/api/spaces/${spaceId}/entries/${entryId}/personal-impact`, {
                method: 'DELETE',
            }),
            { params: Promise.resolve({ id: spaceId, entryId }) }
        )

        expect(mocks.impactUpdateOne).toHaveBeenCalledWith(
            { _id: expect.anything(), userId: 'user-1' },
            expect.objectContaining({
                $set: expect.objectContaining({ status: 'removed' }),
                $unset: { transactionId: 1, accountId: 1 },
            })
        )
    })
})
