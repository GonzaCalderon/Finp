import { describe, expect, it } from 'vitest'

import {
    getArsPerUsdRate,
    getDestinationAmountFromRate,
    getExchangeOperationLabel,
    getSourceAmountFromRate,
    invertManualExchange,
    normalizeManualExchange,
} from '@/lib/utils/exchange'

describe('manual exchange', () => {
    it('calcula ARS por USD al comprar dolares', () => {
        expect(getArsPerUsdRate({
            sourceCurrency: 'ARS',
            sourceAmount: 125000,
            destinationCurrency: 'USD',
            destinationAmount: 100,
        })).toBe(1250)
    })

    it('calcula la misma cotizacion al vender dolares', () => {
        expect(getArsPerUsdRate({
            sourceCurrency: 'USD',
            sourceAmount: 100,
            destinationCurrency: 'ARS',
            destinationAmount: 127000,
        })).toBe(1270)
    })

    it('normaliza una cotizacion enviada que no coincide con los montos', () => {
        const normalized = normalizeManualExchange({
            sourceCurrency: 'ARS',
            sourceAmount: 125000,
            destinationCurrency: 'USD',
            destinationAmount: 100,
            exchangeRate: 999,
        })

        expect(normalized.exchangeRate).toBe(1250)
        expect(normalized.arsPerUsdRate).toBe(1250)
    })

    it('invierte cuentas, monedas y montos en conjunto', () => {
        expect(invertManualExchange({
            sourceAccountId: 'ars-bank',
            destinationAccountId: 'usd-bank',
            sourceCurrency: 'ARS',
            sourceAmount: 125000,
            destinationCurrency: 'USD',
            destinationAmount: 100,
            exchangeRate: 1250,
        })).toEqual({
            sourceAccountId: 'usd-bank',
            destinationAccountId: 'ars-bank',
            sourceCurrency: 'USD',
            sourceAmount: 100,
            destinationCurrency: 'ARS',
            destinationAmount: 125000,
            exchangeRate: 1250,
        })
    })

    it('explica si el usuario compra o vende dolares', () => {
        expect(getExchangeOperationLabel('ARS', 'USD')).toBe('Compra de dólares')
        expect(getExchangeOperationLabel('USD', 'ARS')).toBe('Venta de dólares')
    })

    it('calcula cualquiera de los dos montos manteniendo fija la cotizacion', () => {
        expect(getDestinationAmountFromRate({
            sourceCurrency: 'ARS',
            sourceAmount: 156000,
            destinationCurrency: 'USD',
            exchangeRate: 1560,
        })).toBe(100)
        expect(getSourceAmountFromRate({
            sourceCurrency: 'ARS',
            destinationAmount: 200,
            destinationCurrency: 'USD',
            exchangeRate: 1560,
        })).toBe(312000)
        expect(getDestinationAmountFromRate({
            sourceCurrency: 'USD',
            sourceAmount: 100,
            destinationCurrency: 'ARS',
            exchangeRate: 1540,
        })).toBe(154000)
        expect(getSourceAmountFromRate({
            sourceCurrency: 'USD',
            destinationAmount: 308000,
            destinationCurrency: 'ARS',
            exchangeRate: 1540,
        })).toBe(200)
    })

    it('rechaza monedas iguales y montos no positivos', () => {
        expect(() => normalizeManualExchange({
            sourceCurrency: 'ARS',
            sourceAmount: 100,
            destinationCurrency: 'ARS',
            destinationAmount: 100,
            exchangeRate: 1,
        })).toThrow(/distintas/i)

        expect(() => normalizeManualExchange({
            sourceCurrency: 'ARS',
            sourceAmount: 0,
            destinationCurrency: 'USD',
            destinationAmount: 100,
            exchangeRate: 1,
        })).toThrow(/mayores a 0/i)
    })
})
