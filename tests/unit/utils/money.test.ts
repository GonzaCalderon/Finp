import { describe, expect, it } from 'vitest'

import { getCurrencyScale, isActiveLegalTenderCurrency } from '@/lib/constants/iso-currencies'
import {
    allocateMinorUnitsByLargestRemainder,
    convertMoneyExact,
    decimalToMinorUnits,
    moneyFromDecimal,
} from '@/lib/utils/money'

describe('dinero exacto e ISO 4217', () => {
    it('respeta exponentes 0, 2 y 3 y excluye unidades no monetarias', () => {
        expect(getCurrencyScale('JPY')).toBe(0)
        expect(getCurrencyScale('ARS')).toBe(2)
        expect(getCurrencyScale('KWD')).toBe(3)
        expect(moneyFromDecimal('JPY', '12.6')).toEqual({ currency: 'JPY', minorUnits: '13', scale: 0 })
        expect(moneyFromDecimal('KWD', '1.2344')).toEqual({ currency: 'KWD', minorUnits: '1234', scale: 3 })
        expect(isActiveLegalTenderCurrency('XAU')).toBe(false)
        expect(isActiveLegalTenderCurrency('CLF')).toBe(false)
    })

    it('redondea una sola vez a la unidad menor de destino', () => {
        expect(convertMoneyExact({
            money: moneyFromDecimal('USD', '0.01'),
            targetCurrency: 'JPY',
            rate: '149.5',
        })).toEqual({ currency: 'JPY', minorUnits: '1', scale: 0 })
        expect(decimalToMinorUnits('1.005', 2)).toBe(BigInt(101))
    })

    it('convierte posiciones negativas con redondeo simétrico', () => {
        expect(convertMoneyExact({
            money: { currency: 'USD', minorUnits: '-105', scale: 2 },
            targetCurrency: 'ARS',
            rate: '1300.5',
        })).toEqual({ currency: 'ARS', minorUnits: '-136553', scale: 2 })
    })

    it('reparte por restos mayores con desempate estable', () => {
        expect(allocateMinorUnitsByLargestRemainder({
            totalMinorUnits: BigInt(100),
            weights: [BigInt(1), BigInt(1), BigInt(1)],
            stableKeys: ['b', 'a', 'c'],
        })).toEqual([BigInt(33), BigInt(34), BigInt(33)])
    })
})
