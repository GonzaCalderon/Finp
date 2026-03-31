import type { Currency } from '@/lib/constants'

export type CurrencyTotals = {
    ars: number
    usd: number
}

export type ConsolidatedValuation = {
    amount: number
    currency: Currency
    arsPerUsdRate: number
}

export function isValidArsPerUsdRate(value: number | null | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function consolidateCurrencyTotals(
    totals: CurrencyTotals,
    targetCurrency: Currency,
    arsPerUsdRate?: number | null
): number | null {
    if (!isValidArsPerUsdRate(arsPerUsdRate)) return null

    if (targetCurrency === 'ARS') {
        return totals.ars + totals.usd * arsPerUsdRate
    }

    return totals.usd + totals.ars / arsPerUsdRate
}

export function buildConsolidatedValuation(
    totals: CurrencyTotals,
    targetCurrency: Currency,
    arsPerUsdRate?: number | null
): ConsolidatedValuation | null {
    const amount = consolidateCurrencyTotals(totals, targetCurrency, arsPerUsdRate)
    if (amount === null) return null

    return {
        amount,
        currency: targetCurrency,
        arsPerUsdRate: arsPerUsdRate!,
    }
}

export function formatArsPerUsdRate(arsPerUsdRate?: number | null): string {
    if (!isValidArsPerUsdRate(arsPerUsdRate)) return 'Sin cotización'

    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(arsPerUsdRate)
}
