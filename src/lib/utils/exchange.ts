import type { Currency } from '@/lib/constants'

export type ManualExchangeInput = {
    sourceCurrency: Currency
    sourceAmount: number
    destinationCurrency: Currency
    destinationAmount: number
    exchangeRate: number
}

export type ManualExchangeNormalized = ManualExchangeInput & {
    arsPerUsdRate: number
}

export function getArsPerUsdRate(params: {
    sourceCurrency: Currency
    sourceAmount: number
    destinationCurrency: Currency
    destinationAmount: number
}): number {
    const { sourceCurrency, sourceAmount, destinationCurrency, destinationAmount } = params

    if (sourceCurrency === destinationCurrency) {
        throw new Error('El cambio manual requiere monedas distintas.')
    }

    if (sourceCurrency === 'USD' && destinationCurrency === 'ARS') {
        return destinationAmount / sourceAmount
    }

    if (sourceCurrency === 'ARS' && destinationCurrency === 'USD') {
        return sourceAmount / destinationAmount
    }

    throw new Error('Combinación de monedas inválida para cambio manual.')
}

export function normalizeManualExchange(input: ManualExchangeInput): ManualExchangeNormalized {
    const { sourceCurrency, sourceAmount, destinationCurrency, destinationAmount, exchangeRate } = input

    if (sourceCurrency === destinationCurrency) {
        throw new Error('La moneda origen y destino deben ser distintas.')
    }

    if (sourceAmount <= 0 || destinationAmount <= 0) {
        throw new Error('Los montos del cambio deben ser mayores a 0.')
    }

    if (exchangeRate <= 0) {
        throw new Error('La cotización manual debe ser mayor a 0.')
    }

    const arsPerUsdRate = getArsPerUsdRate({
        sourceCurrency,
        sourceAmount,
        destinationCurrency,
        destinationAmount,
    })

    return {
        sourceCurrency,
        sourceAmount,
        destinationCurrency,
        destinationAmount,
        exchangeRate,
        arsPerUsdRate,
    }
}

export function isExchangeType(type?: string | null): boolean {
    return type === 'exchange'
}
