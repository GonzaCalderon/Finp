import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    connectDB: vi.fn(),
    InstallmentPlan: { findOne: vi.fn(), deleteOne: vi.fn() },
    Transaction: { findOne: vi.fn(), deleteOne: vi.fn() },
    unlinkTransactionDependents: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({ connectDB: mocks.connectDB }))
vi.mock('@/lib/models', () => ({
    InstallmentPlan: mocks.InstallmentPlan,
    Transaction: mocks.Transaction,
}))
vi.mock('@/lib/server/transaction-teardown', () => ({
    unlinkTransactionDependents: mocks.unlinkTransactionDependents,
}))

const { DELETE } = await import('@/app/api/installments/[id]/route')

const params = Promise.resolve({ id: 'plan-1' })

function request() {
    return new Request('http://localhost/api/installments/plan-1', { method: 'DELETE' })
}

function selectChain(value: unknown) {
    return { select: vi.fn().mockResolvedValue(value) }
}

describe('DELETE /api/installments/[id]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
        mocks.connectDB.mockResolvedValue(undefined)
        mocks.InstallmentPlan.findOne.mockReturnValue(selectChain({ _id: 'plan-1' }))
        mocks.InstallmentPlan.deleteOne.mockResolvedValue({ deletedCount: 1 })
        mocks.Transaction.findOne.mockResolvedValue(null)
        mocks.Transaction.deleteOne.mockResolvedValue({ deletedCount: 1 })
        mocks.unlinkTransactionDependents.mockResolvedValue({
            unlinkedPersonalImpact: false,
            resolvedNotifications: 0,
        })
    })

    it('exige sesión', async () => {
        mocks.auth.mockResolvedValue(null)

        const response = await DELETE(request(), { params })

        expect(response.status).toBe(401)
        expect(mocks.InstallmentPlan.findOne).not.toHaveBeenCalled()
    })

    it('no elimina un plan de otro usuario', async () => {
        mocks.InstallmentPlan.findOne.mockReturnValue(selectChain(null))

        const response = await DELETE(request(), { params })

        expect(response.status).toBe(404)
        expect(mocks.InstallmentPlan.findOne).toHaveBeenCalledWith({
            _id: 'plan-1',
            userId: 'user-1',
        })
        expect(mocks.Transaction.deleteOne).not.toHaveBeenCalled()
        expect(mocks.InstallmentPlan.deleteOne).not.toHaveBeenCalled()
    })

    it('desvincula los dependientes de la compra antes de borrarla', async () => {
        mocks.Transaction.findOne.mockResolvedValue({ _id: 'transaction-1' })
        mocks.unlinkTransactionDependents.mockResolvedValue({
            revertedCommitment: { commitmentId: 'commitment-1', period: '2026-07' },
            unlinkedPersonalImpact: true,
            resolvedNotifications: 2,
        })

        const response = await DELETE(request(), { params })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            reverted: {
                commitment: { commitmentId: 'commitment-1', period: '2026-07' },
                personalImpact: true,
                notifications: 2,
            },
        })
        expect(mocks.unlinkTransactionDependents).toHaveBeenCalledWith('user-1', {
            _id: 'transaction-1',
        })
        expect(mocks.Transaction.deleteOne).toHaveBeenCalledWith({
            _id: 'transaction-1',
            userId: 'user-1',
        })
    })

    it('borra el plan igual cuando ya no tiene compra asociada', async () => {
        const response = await DELETE(request(), { params })

        expect(response.status).toBe(200)
        expect(mocks.unlinkTransactionDependents).not.toHaveBeenCalled()
        expect(mocks.Transaction.deleteOne).not.toHaveBeenCalled()
        // Idempotente: el teardown pudo haberlo borrado ya.
        expect(mocks.InstallmentPlan.deleteOne).toHaveBeenCalledWith({
            _id: 'plan-1',
            userId: 'user-1',
        })
    })
})
