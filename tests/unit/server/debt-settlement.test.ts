import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    const dbSession = {
        withTransaction: vi.fn(async (callback: () => Promise<void>) => callback()),
        endSession: vi.fn(),
    }

    return {
        dbSession,
        startSession: vi.fn(async () => dbSession),
        debtFindOne: vi.fn(),
        debtUpdateOne: vi.fn(),
        transactionCreate: vi.fn(),
        transactionUpdateOne: vi.fn(),
        movementCreate: vi.fn(),
        spaceEntryCreate: vi.fn(),
    }
})

vi.mock('mongoose', () => ({
    default: { startSession: mocks.startSession },
}))

vi.mock('@/lib/models', () => ({
    Debt: {
        findOne: mocks.debtFindOne,
        updateOne: mocks.debtUpdateOne,
    },
    DebtMovement: { create: mocks.movementCreate },
    SpaceEntry: { create: mocks.spaceEntryCreate },
    Transaction: {
        create: mocks.transactionCreate,
        updateOne: mocks.transactionUpdateOne,
    },
}))

import { createDebtSettlement } from '@/lib/server/debt-settlement'

describe('createDebtSettlement', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.debtFindOne.mockReturnValue({
            session: vi.fn().mockResolvedValue({
                _id: 'debt-id',
                direction: 'payable',
                status: 'active',
                remainingAmount: 100,
            }),
        })
        mocks.transactionCreate.mockResolvedValue([{
            _id: { toString: () => 'transaction-id' },
        }])
        mocks.debtUpdateOne.mockResolvedValue({ acknowledged: true })
        mocks.movementCreate.mockResolvedValue([])
    })

    it('registra movimiento, transacción y deuda dentro de una única operación', async () => {
        const result = await createDebtSettlement({
            userId: 'user-id',
            debtId: 'debt-id',
            expectedDirection: 'payable',
            amount: 30,
            transaction: { type: 'personal_debt_payment' },
            movement: { type: 'payment' },
        })

        expect(result).toEqual({
            transactionId: 'transaction-id',
            spaceEntryId: undefined,
        })
        expect(mocks.dbSession.withTransaction).toHaveBeenCalledOnce()
        expect(mocks.transactionCreate).toHaveBeenCalledWith(
            [{ type: 'personal_debt_payment' }],
            { session: mocks.dbSession }
        )
        expect(mocks.debtUpdateOne).toHaveBeenCalledWith(
            { _id: 'debt-id' },
            { $set: { remainingAmount: 70, status: 'partially_paid' } },
            { session: mocks.dbSession }
        )
        expect(mocks.movementCreate).toHaveBeenCalledWith(
            [expect.objectContaining({
                userId: 'user-id',
                debtId: 'debt-id',
                transactionId: expect.anything(),
            })],
            { session: mocks.dbSession }
        )
        expect(mocks.dbSession.endSession).toHaveBeenCalledOnce()
    })
})
