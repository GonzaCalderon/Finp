import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    Account: {
        find: vi.fn(),
    },
    Transaction: {
        create: vi.fn(),
        findById: vi.fn(),
    },
    TransactionRule: {
        find: vi.fn(),
        updateOne: vi.fn(),
    },
    calculateAccountBalancesByCurrency: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Account: mocks.Account,
    Transaction: mocks.Transaction,
    TransactionRule: mocks.TransactionRule,
}))

vi.mock('@/lib/utils/balance', () => ({
    calculateAccountBalancesByCurrency: mocks.calculateAccountBalancesByCurrency,
}))

const { createTransactionForUser } = await import('@/lib/server/transactions')

function makeQueryResult<T>(value: T) {
    const query = {
        populate: vi.fn(),
        then: (resolve: (resolved: T) => unknown) => Promise.resolve(resolve(value)),
    }
    query.populate.mockReturnValue(query)
    return query
}

function setRules(rules: Array<Record<string, unknown>>) {
    mocks.TransactionRule.find.mockReturnValue({
        sort: vi.fn().mockResolvedValue(rules),
    })
}

const account = {
    _id: { toString: () => 'account-1' },
    userId: { toString: () => 'user-1' },
    name: 'Cuenta',
    type: 'bank',
    currency: 'ARS',
    supportedCurrencies: ['ARS'],
    allowNegativeBalance: true,
}

describe('createTransactionForUser rule integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.Account.find.mockResolvedValue([account])
        mocks.Transaction.create.mockResolvedValue({ _id: 'transaction-1' })
        mocks.Transaction.findById.mockReturnValue(
            makeQueryResult({ _id: 'transaction-1' })
        )
        mocks.TransactionRule.updateOne.mockResolvedValue({ modifiedCount: 1 })
        setRules([])
    })

    it('applies setType to a simple movement and rewires its account direction', async () => {
        setRules([
            {
                _id: { toString: () => 'rule-1' },
                name: 'Sueldo como ingreso',
                isActive: true,
                priority: 10,
                appliesTo: 'any',
                field: 'description',
                condition: 'contains',
                value: 'sueldo',
                setType: 'income',
            },
        ])

        await createTransactionForUser('user-1', {
            type: 'expense',
            amount: 1000,
            currency: 'ARS',
            date: new Date('2026-07-01T12:00:00Z'),
            description: 'Acreditación SUELDO ref 123456',
            sourceAccountId: 'account-1',
        })

        expect(mocks.Transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'income',
                sourceAccountId: undefined,
                destinationAccountId: 'account-1',
                appliedRuleId: 'rule-1',
                appliedRuleNameSnapshot: 'Sueldo como ingreso',
                appliedRuleActions: { setType: 'income' },
                appliedRuleMatchSnapshot: expect.objectContaining({
                    normalizedRuleValue: 'sueldo',
                }),
            })
        )
        expect(mocks.TransactionRule.updateOne).toHaveBeenCalledWith(
            { _id: 'rule-1', userId: 'user-1' },
            expect.objectContaining({
                $inc: { matchCount: 1 },
            })
        )
    })

    it('fills missing category and merchant while preserving explicit user values', async () => {
        setRules([
            {
                _id: { toString: () => 'rule-2' },
                name: 'Café',
                isActive: true,
                priority: 5,
                appliesTo: 'expense',
                field: 'description',
                condition: 'contains',
                value: 'cafe',
                categoryId: { toString: () => 'category-rule' },
                normalizeMerchant: 'Café Martínez',
            },
        ])

        await createTransactionForUser('user-1', {
            type: 'expense',
            amount: 4500,
            currency: 'ARS',
            date: new Date('2026-07-02T12:00:00Z'),
            description: 'PAGO EN CAFÉ',
            categoryId: 'category-user',
            sourceAccountId: 'account-1',
        })

        expect(mocks.Transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                categoryId: 'category-user',
                merchant: 'Café Martínez',
                appliedRuleActions: {
                    normalizeMerchant: 'Café Martínez',
                },
            })
        )
    })

    it('does not let setType change a specialized credit-card transaction', async () => {
        setRules([
            {
                _id: { toString: () => 'rule-3' },
                name: 'No alterar cuotas',
                isActive: true,
                priority: 5,
                appliesTo: 'expense',
                field: 'description',
                condition: 'contains',
                value: 'notebook',
                setType: 'income',
            },
        ])

        await createTransactionForUser('user-1', {
            type: 'credit_card_expense',
            amount: 500000,
            currency: 'ARS',
            date: new Date('2026-07-03T12:00:00Z'),
            description: 'Notebook',
            sourceAccountId: 'account-1',
        })

        expect(mocks.Transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'credit_card_expense',
                sourceAccountId: 'account-1',
                appliedRuleActions: undefined,
            })
        )
    })
})
