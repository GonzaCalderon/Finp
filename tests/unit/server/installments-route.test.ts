import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    InstallmentPlan: {
        create: vi.fn(),
        deleteOne: vi.fn(),
        updateOne: vi.fn(),
        findById: vi.fn(),
        find: vi.fn(),
    },
    Transaction: {
        findById: vi.fn(),
        find: vi.fn(),
    },
    createTransactionForUser: vi.fn(),
    isServiceError: vi.fn(),
    recordTransactionLearningEvent: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    InstallmentPlan: mocks.InstallmentPlan,
    Transaction: mocks.Transaction,
}))
vi.mock('@/lib/server/transactions', () => ({
    createTransactionForUser: mocks.createTransactionForUser,
}))
vi.mock('@/lib/server/errors', () => ({
    isServiceError: mocks.isServiceError,
}))
vi.mock('@/lib/server/quick-capture-learning', () => ({
    recordTransactionLearningEvent: mocks.recordTransactionLearningEvent,
}))

const { POST } = await import('@/app/api/installments/route')

function query(value: unknown) {
    const chain: {
        populate: ReturnType<typeof vi.fn>
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>
    } = {
        populate: vi.fn(),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    }
    chain.populate.mockReturnValue(chain)
    return chain
}

function request(overrides: Record<string, unknown> = {}) {
    return new Request('http://localhost/api/installments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            description: 'Supermercado',
            totalAmount: 38_500,
            currency: 'ARS',
            installmentCount: 1,
            accountId: 'card-1',
            categoryId: 'category-1',
            purchaseDate: '2026-07-28T12:00:00.000Z',
            firstClosingMonth: '2026-08',
            ...overrides,
        }),
    })
}

describe('POST /api/installments', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.isServiceError.mockReturnValue(false)
        mocks.InstallmentPlan.create.mockResolvedValue({ _id: 'plan-1' })
        mocks.InstallmentPlan.deleteOne.mockResolvedValue({ deletedCount: 1 })
        mocks.InstallmentPlan.updateOne.mockResolvedValue({ modifiedCount: 0 })
        mocks.createTransactionForUser.mockResolvedValue({
            _id: 'transaction-1',
            categoryId: { toString: () => 'category-1' },
        })
        mocks.InstallmentPlan.findById.mockReturnValue(query({
            _id: 'plan-1',
            toObject: () => ({ _id: 'plan-1' }),
        }))
        mocks.Transaction.findById.mockReturnValue(query({
            _id: 'transaction-1',
        }))
        mocks.recordTransactionLearningEvent.mockResolvedValue(undefined)
    })

    it('marca procedencia, duplicados y telemetría de Captura rápida', async () => {
        const response = await POST(request({
            quickCapture: true,
            allowPotentialDuplicate: true,
            quickCaptureLearning: {
                sessionId: 'capture:session-1',
                durationMs: 1200,
            },
        }))

        expect(response.status).toBe(201)
        expect(mocks.createTransactionForUser).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                type: 'credit_card_expense',
                sourceAccountId: 'card-1',
                amount: 38_500,
            }),
            expect.objectContaining({
                createdFrom: 'quick_capture',
                includePreviewSignals: true,
                allowPotentialDuplicate: true,
                metadata: { installmentPlanId: 'plan-1' },
            })
        )
        expect(mocks.recordTransactionLearningEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                type: 'capture_confirmed',
                sessionId: 'capture:session-1',
                eventId: 'capture_confirmed:transaction-1',
            })
        )
    })

    it('elimina el plan si falla la creación de la transacción padre', async () => {
        mocks.createTransactionForUser.mockRejectedValue(new Error('falló la transacción'))

        const response = await POST(request({ quickCapture: true }))

        expect(response.status).toBe(500)
        expect(mocks.InstallmentPlan.deleteOne).toHaveBeenCalledWith({
            _id: 'plan-1',
            userId: 'user-1',
        })
        expect(mocks.Transaction.findById).not.toHaveBeenCalled()
    })
})
