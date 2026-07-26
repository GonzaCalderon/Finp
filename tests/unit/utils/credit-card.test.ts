import { describe, expect, it } from 'vitest'

import {
    buildMonthlyCardPaymentSummary,
    deriveAggregateCardPaymentState,
    deriveCardPaymentState,
    isCreditCardPaymentType,
} from '@/lib/utils/credit-card'
import type { IInstallmentPlan, ITransaction } from '@/types'

const card = (id: string, name: string) => ({
    _id: { toString: () => id },
    name,
    type: 'credit_card',
    color: '#334155',
})

const account = (id: string) => ({
    _id: { toString: () => id },
    name: 'Cuenta',
    type: 'bank',
})

function transaction(
    id: string,
    overrides: Record<string, unknown>
): ITransaction {
    return {
        _id: { toString: () => id },
        userId: { toString: () => 'user-1' },
        type: 'expense',
        amount: 100,
        currency: 'ARS',
        date: new Date(2026, 6, 10),
        description: id,
        createdFrom: 'web',
        createdAt: new Date(2026, 6, 10),
        updatedAt: new Date(2026, 6, 10),
        ...overrides,
    } as unknown as ITransaction
}

function plan(
    id: string,
    cardRef: ReturnType<typeof card>,
    currency: 'ARS' | 'USD',
    amount: number
): IInstallmentPlan {
    return {
        _id: { toString: () => id },
        userId: { toString: () => 'user-1' },
        accountId: cardRef,
        categoryId: { _id: { toString: () => 'category-1' }, name: 'Servicios' },
        description: id,
        currency,
        totalAmount: amount * 3,
        installmentCount: 3,
        installmentAmount: amount,
        purchaseDate: new Date(2026, 5, 10),
        firstClosingMonth: '2026-07',
        createdAt: new Date(2026, 5, 10),
        updatedAt: new Date(2026, 5, 10),
    } as unknown as IInstallmentPlan
}

describe('resumen mensual de tarjetas', () => {
    it.each([
        [0, 0, 'no_charges'],
        [100, 0, 'unpaid'],
        [100, 40, 'partial'],
        [100, 100.005, 'paid'],
        [100, 101, 'overpaid'],
    ] as const)('deriva el estado de %s adeudado y %s pagado', (due, paid, state) => {
        expect(deriveCardPaymentState(due, paid)).toBe(state)
    })

    it('compone estados por moneda sin sumar ARS y USD', () => {
        expect(deriveAggregateCardPaymentState(['paid', 'unpaid'])).toBe('partial')
        expect(deriveAggregateCardPaymentState(['no_charges', 'paid'])).toBe('paid')
        expect(deriveAggregateCardPaymentState(['no_charges', 'overpaid'])).toBe('overpaid')
    })

    it('mantiene cargos, pagos, pendientes y crédito separados por moneda', () => {
        const visa = card('visa', 'Visa')
        const summaries = buildMonthlyCardPaymentSummary({
            month: '2026-07',
            plans: [
                plan('plan-ars', visa, 'ARS', 1000),
                plan('plan-usd', visa, 'USD', 50),
            ],
            transactions: [
                transaction('payment-ars', {
                    type: 'credit_card_payment',
                    amount: 600,
                    currency: 'ARS',
                    destinationAccountId: visa,
                }),
                transaction('payment-usd', {
                    type: 'debt_payment',
                    amount: 60,
                    currency: 'USD',
                    destinationAccountId: visa,
                }),
            ],
        })

        expect(summaries).toHaveLength(1)
        expect(summaries[0]).toMatchObject({
            period: '2026-07',
            due: { ars: 1000, usd: 50 },
            paid: { ars: 600, usd: 60 },
            pending: { ars: 400, usd: 0 },
            credit: { ars: 0, usd: 10 },
            state: 'partial',
            byCurrency: {
                ars: { state: 'partial' },
                usd: { state: 'overpaid' },
            },
        })
        expect(summaries[0].payments).toHaveLength(2)
    })

    it('ignora pagos cuyo destino no es una tarjeta', () => {
        const visa = card('visa', 'Visa')
        const [summary] = buildMonthlyCardPaymentSummary({
            month: '2026-07',
            plans: [plan('plan', visa, 'ARS', 1000)],
            transactions: [
                transaction('wrong-destination', {
                    type: 'credit_card_payment',
                    amount: 1000,
                    destinationAccountId: account('bank'),
                }),
            ],
        })

        expect(summary.paid).toEqual({ ars: 0, usd: 0 })
        expect(summary.state).toBe('unpaid')
    })

    it('ordena por deuda ARS, luego USD y finalmente nombre', () => {
        const summaries = buildMonthlyCardPaymentSummary({
            month: '2026-07',
            plans: [
                plan('cabal', card('cabal', 'Cabal'), 'USD', 200),
                plan('amex', card('amex', 'Amex'), 'ARS', 100),
                plan('visa', card('visa', 'Visa'), 'ARS', 300),
            ],
            transactions: [],
        })

        expect(summaries.map((summary) => summary.cardId)).toEqual(['visa', 'amex', 'cabal'])
    })

    it('unifica el tipo histórico de pago de tarjeta', () => {
        expect(isCreditCardPaymentType('credit_card_payment')).toBe(true)
        expect(isCreditCardPaymentType('debt_payment')).toBe(true)
        expect(isCreditCardPaymentType('transfer')).toBe(false)
    })
})
