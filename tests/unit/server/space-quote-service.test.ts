import { describe, expect, it, vi } from 'vitest'

import {
    assertConversionSnapshotConfirmable,
    buildManualConversionSnapshot,
    resolveSpaceReferenceQuote,
} from '@/lib/server/space-quote-service'

const now = new Date('2026-08-24T15:00:00.000Z')

function jsonResponse(value: unknown) {
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('cotizaciones de referencia de Espacios', () => {
    it('usa compra oficial para USD/ARS y venta oficial para ARS/USD', async () => {
        const fetcher = vi.fn(async () => jsonResponse([{
            moneda: 'USD',
            casa: 'oficial',
            compra: 1300,
            venta: 1350,
            fechaActualizacion: '2026-08-24T14:59:00.000Z',
        }])) as unknown as typeof fetch
        const usdArs = await resolveSpaceReferenceQuote({ sourceCurrency: 'USD', targetCurrency: 'ARS', now, fetcher })
        const arsUsd = await resolveSpaceReferenceQuote({ sourceCurrency: 'ARS', targetCurrency: 'USD', now, fetcher })
        expect(usdArs).toMatchObject({ rate: '1300', source: 'dolarapi_official', status: 'current' })
        expect(Number(arsUsd?.rate)).toBeCloseTo(1 / 1350, 12)
    })

    it('resuelve un cruce derivado vía USD cuando no hay cotización directa', async () => {
        const fetcher = vi.fn(async (url: string | URL | Request) => {
            const value = String(url)
            if (value.includes('base=GBP') && value.includes('quotes=ARS')) return new Response(null, { status: 503 })
            if (value.includes('dolarapi')) return jsonResponse([{
                moneda: 'USD', casa: 'oficial', compra: 1300, venta: 1350,
                fechaActualizacion: '2026-08-24T14:59:00.000Z',
            }])
            if (value.includes('base=GBP') && value.includes('quotes=USD')) {
                return jsonResponse([{ base: 'GBP', quote: 'USD', rate: 1.25, date: '2026-08-24' }])
            }
            return new Response(null, { status: 404 })
        }) as unknown as typeof fetch
        const quote = await resolveSpaceReferenceQuote({ sourceCurrency: 'GBP', targetCurrency: 'ARS', now, fetcher })
        expect(quote?.rate).toBe('1625')
        expect(quote?.path.map((step) => `${step.fromCurrency}/${step.toCurrency}`)).toEqual(['GBP/USD', 'USD/ARS'])
    })

    it('exige actualizar una referencia vencida pero permite override manual trazable', () => {
        const stale = {
            rate: '1300', direction: 'multiply' as const, source: 'frankfurter' as const,
            observedAt: '2026-08-20T00:00:00.000Z', capturedAt: '2026-08-20T00:00:00.000Z',
            expiresAt: '2026-08-21T00:00:00.000Z', path: [],
        }
        expect(() => assertConversionSnapshotConfirmable(stale, now)).toThrow('venció')
        const manual = buildManualConversionSnapshot({
            sourceCurrency: 'USD', targetCurrency: 'ARS', rate: '1400', actorUserId: 'user-1', now,
        })
        expect(manual).toMatchObject({ source: 'manual', manualAuthorUserId: 'user-1', rate: '1400' })
        expect(() => assertConversionSnapshotConfirmable(manual, now)).not.toThrow()
    })
})
