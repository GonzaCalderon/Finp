import { getCurrencyScale, isActiveLegalTenderCurrency } from '@/lib/constants/iso-currencies'

export interface MoneyDto {
    currency: string
    minorUnits: string
    scale: number
}

export type ConversionDirection = 'multiply' | 'divide'
export type ConversionSource = 'dolarapi_official' | 'frankfurter' | 'manual' | 'identity'

export interface ConversionPathStep {
    fromCurrency: string
    toCurrency: string
    rate: string
    source: ConversionSource
}

export interface ConversionSnapshot {
    rate: string
    direction: ConversionDirection
    source: ConversionSource
    manualAuthorUserId?: string
    observedAt: string
    capturedAt: string
    expiresAt?: string
    path: ConversionPathStep[]
}

export class MoneyRuleError extends Error {
    constructor(
        readonly code:
            | 'INVALID_CURRENCY'
            | 'INVALID_MONEY'
            | 'INVALID_SCALE'
            | 'INVALID_RATE'
            | 'CURRENCY_MISMATCH',
        message: string
    ) {
        super(message)
        this.name = 'MoneyRuleError'
    }
}

function pow10(scale: number) {
    if (!Number.isInteger(scale) || scale < 0 || scale > 9) {
        throw new MoneyRuleError('INVALID_SCALE', 'La escala monetaria no es válida.')
    }
    return BigInt(10) ** BigInt(scale)
}

function normalizeDecimal(value: string | number) {
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new MoneyRuleError('INVALID_MONEY', 'El monto debe ser finito.')
        return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })
    }
    return value.trim().replace(',', '.')
}

export function decimalToMinorUnits(value: string | number, scale: number) {
    const normalized = normalizeDecimal(value)
    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized)
    if (!match) throw new MoneyRuleError('INVALID_MONEY', 'El monto no tiene un formato decimal válido.')
    const sign = match[1] === '-' ? -BigInt(1) : BigInt(1)
    const integer = BigInt(match[2])
    const fraction = match[3] ?? ''
    const kept = fraction.slice(0, scale).padEnd(scale, '0')
    let result = integer * pow10(scale) + BigInt(kept || '0')
    const discarded = fraction.slice(scale)
    if (discarded && Number(discarded[0]) >= 5) result += BigInt(1)
    return result * sign
}

export function minorUnitsToDecimal(minorUnits: bigint | string, scale: number) {
    const value = typeof minorUnits === 'bigint' ? minorUnits : BigInt(minorUnits)
    const sign = value < 0 ? '-' : ''
    const absolute = value < 0 ? -value : value
    const base = pow10(scale)
    const integer = absolute / base
    const fraction = (absolute % base).toString().padStart(scale, '0')
    return scale === 0 ? `${sign}${integer}` : `${sign}${integer}.${fraction}`
}

export function moneyFromDecimal(currency: string, value: string | number): MoneyDto {
    const normalizedCurrency = currency.trim().toUpperCase()
    const scale = getCurrencyScale(normalizedCurrency)
    if (scale === undefined || !isActiveLegalTenderCurrency(normalizedCurrency)) {
        throw new MoneyRuleError('INVALID_CURRENCY', 'La moneda no pertenece al registro ISO habilitado.')
    }
    return {
        currency: normalizedCurrency,
        minorUnits: decimalToMinorUnits(value, scale).toString(),
        scale,
    }
}

export function assertMoneyDto(money: MoneyDto): MoneyDto {
    const expectedScale = getCurrencyScale(money.currency)
    if (expectedScale === undefined || expectedScale !== money.scale || !/^-?\d+$/.test(money.minorUnits)) {
        throw new MoneyRuleError('INVALID_MONEY', 'El dinero exacto no coincide con el registro de monedas.')
    }
    return { ...money, currency: money.currency.toUpperCase() }
}

