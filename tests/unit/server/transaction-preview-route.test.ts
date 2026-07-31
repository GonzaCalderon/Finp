import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    prepareTransactionForUser: vi.fn(),
    isServiceError: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/server/transactions', () => ({
    prepareTransactionForUser: mocks.prepareTransactionForUser,
}))
vi.mock('@/lib/server/errors', () => ({
    isServiceError: mocks.isServiceError,
}))

const { POST } = await import('@/app/api/transactions/preview/route')

function request(body: unknown) {
    return new Request('http://localhost/api/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

describe('POST /api/transactions/preview', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.isServiceError.mockReturnValue(false)
    })

    it('exige sesión', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await POST(request({}))

        expect(response.status).toBe(401)
        expect(mocks.prepareTransactionForUser).not.toHaveBeenCalled()
    })

    it('permite previsualizar un consumo de tarjeta', async () => {
        mocks.prepareTransactionForUser.mockResolvedValue({
            data: {
                type: 'credit_card_expense',
                amount: 38_500,
                currency: 'ARS',
                date: new Date('2026-07-28T12:00:00.000Z'),
                sourceAccountId: 'card-1',
                categoryId: 'category-1',
                merchant: 'Supermercado',
            },
            description: 'Supermercado',
            category: {
                id: 'category-1',
                name: 'Supermercado',
            },
            accountImpact: {
                accountId: 'card-1',
                accountName: 'Visa',
                currency: 'ARS',
                currentBalance: -20_000,
                resultingBalance: -58_500,
                allowNegativeBalance: true,
            },
            issues: [],
        })

        const response = await POST(request({
            type: 'credit_card_expense',
            amount: 38_500,
            currency: 'ARS',
            date: '2026-07-28',
            description: 'Supermercado',
            sourceAccountId: 'card-1',
        }))

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            valid: true,
            normalized: {
                type: 'credit_card_expense',
                sourceAccountId: 'card-1',
            },
            accountImpact: {
                accountName: 'Visa',
                resultingBalance: -58_500,
            },
        })
        expect(mocks.prepareTransactionForUser).toHaveBeenCalledWith(
            'user-1',
            expect.any(Object),
            { includePreviewSignals: true }
        )
    })
})
