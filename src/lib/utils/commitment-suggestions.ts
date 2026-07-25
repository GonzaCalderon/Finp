import type { Currency } from '@/lib/constants'
import { normalizeRuleText } from '@/lib/utils/rules'

export interface CommitmentSuggestionHistoryEntry {
    transactionId: string
    description: string
    merchant?: string
    amount: number
    currency: Currency
    occurredAt: Date | string
    categoryId?: string
    categoryName?: string
    accountId?: string
}

export interface ExistingCommitmentForSuggestion {
    normalizedDescription?: string
    description: string
    aliases?: string[]
    currency: Currency
}

export interface CommitmentSuggestion {
    subjectKey: string
    description: string
    amount: number
    currency: Currency
    amountPolicy: 'fixed' | 'variable'
    estimationMode: 'template' | 'last'
    dayOfMonth: number
    categoryId?: string
    accountId?: string
    occurrences: number
    months: string[]
    variationPercent: number
    confidence: number
    evidence: string[]
}

type PatternGroup = {
    subject: string
    displayValues: Map<string, number>
    currency: Currency
    entries: CommitmentSuggestionHistoryEntry[]
}

function monthKey(value: Date | string): string | null {
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthDistance(first: string, last: string): number {
    const [firstYear, firstMonth] = first.split('-').map(Number)
    const [lastYear, lastMonth] = last.split('-').map(Number)
    return (lastYear - firstYear) * 12 + lastMonth - firstMonth + 1
}

function timestamp(value: Date | string): number {
    const result = value instanceof Date ? value.getTime() : new Date(value).getTime()
    return Number.isNaN(result) ? 0 : result
}

function dominantValue(values: Array<string | undefined>, minimumRatio = 0.66): string | undefined {
    const counts = new Map<string, number>()
    values.filter(Boolean).forEach((value) => {
        const key = value as string
        counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    const winner = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]
    if (!winner || winner[1] / values.length < minimumRatio) return undefined
    return winner[0]
}

function median(values: number[]): number {
    const ordered = [...values].sort((left, right) => left - right)
    const middle = Math.floor(ordered.length / 2)
    if (ordered.length % 2 === 0) {
        return Math.round((ordered[middle - 1] + ordered[middle]) / 2)
    }
    return ordered[middle]
}

function mostFrequentDisplayValue(values: Map<string, number>, fallback: string): string {
    return (
        [...values.entries()].sort(
            (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
        )[0]?.[0] ?? fallback
    )
}

function isCovered(
    group: PatternGroup,
    existingCommitments: ExistingCommitmentForSuggestion[]
): boolean {
    return existingCommitments.some((commitment) => {
        if (commitment.currency !== group.currency) return false
        const known = new Set([
            commitment.normalizedDescription ?? normalizeRuleText(commitment.description),
            ...(commitment.aliases ?? []).map(normalizeRuleText),
        ])
        return known.has(group.subject)
    })
}

const RECURRING_CATEGORY_NAMES = new Set([
    'pago de prestamos',
    'suscripciones',
    'servicios',
    'educacion',
    'hogar',
    'impuestos',
])

const INCIDENTAL_CATEGORY_NAMES = new Set([
    'restaurantes y delivery',
    'supermercado',
    'indumentaria',
    'viajes',
    'otros gastos',
])

function categoryConfidenceAdjustment(categoryName: string | undefined): number {
    const normalized = normalizeRuleText(categoryName ?? '')
    if (RECURRING_CATEGORY_NAMES.has(normalized)) return 0.08
    if (INCIDENTAL_CATEGORY_NAMES.has(normalized)) return -0.12
    return 0
}

/**
 * Detecta recurrencia mensual con evidencia híbrida:
 * - tres meses si el monto es estable; cinco si es variable;
 * - al menos 75 % de cobertura temporal;
 * - como máximo un movimiento del patrón por mes;
 * - afinidad de categoría y confianza mínima;
 * - sin crear nada automáticamente;
 */
export function buildCommitmentSuggestions(args: {
    history: CommitmentSuggestionHistoryEntry[]
    existingCommitments: ExistingCommitmentForSuggestion[]
    dismissedSubjectKeys?: Iterable<string>
    limit?: number
}): CommitmentSuggestion[] {
    const groups = new Map<string, PatternGroup>()
    const dismissed = new Set(args.dismissedSubjectKeys ?? [])

    for (const entry of args.history) {
        if (!Number.isFinite(entry.amount) || entry.amount <= 0) continue
        const normalizedMerchant = normalizeRuleText(entry.merchant ?? '')
        const normalizedDescription = normalizeRuleText(entry.description)
        const subject =
            normalizedMerchant.length >= 3 ? normalizedMerchant : normalizedDescription
        if (subject.length < 3) continue

        const key = `${entry.currency}|${subject}`
        const group = groups.get(key) ?? {
            subject,
            currency: entry.currency,
            displayValues: new Map<string, number>(),
            entries: [],
        }
        const displayValue = entry.merchant?.trim() || entry.description.trim() || subject
        group.displayValues.set(displayValue, (group.displayValues.get(displayValue) ?? 0) + 1)
        group.entries.push(entry)
        groups.set(key, group)
    }

    return [...groups.values()]
        .map((group): CommitmentSuggestion | null => {
            if (isCovered(group, args.existingCommitments)) return null

            const entriesByMonth = new Map<string, CommitmentSuggestionHistoryEntry[]>()
            for (const entry of group.entries) {
                const month = monthKey(entry.occurredAt)
                if (!month) continue
                const entries = entriesByMonth.get(month) ?? []
                entries.push(entry)
                entriesByMonth.set(month, entries)
            }

            const months = [...entriesByMonth.keys()].sort()
            if ([...entriesByMonth.values()].some((entries) => entries.length > 1)) return null
            const coveredMonths = monthDistance(months[0] ?? '', months.at(-1) ?? '')
            if (!Number.isFinite(coveredMonths) || coveredMonths <= 0) return null
            const coverage = months.length / coveredMonths
            if (coverage < 0.75) return null

            const representativeEntries = [...entriesByMonth.values()]
                .map(([entry]) => entry)
                .sort((left, right) => timestamp(left.occurredAt) - timestamp(right.occurredAt))
            const amounts = representativeEntries.map((entry) => entry.amount)
            const average = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
            const variationPercent =
                average > 0
                    ? Math.round(((Math.max(...amounts) - Math.min(...amounts)) / average) * 100)
                    : 100
            const amountPolicy = variationPercent <= 10 ? 'fixed' : 'variable'
            const minimumOccurrences = amountPolicy === 'fixed' ? 3 : 5
            if (months.length < minimumOccurrences) return null
            const amount =
                amountPolicy === 'fixed'
                    ? median(amounts)
                    : representativeEntries.at(-1)?.amount ?? median(amounts)
            const days = representativeEntries.map((entry) => {
                const date =
                    entry.occurredAt instanceof Date
                        ? entry.occurredAt
                        : new Date(entry.occurredAt)
                return date.getDate()
            })
            const dayOfMonth = Math.min(31, Math.max(1, median(days)))
            const subjectKey = `create_commitment|${group.currency}|${group.subject}`
            if (dismissed.has(subjectKey)) return null

            const dominantCategoryName = dominantValue(
                representativeEntries.map((entry) => entry.categoryName)
            )

            const confidence = Math.min(
                0.98,
                0.64 +
                    Math.min(months.length, 6) * 0.045 +
                    (variationPercent <= 10 ? 0.08 : 0) +
                    (coverage === 1 ? 0.04 : 0) +
                    categoryConfidenceAdjustment(dominantCategoryName)
            )
            if (confidence < 0.82) return null

            return {
                subjectKey,
                description: mostFrequentDisplayValue(group.displayValues, group.subject),
                amount,
                currency: group.currency,
                amountPolicy,
                estimationMode: amountPolicy === 'variable' ? 'last' : 'template',
                dayOfMonth,
                categoryId: dominantValue(
                    representativeEntries.map((entry) => entry.categoryId)
                ),
                accountId: dominantValue(
                    representativeEntries.map((entry) => entry.accountId)
                ),
                occurrences: months.length,
                months,
                variationPercent,
                confidence,
                evidence: [
                    `${months.length} meses con un movimiento similar`,
                    variationPercent <= 10
                        ? `Monto estable: variación de ${variationPercent}%`
                        : `Monto variable: variación de ${variationPercent}%`,
                    `Suele aparecer cerca del día ${dayOfMonth}`,
                    dominantCategoryName
                        ? `Categoría habitual: ${dominantCategoryName}`
                        : 'Sin categoría habitual suficiente',
                ],
            }
        })
        .filter((suggestion): suggestion is CommitmentSuggestion => Boolean(suggestion))
        .sort(
            (left, right) =>
                right.confidence - left.confidence ||
                right.occurrences - left.occurrences ||
                left.description.localeCompare(right.description)
        )
        .slice(0, args.limit ?? 4)
}
