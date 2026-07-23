import {
    getTextSimilarity,
    normalizeComparisonText,
} from '@/lib/utils/category-ranking'

export interface DescriptionHistoryEntry {
    transactionId: string
    description: string
    merchant?: string
    categoryId?: string
    sourceAccountId?: string
    destinationAccountId?: string
    type: string
    amount: number
    currency: 'ARS' | 'USD'
    occurredAt: Date | string
}

export interface DescriptionTextSuggestion {
    kind: 'correction' | 'completion' | 'normalization'
    value: string
    merchant?: string
    confidence: number
    reason: string
}

export interface SimilarTransactionSuggestion {
    transactionId: string
    description: string
    merchant?: string
    categoryId?: string
    sourceAccountId?: string
    destinationAccountId?: string
    currency: 'ARS' | 'USD'
    occurredAt: string
    reason: string
}

export interface DuplicateTransactionWarning {
    transactionId: string
    description: string
    amount: number
    currency: 'ARS' | 'USD'
    occurredAt: string
}

export interface TransactionRuleProposal {
    value: string
    categoryId: string
    occurrences: number
    reason: string
}

export interface DescriptionIntelligenceSignals {
    textSuggestion?: DescriptionTextSuggestion
    similarTransaction?: SimilarTransactionSuggestion
    duplicate?: DuplicateTransactionWarning
    ruleProposal?: TransactionRuleProposal
}

interface DescriptionIntelligenceContext {
    description: string
    merchant?: string
    categoryId?: string
    amount?: number
    currency?: 'ARS' | 'USD'
    date?: Date | string
    currentTransactionId?: string
}

const RULE_STOP_WORDS = new Set([
    'compra',
    'gasto',
    'pago',
    'cuota',
    'mes',
    'mensual',
    'transferencia',
])

function toTimestamp(value: Date | string) {
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
}

function toIsoString(value: Date | string) {
    const timestamp = toTimestamp(value)
    return timestamp > 0 ? new Date(timestamp).toISOString() : new Date(0).toISOString()
}

export function normalizeDescriptionDisplay(value: string) {
    const collapsed = value.trim().replace(/\s+/g, ' ')
    if (!collapsed) return ''
    return `${collapsed.charAt(0).toLocaleUpperCase('es-AR')}${collapsed.slice(1)}`
}

export function levenshteinDistance(leftValue: string, rightValue: string) {
    const left = normalizeComparisonText(leftValue)
    const right = normalizeComparisonText(rightValue)
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index)

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex]
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + substitutionCost
            )
        }
        previous.splice(0, previous.length, ...current)
    }

    return previous[right.length]
}