function parseRate(rate: string) {
    const normalized = rate.trim().replace(',', '.')
    const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized)
    if (!match || BigInt(`${match?.[1] ?? '0'}${match?.[2] ?? ''}`) <= BigInt(0)) {
        throw new MoneyRuleError('INVALID_RATE', 'La cotización debe ser un decimal positivo.')
    }
    const decimals = match[2]?.length ?? 0
    return {
        numerator: BigInt(`${match[1]}${match[2] ?? ''}`),
        denominator: pow10(decimals),
    }
}

function divideAndRoundHalfUp(numerator: bigint, denominator: bigint) {
    if (denominator <= BigInt(0)) throw new MoneyRuleError('INVALID_RATE', 'El divisor de conversión no es válido.')
    const quotient = numerator / denominator
    const remainder = numerator % denominator
    return remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient
}

export function convertMoneyExact(input: {
    money: MoneyDto
    targetCurrency: string
    rate: string
    direction?: ConversionDirection
}) {
    const source = assertMoneyDto(input.money)
    const targetCurrency = input.targetCurrency.trim().toUpperCase()
    const targetScale = getCurrencyScale(targetCurrency)
    if (targetScale === undefined) throw new MoneyRuleError('INVALID_CURRENCY', 'La moneda de destino no está habilitada.')
    if (targetCurrency === source.currency) return { ...source }
    const rate = parseRate(input.rate)
    const sourceMinor = BigInt(source.minorUnits)
    const sign = sourceMinor < BigInt(0) ? -BigInt(1) : BigInt(1)
    const absoluteSourceMinor = sourceMinor < BigInt(0) ? -sourceMinor : sourceMinor
    const scaleNumerator = pow10(targetScale)
    const scaleDenominator = pow10(source.scale)
    const direction = input.direction ?? 'multiply'
    const numerator = direction === 'multiply'
        ? absoluteSourceMinor * rate.numerator * scaleNumerator
        : absoluteSourceMinor * rate.denominator * scaleNumerator
    const denominator = direction === 'multiply'
        ? rate.denominator * scaleDenominator
        : rate.numerator * scaleDenominator
    return {
        currency: targetCurrency,
        minorUnits: (divideAndRoundHalfUp(numerator, denominator) * sign).toString(),
        scale: targetScale,
    } satisfies MoneyDto
}

export function moneyToNumber(money: MoneyDto) {
    return Number(minorUnitsToDecimal(money.minorUnits, money.scale))
}

/** Reparte por restos mayores y usa la clave estable para resolver empates. */
export function allocateMinorUnitsByLargestRemainder(input: {
    totalMinorUnits: bigint
    weights: bigint[]
    stableKeys: string[]
}) {
    if (input.weights.length !== input.stableKeys.length || input.weights.length === 0) {
        throw new MoneyRuleError('INVALID_MONEY', 'El reparto exacto necesita pesos y claves consistentes.')
    }
    const weightTotal = input.weights.reduce((sum, weight) => sum + weight, BigInt(0))
    if (weightTotal <= BigInt(0) || input.weights.some((weight) => weight < BigInt(0))) {
        throw new MoneyRuleError('INVALID_MONEY', 'Los pesos del reparto deben ser no negativos y sumar más de cero.')
    }
    const rows = input.weights.map((weight, index) => {
        const weighted = input.totalMinorUnits * weight
        return {
            index,
            units: weighted / weightTotal,
            remainder: weighted % weightTotal,
            key: input.stableKeys[index],
        }
    })
    let pending = input.totalMinorUnits - rows.reduce((sum, row) => sum + row.units, BigInt(0))
    for (const row of [...rows].sort((left, right) => {
        if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1
        return left.key.localeCompare(right.key)
    })) {
        if (pending <= BigInt(0)) break
        row.units += BigInt(1)
        pending -= BigInt(1)
    }
    return rows.sort((left, right) => left.index - right.index).map((row) => row.units)
}
