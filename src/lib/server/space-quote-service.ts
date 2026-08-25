import { createHash } from 'node:crypto'

import { isActiveLegalTenderCurrency } from '@/lib/constants/iso-currencies'
import { ServiceError } from '@/lib/server/errors'
import type { ConversionPathStep, ConversionSnapshot } from '@/lib/utils/money'
import type { SpaceQuoteDto, SpaceQuotesDto } from '@/types'

const DOLAR_API_URL = 'https://dolarapi.com/v1/cotizaciones'
const FRANKFURTER_URL = 'https://api.frankfurter.dev/v2/rates'
const DOLAR_TTL_MS = 15 * 60 * 1000
const FRANKFURTER_TTL_MS = 36 * 60 * 60 * 1000

interface DirectQuote {
    rate: string
    source: 'dolarapi_official' | 'frankfurter'
    observedAt: string
    expiresAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object'
}

function decimalRate(value: number) {
    if (!Number.isFinite(value) || value <= 0) return undefined
    return Number(value.toPrecision(12)).toString()
}

function validDate(value: unknown, fallback: Date) {
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value)
    return fallback
}

export function quoteFingerprint(input: {
    sourceCurrency: string
    targetCurrency: string
    rate: string
    source: string
    observedAt: string
    path: ConversionPathStep[]
}) {
    return createHash('sha256').update(JSON.stringify(input)).digest('base64url').slice(0, 24)
}

export function isConversionSnapshotFresh(snapshot: ConversionSnapshot, now = new Date()) {
    return !snapshot.expiresAt || Date.parse(snapshot.expiresAt) > now.getTime()
}

export function buildManualConversionSnapshot(input: {
    sourceCurrency: string
    targetCurrency: string
    rate: string
    actorUserId: string
    now?: Date
}): ConversionSnapshot {
    const now = input.now ?? new Date()
    if (!decimalRate(Number(input.rate))) {
        throw new ServiceError(400, 'SPACE_QUOTE_MANUAL_INVALID', 'La cotización manual debe ser positiva.')
    }
    return {
        rate: input.rate,
        direction: 'multiply',
        source: 'manual',
        manualAuthorUserId: input.actorUserId,
        observedAt: now.toISOString(),
        capturedAt: now.toISOString(),
        path: [{
            fromCurrency: input.sourceCurrency,
            toCurrency: input.targetCurrency,
            rate: input.rate,
            source: 'manual',
        }],
    }
}

export function assertConversionSnapshotConfirmable(snapshot: ConversionSnapshot, now = new Date()) {
    if (snapshot.source !== 'manual' && !isConversionSnapshotFresh(snapshot, now)) {
        throw new ServiceError(
            409,
            'SPACE_QUOTE_STALE',
            'La cotización de referencia venció. Actualizala o confirmala explícitamente como manual.'
        )
    }
}

async function fetchDolarApiDirect(
    sourceCurrency: string,
    targetCurrency: string,
    now: Date,
    fetcher: typeof fetch
): Promise<DirectQuote | undefined> {
    if (sourceCurrency !== 'ARS' && targetCurrency !== 'ARS') return undefined
    const foreignCurrency = sourceCurrency === 'ARS' ? targetCurrency : sourceCurrency
    const response = await fetcher(DOLAR_API_URL, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 15 * 60 },
        signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return undefined
    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) return undefined
    const rows = payload.filter(isRecord)
    const candidate = rows.find((row) => {
        const currency = typeof row.moneda === 'string' ? row.moneda.toUpperCase() : undefined
        const house = typeof row.casa === 'string' ? row.casa.toLowerCase() : ''
        if (foreignCurrency === 'USD') return currency === 'USD' && house === 'oficial'
        return currency === foreignCurrency
    })
    if (!candidate) return undefined
    const buy = Number(candidate.compra)
    const sell = Number(candidate.venta)
    const value = sourceCurrency === 'ARS' ? 1 / sell : buy
    const rate = decimalRate(value)
    if (!rate) return undefined
    const observed = validDate(candidate.fechaActualizacion, now)
    return {
        rate,
        source: 'dolarapi_official',
        observedAt: observed.toISOString(),
        expiresAt: new Date(observed.getTime() + DOLAR_TTL_MS).toISOString(),
    }
}

function parseFrankfurterRate(payload: unknown, targetCurrency: string) {
    if (Array.isArray(payload)) {
        for (const row of payload) {
            if (!isRecord(row)) continue
            const quote = String(row.quote ?? row.target ?? '').toUpperCase()
            if (quote === targetCurrency || payload.length === 1) {
                const rate = decimalRate(Number(row.rate))
                if (rate) return { rate, date: row.date }
            }
        }
    }
    if (isRecord(payload)) {
        const rates = isRecord(payload.rates) ? payload.rates : undefined
        const rate = decimalRate(Number(rates?.[targetCurrency] ?? payload.rate))
        if (rate) return { rate, date: payload.date }
    }
    return undefined
}

