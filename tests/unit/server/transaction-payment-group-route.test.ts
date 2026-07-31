import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    Transaction: {
        findOne: vi.fn(),
        find: vi.fn(),
        findOneAndDelete: vi.fn(),
        deleteMany: vi.fn(),
    },
    unlinkTransactionDependents: vi.fn(),
    normalizePaymentGroup: vi.fn(),
    recordTransactionLearningEvent: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    Transaction: mocks.Transaction,
    Account: {},
    InstallmentPlan: {},
}))
vi.mock('@/lib/server/transaction-teardown', () => ({
    unlinkTransactionDependents: mocks.unlinkTransactionDependents,
    normalizePaymentGroup: mocks.normalizePaymentGroup,
}))
vi.mock('@/lib/server/quick-capture-learning', () => ({
    recordTransactionLearningEvent: mocks.recordTransactionLearningEvent,
}))
vi.mock('@/lib/server/transactions', () => ({ resolveRuleTraceForEdit: vi.fn() }))
vi.mock('@/lib/server/commitments', () => ({
    syncApplicationSnapshotFromTransaction: vi.fn(),
}))

const { GET, DELETE } = await import('@/app/api/transactions/[id]/route')

const params = Promise.resolve({ id: 'transaction-ars' })
const baseTransaction = {
    _id: 'transaction-ars',
    type: 'credit_card_payment',
    amount: 120_000,
    currency: 'ARS',
    paymentGroupId: 'payment-group-1',
}
const usdTransaction = {
    _id: 'transaction-usd',
    type: 'credit_card_payment',
    amount: 50,
    currency: 'USD',
    paymentGroupId: 'payment-group-1',
}

function leanQuery<T>(value: T) {
    return { lean: vi.fn().mockResolvedValue(value) }
}

function populatedQuery<T>(value: T) {
    const query = {
        populate: vi.fn(),
        then: (
            resolve: (result: T) => unknown,
            reject: (reason: unknown) => unknown
        ) => Promise.resolve(value).then(resolve, reject),
    }
    query.populate.mockReturnValue(query)
    return query
}

function selectQuery<T>(value: T) {
    return { select: vi.fn().mockResolvedValue(value) }
}

describe('contrato de grupos en /api/transactions/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.unlinkTransactionDependents.mockResolvedValue({
            unlinkedPersonalImpact: false,
            resolvedNotifications: 0,
        })
        mocks.normalizePaymentGroup.mockResolvedValue({
            normalized: true,
            clearedMemberIds: [],
        })
        mocks.recordTransactionLearningEvent.mockResolvedValue(undefined)
    })

    it('expone el grupo como id y miembros mínimos', async () => {
        mocks.Transaction.findOne.mockReturnValue(populatedQuery(baseTransaction))
        mocks.Transaction.find.mockReturnValue(
            selectQuery([baseTransaction, usdTransaction])
        )

        const response = await GET(
            new Request('http://localhost/api/transactions/transaction-ars'),
            { params }
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            paymentGroup: {
                id: 'payment-group-1',
                members: [
                    { id: 'transaction-ars', amount: 120_000, currency: 'ARS' },
                    { id: 'transaction-usd', amount: 50, currency: 'USD' },
                ],
            },
        })
        expect(mocks.Transaction.find).toHaveBeenCalledWith({
            userId: 'user-1',
            paymentGroupId: 'payment-group-1',
        })
    })

    it('rechaza un alcance desconocido antes de consultar la base', async () => {
        const response = await DELETE(
            new Request(
                'http://localhost/api/transactions/transaction-ars?scope=unknown',
                { method: 'DELETE' }
            ),
            { params }
        )

        expect(response.status).toBe(400)
        expect(mocks.connectDB).not.toHaveBeenCalled()
    })

    it('borra sólo una parte por defecto y normaliza el grupo restante', async () => {
        mocks.Transaction.findOne.mockReturnValue(leanQuery(baseTransaction))
        mocks.Transaction.findOneAndDelete.mockResolvedValue(baseTransaction)

        const response = await DELETE(
            new Request('http://localhost/api/transactions/transaction-ars', {
                method: 'DELETE',
            }),
            { params }
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            deletedCount: 1,
            scope: 'single',
        })
        expect(mocks.Transaction.deleteMany).not.toHaveBeenCalled()
        expect(mocks.normalizePaymentGroup).toHaveBeenCalledWith(
            'user-1',
            'payment-group-1'
        )
    })

    it('procesa y borra todos los miembros cuando el usuario elige group', async () => {
        mocks.Transaction.findOne.mockReturnValue(leanQuery(baseTransaction))
        mocks.Transaction.find.mockReturnValue(
            leanQuery([baseTransaction, usdTransaction])
        )
        mocks.Transaction.deleteMany.mockResolvedValue({ deletedCount: 2 })

        const response = await DELETE(
            new Request(
                'http://localhost/api/transactions/transaction-ars?scope=group',
                { method: 'DELETE' }
            ),
            { params }
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            deletedCount: 2,
            scope: 'group',
        })
        expect(mocks.unlinkTransactionDependents).toHaveBeenCalledTimes(2)
        expect(mocks.Transaction.deleteMany).toHaveBeenCalledWith({
            userId: 'user-1',
            _id: { $in: ['transaction-ars', 'transaction-usd'] },
        })
    })
})
