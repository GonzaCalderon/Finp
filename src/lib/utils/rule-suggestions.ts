import { normalizeRuleText } from '@/lib/utils/rules'
import type { ITransactionRule } from '@/types'

export interface RuleSuggestionHistoryEntry {
    transactionId: string
    type: string
    description: string
    merchant?: string
    categoryId: string
    occurredAt: Date | string
}

export interface TransactionRuleSuggestion {
    key: string
    name: string
    appliesTo: 'expense' | 'income'
    field: 'description' | 'merchant'
    condition: 'contains' | 'equals'
    value: string
    categoryId: string
    normalizeMerchant?: string
    occurrences: number
    confidence: number
    reason: string
    examples: string[]
    lastOccurredAt: string
}

type PatternGroup = {
    appliesTo: 'expense' | 'income'
    field: 'description' | 'merchant'
    normalizedValue: string
    displayValues: Map<string, number>
    entries: RuleSuggestionHistoryEntry[]
}

const DESCRIPTION_STOP_WORDS = new Set([
    'compra',
    'gasto',
    'pago',
    'pagos',
    'cuota',
    'cuotas',
    'mes',
    'mensual',
    'transferencia',
    'debito',
    'credito',
    'consumo',
    'ars',
    'usd',
])

function toTimestamp(value: Date | string) {
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
}

function normalizeType(type: string): 'expense' | 'income' | null {
    if (type === 'income') return 'income'
    if (type === 'expense' || type === 'credit_card_expense') return 'expense'
    return null
}

function getMostFrequentDisplayValue(values: Map<string, number>) {
    return [...values.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
}

function getDominantCategory(entries: RuleSuggestionHistoryEntry[]) {
    const counts = new Map<string, number>()
    entries.forEach((entry) => {
        counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1)
    })
    const [categoryId, count] = [...counts.entries()]
        .sort((left, right) => right[1] - left[1])[0] ?? []

    return categoryId
        ? { categoryId, count, ratio: count / entries.length }
        : null
}

function buildSuggestionKey(args: {
    appliesTo: string
    field: string
    normalizedValue: string
    categoryId: string
}) {
    return [
        args.appliesTo,
        args.field,
        args.normalizedValue,
        args.categoryId,
    ].join('|')
}

function isAlreadyCovered(
    suggestion: Pick<TransactionRuleSuggestion, 'appliesTo' | 'field' | 'value'>,
    rules: ITransactionRule[]
) {
    const normalizedValue = normalizeRuleText(suggestion.value)
    return rules.some((rule) => {
        const scopeMatches =
            rule.appliesTo === 'any' ||
            rule.appliesTo === suggestion.appliesTo
        return (
            scopeMatches &&
            rule.field === suggestion.field &&
            normalizeRuleText(rule.value) === normalizedValue
        )
    })
}

function toSuggestion(
    group: PatternGroup,
    dismissedKeys: Set<string>
): (TransactionRuleSuggestion & { transactionIds: Set<string> }) | null {
    if (group.entries.length < 3) return null
    const dominant = getDominantCategory(group.entries)
    if (!dominant || dominant.count < 3 || dominant.ratio < 0.75) return null

    const dominantEntries = group.entries.filter(
        (entry) => entry.categoryId === dominant.categoryId
    )
    const displayValue =
        getMostFrequentDisplayValue(group.displayValues) ?? group.normalizedValue
    const key = buildSuggestionKey({
        appliesTo: group.appliesTo,
        field: group.field,
        normalizedValue: group.normalizedValue,
        categoryId: dominant.categoryId,
    })
    if (dismissedKeys.has(key)) return null

    const lastOccurredAt = dominantEntries
        .map((entry) => entry.occurredAt)
        .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0]
    const confidence = Math.min(
        0.99,
        0.58 + dominant.ratio * 0.25 + Math.min(dominant.count, 8) * 0.025
    )

    return {
        key,
        name:
            group.field === 'merchant'
                ? `${displayValue} → categoría habitual`
                : `${displayValue} → categoría habitual`,
        appliesTo: group.appliesTo,
        field: group.field,
        condition: group.field === 'merchant' ? 'equals' : 'contains',
        value: displayValue,
        categoryId: dominant.categoryId,
        normalizeMerchant: group.field === 'merchant' ? displayValue : undefined,
        occurrences: dominant.count,
        confidence,
        reason:
            group.field === 'merchant'
                ? `${dominant.count} movimientos de este comercio usaron la misma categoría.`
                : `${dominant.count} movimientos con “${displayValue}” usaron la misma categoría.`,
        examples: dominantEntries
            .slice()
            .sort((left, right) => toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt))
            .slice(0, 3)
            .map((entry) => entry.description),
        lastOccurredAt: new Date(lastOccurredAt).toISOString(),
        transactionIds: new Set(dominantEntries.map((entry) => entry.transactionId)),
    }
}

