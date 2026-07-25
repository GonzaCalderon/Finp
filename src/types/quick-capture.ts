import type { Currency } from '@/lib/constants'

export type QuickCaptureAliasTargetType =
    | 'account'
    | 'category'
    | 'merchant'
    | 'description'

export type QuickCaptureSuggestionSource =
    | 'alias'
    | 'rule'
    | 'learned'
    | 'frequent'
    | 'entity'
    | 'similarity'
    | 'date'

export type QuickCaptureLearningEventType =
    | 'capture_opened'
    | 'suggestion_shown'
    | 'suggestion_accepted'
    | 'suggestion_dismissed'
    | 'suggestion_reverted'
    | 'field_corrected'
    | 'capture_abandoned'
    | 'capture_handoff'
    | 'capture_confirmed'
    | 'transaction_edited'
    | 'transaction_deleted'
    | 'transaction_undone'
    // Sugerencias funcionales: mostrada, aceptada, descartada y completada son
    // estados distintos. Tocar el CTA no equivale a completar la función.
    | 'intent_detected'
    | 'intent_accepted'
    | 'intent_dismissed'
    | 'intent_completed'

export type QuickCaptureLearningMethod =
    | 'automatic'
    | 'enter'
    | 'tab'
    | 'space'
    | 'tap'
    | 'always'
    | 'escape'
    | 'double_space'
    | 'manual'
    | 'close'
    | 'handoff'
    | 'submit'
    | 'delete'
    | 'undo'
    /** Derivación a un módulo especializado llevando el borrador. */
    | 'derive'
    /** Silenciado de forma persistente ("No volver a sugerir"). */
    | 'never'

export type QuickCapturePatternTriggerKind =
    | 'description'
    | 'merchant'
    | 'token'

export interface QuickCaptureAliasDto {
    _id: string
    term: string
    normalizedTerm: string
    targetType: QuickCaptureAliasTargetType
    targetId?: string
    targetValue?: string
    targetLabel: string
    targetColor?: string
    isStale?: boolean
    usageCount: number
    lastUsedAt?: string
    createdAt: string
    updatedAt: string
}

export type QuickCaptureTokenKind =
    | 'amount'
    | 'currency'
    | 'date'
    | 'type'
    | 'account'
    | 'category'
    | 'merchant'
    | 'description'
    | 'correction'
    | 'suggestion'
    | 'unknown'

export interface QuickCaptureToken {
    value: string
    normalizedValue: string
    start: number
    end: number
    kind: QuickCaptureTokenKind
    label?: string
    color?: string
}

export interface QuickCaptureSuggestion {
    id: string
    sourceText: string
    targetType: QuickCaptureAliasTargetType | 'date'
    targetId?: string
    targetValue?: string
    targetLabel: string
    reason: string
    confidence: number
    start: number
    end: number
    source?: QuickCaptureSuggestionSource
    patternKey?: string
    evidence?: {
        occurrences: number
        total: number
        consistency: number
    }
    autoApplicable?: boolean
    preserveSourceText?: boolean
}

export interface QuickCaptureDraft {
    type: 'expense' | 'income'
    amount?: number
    currency: Currency
    date: Date
    description: string
    accountId?: string
    categoryId?: string
    merchant?: string
}

export interface QuickCaptureInterpretation {
    draft: QuickCaptureDraft
    tokens: QuickCaptureToken[]
    suggestions: QuickCaptureSuggestion[]
    unresolvedTokens: string[]
    corrections: Array<{
        source: string
        target: string
        reason: string
    }>
    appliedAliasIds?: string[]
    personalizations?: QuickCaptureAppliedPersonalization[]
}

export interface QuickCaptureAppliedPersonalization {
    patternKey: string
    targetType: QuickCaptureAliasTargetType
    targetId?: string
    targetValue?: string
    targetLabel: string
    triggerLabel: string
    reason: string
    confidence: number
    occurrences: number
    total: number
}

