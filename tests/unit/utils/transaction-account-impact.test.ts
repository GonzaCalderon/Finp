import { describe, expect, it } from 'vitest'
import {
    getBalanceBeforeReplacingTransaction,
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

    it('uses real amount for account impact even when operationalAmount is smaller', () => {
        const transaction = {
            type: 'expense',
            amount: 1000,
            operationalAmount: 400,
            currency: 'ARS',
            sourceAccountId: 'bank',
        }

        const result = getTransactionAccountImpact(transaction)

        expect(result).toEqual({
            accountId: 'bank',
            currency: 'ARS',
            delta: -1000,
            direction: 'decrease',
        })
    })

    it('descuenta el credito anterior al validar una compra de dolares invertida', () => {
        const available = getBalanceBeforeReplacingTransaction({
            currentBalance: 10,
            accountId: 'usd-savings',
            currency: 'USD',
            previousTransaction: {
                type: 'exchange',
                amount: 12000,
                currency: 'ARS',
                sourceAccountId: 'bank',
                destinationAccountId: 'usd-savings',
                destinationAmount: 10,
                destinationCurrency: 'USD',
            },
        })

        expect(available).toBe(0)
    })

    it('devuelve el debito anterior al saldo al editar sobre la misma cuenta', () => {
        const available = getBalanceBeforeReplacingTransaction({
            currentBalance: 3000,
            accountId: 'bank',
            currency: 'ARS',
            previousTransaction: {
                type: 'expense',
                amount: 2000,
                currency: 'ARS',
                sourceAccountId: 'bank',
            },
        })

        expect(available).toBe(5000)
    })
})
