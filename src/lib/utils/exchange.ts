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

export type ManualExchangeDraft = {
    sourceAccountId?: string
    destinationAccountId?: string
    sourceCurrency: Currency
    sourceAmount: number
    destinationCurrency: Currency
    destinationAmount: number
    exchangeRate: number
}

export function getExchangeOperationLabel(
    sourceCurrency: Currency,
    destinationCurrency: Currency
) {
    if (sourceCurrency === 'ARS' && destinationCurrency === 'USD') return 'Compra de dólares'
    if (sourceCurrency === 'USD' && destinationCurrency === 'ARS') return 'Venta de dólares'
    return 'Cambio de moneda'
}

export function invertManualExchange(draft: ManualExchangeDraft): ManualExchangeDraft {
    return {
        sourceAccountId: draft.destinationAccountId,
        destinationAccountId: draft.sourceAccountId,
        sourceCurrency: draft.destinationCurrency,
        sourceAmount: draft.destinationAmount,
        destinationCurrency: draft.sourceCurrency,
        destinationAmount: draft.sourceAmount,
        exchangeRate: draft.exchangeRate,
    }
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

export function getDestinationAmountFromRate(params: {
    sourceCurrency: Currency
    sourceAmount: number
    destinationCurrency: Currency
    exchangeRate: number
}): number {
    const { sourceCurrency, sourceAmount, destinationCurrency, exchangeRate } = params

    if (sourceAmount <= 0 || exchangeRate <= 0 || sourceCurrency === destinationCurrency) {
        return 0
    }

    if (sourceCurrency === 'ARS' && destinationCurrency === 'USD') {
        return sourceAmount / exchangeRate
    }

    if (sourceCurrency === 'USD' && destinationCurrency === 'ARS') {
        return sourceAmount * exchangeRate
    }

    return 0
}

export function getSourceAmountFromRate(params: {
    sourceCurrency: Currency
    destinationAmount: number
    destinationCurrency: Currency
    exchangeRate: number
}): number {
    const { sourceCurrency, destinationAmount, destinationCurrency, exchangeRate } = params

    if (destinationAmount <= 0 || exchangeRate <= 0 || sourceCurrency === destinationCurrency) {
        return 0
    }

    if (sourceCurrency === 'ARS' && destinationCurrency === 'USD') {
        return destinationAmount * exchangeRate
    }

    if (sourceCurrency === 'USD' && destinationCurrency === 'ARS') {
        return destinationAmount / exchangeRate
    }

    return 0
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
        // Los montos son la fuente de verdad; no persistimos una cotización
        // desactualizada que pueda enviar otro cliente.
        exchangeRate: arsPerUsdRate,
        arsPerUsdRate,
    }
}

export function isExchangeType(type?: string | null): boolean {
    return type === 'exchange'
}
