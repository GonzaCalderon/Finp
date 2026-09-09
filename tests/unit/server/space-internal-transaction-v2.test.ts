import { Types } from 'mongoose'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    accountFindOne: vi.fn(),
    categoryFindOne: vi.fn(),
    transactionCreate: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Account: { findOne: mocks.accountFindOne },
    Category: { findOne: mocks.categoryFindOne },
    Transaction: { create: mocks.transactionCreate },
    TransactionRule: {},
    User: {},
}))

import { createInternalSpaceTransaction } from '@/lib/server/transactions'

const references = {
    userId: new Types.ObjectId().toString(),
    spaceId: new Types.ObjectId().toString(),
    spaceEntryId: new Types.ObjectId().toString(),
    spaceImpactId: new Types.ObjectId().toString(),
    spaceOperationId: new Types.ObjectId().toString(),
    accountId: new Types.ObjectId().toString(),
}
const session = {} as never

function sessionResult(value: unknown) {
    return { session: vi.fn().mockResolvedValue(value) }
}

function base() {
    return {
        ...references,
        amount: 40,
        operationalAmount: 40,
        currency: 'ARS' as const,
        date: new Date('2026-08-24T15:00:00Z'),
        description: 'Parte propia',
    }
}

describe('internal space transaction v2', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.accountFindOne.mockReturnValue(sessionResult({
            _id: references.accountId,
            type: 'bank',
            currency: 'ARS',
            supportedCurrencies: ['ARS'],
            isActive: true,
        }))
        mocks.categoryFindOne.mockReturnValue(sessionResult(null))
        mocks.transactionCreate.mockImplementation(async ([data]: [Record<string, unknown>]) => [{
            _id: new Types.ObjectId(), ...data,
        }])
    })

    it('permite la variante interna sin cuenta sólo para parte de no pagador', async () => {
        await createInternalSpaceTransaction({
            ...base(),
            variant: 'participant_expense',
        }, session)
        expect(mocks.accountFindOne).not.toHaveBeenCalled()
        expect(mocks.transactionCreate).toHaveBeenCalledWith([
            expect.objectContaining({
                type: 'expense',
                amount: 40,
                operationalAmount: 40,
                createdFrom: 'space',
                spaceContractVersion: 2,
                sourceAccountId: undefined,
                destinationAccountId: undefined,
            }),
        ], { session })
    })

    it('rechaza que la variante sin cuenta invente otro monto operacional', async () => {
        await expect(createInternalSpaceTransaction({
            ...base(),
            variant: 'participant_expense',
            operationalAmount: 20,
        }, session)).rejects.toMatchObject({ code: 'INVALID_SPACE_OPERATIONAL_AMOUNT' })
    })

    it('pagador conserva salida real y parte propia separadas', async () => {
        await createInternalSpaceTransaction({
            ...base(),
            variant: 'payer_expense',
            sourceAccountId: references.accountId,
            amount: 100,
            operationalAmount: 40,
        }, session)
        expect(mocks.transactionCreate).toHaveBeenCalledWith([
            expect.objectContaining({
                type: 'expense',
                amount: 100,
                operationalAmount: 40,
                sourceAccountId: references.accountId,
            }),
        ], { session })
    })

    it('registra tarjeta del pagador como consumo 1/1 por el total y sin plan', async () => {
        mocks.accountFindOne.mockReturnValue(sessionResult({
            _id: references.accountId,
            type: 'credit_card',
            currency: 'ARS',
            supportedCurrencies: ['ARS', 'USD'],
            isActive: true,
        }))

        await createInternalSpaceTransaction({
            ...base(),
            variant: 'payer_expense',
            sourceAccountId: references.accountId,
            amount: 100,
            operationalAmount: 40,
        }, session)

        expect(mocks.transactionCreate).toHaveBeenCalledWith([
            expect.objectContaining({
                type: 'credit_card_expense',
                amount: 100,
                operationalAmount: 40,
                sourceAccountId: references.accountId,
            }),
        ], { session })
        expect(mocks.transactionCreate.mock.calls[0]?.[0]?.[0]).not.toHaveProperty('installmentPlanId')
    })

    it('no usa una tarjeta como cuenta de liquidación', async () => {
        mocks.accountFindOne.mockReturnValue(sessionResult({
            _id: references.accountId,
            type: 'credit_card',
            currency: 'ARS',
            supportedCurrencies: ['ARS', 'USD'],
            isActive: true,
        }))

        await expect(createInternalSpaceTransaction({
            ...base(),
            variant: 'settlement_paid',
            sourceAccountId: references.accountId,
            operationalAmount: 0,
        }, session)).rejects.toMatchObject({ code: 'SPECIAL_ACCOUNT_REQUIRES_FULL_FLOW' })
    })

    it('liquidación exige impacto operacional cero', async () => {
        await expect(createInternalSpaceTransaction({
            ...base(),
            variant: 'settlement_paid',
            sourceAccountId: references.accountId,
        }, session)).rejects.toMatchObject({ code: 'INVALID_SPACE_SETTLEMENT' })
    })
})
