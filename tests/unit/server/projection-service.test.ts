import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function queryResult<T>(value: T) {
    const query = {
        populate: vi.fn(),
        select: vi.fn(),
        lean: vi.fn(),
        then: (resolve: (result: T) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(value).then(resolve, reject),
    }
    query.populate.mockReturnValue(query)
    query.select.mockReturnValue(query)
    query.lean.mockResolvedValue(value)
    return query
}

const mocks = vi.hoisted(() => ({
    commitmentFind: vi.fn(),
    planFind: vi.fn(),
    applicationFind: vi.fn(),
    transactionFind: vi.fn(),
    userFindById: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    ScheduledCommitment: { find: mocks.commitmentFind },
    InstallmentPlan: { find: mocks.planFind },
    CommitmentApplication: { find: mocks.applicationFind },
    Transaction: { find: mocks.transactionFind },
    User: { findById: mocks.userFindById },
}))

const { getProjectionForUser } = await import('@/lib/server/projection')

const objectId = (value: string) => ({ toString: () => value })
const visa = {
    _id: objectId('visa'),
    name: 'Visa',
    color: '#123456',
    type: 'credit_card',
    creditCardConfig: { dueDay: 18 },
}
const category = { _id: objectId('category'), name: 'Comida', color: '#654321' }

describe('servicio de proyeccion', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 6, 31, 12))
        mocks.userFindById.mockResolvedValue({
            preferences: { monthStartDay: 1, operationalStartDate: new Date(2026, 0, 1) },
        })
        mocks.commitmentFind.mockReturnValue(queryResult([]))
        mocks.applicationFind.mockReturnValue(queryResult([]))
        mocks.planFind.mockReturnValue(queryResult([
            {
                _id: objectId('one-pay'),
                userId: objectId('user-1'),
                accountId: visa,
                categoryId: category,
                description: 'Compra moderna',
                currency: 'ARS',
                totalAmount: 120_000,
                installmentCount: 1,
                installmentAmount: 120_000,
                purchaseDate: new Date(2026, 6, 5),
                firstClosingMonth: '2026-07',
            },
            {
                _id: objectId('installments'),
                userId: objectId('user-1'),
                accountId: visa,
                categoryId: category,
                description: 'Tres cuotas',
                currency: 'USD',
                totalAmount: 90,
                installmentCount: 3,
                installmentAmount: 30,
                purchaseDate: new Date(2026, 5, 5),
                firstClosingMonth: '2026-07',
            },
        ]))
        mocks.transactionFind.mockReturnValue(queryResult([
            {
                _id: objectId('historical'),
                userId: objectId('user-1'),
                sourceAccountId: visa,
                categoryId: category,
                type: 'credit_card_expense',
                amount: 15,
                currency: 'USD',
                date: new Date(2026, 6, 10),
                description: 'Consumo historico',
            },
        ]))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('incluye 1/1, historicos y cuotas con certeza y moneda correctas', async () => {
        const result = await getProjectionForUser('user-1', { mode: 'monthly', monthCount: 1 })
        const period = result.projection[0]

        expect(period.items).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceId: 'one-pay',
                source: { type: 'installment_plan', id: 'one-pay' },
                kind: 'card_single',
                certainty: 'confirmed',
                amount: 120_000,
                currency: 'ARS',
                card: expect.objectContaining({ dueDay: 18 }),
            }),
            expect.objectContaining({
                sourceId: 'historical',
                source: { type: 'transaction', id: 'historical' },
                kind: 'card_single',
                certainty: 'confirmed',
                amount: 15,
                currency: 'USD',
            }),
            expect.objectContaining({
                sourceId: 'installments',
                source: { type: 'installment_plan', id: 'installments' },
                kind: 'card_installment',
                certainty: 'calculated',
                amount: 30,
                currency: 'USD',
                installment: { current: 1, count: 3 },
            }),
        ]))
        expect(period.totals).toMatchObject({
            cardSingle: { ars: 120_000, usd: 15 },
            cardInstallments: { ars: 0, usd: 30 },
            total: { ars: 120_000, usd: 45 },
        })
    })

    it('acota las consultas por usuario y no consulta una vez por periodo', async () => {
        await getProjectionForUser('user-private', { mode: 'monthly', monthCount: 6 })

        expect(mocks.userFindById).toHaveBeenCalledOnce()
        expect(mocks.userFindById).toHaveBeenCalledWith('user-private', expect.any(Object))
        expect(mocks.commitmentFind).toHaveBeenCalledOnce()
        expect(mocks.commitmentFind).toHaveBeenCalledWith({ userId: 'user-private', isActive: true })
        expect(mocks.planFind).toHaveBeenCalledOnce()
        expect(mocks.planFind).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-private' }))
        expect(mocks.applicationFind).toHaveBeenCalledOnce()
        expect(mocks.applicationFind).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-private',
            period: { $in: expect.any(Array) },
        }))
        expect(mocks.transactionFind).toHaveBeenCalledOnce()
        expect(mocks.transactionFind).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-private' }))
    })
})
