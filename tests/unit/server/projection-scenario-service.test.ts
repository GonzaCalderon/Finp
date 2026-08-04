import { beforeEach, describe, expect, it, vi } from 'vitest'

function queryResult<T>(value: T) {
    const query = {
        select: vi.fn(),
        lean: vi.fn(),
        then: (resolve: (result: T) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(value).then(resolve, reject),
    }
    query.select.mockReturnValue(query)
    query.lean.mockResolvedValue(value)
    return query
}

const mocks = vi.hoisted(() => ({
    accountFind: vi.fn(),
    categoryFind: vi.fn(),
    userFindById: vi.fn(),
    projection: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Account: { find: mocks.accountFind },
    Category: { find: mocks.categoryFind },
    User: { findById: mocks.userFindById },
}))
vi.mock('@/lib/server/projection', () => ({ getProjectionForUser: mocks.projection }))

const {
    getProjectionScenarioPreviewForUser,
    InvalidScenarioAccountError,
    InvalidScenarioCategoryError,
} = await import('@/lib/server/projection-scenario')

describe('servicio de preview de escenarios', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.projection.mockResolvedValue({ currentPeriod: '2026-07', projection: [] })
        mocks.userFindById.mockReturnValue(queryResult({ preferences: { monthStartDay: 15 } }))
        mocks.categoryFind.mockReturnValue(queryResult([]))
        mocks.accountFind.mockReturnValue(queryResult([]))
    })

    it('agrupa categorías y acota todas las consultas por usuario sin N+1', async () => {
        mocks.categoryFind.mockReturnValue(queryResult([
            { _id: { toString: () => 'food' }, name: 'Comida', color: '#123456' },
        ]))
        const input = {
            view: { mode: 'monthly' as const, months: 24 },
            changes: [
                {
                    id: 'h1',
                    type: 'hypothetical' as const,
                    description: 'Uno',
                    amount: 10,
                    currency: 'ARS' as const,
                    categoryId: 'food',
                    expense: {
                        type: 'commitment' as const,
                        recurrence: { type: 'once' as const, date: '2026-08-01' },
                    },
                },
                {
                    id: 'h2',
                    type: 'hypothetical' as const,
                    description: 'Dos',
                    amount: 20,
                    currency: 'USD' as const,
                    categoryId: 'food',
                    expense: {
                        type: 'commitment' as const,
                        recurrence: { type: 'monthly' as const, dayOfMonth: 31, startDate: '2026-08-01' },
                    },
                },
            ],
        }

        await getProjectionScenarioPreviewForUser('user-private', input)

        expect(mocks.projection).toHaveBeenCalledOnce()
        expect(mocks.projection).toHaveBeenCalledWith('user-private', {
            mode: 'monthly',
            year: undefined,
            monthCount: 24,
        })
        expect(mocks.userFindById).toHaveBeenCalledOnce()
        expect(mocks.userFindById).toHaveBeenCalledWith('user-private', expect.any(Object))
        expect(mocks.categoryFind).toHaveBeenCalledOnce()
        expect(mocks.categoryFind).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-private',
            _id: { $in: ['food'] },
            type: 'expense',
        }))
    })

    it('rechaza de forma indistinguible una categoría inexistente o ajena', async () => {
        await expect(getProjectionScenarioPreviewForUser('user-1', {
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'foreign-category',
                type: 'hypothetical',
                description: 'Gasto',
                amount: 10,
                currency: 'ARS',
                categoryId: 'category-from-user-2',
                expense: { type: 'commitment', recurrence: { type: 'once', date: '2026-08-01' } },
            }],
        })).rejects.toBeInstanceOf(InvalidScenarioCategoryError)
    })

    it('no consulta categorías cuando el escenario no las usa', async () => {
        await getProjectionScenarioPreviewForUser('user-1', {
            view: { mode: 'monthly', months: 6 },
            changes: [],
        })
        expect(mocks.categoryFind).not.toHaveBeenCalled()
        expect(mocks.accountFind).not.toHaveBeenCalled()
    })

    it('agrupa tarjetas y rechaza una tarjeta ajena o inactiva', async () => {
        const accountId = '720000000000000000000001'
        const input = {
            view: { mode: 'monthly' as const, months: 6 },
            changes: [{
                id: 'card-purchase',
                type: 'hypothetical' as const,
                description: 'Notebook',
                amount: 120_000,
                currency: 'USD' as const,
                expense: {
                    type: 'card_installment' as const,
                    accountId,
                    purchaseDate: '2026-07-31',
                    firstClosingMonth: '2026-08',
                    installmentCount: 3,
                },
            }],
        }
        mocks.accountFind.mockReturnValue(queryResult([]))

        await expect(getProjectionScenarioPreviewForUser('user-1', input))
            .rejects.toBeInstanceOf(InvalidScenarioAccountError)
        expect(mocks.accountFind).toHaveBeenCalledOnce()
        expect(mocks.accountFind).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-1',
            _id: { $in: [accountId] },
            type: 'credit_card',
            isActive: true,
        }))
    })

    it('proyecta una compra con una tarjeta activa autorizada en una consulta agrupada', async () => {
        const accountId = '720000000000000000000001'
        mocks.projection.mockResolvedValue({
            currentPeriod: '2026-07',
            projection: [{
                month: '2026-08',
                isCurrentMonth: false,
                isPast: false,
                items: [],
                totals: {
                    commitments: { ars: 0, usd: 0 },
                    cardSingle: { ars: 0, usd: 0 },
                    cardInstallments: { ars: 0, usd: 0 },
                    hypothetical: { ars: 0, usd: 0 },
                    estimated: { ars: 0, usd: 0 },
                    total: { ars: 0, usd: 0 },
                    pendingAmountCount: 0,
                },
            }],
        })
        mocks.accountFind.mockReturnValue(queryResult([{
            _id: { toString: () => accountId },
            name: 'Visa',
            type: 'credit_card',
            supportedCurrencies: ['ARS', 'USD'],
            creditCardConfig: { dueDay: 10 },
        }]))

        const result = await getProjectionScenarioPreviewForUser('user-1', {
            view: { mode: 'monthly', months: 6 },
            changes: [{
                id: 'card-purchase',
                type: 'hypothetical',
                description: 'Auriculares',
                amount: 120,
                currency: 'USD',
                expense: {
                    type: 'card_single',
                    accountId,
                    purchaseDate: '2026-07-31',
                    firstClosingMonth: '2026-08',
                },
            }],
        })

        expect(result.scenario.projection[0].items[0]).toMatchObject({
            kind: 'card_single',
            amount: 120,
            currency: 'USD',
            card: { id: accountId, name: 'Visa', dueDay: 10 },
        })
        expect(mocks.accountFind).toHaveBeenCalledOnce()
    })
})