async function fetchFrankfurterDirect(
    sourceCurrency: string,
    targetCurrency: string,
    now: Date,
    fetcher: typeof fetch
): Promise<DirectQuote | undefined> {
    const query = new URLSearchParams({ base: sourceCurrency, quotes: targetCurrency })
    const response = await fetcher(`${FRANKFURTER_URL}?${query}`, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 24 * 60 * 60 },
        signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return undefined
    const parsed = parseFrankfurterRate(await response.json(), targetCurrency)
    if (!parsed) return undefined
    const observed = validDate(parsed.date, now)
    return {
        rate: parsed.rate,
        source: 'frankfurter',
        observedAt: observed.toISOString(),
        expiresAt: new Date(observed.getTime() + FRANKFURTER_TTL_MS).toISOString(),
    }
}

async function directQuote(
    sourceCurrency: string,
    targetCurrency: string,
    now: Date,
    fetcher: typeof fetch
) {
    if (sourceCurrency === targetCurrency) {
        return {
            rate: '1',
            source: 'identity' as const,
            observedAt: now.toISOString(),
            expiresAt: undefined,
        }
    }
    if (sourceCurrency === 'ARS' || targetCurrency === 'ARS') {
        return fetchDolarApiDirect(sourceCurrency, targetCurrency, now, fetcher)
    }
    return fetchFrankfurterDirect(sourceCurrency, targetCurrency, now, fetcher)
}

export async function resolveSpaceReferenceQuote(input: {
    sourceCurrency: string
    targetCurrency: string
    now?: Date
    fetcher?: typeof fetch
}): Promise<SpaceQuoteDto | undefined> {
    const sourceCurrency = input.sourceCurrency.trim().toUpperCase()
    const targetCurrency = input.targetCurrency.trim().toUpperCase()
    if (!isActiveLegalTenderCurrency(sourceCurrency) || !isActiveLegalTenderCurrency(targetCurrency)) {
        throw new ServiceError(400, 'SPACE_CURRENCY_INVALID', 'La moneda no pertenece al registro ISO habilitado.')
    }
    const now = input.now ?? new Date()
    const fetcher = input.fetcher ?? fetch
    let direct: Awaited<ReturnType<typeof directQuote>>
    try {
        direct = await directQuote(sourceCurrency, targetCurrency, now, fetcher)
    } catch {
        direct = undefined
    }
    let path: ConversionPathStep[] = []
    let rate: string | undefined
    let source: SpaceQuoteDto['source'] | undefined
    let observedAt: string | undefined
    let expiresAt: string | undefined
    if (direct) {
        rate = direct.rate
        source = direct.source
        observedAt = direct.observedAt
        expiresAt = direct.expiresAt
        path = [{ fromCurrency: sourceCurrency, toCurrency: targetCurrency, rate, source }]
    } else {
        for (const pivot of ['USD', 'EUR']) {
            if (pivot === sourceCurrency || pivot === targetCurrency) continue
            try {
                const first = await directQuote(sourceCurrency, pivot, now, fetcher)
                const second = await directQuote(pivot, targetCurrency, now, fetcher)
                if (!first || !second) continue
                rate = decimalRate(Number(first.rate) * Number(second.rate))
                if (!rate) continue
                source = first.source === 'dolarapi_official' || second.source === 'dolarapi_official'
                    ? 'dolarapi_official'
                    : 'frankfurter'
                observedAt = new Date(Math.min(Date.parse(first.observedAt), Date.parse(second.observedAt))).toISOString()
                const expiries = [first.expiresAt, second.expiresAt].filter(Boolean).map((value) => Date.parse(value!))
                expiresAt = expiries.length ? new Date(Math.min(...expiries)).toISOString() : undefined
                path = [
                    { fromCurrency: sourceCurrency, toCurrency: pivot, rate: first.rate, source: first.source },
                    { fromCurrency: pivot, toCurrency: targetCurrency, rate: second.rate, source: second.source },
                ]
                break
            } catch {
                // El próximo camino o la cotización manual siguen disponibles.
            }
        }
    }
    if (!rate || !source || !observedAt) return undefined
    const fingerprint = quoteFingerprint({ sourceCurrency, targetCurrency, rate, source, observedAt, path })
    return {
        fingerprint,
        sourceCurrency,
        targetCurrency,
        rate,
        direction: 'multiply',
        source,
        status: expiresAt && Date.parse(expiresAt) <= now.getTime() ? 'stale' : 'current',
        observedAt,
        capturedAt: now.toISOString(),
        expiresAt,
        path,
    }
}

export async function getSpaceReferenceQuotes(input: {
    currencies: string[]
    reportingCurrency: string
    now?: Date
    fetcher?: typeof fetch
}): Promise<SpaceQuotesDto> {
    const now = input.now ?? new Date()
    const currencies = Array.from(new Set(input.currencies.map((currency) => currency.toUpperCase())))
        .filter((currency) => currency !== input.reportingCurrency)
    const resolved = await Promise.all(currencies.map((sourceCurrency) => resolveSpaceReferenceQuote({
        sourceCurrency,
        targetCurrency: input.reportingCurrency,
        now,
        fetcher: input.fetcher,
    })))
    return {
        reportingCurrency: input.reportingCurrency,
        fetchedAt: now.toISOString(),
        quotes: resolved.flatMap((quote) => quote ? [quote] : []),
    }
}

export function quoteToConversionSnapshot(quote: SpaceQuoteDto): ConversionSnapshot {
    return {
        rate: quote.rate,
        direction: quote.direction,
        source: quote.source,
        observedAt: quote.observedAt,
        capturedAt: quote.capturedAt,
        expiresAt: quote.expiresAt,
        path: quote.path,
    }
}
