import { describe, expect, it } from 'vitest'

import {
    buildFinancialSmokePeriods,
    deriveFinancialSmokeEmail,
} from '../e2e/helpers/financial-smoke'

const CURRENT_PERIOD_DATE_KEYS = [
    'currentIncome',
    'currentExpenseArs',
    'currentExpenseUsd',
    'currentExchange',
    'negativeExpense',
    'partialDebtPayment',
    'paidDebtCollect',
    'installmentPurchase',
] as const

describe('financial smoke fixture', () => {
    it('deriva un usuario independiente sin exponer una credencial nueva', () => {
        expect(deriveFinancialSmokeEmail('Test@Finp.dev')).toBe(
            'test+financial-smoke@finp.dev'
        )
    })

    it('construye fechas dentro del período actual y el histórico', () => {
        const fixture = buildFinancialSmokePeriods(
            new Date(2026, 6, 28, 12, 0, 0)
        )

        expect(fixture.current).toBe('2026-07')
        expect(fixture.historical).toBe('2026-06')
        expect(fixture.dates.currentIncome.getMonth()).toBe(6)
        expect(fixture.dates.historicalIncome.getMonth()).toBe(5)
    })

    it('mantiene cada movimiento del período en curso antes del instante actual', () => {
        // El saldo acumulado corta en `now`, no al cierre del día: una corrida
        // matutina descartaría los movimientos fechados hoy al mediodía.
        const now = new Date(2026, 8, 10, 10, 44, 0)
        const fixture = buildFinancialSmokePeriods(now)

        expect(fixture.current).toBe('2026-09')
        for (const key of CURRENT_PERIOD_DATE_KEYS) {
            expect(fixture.dates[key].getTime()).toBeLessThan(now.getTime())
        }
    })

    it('sostiene el corte cuando la corrida cae el primer día del período', () => {
        const now = new Date(2026, 8, 1, 0, 30, 0)
        const fixture = buildFinancialSmokePeriods(now)

        for (const key of CURRENT_PERIOD_DATE_KEYS) {
            const date = fixture.dates[key]
            expect(date.getTime()).toBeLessThan(now.getTime())
            expect(date.getMonth()).toBe(8)
            expect(date.getDate()).toBe(1)
        }
    })
})