export interface QuickCaptureLearnedPatternDto {
    key: string
    triggerKind: QuickCapturePatternTriggerKind
    triggerTerm: string
    triggerLabel: string
    transactionType: 'expense' | 'income'
    currency: Currency
    targetType: QuickCaptureAliasTargetType
    targetId?: string
    targetValue?: string
    targetLabel: string
    targetColor?: string
    occurrences: number
    total: number
    consistency: number
    confidence: number
    lead: number
    acceptedCount: number
    dismissedCount: number
    revertedCount: number
    correctedCount: number
    lastSeenAt: string
    autoApply: boolean
    status: 'active' | 'forgotten'
    reason: string
    canConvertToRule: boolean
}

export interface QuickCaptureLearningProfileDto {
    enabled: boolean
    resetAt?: string
    /** Intro del aprendizaje personal. */
    introSeenAt?: string
    /** Intro de Captura rápida como orientador, independiente de la anterior. */
    captureIntroSeenAt?: string
}

export interface QuickCaptureLearningMetrics {
    captures: number
    confirmed: number
    abandoned: number
    suggestionsShown: number
    suggestionsAccepted: number
    corrections: number
    reversions: number
    acceptanceRate: number
    correctionRate: number
    medianDurationMs?: number
    activePatterns: number
}

export interface QuickCaptureLearningContext {
    profile: QuickCaptureLearningProfileDto
    patterns: QuickCaptureLearnedPatternDto[]
    metrics: QuickCaptureLearningMetrics
}

export interface QuickCaptureLearningEventInput {
    eventId: string
    sessionId: string
    type: QuickCaptureLearningEventType
    method?: QuickCaptureLearningMethod
    inputTerms?: string[]
    transactionType?: 'expense' | 'income'
    currency?: Currency
    accountId?: string
    categoryId?: string
    merchantTerm?: string
    suggestionId?: string
    patternKey?: string
    source?: QuickCaptureSuggestionSource
    targetType?: QuickCaptureAliasTargetType | 'date'
    targetId?: string
    targetValue?: string
    confidence?: number
    position?: number
    durationMs?: number
    transactionId?: string
}

export interface QuickCaptureFrequent {
    key: string
    type: 'expense' | 'income'
    amount: number
    currency: Currency
    description: string
    merchant?: string
    accountId?: string
    categoryId?: string
    occurrences: number
    lastUsedAt: string
}

export interface TransactionPreviewIssue {
    code: string
    message: string
    field?: string
    severity: 'error' | 'warning'
}

export interface TransactionAccountImpact {
    accountId: string
    accountName: string
    currency: Currency
    currentBalance: number
    resultingBalance: number
    allowNegativeBalance: boolean
}

export interface TransactionPreviewResponse {
    valid: boolean
    normalized?: {
        type: 'expense' | 'income'
        amount: number
        currency: Currency
        date: string
        description: string
        sourceAccountId?: string
        destinationAccountId?: string
        categoryId?: string
        merchant?: string
    }
    appliedRule?: {
        id: string
        name: string
    }
    category?: {
        id: string
        name: string
        color?: string
    }
    accountImpact?: TransactionAccountImpact
    duplicate?: {
        transactionId: string
        description: string
        date: string
    }
    issues: TransactionPreviewIssue[]
}

export interface QuickCaptureContextResponse {
    aliases: QuickCaptureAliasDto[]
    frequents: QuickCaptureFrequent[]
    learning?: QuickCaptureLearningContext
    /**
     * Compromisos con aplicación pendiente en el período actual. Ausentes si la
     * consulta falla: la orientación es una mejora, no un requisito para capturar.
     */
    commitments?: QuickCaptureCommitmentDto[]
    currentPeriod?: string
    /** `subjectKey` de propuestas que el usuario silenció con "No volver a sugerir". */
    dismissedSuggestions?: string[]
}

/** Compromiso aplicable, tal como lo consume el detector de intención. */
export interface QuickCaptureCommitmentDto {
    commitmentId: string
    description: string
    normalizedDescription?: string
    aliases?: string[]
    period: string
    currency: Currency
    resolvedAmount: number
    amountPolicy: 'fixed' | 'variable'
    accountId?: string
    categoryId?: string
    state: 'scheduled' | 'awaiting_amount' | 'ready' | 'registered' | 'skipped' | 'cancelled' | 'reverted'
}
