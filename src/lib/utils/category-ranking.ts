export interface CategoryHistoryEntry {
    categoryId: string
    description?: string
    merchant?: string
    occurredAt?: Date | string
}

export interface CategoryHistoryRanking {
    categoryId: string
    score: number
    usageCount?: number
    similarMatchCount?: number
    reason?: string
}

const STOP_WORDS = new Set([
    'con',
    'del',
    'las',
    'los',
    'para',
    'por',
    'una',
    'uno',
    'unos',
    'unas',
])

export function normalizeComparisonText(value?: string) {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function tokenize(value: string) {
    return value
        .split(' ')
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
}

export function getTextSimilarity(currentValue: string, historicalValue: string) {
    const current = normalizeComparisonText(currentValue)
    const historical = normalizeComparisonText(historicalValue)
    if (!current || !historical) return 0
    if (current === historical) return 1

    const shorter = current.length <= historical.length ? current : historical
    const longer = current.length > historical.length ? current : historical
    if (shorter.length >= 4 && longer.includes(shorter)) return 0.82

    const currentTokens = new Set(tokenize(current))
    const historicalTokens = new Set(tokenize(historical))
    if (currentTokens.size === 0 || historicalTokens.size === 0) return 0

    let intersection = 0
    currentTokens.forEach((token) => {
        if (historicalTokens.has(token)) intersection += 1
    })

    return (2 * intersection) / (currentTokens.size + historicalTokens.size)
}

function occurredAtTimestamp(value?: Date | string) {
    if (!value) return 0
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
    return Number.isNaN(timestamp) ? 0 : timestamp
}

export function rankCategoryHistory(
    entries: CategoryHistoryEntry[],
    context: { description?: string; merchant?: string } = {}
): CategoryHistoryRanking[] {
    const currentText = normalizeComparisonText([context.description, context.merchant].filter(Boolean).join(' '))
    const orderedEntries = [...entries].sort(
        (left, right) => occurredAtTimestamp(right.occurredAt) - occurredAtTimestamp(left.occurredAt)
    )
    const aggregates = new Map<string, {
        count: number
        mostRecentIndex: number
        bestSimilarity: number
        similarMatches: number
    }>()

    orderedEntries.forEach((entry, index) => {
        if (!entry.categoryId) return

        const historicalText = normalizeComparisonText([entry.description, entry.merchant].filter(Boolean).join(' '))
        const similarity = getTextSimilarity(currentText, historicalText)
        const current = aggregates.get(entry.categoryId) ?? {
            count: 0,
            mostRecentIndex: index,
            bestSimilarity: 0,
            similarMatches: 0,
        }

        current.count += 1
        current.mostRecentIndex = Math.min(current.mostRecentIndex, index)
        current.bestSimilarity = Math.max(current.bestSimilarity, similarity)
        if (similarity >= 0.45) current.similarMatches += 1
        aggregates.set(entry.categoryId, current)
    })

    return Array.from(aggregates.entries())
        .map(([categoryId, aggregate]) => {
            const frequencyScore = Math.min(18, Math.log2(aggregate.count + 1) * 5)
            const recencyScore = Math.max(0, 24 - aggregate.mostRecentIndex * 0.35)
            const similarityScore =
                aggregate.bestSimilarity * 100 + Math.min(12, aggregate.similarMatches * 3)

            return {
                categoryId,
                score: Number((frequencyScore + recencyScore + similarityScore).toFixed(3)),
                mostRecentIndex: aggregate.mostRecentIndex,
                usageCount: aggregate.count,
                similarMatchCount: aggregate.similarMatches,
                reason:
                    aggregate.similarMatches > 0
                        ? `La usaste en ${aggregate.similarMatches} movimiento${aggregate.similarMatches === 1 ? '' : 's'} similar${aggregate.similarMatches === 1 ? '' : 'es'}.`
                        : aggregate.count > 1
                            ? `La usaste ${aggregate.count} veces y aparece entre tus movimientos recientes.`
                            : 'Aparece entre tus movimientos recientes.',
            }
        })
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score
            if (left.mostRecentIndex !== right.mostRecentIndex) {
                return left.mostRecentIndex - right.mostRecentIndex
            }
            return left.categoryId.localeCompare(right.categoryId)
        })
        .map(({ categoryId, score, usageCount, similarMatchCount, reason }) => ({
            categoryId,
            score,
            usageCount,
            similarMatchCount,
            reason,
        }))
}

export function orderCategoryIds({
    categoryIds,
    historyRanking,
    recentCategoryIds = [],
    selectedCategoryId,
}: {
    categoryIds: string[]
    historyRanking: CategoryHistoryRanking[]
    recentCategoryIds?: string[]
    selectedCategoryId?: string
}) {
    const scores = new Map(historyRanking.map((item) => [item.categoryId, item.score]))

    recentCategoryIds.forEach((categoryId, index) => {
        const recentBoost = Math.max(4, 22 - index * 3)
        scores.set(categoryId, (scores.get(categoryId) ?? 0) + recentBoost)
    })

    if (selectedCategoryId) {
        scores.set(selectedCategoryId, (scores.get(selectedCategoryId) ?? 0) + 1_000)
    }

    return categoryIds
        .map((categoryId, originalIndex) => ({
            categoryId,
            originalIndex,
            score: scores.get(categoryId) ?? 0,
        }))
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score
            return left.originalIndex - right.originalIndex
        })
        .map((item) => item.categoryId)
}