function buildTextSuggestion(
    history: DescriptionHistoryEntry[],
    description: string
): DescriptionTextSuggestion | undefined {
    const current = normalizeComparisonText(description)
    if (current.length < 3) return undefined

    const candidateMap = new Map<string, {
        value: string
        merchant?: string
        count: number
        mostRecentIndex: number
    }>()

    history.forEach((entry, index) => {
        const candidates = [
            { value: entry.description },
            ...(entry.merchant ? [{ value: entry.merchant, merchant: entry.merchant }] : []),
        ]

        candidates.forEach((candidate) => {
            const normalized = normalizeComparisonText(candidate.value)
            if (normalized.length < 3 || normalized === current) return
            const stored = candidateMap.get(normalized)
            if (stored) {
                stored.count += 1
                stored.mostRecentIndex = Math.min(stored.mostRecentIndex, index)
                if (!stored.merchant && candidate.merchant) stored.merchant = candidate.merchant
                return
            }
            candidateMap.set(normalized, {
                value: normalizeDescriptionDisplay(candidate.value),
                merchant: candidate.merchant,
                count: 1,
                mostRecentIndex: index,
            })
        })
    })

    const ranked = Array.from(candidateMap.entries())
        .map(([normalized, candidate]) => {
            const isCompletion = normalized.startsWith(current) && normalized.length - current.length >= 2
            const distance = levenshteinDistance(current, normalized)
            const editSimilarity = 1 - distance / Math.max(current.length, normalized.length)
            const semanticSimilarity = getTextSimilarity(current, normalized)
            const maxDistance = normalized.length >= 12 ? 3 : 2
            const sameCharacters =
                current.length === normalized.length &&
                [...current].sort().join('') === [...normalized].sort().join('')
            const isCorrection =
                !isCompletion &&
                (
                    (distance <= maxDistance && editSimilarity >= 0.72) ||
                    (distance <= 2 && sameCharacters) ||
                    semanticSimilarity >= 0.78
                )

            if (!isCompletion && !isCorrection) return null

            const confidence = isCompletion
                ? Math.min(0.98, 0.84 + Math.min(0.1, candidate.count * 0.02))
                : Math.min(0.98, Math.max(editSimilarity, semanticSimilarity) + Math.min(0.08, candidate.count * 0.01))
            const score =
                confidence * 100 +
                Math.min(12, Math.log2(candidate.count + 1) * 4) +
                Math.max(0, 8 - candidate.mostRecentIndex * 0.08)

            return {
                kind: isCompletion ? 'completion' as const : 'correction' as const,
                value: candidate.value,
                merchant: candidate.merchant,
                confidence,
                reason: isCompletion
                    ? 'Coincide con una descripcion que ya usaste.'
                    : 'Se parece a una descripcion o comercio de tu historial.',
                score,
            }
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
        .sort((left, right) => right.score - left.score)

    if (ranked[0]) {
        const topSuggestion = ranked[0]
        return {
            kind: topSuggestion.kind,
            value: topSuggestion.value,
            merchant: topSuggestion.merchant,
            confidence: topSuggestion.confidence,
            reason: topSuggestion.reason,
        }
    }

    const normalizedDisplay = normalizeDescriptionDisplay(description)
    if (normalizedDisplay !== description && normalizeComparisonText(normalizedDisplay) === current) {
        return {
            kind: 'normalization',
            value: normalizedDisplay,
            confidence: 1,
            reason: 'Ordena espacios y capitalizacion sin cambiar el contenido.',
        }
    }

    return undefined
}

function findSimilarTransaction(
    history: DescriptionHistoryEntry[],
    context: DescriptionIntelligenceContext
): SimilarTransactionSuggestion | undefined {
    const currentText = [context.description, context.merchant].filter(Boolean).join(' ')
    if (normalizeComparisonText(currentText).length < 3) return undefined

    const candidate = history
        .filter((entry) => entry.transactionId !== context.currentTransactionId)
        .map((entry, index) => {
            const historicalText = [entry.description, entry.merchant].filter(Boolean).join(' ')
            const similarity = getTextSimilarity(currentText, historicalText)
            return {
                entry,
                similarity,
                score: similarity * 100 + Math.max(0, 12 - index * 0.08),
            }
        })
        .filter((item) => item.similarity >= 0.45)
        .sort((left, right) => right.score - left.score)[0]

    if (!candidate) return undefined

    return {
        transactionId: candidate.entry.transactionId,
        description: candidate.entry.description,
        merchant: candidate.entry.merchant,
        categoryId: candidate.entry.categoryId,
        sourceAccountId: candidate.entry.sourceAccountId,
        destinationAccountId: candidate.entry.destinationAccountId,
        currency: candidate.entry.currency,
        occurredAt: toIsoString(candidate.entry.occurredAt),
        reason:
            candidate.similarity >= 0.9
                ? 'Encontramos un movimiento casi identico.'
                : 'Encontramos un movimiento parecido en tu historial.',
    }
}

function findDuplicate(
    history: DescriptionHistoryEntry[],
    context: DescriptionIntelligenceContext
): DuplicateTransactionWarning | undefined {
    if (!context.amount || context.amount <= 0 || !context.currency || !context.date) return undefined
    const currentTimestamp = toTimestamp(context.date)
    const currentText = [context.description, context.merchant].filter(Boolean).join(' ')
    if (!currentTimestamp || normalizeComparisonText(currentText).length < 3) return undefined

    const duplicate = history.find((entry) => {
        if (entry.transactionId === context.currentTransactionId) return false
        if (entry.currency !== context.currency || Math.abs(entry.amount - context.amount!) > 0.009) return false
        const hoursApart = Math.abs(toTimestamp(entry.occurredAt) - currentTimestamp) / 3_600_000
        if (hoursApart > 36) return false
        const historicalText = [entry.description, entry.merchant].filter(Boolean).join(' ')
        return getTextSimilarity(currentText, historicalText) >= 0.72
    })

    return duplicate
        ? {
            transactionId: duplicate.transactionId,
            description: duplicate.description,
            amount: duplicate.amount,
            currency: duplicate.currency,
            occurredAt: toIsoString(duplicate.occurredAt),
        }
        : undefined
}

function findRuleProposal(
    history: DescriptionHistoryEntry[],
    context: DescriptionIntelligenceContext
): TransactionRuleProposal | undefined {
    if (!context.categoryId || normalizeComparisonText(context.description).length < 3) return undefined

    const matchingEntries = history.filter((entry) => {
        if (entry.categoryId !== context.categoryId) return false
        return getTextSimilarity(context.description, entry.description) >= 0.35
    })
    if (matchingEntries.length < 3) return undefined

    const currentTokens = normalizeComparisonText(context.description)
        .split(' ')
        .filter((token) => token.length >= 3 && !RULE_STOP_WORDS.has(token))
    const tokenCounts = currentTokens.map((token) => ({
        token,
        count: matchingEntries.filter((entry) =>
            normalizeComparisonText(entry.description).split(' ').includes(token)
        ).length,
    }))
    const stableToken = tokenCounts
        .filter((item) => item.count >= 3)
        .sort((left, right) => {
            if (right.count !== left.count) return right.count - left.count
            return right.token.length - left.token.length
        })[0]

    if (!stableToken) return undefined
    const originalToken = context.description
        .split(/\s+/)
        .find((token) => normalizeComparisonText(token) === stableToken.token)

    return {
        value: originalToken ?? stableToken.token,
        categoryId: context.categoryId,
        occurrences: matchingEntries.length,
        reason: `Elegiste esta categoria en ${matchingEntries.length} movimientos parecidos.`,
    }
}

export function buildDescriptionIntelligence(
    history: DescriptionHistoryEntry[],
    context: DescriptionIntelligenceContext
): DescriptionIntelligenceSignals {
    const orderedHistory = [...history].sort(
        (left, right) => toTimestamp(right.occurredAt) - toTimestamp(left.occurredAt)
    )

    return {
        textSuggestion: buildTextSuggestion(orderedHistory, context.description),
        similarTransaction: findSimilarTransaction(orderedHistory, context),
        duplicate: findDuplicate(orderedHistory, context),
        ruleProposal: findRuleProposal(orderedHistory, context),
    }
}
