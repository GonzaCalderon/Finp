import { describe, expect, it } from 'vitest'
import { getDefaultFirstClosingMonth } from '@/lib/utils/installments'

describe('getDefaultFirstClosingMonth', () => {
    it('propone el mes calendario siguiente', () => {
        expect(getDefaultFirstClosingMonth(new Date(2026, 6, 28))).toBe('2026-08')
    })

    it('conserva el año al cruzar diciembre', () => {
        expect(getDefaultFirstClosingMonth(new Date(2026, 11, 31))).toBe('2027-01')
    })
})
