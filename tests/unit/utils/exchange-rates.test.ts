import { describe, expect, it } from 'vitest'

import {
    getQuoteRateForDirection,
    parseDolarApiQuotes,
} from '@/lib/utils/exchange-rates'

describe('exchange rate quotes', () => {
    const payload = [
        {
            moneda: 'USD',
            casa: 'oficial',
            nombre: 'Oficial',
            compra: 1400,
            venta: 1450,
            fechaActualizacion: '2026-07-22T18:00:00.000Z',
        },
        {
            moneda: 'USD',
            casa: 'blue',
            nombre: 'Blue',
            compra: 1500,
            venta: 1520,
            fechaActualizacion: '2026-07-22T20:59:00.000Z',
        },
        {
            moneda: 'USD',
            casa: 'tarjeta',
            nombre: 'Tarjeta',
            compra: 1800,
            venta: 1900,
            fechaActualizacion: '2026-07-22T18:00:00.000Z',
        },
    ]

    it('normaliza y limita las cotizaciones visibles', () => {
        expect(parseDolarApiQuotes(payload)).toEqual([
            {
                house: 'blue',
                name: 'Blue',
                buy: 1500,
                sell: 1520,
                updatedAt: '2026-07-22T20:59:00.000Z',
            },
            {
                house: 'oficial',
                name: 'Oficial',
                buy: 1400,
                sell: 1450,
                updatedAt: '2026-07-22T18:00:00.000Z',
            },
        ])
    })

    it('usa venta al comprar USD y compra al venderlos', () => {
        const quote = parseDolarApiQuotes(payload)[0]

        expect(getQuoteRateForDirection(quote, 'ARS', 'USD')).toBe(1520)
        expect(getQuoteRateForDirection(quote, 'USD', 'ARS')).toBe(1500)
    })

    it('descarta respuestas incompletas o invalidas', () => {
        expect(parseDolarApiQuotes([{ casa: 'blue', compra: 0, venta: 1 }])).toEqual([])
        expect(parseDolarApiQuotes({})).toEqual([])
    })
})