export function buildTransactionRuleSuggestions(args: {
    history: RuleSuggestionHistoryEntry[]
    existingRules: ITransactionRule[]
    dismissedKeys?: Iterable<string>
    limit?: number
}): TransactionRuleSuggestion[] {
    const merchantGroups = new Map<string, PatternGroup>()
    const tokenGroups = new Map<string, PatternGroup>()
    const dismissedKeys = new Set(args.dismissedKeys ?? [])

    args.history.forEach((entry) => {
        const appliesTo = normalizeType(entry.type)
        if (!appliesTo || !entry.categoryId) return

        const normalizedMerchant = normalizeRuleText(entry.merchant ?? '')
        if (normalizedMerchant.length >= 3) {
            const key = `${appliesTo}|merchant|${normalizedMerchant}`
            const group: PatternGroup = merchantGroups.get(key) ?? {
                appliesTo,
                field: 'merchant',
                normalizedValue: normalizedMerchant,
                displayValues: new Map(),
                entries: [],
            }
            const displayMerchant = entry.merchant?.trim() || normalizedMerchant
            group.displayValues.set(
                displayMerchant,
                (group.displayValues.get(displayMerchant) ?? 0) + 1
            )
            group.entries.push(entry)
            merchantGroups.set(key, group)
        }

        const tokens = new Set(
            normalizeRuleText(entry.description)
                .split(' ')
                .filter(
                    (token) =>
                        token.length >= 3 &&
                        !DESCRIPTION_STOP_WORDS.has(token) &&
                        !/^\d+$/.test(token)
                )
        )

        tokens.forEach((token) => {
            const key = `${appliesTo}|description|${token}`
            const group: PatternGroup = tokenGroups.get(key) ?? {
                appliesTo,
                field: 'description',
                normalizedValue: token,
                displayValues: new Map(),
                entries: [],
            }
            group.displayValues.set(token, (group.displayValues.get(token) ?? 0) + 1)
            group.entries.push(entry)
            tokenGroups.set(key, group)
        })
    })

    // Keep all strong merchant candidates for de-duplication, even when one was
    // dismissed or is already covered. Otherwise the same transaction cluster
    // immediately resurfaces as a weaker description suggestion.
    const merchantCandidates = [...merchantGroups.values()]
        .map((group) => toSuggestion(group, new Set()))
        .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion))

    const merchantSuggestions = merchantCandidates
        .filter((suggestion) => !dismissedKeys.has(suggestion.key))
        .filter((suggestion) => !isAlreadyCovered(suggestion, args.existingRules))

    const tokenSuggestions = [...tokenGroups.values()]
        .map((group) => toSuggestion(group, dismissedKeys))
        .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion))
        .filter((suggestion) => !isAlreadyCovered(suggestion, args.existingRules))
        .filter((suggestion) => {
            return !merchantCandidates.some((merchantSuggestion) => {
                if (merchantSuggestion.categoryId !== suggestion.categoryId) return false
                const overlap = [...suggestion.transactionIds].filter((id) =>
                    merchantSuggestion.transactionIds.has(id)
                ).length
                return overlap / suggestion.transactionIds.size >= 0.8
            })
        })

    return [...merchantSuggestions, ...tokenSuggestions]
        .sort(
            (left, right) =>
                right.confidence - left.confidence ||
                right.occurrences - left.occurrences ||
                toTimestamp(right.lastOccurredAt) - toTimestamp(left.lastOccurredAt)
        )
        .slice(0, args.limit ?? 6)
        .map(({ transactionIds, ...suggestion }) => {
            void transactionIds
            return suggestion
        })
}
