import type {
    QuickCaptureLearnedPatternDto,
    QuickCaptureLearningEventInput,
} from '@/types'

const LEARNING_STOP_WORDS = new Set([
    'ars',
    'usd',
    'hoy',
    'ayer',
    'anteayer',
    'antes',
    'manana',
    'mañana',
    'gasto',
    'gaste',
    'gasté',
    'ingreso',
    'cobre',
    'cobré',
    'pague',
    'pagué',
    'con',
    'desde',
    'hacia',
    'para',
    'por',
    'del',
    'las',
    'los',
    'una',
    'uno',
    'que',
])

export function sanitizeQuickCaptureLearningTerms(
    values: string[]
): string[] {
    return Array.from(new Set(
        values
            .flatMap((value) => value.split(/\s+/))
            .map((value) =>
                value
                    .normalize('NFD')
                    .replace(/\p{Diacritic}/gu, '')
                    .toLowerCase()
                    .replace(/[^\p{L}\p{N}]/gu, '')
                    .slice(0, 40)
            )
            .filter((value) =>
                value.length >= 3 &&
                !LEARNING_STOP_WORDS.has(value) &&
                !/^\d+$/.test(value)
            )
    )).slice(0, 8)
}

export function sanitizeQuickCaptureLearningEvent(
    input: QuickCaptureLearningEventInput
): QuickCaptureLearningEventInput {
    return {
        ...input,
        inputTerms: input.inputTerms
            ? sanitizeQuickCaptureLearningTerms(input.inputTerms)
            : undefined,
        merchantTerm: input.merchantTerm
            ? sanitizeQuickCaptureLearningTerms([input.merchantTerm]).join(' ').slice(0, 120)
            : undefined,
        targetValue: input.targetValue
            ? sanitizeQuickCaptureLearningTerms([input.targetValue]).join(' ').slice(0, 200)
            : undefined,
        durationMs:
            typeof input.durationMs === 'number'
                ? Math.min(Math.max(Math.round(input.durationMs), 0), 86_400_000)
                : undefined,
    }
}

export function scoreQuickCaptureLearningPattern(params: {
    occurrences: number
    total: number
    daysSinceLastSeen: number
    acceptedCount: number
    dismissedCount: number
    revertedCount: number
    correctedCount: number
}) {
    const {
        occurrences,
        total,
        daysSinceLastSeen,
        acceptedCount,
        dismissedCount,
        revertedCount,
        correctedCount,
    } = params
    const consistency = total > 0 ? occurrences / total : 0
    const smoothedConfidence = (occurrences + 1) / (total + 2)
    const interactions = Math.max(
        3,
        acceptedCount + dismissedCount + revertedCount + correctedCount
    )
    const feedback = Math.max(
        -0.25,
        Math.min(
            0.15,
            (
                acceptedCount -
                dismissedCount * 2 -
                revertedCount * 3 -
                correctedCount * 2
            ) / interactions * 0.12
        )
    )
    const recency = Math.max(0, 1 - daysSinceLastSeen / 90) * 0.1
    const confidence = Math.max(
        0,
        Math.min(1, smoothedConfidence + feedback + recency)
    )

    return { consistency, confidence }
}

export function resolveQuickCapturePatternEligibility(params: {
    occurrences: number
    consistency: number
    confidence: number
    lead: number
    recentNegativeCount: number
}) {
    const visible =
        params.occurrences >= 3 &&
        params.consistency >= 0.7 &&
        params.confidence >= 0.55
    const autoApply =
        visible &&
        params.occurrences >= 5 &&
        params.consistency >= 0.9 &&
        params.confidence >= 0.8 &&
        params.lead >= 2 &&
        params.recentNegativeCount < 2

    return { visible, autoApply }
}

export function compareQuickCaptureLearnedPatterns(
    left: QuickCaptureLearnedPatternDto,
    right: QuickCaptureLearnedPatternDto
) {
    if (left.autoApply !== right.autoApply) return left.autoApply ? -1 : 1
    if (left.confidence !== right.confidence) {
        return right.confidence - left.confidence
    }
    if (left.occurrences !== right.occurrences) {
        return right.occurrences - left.occurrences
    }
    return right.lastSeenAt.localeCompare(left.lastSeenAt)
}
