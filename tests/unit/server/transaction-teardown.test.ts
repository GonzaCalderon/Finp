import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    dbSession: {
        withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
        endSession: vi.fn(),
    },
    startSession: vi.fn(),
    revertApplicationForTransaction: vi.fn(),
    SpaceEntryPersonalImpact: {
        findOneAndUpdate: vi.fn(),
        updateOne: vi.fn(),
    },
    Notification: { updateMany: vi.fn() },
    Transaction: {
        findOne: vi.fn(),
        find: vi.fn(),
        exists: vi.fn(),
        updateMany: vi.fn(),
        deleteOne: vi.fn(),
    },
    InstallmentPlan: { findOneAndDelete: vi.fn() },
}))

vi.mock('mongoose', () => ({
    default: { startSession: mocks.startSession },
}))

vi.mock('@/lib/server/commitments', () => ({
    revertApplicationForTransaction: mocks.revertApplicationForTransaction,
}))

vi.mock('@/lib/models', () => ({
    SpaceEntryPersonalImpact: mocks.SpaceEntryPersonalImpact,
    Notification: mocks.Notification,
    Transaction: mocks.Transaction,
    InstallmentPlan: mocks.InstallmentPlan,
}))

const {
    deleteAuthorizedPersonalTransactions,
    normalizePaymentGroup,
    removePersonalImpactWithoutTransaction,
    unlinkTransactionDependents,
} = await import('@/lib/server/transaction-teardown')

const transaction = { _id: { toString: () => 'transaction-1' } }

function selectChain(value: unknown) {
    return { select: vi.fn().mockResolvedValue(value) }
}

function sessionLeanChain(value: unknown) {
    const query = {
        session: vi.fn(),
        lean: vi.fn().mockResolvedValue(value),
    }
    query.session.mockReturnValue(query)
    return query
}

