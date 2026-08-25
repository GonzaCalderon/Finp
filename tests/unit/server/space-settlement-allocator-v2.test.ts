import { describe, expect, it } from 'vitest'

import { applySettlementLegsV2 } from '@/lib/server/space-settlement-allocator-v2'
import { moneyFromDecimal, type ConversionSnapshot } from '@/lib/utils/money'

function snapshot(rate: string, fromCurrency: string, toCurrency: string): ConversionSnapshot {
    return {
        rate,
        direction: 'multiply',
        source: 'manual',
        manualAuthorUserId: 'actor',
        observedAt: '2026-08-24T12:00:00.000Z',
        capturedAt: '2026-08-24T12:00:00.000Z',
        path: [{ fromCurrency, toCurrency, rate, source: 'manual' }],
    }
}

describe('liquidación multitramos por moneda', () => {
    it('aplica primero la misma moneda y conserva el resto en la moneda de deuda', () => {
        const result = applySettlementLegsV2({
            components: [
                { currency: 'USD', amount: moneyFromDecimal('USD', 50), order: 0 },
                { currency: 'ARS', amount: moneyFromDecimal('ARS', 100_000), order: 1 },
            ],
            legs: [{ id: 'usd', paid: moneyFromDecimal('USD', 30) }],
        })
        expect(result.applications).toHaveLength(1)
        expect(result.applications[0].debtCurrency).toBe('USD')
        expect(result.remaining).toEqual([
            moneyFromDecimal('USD', 20),
            moneyFromDecimal('ARS', 100_000),
        ])
    })

    it('aplica dos tramos atómicos y traza la conversión cruzada', () => {
        const usdArs = snapshot('1000', 'USD', 'ARS')
        const result = applySettlementLegsV2({
            components: [
                { currency: 'USD', amount: moneyFromDecimal('USD', 50), order: 0 },
                { currency: 'ARS', amount: moneyFromDecimal('ARS', 100_000), order: 1 },
            ],
            legs: [
                { id: 'usd', paid: moneyFromDecimal('USD', 50) },
                { id: 'ars', paid: moneyFromDecimal('ARS', 40_000) },
                { id: 'extra-usd', paid: moneyFromDecimal('USD', 60), conversions: [{ targetCurrency: 'ARS', snapshot: usdArs }] },
            ],
        })
        expect(result.remaining.every((money) => money.minorUnits === '0')).toBe(true)
        expect(result.applications.at(-1)?.conversionSnapshot).toEqual(usdArs)
    })

    it('rechaza sobrepago superior a una unidad menor', () => {
        expect(() => applySettlementLegsV2({
            components: [{ currency: 'USD', amount: moneyFromDecimal('USD', 10), order: 0 }],
            legs: [{ id: 'usd', paid: moneyFromDecimal('USD', '10.02') }],
        })).toThrow('SPACE_SETTLEMENT_OVERPAYMENT')
    })
})
