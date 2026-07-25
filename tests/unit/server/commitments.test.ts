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
        findOneAndUpdate: vi.fn(),
        updateOne: vi.fn(),
        exists: vi.fn(),
    },
    Transaction: {
        deleteOne: vi.fn(),
        updateOne: vi.fn(),
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

const {
    applyCommitmentForUser,
    resolveApplicationStateForPeriod,
    revertApplicationForTransaction,
    syncApplicationSnapshotFromTransaction,
    normalizeCommitmentAliases,
} = await import('@/lib/server/commitments')

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
        mocks.CommitmentApplication.findOneAndUpdate.mockResolvedValue({ _id: 'application-1' })
        mocks.Transaction.deleteOne.mockResolvedValue({ deletedCount: 1 })
        mocks.Transaction.updateOne.mockResolvedValue({ matchedCount: 1 })
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
            expect.objectContaining({ createdFrom: 'web', status: 'confirmed' })
        )
        expect(result.transaction).toEqual({ _id: 'transaction-1' })
    })

    it('escribe la procedencia del compromiso en la transacción', async () => {
        await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })

        expect(mocks.createTransactionForUser.mock.calls[0][2].metadata).toEqual({
            commitmentId: commitment._id,
            commitmentPeriod: '2026-03',
            commitmentNameSnapshot: 'Alquiler',
        })

        // Y cierra el vínculo en la otra dirección.
        expect(mocks.Transaction.updateOne).toHaveBeenCalledWith(
            { _id: 'transaction-1', userId: 'user-1' },
            { $set: { commitmentApplicationId: 'application-1' } }
        )
    })

    it('guarda la foto financiera de lo aplicado', async () => {
        await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })

        const update = mocks.CommitmentApplication.findOneAndUpdate.mock.calls[0][1]
        expect(update.$set).toMatchObject({
            status: 'registered',
            origin: 'manual',
            transactionId: 'transaction-1',
            snapshot: expect.objectContaining({
                amount: 1200,
                currency: 'ARS',
                description: 'Alquiler',
                accountId: 'account-1',
                // 1200 != el monto de plantilla (1000) → el usuario lo cambió.
                amountSource: 'manual',
            }),
        })
    })

    it('marca el importe como calculado cuando coincide con el vigente', async () => {
        await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1000,
            accountId: 'account-1',
            date: '2026-03-20',
        })

        expect(
            mocks.CommitmentApplication.findOneAndUpdate.mock.calls[0][1].$set.snapshot.amountSource
        ).toBe('template')
    })

    it('registra el origen quick_capture y lo refleja en createdFrom', async () => {
        await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
            origin: 'quick_capture',
        })

        expect(mocks.createTransactionForUser.mock.calls[0][2].createdFrom).toBe('quick_capture')
        expect(mocks.CommitmentApplication.findOneAndUpdate.mock.calls[0][1].$set.origin).toBe(
            'quick_capture'
        )
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
        mocks.CommitmentApplication.findOne.mockResolvedValue({ _id: 'existing', status: 'registered' })

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

    it('permite volver a aplicar un período revertido reutilizando la fila', async () => {
        mocks.CommitmentApplication.findOne.mockResolvedValue({ _id: 'existing', status: 'reverted' })

        await applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })

        expect(mocks.createTransactionForUser).toHaveBeenCalled()

        const [filter, update, options] = mocks.CommitmentApplication.findOneAndUpdate.mock.calls[0]
        // El filtro excluye las registradas: eso hace el upsert atómico.
        expect(filter).toMatchObject({ status: { $ne: 'registered' } })
        expect(options).toMatchObject({ upsert: true })
        expect(update.$unset).toEqual({ revertedAt: '', revertedReason: '' })
    })

    it('cleans up only the newly created transaction when the unique application index races', async () => {
        const duplicateKeyError = Object.assign(new Error('duplicate key'), { code: 11000 })
        mocks.CommitmentApplication.findOneAndUpdate.mockRejectedValue(duplicateKeyError)

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

    it('no borra la transacción si otra aplicación ya la referencia', async () => {
        mocks.CommitmentApplication.findOneAndUpdate.mockRejectedValue(new Error('boom'))
        mocks.CommitmentApplication.exists.mockResolvedValue({ _id: 'otra' })

        await expect(applyCommitmentForUser('user-1', 'commitment-1', {
            period: '2026-03',
            amount: 1200,
            accountId: 'account-1',
            date: '2026-03-20',
        })).rejects.toMatchObject({ status: 500 })

        expect(mocks.Transaction.deleteOne).not.toHaveBeenCalled()
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

        expect(mocks.CommitmentApplication.findOneAndUpdate).not.toHaveBeenCalled()
    })
})

