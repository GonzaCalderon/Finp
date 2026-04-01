import { getCurrentFinancialPeriod } from '@/lib/utils/period'

function pad(value: number) {
    return String(value).padStart(2, '0')
}

export function normalizeOperationalStartDate(value?: string | Date | null): string | undefined {
    if (!value) return undefined

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return undefined
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    }

    const trimmed = value.trim()
    if (!trimmed) return undefined

    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return undefined

    const [, y, m, d] = match
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.getFullYear() !== Number(y) ||
        parsed.getMonth() !== Number(m) - 1 ||
        parsed.getDate() !== Number(d)
    ) {
        return undefined
    }

    return trimmed
}

export function parseOperationalStartDate(value?: string | Date | null): Date | undefined {
    const normalized = normalizeOperationalStartDate(value)
    if (!normalized) return undefined
    const [year, month, day] = normalized.split('-').map(Number)
    return new Date(year, month - 1, day)
}

export function isOnOrAfterOperationalStart(
    value: Date | string,
    operationalStartDate?: string | Date | null
): boolean {
    const startDate = parseOperationalStartDate(operationalStartDate)
    if (!startDate) return true
    const date = value instanceof Date ? value : new Date(value)
    return date >= startDate
}

export function startsOnOrAfterOperationalStart(
    value: Date,
    operationalStartDate?: string | Date | null
): boolean {
    const startDate = parseOperationalStartDate(operationalStartDate)
    if (!startDate) return true
    return value >= startDate
}

export function hasOperationalCoverage(
    start: Date,
    end: Date,
    operationalStartDate?: string | Date | null
): boolean {
    const startDate = parseOperationalStartDate(operationalStartDate)
    if (!startDate) return true
    return end > startDate
}

export function clampRangeStartToOperationalStart(
    start: Date,
    operationalStartDate?: string | Date | null
): Date {
    const startDate = parseOperationalStartDate(operationalStartDate)
    if (!startDate || startDate <= start) return start
    return startDate
}

export function getOperationalStartFinancialPeriod(
    operationalStartDate?: string | Date | null,
    monthStartDay = 1
): string | undefined {
    const startDate = parseOperationalStartDate(operationalStartDate)
    if (!startDate) return undefined
    return getCurrentFinancialPeriod(startDate, monthStartDay)
}
