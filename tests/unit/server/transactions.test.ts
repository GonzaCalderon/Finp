import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    Account: {
        find: vi.fn(),
    },
    Category: {
        findOne: vi.fn(),
    },
    Transaction: {
        create: vi.fn(),
        find: vi.fn(),
        findById: vi.fn(),
    },
    TransactionRule: {
        find: vi.fn(),
        updateOne: vi.fn(),
    },
    calculateAccountBalancesByCurrency: vi.fn(),
    User: {
        findById: vi.fn(),
    },
}))

vi.mock('@/lib/models', () => ({
    Account: mocks.Account,
    Category: mocks.Category,
    Transaction: mocks.Transaction,
    TransactionRule: mocks.TransactionRule,
    User: mocks.User,
}))

vi.mock('@/lib/utils/balance', () => ({
    calculateAccountBalancesByCurrency: mocks.calculateAccountBalancesByCurrency,
}))

const {
    createTransactionForUser,
    prepareTransactionForUser,
} = await import('@/lib/server/transactions')

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

function setPossibleDuplicates(rows: Array<Record<string, unknown>>) {
    const query = {
        select: vi.fn(),
        sort: vi.fn(),
        limit: vi.fn(),
        lean: vi.fn().mockResolvedValue(rows),
    }
    query.select.mockReturnValue(query)
    query.sort.mockReturnValue(query)
    query.limit.mockReturnValue(query)
    mocks.Transaction.find.mockReturnValue(query)
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
        mocks.Category.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: { toString: () => 'category-user' },
                name: 'Categoría',
                type: 'expense',
                isArchived: false,
            }),
        })
        mocks.calculateAccountBalancesByCurrency.mockResolvedValue({
            ARS: 100_000,
            USD: 0,
        })
        mocks.Transaction.create.mockResolvedValue({ _id: 'transaction-1' })
        mocks.Transaction.findById.mockReturnValue(
            makeQueryResult({ _id: 'transaction-1' })
        )
        mocks.TransactionRule.updateOne.mockResolvedValue({ modifiedCount: 1 })
        setPossibleDuplicates([])
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

    it('persists quick capture as the real creation source', async () => {
        await createTransactionForUser(
            'user-1',
            {
                type: 'expense',
                amount: 1500,
                currency: 'ARS',
                date: new Date('2026-07-24T12:00:00Z'),
                description: 'Verdulería',
                sourceAccountId: 'account-1',
            },
            { createdFrom: 'quick_capture' }
        )

        expect(mocks.Transaction.create).toHaveBeenCalledWith(
            expect.objectContaining({
                createdFrom: 'quick_capture',
            })
        )
    })
})

describe('prepareTransactionForUser financial safety', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setRules([])
        mocks.Account.find.mockResolvedValue([{
            ...account,
            isActive: true,
        }])
        mocks.calculateAccountBalancesByCurrency.mockResolvedValue({
            ARS: 100,
            USD: 20,
        })
        mocks.Category.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: { toString: () => 'category-1' },
                name: 'Comida',
                type: 'expense',
                isArchived: false,
            }),
        })
        mocks.User.findById.mockReturnValue({
            lean: vi.fn().mockResolvedValue(null),
        })
        setPossibleDuplicates([])
    })

    function expense(overrides: Record<string, unknown> = {}) {
        return {
            type: 'expense',
            amount: 50,
            currency: 'ARS',
            date: new Date('2026-07-24T12:00:00Z'),
            description: 'Café',
            sourceAccountId: 'account-1',
            ...overrides,
        }
    }

    it('rejects an inactive account', async () => {
        mocks.Account.find.mockResolvedValue([{ ...account, isActive: false }])

        await expect(prepareTransactionForUser('user-1', expense())).rejects.toMatchObject({
            code: 'ACCOUNT_INACTIVE',
        })
    })

    it('rejects an account that does not belong to the user', async () => {
        mocks.Account.find.mockResolvedValue([])

        await expect(prepareTransactionForUser('user-1', expense())).rejects.toMatchObject({
            code: 'SOURCE_ACCOUNT_NOT_FOUND',
        })
    })

    it('rejects a currency unsupported by the selected account', async () => {
        await expect(
            prepareTransactionForUser('user-1', expense({ currency: 'USD' }))
        ).rejects.toMatchObject({
            code: 'SOURCE_ACCOUNT_CURRENCY_UNSUPPORTED',
        })
    })

    it('blocks insufficient funds when negative balances are disabled', async () => {
        mocks.Account.find.mockResolvedValue([{
            ...account,
            isActive: true,
            allowNegativeBalance: false,
        }])

        await expect(
            prepareTransactionForUser('user-1', expense({ amount: 150 }))
        ).rejects.toMatchObject({
            code: 'INSUFFICIENT_FUNDS',
        })
    })

    it('rejects a category of the opposite transaction type', async () => {
        mocks.Category.findOne.mockReturnValue({
            lean: vi.fn().mockResolvedValue({
                _id: { toString: () => 'category-1' },
                name: 'Sueldo',
                type: 'income',
                isArchived: false,
            }),
        })

        await expect(
            prepareTransactionForUser('user-1', expense({ categoryId: 'category-1' }))
        ).rejects.toMatchObject({
            code: 'CATEGORY_TYPE_MISMATCH',
        })
    })

    it('routes credit cards away from simple capture', async () => {
        mocks.Account.find.mockResolvedValue([{
            ...account,
            isActive: true,
            type: 'credit_card',
        }])

        await expect(prepareTransactionForUser('user-1', expense())).rejects.toMatchObject({
            code: 'SPECIAL_ACCOUNT_REQUIRES_FULL_FLOW',
        })
    })

    it('requires explicit confirmation for a duplicate found during final creation', async () => {
        setPossibleDuplicates([{
            _id: { toString: () => 'duplicate-1' },
            description: 'Café',
            date: new Date('2026-07-24T12:00:00Z'),
        }])

        await expect(
            createTransactionForUser('user-1', expense(), {
                includePreviewSignals: true,
            })
        ).rejects.toMatchObject({
            code: 'DUPLICATE_CONFIRMATION_REQUIRED',
        })
    })
})