describe('revertApplicationForTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deja la aplicación en reverted y suelta el transactionId', async () => {
        mocks.CommitmentApplication.findOneAndUpdate.mockResolvedValue({
            commitmentId: { toString: () => 'commitment-1' },
            period: '2026-03',
        })

        const result = await revertApplicationForTransaction('user-1', 'transaction-1')

        expect(result).toEqual({ commitmentId: 'commitment-1', period: '2026-03' })

        const [filter, update] = mocks.CommitmentApplication.findOneAndUpdate.mock.calls[0]
        expect(filter).toEqual({ userId: 'user-1', transactionId: 'transaction-1' })
        expect(update.$set).toMatchObject({ status: 'reverted', revertedReason: 'transaction_deleted' })
        expect(update.$unset).toEqual({ transactionId: '' })
    })

    it('devuelve null cuando la transacción no venía de un compromiso', async () => {
        mocks.CommitmentApplication.findOneAndUpdate.mockResolvedValue(null)

        await expect(revertApplicationForTransaction('user-1', 'transaction-1')).resolves.toBeNull()
    })
})

describe('syncApplicationSnapshotFromTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('actualiza la foto sin tocar la plantilla', async () => {
        mocks.CommitmentApplication.updateOne.mockResolvedValue({ matchedCount: 1 })

        const changed = await syncApplicationSnapshotFromTransaction('user-1', 'transaction-1', {
            amount: 690_000,
            currency: 'ARS',
            description: 'Alquiler julio',
            accountId: 'account-2',
        })

        expect(changed).toBe(true)
        const update = mocks.CommitmentApplication.updateOne.mock.calls[0][1]
        expect(update.$set['snapshot.amount']).toBe(690_000)
        expect(update.$set['snapshot.amountSource']).toBe('manual')
        // Nada del update puede apuntar al ScheduledCommitment.
        expect(Object.keys(update.$set).every((key) => key.startsWith('snapshot.'))).toBe(true)
    })

    it('informa cuando la transacción no tenía aplicación vinculada', async () => {
        mocks.CommitmentApplication.updateOne.mockResolvedValue({ matchedCount: 0 })

        await expect(
            syncApplicationSnapshotFromTransaction('user-1', 'transaction-1', {
                amount: 1,
                currency: 'ARS',
                description: 'x',
            })
        ).resolves.toBe(false)
    })
})

describe('resolveApplicationStateForPeriod', () => {
    it('un período futuro está agendado', () => {
        expect(resolveApplicationStateForPeriod({}, '2026-09', '2026-07', null)).toBe('scheduled')
    })

    it('un compromiso fijo del período actual está listo para registrar', () => {
        expect(resolveApplicationStateForPeriod({ amountPolicy: 'fixed' }, '2026-07', '2026-07', null)).toBe('ready')
    })

    it('un compromiso variable espera el importe', () => {
        expect(
            resolveApplicationStateForPeriod({ amountPolicy: 'variable' }, '2026-07', '2026-07', null)
        ).toBe('awaiting_amount')
    })

    it('un estado persistido gana sobre el derivado', () => {
        expect(
            resolveApplicationStateForPeriod({}, '2026-07', '2026-07', { status: 'registered' })
        ).toBe('registered')
        expect(
            resolveApplicationStateForPeriod({}, '2026-07', '2026-07', { status: 'skipped' })
        ).toBe('skipped')
    })

    it('una aplicación revertida vuelve a derivarse: el período quedó reabierto', () => {
        expect(
            resolveApplicationStateForPeriod({ amountPolicy: 'fixed' }, '2026-07', '2026-07', {
                status: 'reverted',
            })
        ).toBe('ready')
    })
})

describe('normalizeCommitmentAliases', () => {
    it('normaliza, deduplica y descarta los demasiado cortos', () => {
        expect(normalizeCommitmentAliases(['  Alquíler ', 'ALQUILER', 'x', 'Expensas'])).toEqual([
            'alquiler',
            'expensas',
        ])
    })

    it('tolera ausencia de alias', () => {
        expect(normalizeCommitmentAliases(undefined)).toEqual([])
        expect(normalizeCommitmentAliases([])).toEqual([])
    })
})
