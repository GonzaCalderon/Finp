import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    transactionFind: vi.fn(),
    transactionSelect: vi.fn(),
    transactionSort: vi.fn(),
    transactionLimit: vi.fn(),
    transactionLean: vi.fn(),
    ruleFind: vi.fn(),
    ruleLean: vi.fn(),
    dismissalFind: vi.fn(),
    dismissalSelect: vi.fn(),
    dismissalLean: vi.fn(),
    dismissalUpdateOne: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    Transaction: { find: mocks.transactionFind },
    TransactionRule: { find: mocks.ruleFind },
    RuleSuggestionDismissal: {
        find: mocks.dismissalFind,
        updateOne: mocks.dismissalUpdateOne,
    },
}))

const { GET } = await import('@/app/api/transaction-rules/suggestions/route')
const { POST } = await import(
    '@/app/api/transaction-rules/suggestions/dismiss/route'
)

function dismissRequest(body: unknown) {
    return new Request(
        'https://finp.test/api/transaction-rules/suggestions/dismiss',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    )
}

describe('transaction rule suggestions routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)

        mocks.transactionLean.mockResolvedValue([
            {
                _id: { toString: () => 'transaction-1' },
                type: 'expense',
                categoryId: { toString: () => 'category-health' },
                description: 'Compra uno',
                merchant: 'Farmacity',
                date: new Date('2026-07-01'),
            },
            {
                _id: { toString: () => 'transaction-2' },
                type: 'expense',
                categoryId: { toString: () => 'category-health' },
                description: 'Compra dos',
                merchant: 'Farmacity',
                date: new Date('2026-07-02'),
            },
            {
                _id: { toString: () => 'transaction-3' },
                type: 'expense',
                categoryId: { toString: () => 'category-health' },
                description: 'Compra tres',
                merchant: 'Farmacity',
                date: new Date('2026-07-03'),
            },
        ])
        mocks.transactionLimit.mockReturnValue({ lean: mocks.transactionLean })
        mocks.transactionSort.mockReturnValue({ limit: mocks.transactionLimit })
        mocks.transactionSelect.mockReturnValue({ sort: mocks.transactionSort })
        mocks.transactionFind.mockReturnValue({ select: mocks.transactionSelect })

        mocks.ruleLean.mockResolvedValue([])
        mocks.ruleFind.mockReturnValue({ lean: mocks.ruleLean })

        mocks.dismissalLean.mockResolvedValue([])
        mocks.dismissalSelect.mockReturnValue({ lean: mocks.dismissalLean })
        mocks.dismissalFind.mockReturnValue({ select: mocks.dismissalSelect })
        mocks.dismissalUpdateOne.mockResolvedValue({ acknowledged: true })
    })

    it('isolates suggestion history by authenticated user and disables caching', async () => {
        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        expect(mocks.transactionFind).toHaveBeenCalledWith({
            userId: 'user-1',
            type: { $in: ['expense', 'income', 'credit_card_expense'] },
            categoryId: { $exists: true, $ne: null },
        })
        expect(body.suggestions).toEqual([
            expect.objectContaining({
                field: 'merchant',
                value: 'Farmacity',
                categoryId: 'category-health',
                occurrences: 3,
            }),
        ])
    })

    it('requires authentication before reading suggestion data', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await GET()

        expect(response.status).toBe(401)
        expect(mocks.transactionFind).not.toHaveBeenCalled()
    })

    it('persists a dismissal for the current user without duplicates', async () => {
        const response = await POST(dismissRequest({ key: 'expense|merchant|farmacity|health' }))

        expect(response.status).toBe(200)
        expect(mocks.dismissalUpdateOne).toHaveBeenCalledWith(
            {
                userId: 'user-1',
                key: 'expense|merchant|farmacity|health',
            },
            {
                $setOnInsert: expect.objectContaining({
                    userId: 'user-1',
                    key: 'expense|merchant|farmacity|health',
                    dismissedAt: expect.any(Date),
                }),
            },
            { upsert: true }
        )
    })

    it('rejects malformed dismissal keys before connecting to the database', async () => {
        const response = await POST(dismissRequest({ key: '' }))

        expect(response.status).toBe(400)
        expect(mocks.connectDB).not.toHaveBeenCalled()
        expect(mocks.dismissalUpdateOne).not.toHaveBeenCalled()
    })
})
