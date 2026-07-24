import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceError } from '@/lib/server/errors'

const mocks = vi.hoisted(() => ({
    createTransactionForUser: vi.fn(),
    User: {
        findById: vi.fn(),
    },
    ScheduledCommitment: {
        findOne: vi.fn(),
    },
    CommitmentApplication: {
        findOne: vi.fn(),
        create: vi.fn(),
        exists: vi.fn(),
    },
    Transaction: {
        deleteOne: vi.fn(),
    },
}))

vi.mock('@/lib/server/transactions', () => ({
    createTransactionForUser: mocks.createTransactionForUser,
}))

vi.mock('@/lib/models', () => ({
    User: mocks.User,
    ScheduledCommitment: mocks.ScheduledCommitment,
    CommitmentApplication: mocks.CommitmentApplication,
    Transaction: mocks.Transaction,
}))

const { applyCommitmentForUser } = await import('@/lib/server/commitments')

const commitment = {
    _id: { toString: () => 'commitment-1' },
    isActive: true,
    description: 'Alquiler',
    amount: 1000,
    currency: 'ARS',
    categoryId: { toString: () => 'category-1' },
}

describe('applyCommitmentForUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.User.findById.mockResolvedValue({ preferences: { monthStartDay: 15 } })
        mocks.ScheduledCommitment.findOne.mockResolvedValue(commitment)
        mocks.CommitmentApplication.findOne.mockResolvedValue(null)
        mocks.CommitmentApplication.exists.mockResolvedValue(null)
        mocks.CommitmentApplication.create.mockResolvedValue({ _id: 'application-1' })
        mocks.Transaction.deleteOne.mockResolvedValue({ deletedCount: 1 })
        mocks.createTransactionForUser.mockResolvedValue({ _id: 'transaction-1' })
    })

    it('creates an expense transaction and then records the application', async () => {
        const result = await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
            notes: 'Pagado',
        })

        expect(mocks.createTransactionForUser).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                type: 'expense',
                amount: 1200,
                currency: 'ARS',
                description: 'Alquiler',
                categoryId: 'category-1',
                sourceAccountId: 'account-1',
                notes: 'Pagado',
            }),
            { createdFrom: 'web', status: 'confirmed' }
        )
        expect(mocks.CommitmentApplication.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                commitmentId: 'commitment-1',
                period: '2026-03',
                transactionId: 'transaction-1',
                appliedBy: 'manual',
            })
        )
        expect(result.transaction).toEqual({ _id: 'transaction-1' })
    })

    it('rejects a transaction date outside the financial period', async () => {
        await expect(applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-10',
        })).rejects.toMatchObject({
            status: 400,
            code: 'COMMITMENT_DATE_OUTSIDE_PERIOD',
        })

        expect(mocks.createTransactionForUser).not.toHaveBeenCalled()
    })

    it('parses YYYY-MM-DD as a local date when validating the financial period', async () => {
        mocks.User.findById.mockResolvedValue({ preferences: { monthStartDay: 1 } })

        await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-04',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-04-01',
        })

        expect(mocks.createTransactionForUser).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                date: new Date(2026, 3, 1),
            }),
            expect.any(Object)
        )
    })

    it('rejects an already applied commitment with 409 before creating a transaction', async () => {
        mocks.CommitmentApplication.findOne.mockResolvedValue({ _id: 'existing' })

        await expect(applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })).rejects.toMatchObject({
            status: 409,
            code: 'COMMITMENT_ALREADY_APPLIED',
        })

        expect(mocks.createTransactionForUser).not.toHaveBeenCalled()
    })

    it('cleans up only the newly created transaction when the unique application index races', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 })
        mocks.CommitmentApplication.create.mockRejectedValue(duplicateKeyError)

        await expect(applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })).rejects.toMatchObject({
            status: 409,
            code: 'COMMITMENT_ALREADY_APPLIED',
        })

        expect(mocks.Transaction.deleteOne).toHaveBeenCalledWith({
            _id: 'transaction-1',
            userId: 'user-1',
        })
    })

    it('does not create an application if transaction creation fails', async () => {
        mocks.createTransactionForUser.mockRejectedValue(new ServiceError(400, 'INSUFFICIENT_FUNDS', 'Saldo insuficiente'))

        await expect(applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })).rejects.toMatchObject({
            status: 400,
            code: 'INSUFFICIENT_FUNDS',
        })

        expect(mocks.CommitmentApplication.create).not.toHaveBeenCalled()
    })
})
