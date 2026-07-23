import type { Currency } from '@/lib/constants'

export const DOLAR_API_QUOTE_HOUSES = ['blue', 'oficial', 'bolsa'] as const

export type DolarApiQuoteHouse = (typeof DOLAR_API_QUOTE_HOUSES)[number]

export type ExchangeRateQuote = {
    house: DolarApiQuoteHouse
    name: string
    buy: number
    sell: number
    updatedAt: string
}

export type ExchangeRatesResponse = {
    quotes: ExchangeRateQuote[]
    source: 'dolarapi.com'
    fetchedAt: string
}

const QUOTE_NAMES: Record<DolarApiQuoteHouse, string> = {
    blue: 'Blue',
    oficial: 'Oficial',
    bolsa: 'MEP',
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object'
}

export function parseDolarApiQuotes(payload: unknown): ExchangeRateQuote[] {
    if (!Array.isArray(payload)) return []

    const quotesByHouse = new Map<DolarApiQuoteHouse, ExchangeRateQuote>()

    payload.forEach((item) => {
        if (!isRecord(item)) return

        const house = item.casa
        if (
            typeof house !== 'string' ||
            !DOLAR_API_QUOTE_HOUSES.includes(house as DolarApiQuoteHouse)
        ) {
            return
        }

        const buy = Number(item.compra)
        const sell = Number(item.venta)
        const updatedAt = typeof item.fechaActualizacion === 'string'
            ? item.fechaActualizacion
            : ''

        if (
            !Number.isFinite(buy) ||
            !Number.isFinite(sell) ||
            buy <= 0 ||
            sell <= 0 ||
            Number.isNaN(new Date(updatedAt).getTime())
        ) {
            return
        }

        const normalizedHouse = house as DolarApiQuoteHouse
        quotesByHouse.set(normalizedHouse, {
            house: normalizedHouse,
            name: QUOTE_NAMES[normalizedHouse],
            buy,
            sell,
            updatedAt,
        })
    })

    return DOLAR_API_QUOTE_HOUSES.flatMap((house) => {
        const quote = quotesByHouse.get(house)
        return quote ? [quote] : []
    })
}

export function getQuoteRateForDirection(
    quote: ExchangeRateQuote,
    sourceCurrency: Currency,
    destinationCurrency: Currency
) {
    if (sourceCurrency === 'ARS' && destinationCurrency === 'USD') {
        return quote.sell
    }

    if (sourceCurrency === 'USD' && destinationCurrency === 'ARS') {
        return quote.buy
    }

    return 0
}