describe('unlinkTransactionDependents', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.startSession.mockResolvedValue(mocks.dbSession)
        mocks.revertApplicationForTransaction.mockResolvedValue(null)
        mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mockResolvedValue(null)
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 0 })
        mocks.Transaction.findOne.mockReturnValue(selectChain(null))
        mocks.Transaction.find.mockReturnValue(selectChain([]))
        mocks.Transaction.exists.mockResolvedValue(null)
        mocks.Transaction.updateMany.mockResolvedValue({ modifiedCount: 0 })
        mocks.Transaction.deleteOne.mockResolvedValue({ deletedCount: 1 })
        mocks.InstallmentPlan.findOneAndDelete.mockResolvedValue(null)
    })

    it('revierte la aplicación del compromiso y la reporta', async () => {
        mocks.revertApplicationForTransaction.mockResolvedValue({
            commitmentId: 'commitment-1',
            period: '2026-07',
        })

        const result = await unlinkTransactionDependents('user-1', transaction)

        expect(mocks.revertApplicationForTransaction).toHaveBeenCalledWith('user-1', 'transaction-1')
        expect(result.revertedCommitment).toEqual({ commitmentId: 'commitment-1', period: '2026-07' })
    })

    it('elimina el plan de cuotas de la compra y lo reporta', async () => {
        mocks.InstallmentPlan.findOneAndDelete.mockResolvedValue({ installmentCount: 6 })

        const result = await unlinkTransactionDependents('user-1', {
            ...transaction,
            installmentPlanId: { toString: () => 'plan-1' },
        })

        expect(result.deletedInstallmentPlan).toEqual({ planId: 'plan-1', installmentCount: 6 })
        expect(mocks.InstallmentPlan.findOneAndDelete).toHaveBeenCalledWith({
            _id: 'plan-1',
            userId: 'user-1',
        })
    })

    it('resuelve el plan tanto poblado como en string', async () => {
        mocks.InstallmentPlan.findOneAndDelete.mockResolvedValue({ installmentCount: 3 })

        await unlinkTransactionDependents('user-1', {
            ...transaction,
            installmentPlanId: { _id: { toString: () => 'plan-poblado' } },
        })
        await unlinkTransactionDependents('user-1', {
            ...transaction,
            installmentPlanId: 'plan-string',
        })

        expect(mocks.InstallmentPlan.findOneAndDelete.mock.calls.map(([filter]) => filter._id)).toEqual([
            'plan-poblado',
            'plan-string',
        ])
    })

    it('conserva el plan si otra compra sigue apuntándolo', async () => {
        mocks.Transaction.exists.mockResolvedValue({ _id: 'transaction-9' })

        const result = await unlinkTransactionDependents('user-1', {
            ...transaction,
            installmentPlanId: 'plan-1',
        })

        expect(mocks.InstallmentPlan.findOneAndDelete).not.toHaveBeenCalled()
        expect(result.deletedInstallmentPlan).toBeUndefined()
        // La compra que se está borrando no cuenta como dueño del plan.
        expect(mocks.Transaction.exists).toHaveBeenCalledWith({
            userId: 'user-1',
            installmentPlanId: 'plan-1',
            _id: { $ne: transaction._id },
        })
    })

    it('no toca planes cuando la transacción no nació de cuotas', async () => {
        const result = await unlinkTransactionDependents('user-1', transaction)

        expect(mocks.Transaction.exists).not.toHaveBeenCalled()
        expect(mocks.InstallmentPlan.findOneAndDelete).not.toHaveBeenCalled()
        expect(result.deletedInstallmentPlan).toBeUndefined()
    })

    it('un fallo al eliminar el plan no impide el resto', async () => {
        mocks.InstallmentPlan.findOneAndDelete.mockRejectedValue(new Error('mongo caído'))
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 })

        const result = await unlinkTransactionDependents('user-1', {
            ...transaction,
            installmentPlanId: 'plan-1',
        })

        expect(result.deletedInstallmentPlan).toBeUndefined()
        expect(result.resolvedNotifications).toBe(1)
    })

    it('desvincula el impacto personal de Espacios soltando el transactionId', async () => {
        mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mockResolvedValue({ _id: 'impact-1' })

        const result = await unlinkTransactionDependents('user-1', transaction)

        expect(result.unlinkedPersonalImpact).toBe(true)

        const [filter, update] = mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mock.calls[0]
        expect(filter).toMatchObject({ userId: 'user-1', transactionId: 'transaction-1' })
        // Sólo toca impactos vivos, no los ya quitados.
        expect(filter.status.$in).toEqual(['linked', 'needs_review'])
        expect(update.$set.status).toBe('removed')
        expect(update.$unset).toEqual({ transactionId: 1, accountId: 1 })
    })

    it('cancela las notificaciones pendientes que apuntaban a la transacción', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 2 })

        const result = await unlinkTransactionDependents('user-1', transaction)

        expect(result.resolvedNotifications).toBe(2)
        const [filter, update] = mocks.Notification.updateMany.mock.calls[0]
        expect(filter['entityRefs.transactionId']).toBe('transaction-1')
        expect(filter.actionStatus).toBe('pending')
        expect(update.$set.actionStatus).toBe('cancelled')
    })

    it('informa el hermano huérfano de un pago dual sin borrarlo', async () => {
        mocks.Transaction.findOne.mockReturnValue(
            selectChain({ _id: { toString: () => 'transaction-2' } })
        )

        const result = await unlinkTransactionDependents('user-1', {
            ...transaction,
            paymentGroupId: 'group-1',
        })

        expect(result.orphanPaymentSiblingId).toBe('transaction-2')
        // El hermano mueve dinero real: nunca se borra por iniciativa propia.
        expect(mocks.Transaction.findOne.mock.calls[0][0]).toMatchObject({
            paymentGroupId: 'group-1',
            _id: { $ne: transaction._id },
        })
    })

    it('no busca hermanos cuando no hay pago dual', async () => {
        await unlinkTransactionDependents('user-1', transaction)

        expect(mocks.Transaction.findOne).not.toHaveBeenCalled()
    })

    it('un fallo en notificaciones no impide revertir el compromiso', async () => {
        mocks.revertApplicationForTransaction.mockResolvedValue({
            commitmentId: 'commitment-1',
            period: '2026-07',
        })
        mocks.Notification.updateMany.mockRejectedValue(new Error('mongo caído'))

        const result = await unlinkTransactionDependents('user-1', transaction)

        expect(result.revertedCommitment).toBeTruthy()
        expect(result.resolvedNotifications).toBe(0)
    })

    it('un fallo en el impacto personal no impide el resto', async () => {
        mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mockRejectedValue(new Error('boom'))
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 })

        const result = await unlinkTransactionDependents('user-1', transaction)

        expect(result.unlinkedPersonalImpact).toBe(false)
        expect(result.resolvedNotifications).toBe(1)
    })

    it('limpia el group id cuando queda una sola parte', async () => {
        mocks.Transaction.find.mockReturnValue(
            selectChain([{ _id: { toString: () => 'transaction-2' } }])
        )

        const result = await normalizePaymentGroup('user-1', 'group-1')

        expect(result).toEqual({
            groupId: 'group-1',
            clearedMemberIds: ['transaction-2'],
        })
        expect(mocks.Transaction.updateMany).toHaveBeenCalledWith(
            {
                userId: 'user-1',
                paymentGroupId: 'group-1',
                _id: { $in: ['transaction-2'] },
            },
            { $unset: { paymentGroupId: 1 } }
        )
    })

    it('conserva un grupo válido de dos partes', async () => {
        mocks.Transaction.find.mockReturnValue(
            selectChain([
                { _id: { toString: () => 'transaction-1' } },
                { _id: { toString: () => 'transaction-2' } },
            ])
        )

        expect(await normalizePaymentGroup('user-1', 'group-1')).toBeNull()
        expect(mocks.Transaction.updateMany).not.toHaveBeenCalled()
    })
})

