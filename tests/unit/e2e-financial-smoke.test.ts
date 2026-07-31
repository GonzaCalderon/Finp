import { describe, expect, it } from 'vitest'

import {
    buildFinancialSmokePeriods,
    deriveFinancialSmokeEmail,
} from '../e2e/helpers/financial-smoke'

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
})
