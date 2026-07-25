import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    transactionLean: vi.fn(),
    commitmentLean: vi.fn(),
    dismissalLean: vi.fn(),
    categoryLean: vi.fn(),
}))

function transactionQuery() {
    return {
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: mocks.transactionLean,
    }
}

function simpleQuery(lean: ReturnType<typeof vi.fn>) {
    return {
        select: vi.fn().mockReturnThis(),
        lean,
    }
}

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    Transaction: { find: vi.fn(() => transactionQuery()) },
    ScheduledCommitment: {
        find: vi.fn(() => simpleQuery(mocks.commitmentLean)),
    },
    FunctionalSuggestionDismissal: {
        find: vi.fn(() => simpleQuery(mocks.dismissalLean)),
    },
    Category: {
        find: vi.fn(() => simpleQuery(mocks.categoryLean)),
    },
}))

const { GET } = await import('@/app/api/commitments/suggestions/route')

describe('GET /api/commitments/suggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.commitmentLean.mockResolvedValue([])
        mocks.dismissalLean.mockResolvedValue([])
        mocks.categoryLean.mockResolvedValue([])
        mocks.transactionLean.mockResolvedValue([
            {
                _id: { toString: () => '1' },
                description: 'Internet',
                merchant: 'FibraNet',
                amount: 20_000,
                currency: 'ARS',
                date: new Date(2026, 0, 8),
            },
            {
                _id: { toString: () => '2' },
                description: 'Internet',
                merchant: 'FibraNet',
                amount: 20_500,
                currency: 'ARS',
                date: new Date(2026, 1, 8),
            },
            {
                _id: { toString: () => '3' },
                description: 'Internet',
                merchant: 'FibraNet',
                amount: 21_000,
                currency: 'ARS',
                date: new Date(2026, 2, 8),
            },
        ])
    })

    it('exige autenticación antes de consultar historial', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await GET()

        expect(response.status).toBe(401)
        expect(mocks.connectDB).not.toHaveBeenCalled()
    })

    it('devuelve candidatos explicables sin escribir entidades', async () => {
        const response = await GET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.suggestions).toEqual([
            expect.objectContaining({
                description: 'FibraNet',
                amountPolicy: 'fixed',
                occurrences: 3,
            }),
        ])
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    })
})