describe('deleteAuthorizedPersonalTransactions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.startSession.mockResolvedValue(mocks.dbSession)
        mocks.revertApplicationForTransaction.mockResolvedValue(null)
        mocks.SpaceEntryPersonalImpact.findOneAndUpdate.mockResolvedValue(null)
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 0 })
        mocks.Transaction.deleteOne.mockResolvedValue({ deletedCount: 1 })
    })

    it('consulta con alcance completo, ejecuta teardown antes del borrado y usa una transaccion', async () => {
        const target = {
            _id: { toString: () => '64b000000000000000000004' },
            type: 'expense',
        }
        mocks.Transaction.find.mockReturnValue(sessionLeanChain([target]))

        const result = await deleteAuthorizedPersonalTransactions(
            'user-1',
            [{
                transactionId: '64b000000000000000000004',
                spaceId: '64b000000000000000000001',
                spaceEntryId: '64b000000000000000000002',
            }]
        )

        expect(mocks.Transaction.find).toHaveBeenCalledWith({
            userId: 'user-1',
            $or: [{
                _id: '64b000000000000000000004',
                spaceId: '64b000000000000000000001',
                spaceEntryId: '64b000000000000000000002',
            }],
        })
        expect(mocks.dbSession.withTransaction).toHaveBeenCalledOnce()
        expect(mocks.revertApplicationForTransaction.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.Transaction.deleteOne.mock.invocationCallOrder[0])
        expect(mocks.Transaction.deleteOne).toHaveBeenCalledWith(
            {
                _id: '64b000000000000000000004',
                userId: 'user-1',
                spaceId: '64b000000000000000000001',
                spaceEntryId: '64b000000000000000000002',
            },
            { session: mocks.dbSession }
        )
        expect(result.deletedTransactions).toEqual([target])
        expect(mocks.dbSession.endSession).toHaveBeenCalledOnce()
    })

    it('no borra si falla el teardown y devuelve un error observable', async () => {
        const target = {
            _id: { toString: () => '64b000000000000000000004' },
            type: 'expense',
        }
        mocks.Transaction.find.mockReturnValue(sessionLeanChain([target]))
        mocks.revertApplicationForTransaction.mockRejectedValue(new Error('mongo caido'))

        await expect(deleteAuthorizedPersonalTransactions(
            'user-1',
            [{ transactionId: '64b000000000000000000004' }]
        )).rejects.toMatchObject({
            code: 'TRANSACTION_TEARDOWN_FAILED',
            status: 500,
        })

        expect(mocks.Transaction.deleteOne).not.toHaveBeenCalled()
        expect(mocks.dbSession.endSession).toHaveBeenCalledOnce()
    })

    it('es idempotente cuando la transaccion ya no existe', async () => {
        mocks.Transaction.find.mockReturnValue(sessionLeanChain([]))

        const result = await deleteAuthorizedPersonalTransactions(
            'user-1',
            [{ transactionId: '64b000000000000000000004' }]
        )

        expect(result.deletedTransactions).toEqual([])
        expect(mocks.Transaction.deleteOne).not.toHaveBeenCalled()
    })
})

describe('removePersonalImpactWithoutTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.startSession.mockResolvedValue(mocks.dbSession)
        mocks.SpaceEntryPersonalImpact.updateOne.mockResolvedValue({ modifiedCount: 1 })
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 })
    })

    it('cierra impacto y notificaciones en la misma sesion sin buscar transacciones ambiguas', async () => {
        await expect(removePersonalImpactWithoutTransaction(
            'user-1',
            '64b000000000000000000003'
        )).resolves.toBe(true)

        expect(mocks.SpaceEntryPersonalImpact.updateOne).toHaveBeenCalledWith(
            {
                _id: '64b000000000000000000003',
                userId: 'user-1',
                status: { $in: ['linked', 'needs_review'] },
            },
            expect.objectContaining({
                $set: expect.objectContaining({ status: 'removed' }),
                $unset: { transactionId: 1, accountId: 1 },
            }),
            { session: mocks.dbSession }
        )
        expect(mocks.Notification.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientUserId: 'user-1',
                actionStatus: 'pending',
            }),
            expect.objectContaining({
                $set: expect.objectContaining({ actionStatus: 'completed' }),
            }),
            { session: mocks.dbSession }
        )
        expect(mocks.Transaction.find).not.toHaveBeenCalled()
    })
})
