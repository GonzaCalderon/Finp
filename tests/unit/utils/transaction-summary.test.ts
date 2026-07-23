import { describe, expect, it } from 'vitest'
import { buildTransactionPeriodSummary } from '@/lib/utils/transaction-summary'
import type { IInstallmentPlan, ITransaction } from '@/types'

function transaction(overrides: Record<string, unknown>): ITransaction {
    return {
        _id: 'tx-id',
        userId: 'user-id',
        type: 'expense',
        amount: 0,
        currency: 'ARS',
        date: new Date('2026-03-10'),
        description: 'Movimiento',
        createdFrom: 'web',
        createdAt: new Date('2026-03-10'),
        updatedAt: new Date('2026-03-10'),
        ...overrides,
    } as unknown as ITransaction
}

function installmentPlan(overrides: Record<string, unknown>): IInstallmentPlan {
    return {
        _id: 'plan-id',
        userId: 'user-id',
        accountId: { _id: 'card-id', name: 'Visa', currency: 'ARS' },
        categoryId: { _id: 'category-id', name: 'Tecnologia' },
        description: 'Notebook',
        currency: 'ARS',
        totalAmount: 1200,
        installmentCount: 3,
        installmentAmount: 400,
        purchaseDate: new Date('2026-01-15'),
        firstClosingMonth: '2026-03',
        createdAt: new Date('2026-01-15'),
        updatedAt: new Date('2026-01-15'),
        ...overrides,
    } as unknown as IInstallmentPlan
}

describe('buildTransactionPeriodSummary', () => {
    it('suma gastos comunes y pagos de tarjeta para el gasto operativo', () => {
        const summary = buildTransactionPeriodSummary({
            month: '2026-03',
            transactions: [
                transaction({ type: 'income', amount: 1000 }),
                transaction({ type: 'expense', amount: 100 }),
                transaction({
                    type: 'credit_card_payment',
                    amount: 300,
                    destinationAccountId: { _id: 'card-id', name: 'Visa', currency: 'ARS' },
                }),
                transaction({
                    type: 'credit_card_expense',
                    amount: 80,
                    sourceAccountId: { _id: 'card-id', name: 'Visa', currency: 'ARS' },
                    categoryId: { _id: 'category-id', name: 'Tecnologia' },
                }),
                transaction({
                    type: 'credit_card_expense',
                    amount: 1200,
                    date: new Date('2026-01-15'),
                    installmentPlanId: 'plan-id',
                    sourceAccountId: { _id: 'card-id', name: 'Visa', currency: 'ARS' },
                }),
            ],
            plans: [installmentPlan({})],
        })

        expect(summary.income).toEqual({ ars: 1000, usd: 0 })
        expect(summary.expense).toEqual({ ars: 400, usd: 0 })
        expect(summary.creditCardExpense).toEqual({ ars: 480, usd: 0 })
        expect(summary.balance).toEqual({ ars: 600, usd: 0 })
    })

    it('mantiene ARS y USD separados', () => {
        const summary = buildTransactionPeriodSummary({
            month: '2026-03',
            transactions: [
                transaction({ type: 'income', amount: 1000, currency: 'ARS' }),
                transaction({ type: 'income', amount: 50, currency: 'USD' }),
                transaction({ type: 'expense', amount: 200, currency: 'ARS' }),
                transaction({ type: 'expense', amount: 20, currency: 'USD' }),
                transaction({
                    type: 'credit_card_payment',
                    amount: 70,
                    currency: 'USD',
                    destinationAccountId: { _id: 'card-id', name: 'Visa', currency: 'USD' },
                }),
            ],
            plans: [
                installmentPlan({
                    currency: 'USD',
                    totalAmount: 300,
                    installmentAmount: 100,
                    accountId: { _id: 'card-id', name: 'Visa', currency: 'USD' },
                }),
            ],
        })

        expect(summary.income).toEqual({ ars: 1000, usd: 50 })
        expect(summary.expense).toEqual({ ars: 200, usd: 90 })
        expect(summary.creditCardExpense).toEqual({ ars: 0, usd: 100 })
        expect(summary.balance).toEqual({ ars: 800, usd: -40 })
    })

    it('refleja cambios de moneda en el balance del periodo', () => {
        const summary = buildTransactionPeriodSummary({
            month: '2026-03',
            transactions: [
                transaction({
                    type: 'exchange',
                    amount: 12500,
                    currency: 'ARS',
                    destinationAmount: 10,
                    destinationCurrency: 'USD',
                }),
                transaction({ type: 'expense', amount: 5, currency: 'USD' }),
            ],
            plans: [],
        })

        expect(summary.income).toEqual({ ars: 0, usd: 0 })
        expect(summary.expense).toEqual({ ars: 0, usd: 5 })
        expect(summary.balance).toEqual({ ars: -12500, usd: 5 })
    })

    it('no cuenta ajustes como ingresos ni gastos operativos', () => {
        const summary = buildTransactionPeriodSummary({
            month: '2026-03',
            transactions: [
                transaction({ type: 'adjustment', amount: -1000, sourceAccountId: 'cash' }),
                transaction({ type: 'adjustment', amount: 400, sourceAccountId: 'cash' }),
            ],
            plans: [],
        })

        expect(summary.income).toEqual({ ars: 0, usd: 0 })
        expect(summary.expense).toEqual({ ars: 0, usd: 0 })
    })

    it('incluye desembolsos y pagos de préstamos en el resultado del período', () => {
        const summary = buildTransactionPeriodSummary({
            month: '2026-03',
            transactions: [
                transaction({
                    type: 'transfer',
                    amount: 500,
                    sourceAccountId: { _id: 'loan', type: 'debt' },
                    destinationAccountId: { _id: 'cash', type: 'cash' },
                }),
                transaction({
                    type: 'transfer',
                    amount: 125,
                    sourceAccountId: { _id: 'cash', type: 'cash' },
                    destinationAccountId: { _id: 'loan', type: 'debt' },
                }),
            ],
            plans: [],
        })

        expect(summary.balance).toEqual({ ars: 375, usd: 0 })
    })
})
