import { describe, expect, it } from 'vitest'
import {
    getTransactionAccountImpact,
    getTransactionAccountImpacts,
} from '@/lib/utils/transaction-account-impact'

describe('transaction account impact', () => {
    it('returns increase for an adjustment that raises the real balance', () => {
        const result = getTransactionAccountImpact({
            type: 'adjustment',
            amount: -1500,
            currency: 'ARS',
            sourceAccountId: 'cash',
        })

        expect(result).toEqual({
            accountId: 'cash',
            currency: 'ARS',
            delta: 1500,
            direction: 'increase',
        })
    })

    it('returns decrease for an adjustment that lowers the real balance', () => {
        const result = getTransactionAccountImpact({
            type: 'adjustment',
            amount: 900,
            currency: 'ARS',
            sourceAccountId: 'cash',
        })

        expect(result).toEqual({
            accountId: 'cash',
            currency: 'ARS',
            delta: -900,
            direction: 'decrease',
        })
    })

    it('uses the destination account as the primary impact for income', () => {
        const result = getTransactionAccountImpact({
            type: 'income',
            amount: 1000,
            currency: 'USD',
            destinationAccountId: 'savings',
        })

        expect(result).toMatchObject({
            accountId: 'savings',
            currency: 'USD',
            delta: 1000,
            direction: 'increase',
        })
    })

    it('returns source decrease and destination increase for transfers', () => {
        const impacts = getTransactionAccountImpacts({
            type: 'transfer',
            amount: 500,
            currency: 'ARS',
            sourceAccountId: 'bank',
            destinationAccountId: 'wallet',
        })

        expect(impacts).toEqual([
            { accountId: 'bank', currency: 'ARS', delta: -500, direction: 'decrease' },
            { accountId: 'wallet', currency: 'ARS', delta: 500, direction: 'increase' },
        ])
        expect(getTransactionAccountImpact({
            type: 'transfer',
            amount: 500,
            currency: 'ARS',
            sourceAccountId: 'bank',
            destinationAccountId: 'wallet',
        }, 'wallet')?.direction).toBe('increase')
    })

    it('uses source currency and destination currency for manual exchange', () => {
        const impacts = getTransactionAccountImpacts({
            type: 'exchange',
            amount: 12000,
            currency: 'ARS',
            sourceAccountId: 'bank',
            destinationAccountId: 'usd-savings',
            destinationAmount: 10,
            destinationCurrency: 'USD',
        })

        expect(impacts).toEqual([
            { accountId: 'bank', currency: 'ARS', delta: -12000, direction: 'decrease' },
            { accountId: 'usd-savings', currency: 'USD', delta: 10, direction: 'increase' },
        ])
    })

    it('treats credit card payments as source decrease and destination increase', () => {
        const impacts = getTransactionAccountImpacts({
            type: 'debt_payment',
            amount: 7000,
            currency: 'ARS',
            sourceAccountId: 'bank',
            destinationAccountId: 'visa',
        })

        expect(impacts).toEqual([
            { accountId: 'bank', currency: 'ARS', delta: -7000, direction: 'decrease' },
            { accountId: 'visa', currency: 'ARS', delta: 7000, direction: 'increase' },
        ])
        expect(getTransactionAccountImpact({
            type: 'credit_card_payment',
            amount: 7000,
            currency: 'ARS',
            sourceAccountId: 'bank',
            destinationAccountId: 'visa',
        })?.accountId).toBe('bank')
    })
})
