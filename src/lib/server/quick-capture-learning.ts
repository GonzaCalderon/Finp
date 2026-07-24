import { createHash, randomUUID } from 'crypto'
import { Types } from 'mongoose'

import {
    Account,
    Category,
    QuickCaptureLearningEvent,
    QuickCaptureLearningProfile,
    QuickCapturePatternControl,
    Transaction,
} from '@/lib/models'
import { supportsCurrency } from '@/lib/utils/accounts'
import {
    compareQuickCaptureLearnedPatterns,
    resolveQuickCapturePatternEligibility,
    sanitizeQuickCaptureLearningEvent,
    sanitizeQuickCaptureLearningTerms,
    scoreQuickCaptureLearningPattern,
} from '@/lib/utils/quick-capture-learning'
import { normalizeQuickCaptureTerm } from '@/lib/utils/quick-capture'
import type { Currency } from '@/lib/constants'
import type {
    QuickCaptureLearnedPatternDto,
    QuickCaptureLearningContext,
    QuickCaptureLearningEventInput,
    QuickCaptureLearningMetrics,
    QuickCaptureLearningProfileDto,
    QuickCapturePatternTriggerKind,
} from '@/types'

const SIMPLE_ACCOUNT_TYPES = new Set(['bank', 'cash', 'wallet', 'savings'])
const HISTORY_LIMIT = 500
const EVENT_RETENTION_MS = 180 * 24 * 60 * 60 * 1000
const RECENT_NEGATIVE_MS = 30 * 24 * 60 * 60 * 1000

type TransactionLearningRow = {
    _id: { toString(): string }
    type: 'expense' | 'income'
    currency: Currency
    description: string
    merchant?: string
    sourceAccountId?: { toString(): string }
    destinationAccountId?: { toString(): string }
    categoryId?: { toString(): string }
    date: Date
    createdAt?: Date
    updatedAt?: Date
}

type LearningEventRow = {
    type: QuickCaptureLearningEventInput['type']
    patternKey?: string
    durationMs?: number
    createdAt: Date
}

type PatternCandidate = {
    targetId?: string
    targetValue?: string
    targetLabel: string
    occurrences: number
    lastSeenAt: Date
}

type PatternGroup = {
    triggerKind: QuickCapturePatternTriggerKind
    triggerTerm: string
    triggerLabel: string
    transactionType: 'expense' | 'income'
    currency: Currency
    targetType: QuickCaptureLearnedPatternDto['targetType']
    total: number
    candidates: Map<string, PatternCandidate>
}

function resolveId(value: unknown) {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && 'toString' in value) return value.toString()
    return undefined
}

function patternKey(value: string) {
    return createHash('sha256').update(value).digest('hex')
}

function displayToken(source: string, normalized: string) {
    const token = source
        .split(/\s+/)
        .find((item) => normalizeQuickCaptureTerm(item) === normalized)
    if (token) return token
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function patternReason(pattern: {
    triggerLabel: string
    targetLabel: string
    occurrences: number
    total: number
}) {
    return `Usaste ${pattern.triggerLabel} con ${pattern.targetLabel} en ${pattern.occurrences} de ${pattern.total} movimientos similares.`
}

export async function getQuickCaptureLearningProfile(
    userId: string
): Promise<QuickCaptureLearningProfileDto> {
    const profile = await QuickCaptureLearningProfile.findOne({ userId })
        .lean<{
            enabled?: boolean
            resetAt?: Date
            introSeenAt?: Date
        } | null>()

    return {
        enabled: profile?.enabled !== false,
        resetAt: profile?.resetAt?.toISOString(),
        introSeenAt: profile?.introSeenAt?.toISOString(),
    }
}

function buildMetrics(
    events: LearningEventRow[],
    activePatterns: number
): QuickCaptureLearningMetrics {
    const count = (type: LearningEventRow['type']) =>
        events.filter((event) => event.type === type).length
    const captures = count('capture_opened')
    const confirmed = count('capture_confirmed')
    const abandoned = count('capture_abandoned')
    const suggestionsShown = count('suggestion_shown')
    const suggestionsAccepted = count('suggestion_accepted')
    const corrections = count('field_corrected')
    const reversions = count('suggestion_reverted')
    const durations = events
        .map((event) => event.durationMs)
        .filter((duration): duration is number => typeof duration === 'number')
        .sort((left, right) => left - right)
    const middle = Math.floor(durations.length / 2)
    const medianDurationMs = durations.length === 0
        ? undefined
        : durations.length % 2 === 0
            ? Math.round((durations[middle - 1] + durations[middle]) / 2)
            : durations[middle]

    return {
        captures,
        confirmed,
        abandoned,
        suggestionsShown,
        suggestionsAccepted,
        corrections,
        reversions,
        acceptanceRate:
            suggestionsShown > 0 ? suggestionsAccepted / suggestionsShown : 0,
        correctionRate: confirmed > 0 ? corrections / confirmed : 0,
        medianDurationMs,
        activePatterns,
    }
}

function addCandidate(
    groups: Map<string, PatternGroup>,
    params: {
        triggerKind: QuickCapturePatternTriggerKind
        triggerTerm: string
        triggerLabel: string
        transactionType: 'expense' | 'income'
        currency: Currency
        targetType: PatternGroup['targetType']
        targetId?: string
        targetValue?: string
        targetLabel?: string
        lastSeenAt: Date
    }
) {
    const groupKey = [
        params.triggerKind,
        params.triggerTerm,
        params.transactionType,
        params.currency,
        params.targetType,
    ].join('|')
    let group = groups.get(groupKey)
    if (!group) {
        group = {
            triggerKind: params.triggerKind,
            triggerTerm: params.triggerTerm,
            triggerLabel: params.triggerLabel,
            transactionType: params.transactionType,
            currency: params.currency,
            targetType: params.targetType,
            total: 0,
            candidates: new Map(),
        }
        groups.set(groupKey, group)
    }
    group.total += 1

    const targetKey = params.targetId || params.targetValue
    if (!targetKey || !params.targetLabel) return
    const existing = group.candidates.get(targetKey)
    if (existing) {
        existing.occurrences += 1
        if (params.lastSeenAt > existing.lastSeenAt) {
            existing.lastSeenAt = params.lastSeenAt
            existing.targetLabel = params.targetLabel
        }
        return
    }
    group.candidates.set(targetKey, {
        targetId: params.targetId,
        targetValue: params.targetValue,
        targetLabel: params.targetLabel,
        occurrences: 1,
        lastSeenAt: params.lastSeenAt,
    })
}

function buildPatternGroups(rows: TransactionLearningRow[]) {
    const groups = new Map<string, PatternGroup>()
    rows.forEach((transaction) => {
        const descriptionTerm = normalizeQuickCaptureTerm(transaction.description)
        const words = sanitizeQuickCaptureLearningTerms([transaction.description])
        const merchantTerm = normalizeQuickCaptureTerm(transaction.merchant ?? '')
        const triggers = new Map<string, {
            kind: QuickCapturePatternTriggerKind
            term: string
            label: string
        }>()
        if (descriptionTerm.length >= 3) {
            triggers.set(`description:${descriptionTerm}`, {
                kind: 'description',
                term: descriptionTerm,
                label: transaction.description,
            })
        }
        words.forEach((word) => {
            triggers.set(`token:${word}`, {
                kind: 'token',
                term: word,
                label: displayToken(transaction.description, word),
            })
        })
        if (merchantTerm.length >= 3) {
            triggers.set(`merchant:${merchantTerm}`, {
                kind: 'merchant',
                term: merchantTerm,
                label: transaction.merchant ?? merchantTerm,
            })
        }

        const accountId = resolveId(
            transaction.type === 'income'
                ? transaction.destinationAccountId
                : transaction.sourceAccountId
        )
        const categoryId = resolveId(transaction.categoryId)
        const lastSeenAt =
            transaction.updatedAt ?? transaction.createdAt ?? transaction.date

        triggers.forEach((trigger) => {
            addCandidate(groups, {
                triggerKind: trigger.kind,
                triggerTerm: trigger.term,
                triggerLabel: trigger.label,
                transactionType: transaction.type,
                currency: transaction.currency,
                targetType: 'account',
                targetId: accountId,
                targetLabel: accountId,
                lastSeenAt,
            })
            addCandidate(groups, {
                triggerKind: trigger.kind,
                triggerTerm: trigger.term,
                triggerLabel: trigger.label,
                transactionType: transaction.type,
                currency: transaction.currency,
                targetType: 'category',
                targetId: categoryId,
                targetLabel: categoryId,
                lastSeenAt,
            })
            addCandidate(groups, {
                triggerKind: trigger.kind,
                triggerTerm: trigger.term,
                triggerLabel: trigger.label,
                transactionType: transaction.type,
                currency: transaction.currency,
                targetType: 'merchant',
                targetValue:
                    trigger.kind === 'merchant' ? undefined : transaction.merchant,
                targetLabel:
                    trigger.kind === 'merchant' ? undefined : transaction.merchant,
                lastSeenAt,
            })
            if (trigger.kind === 'token') {
                addCandidate(groups, {
                    triggerKind: trigger.kind,
                    triggerTerm: trigger.term,
                    triggerLabel: trigger.label,
                    transactionType: transaction.type,
                    currency: transaction.currency,
                    targetType: 'description',
                    targetValue: trigger.label,
                    targetLabel: trigger.label,
                    lastSeenAt,
                })
            }
        })
    })
    return groups
}

export async function getQuickCaptureLearningContext(
    userId: string,
    options: {
        includeForgotten?: boolean
        includeWhenDisabled?: boolean
        limit?: number
    } = {}
): Promise<QuickCaptureLearningContext> {
    const profile = await getQuickCaptureLearningProfile(userId)
    const resetAt = profile.resetAt ? new Date(profile.resetAt) : undefined
    const eventStart = new Date(Math.max(
        Date.now() - EVENT_RETENTION_MS,
        resetAt?.getTime() ?? 0
    ))
    const historyFilter: Record<string, unknown> = {
        userId,
        type: { $in: ['expense', 'income'] },
        status: { $in: ['confirmed', null] },
        createdFrom: { $in: ['web', 'quick_capture'] },
        installmentPlanId: { $exists: false },
        spaceId: { $exists: false },
        importBatchId: { $exists: false },
    }
    if (resetAt) {
        historyFilter.$or = [
            { createdAt: { $gte: resetAt } },
            { updatedAt: { $gte: resetAt } },
        ]
    }

    const [rows, events, controls] = await Promise.all([
        Transaction.find(historyFilter)
            .select(
                'type currency description merchant sourceAccountId destinationAccountId categoryId date createdAt updatedAt'
            )
            .sort({ updatedAt: -1, date: -1 })
            .limit(HISTORY_LIMIT)
            .lean<TransactionLearningRow[]>(),
        QuickCaptureLearningEvent.find({
            userId,
            createdAt: { $gte: eventStart },
        })
            .select('type patternKey durationMs createdAt')
            .sort({ createdAt: -1 })
            .lean<LearningEventRow[]>(),
        QuickCapturePatternControl.find({ userId })
            .select('patternKey status')
            .lean<Array<{
                patternKey: string
                status: 'active' | 'forgotten'
            }>>(),
    ])

    const groups = buildPatternGroups(rows)
    const accountIds = new Set<string>()
    const categoryIds = new Set<string>()
    groups.forEach((group) => {
        group.candidates.forEach((candidate) => {
            if (group.targetType === 'account' && candidate.targetId) {
                accountIds.add(candidate.targetId)
            }
            if (group.targetType === 'category' && candidate.targetId) {
                categoryIds.add(candidate.targetId)
            }
        })
    })
    const [accounts, categories] = await Promise.all([
        Account.find({
            _id: { $in: Array.from(accountIds) },
            userId,
            isActive: { $ne: false },
            type: { $in: Array.from(SIMPLE_ACCOUNT_TYPES) },
        })
            .select('_id name color currency supportedCurrencies type isActive')
            .lean<Array<{
                _id: { toString(): string }
                name: string
                color?: string
                currency: Currency
                supportedCurrencies?: Currency[]
                type: string
                isActive?: boolean
            }>>(),
        Category.find({
            _id: { $in: Array.from(categoryIds) },
            userId,
            isArchived: { $ne: true },
        })
            .select('_id name color type')
            .lean<Array<{
                _id: { toString(): string }
                name: string
                color?: string
                type: 'expense' | 'income'
            }>>(),
    ])
    const accountMap = new Map(
        accounts.map((account) => [account._id.toString(), account])
    )
    const categoryMap = new Map(
        categories.map((category) => [category._id.toString(), category])
    )
    const controlMap = new Map(
        controls.map((control) => [control.patternKey, control.status])
    )
    const feedbackMap = new Map<string, {
        accepted: number
        dismissed: number
        reverted: number
        corrected: number
        recentNegative: number
    }>()
    events.forEach((event) => {
        if (!event.patternKey) return
        const feedback = feedbackMap.get(event.patternKey) ?? {
            accepted: 0,
            dismissed: 0,
            reverted: 0,
            corrected: 0,
            recentNegative: 0,
        }
        const recent =
            Date.now() - event.createdAt.getTime() <= RECENT_NEGATIVE_MS
        if (event.type === 'suggestion_accepted') feedback.accepted += 1
        if (event.type === 'suggestion_dismissed') {
            feedback.dismissed += 1
            if (recent) feedback.recentNegative += 1
        }
        if (event.type === 'suggestion_reverted') {
            feedback.reverted += 1
            if (recent) feedback.recentNegative += 1
        }
        if (event.type === 'field_corrected') {
            feedback.corrected += 1
            if (recent) feedback.recentNegative += 1
        }
        feedbackMap.set(event.patternKey, feedback)
    })

    const patterns: QuickCaptureLearnedPatternDto[] = []
    groups.forEach((group) => {
        const orderedCandidates = Array.from(group.candidates.values())
            .sort((left, right) => right.occurrences - left.occurrences)
        orderedCandidates.forEach((candidate, index) => {
            let targetLabel = candidate.targetLabel
            let targetColor: string | undefined
            if (group.targetType === 'account') {
                const account = candidate.targetId
                    ? accountMap.get(candidate.targetId)
                    : undefined
                if (!account || !supportsCurrency(account, group.currency)) return
                targetLabel = account.name
                targetColor = account.color
            }
            if (group.targetType === 'category') {
                const category = candidate.targetId
                    ? categoryMap.get(candidate.targetId)
                    : undefined
                if (!category || category.type !== group.transactionType) return
                targetLabel = category.name
                targetColor = category.color
            }

            const rawKey = [
                group.triggerKind,
                group.triggerTerm,
                group.transactionType,
                group.currency,
                group.targetType,
                candidate.targetId ?? candidate.targetValue,
            ].join('|')
            const key = patternKey(rawKey)
            const feedback = feedbackMap.get(key) ?? {
                accepted: 0,
                dismissed: 0,
                reverted: 0,
                corrected: 0,
                recentNegative: 0,
            }
            const daysSinceLastSeen = Math.max(
                0,
                (Date.now() - candidate.lastSeenAt.getTime()) / 86_400_000
            )
            const { consistency, confidence } =
                scoreQuickCaptureLearningPattern({
                    occurrences: candidate.occurrences,
                    total: group.total,
                    daysSinceLastSeen,
                    acceptedCount: feedback.accepted,
                    dismissedCount: feedback.dismissed,
                    revertedCount: feedback.reverted,
                    correctedCount: feedback.corrected,
                })
            const lead =
                candidate.occurrences -
                (orderedCandidates[index === 0 ? 1 : 0]?.occurrences ?? 0)
            const eligibility = resolveQuickCapturePatternEligibility({
                occurrences: candidate.occurrences,
                consistency,
                confidence,
                lead,
                recentNegativeCount: feedback.recentNegative,
            })
            const status = controlMap.get(key) ?? 'active'
            if (
                !eligibility.visible &&
                !(options.includeForgotten && status === 'forgotten')
            ) {
                return
            }
            if (status === 'forgotten' && !options.includeForgotten) return

            const pattern: QuickCaptureLearnedPatternDto = {
                key,
                triggerKind: group.triggerKind,
                triggerTerm: group.triggerTerm,
                triggerLabel: group.triggerLabel,
                transactionType: group.transactionType,
                currency: group.currency,
                targetType: group.targetType,
                targetId: candidate.targetId,
                targetValue: candidate.targetValue,
                targetLabel,
                targetColor,
                occurrences: candidate.occurrences,
                total: group.total,
                consistency,
                confidence,
                lead,
                acceptedCount: feedback.accepted,
                dismissedCount: feedback.dismissed,
                revertedCount: feedback.reverted,
                correctedCount: feedback.corrected,
                lastSeenAt: candidate.lastSeenAt.toISOString(),
                autoApply: eligibility.autoApply && status === 'active',
                status,
                reason: patternReason({
                    triggerLabel: group.triggerLabel,
                    targetLabel,
                    occurrences: candidate.occurrences,
                    total: group.total,
                }),
                canConvertToRule:
                    (group.triggerKind === 'description' ||
                        group.triggerKind === 'merchant') &&
                    (group.targetType === 'category' ||
                        group.targetType === 'merchant'),
            }
            patterns.push(pattern)
        })
    })

    patterns.sort(compareQuickCaptureLearnedPatterns)
    const enabledPatterns =
        profile.enabled || options.includeWhenDisabled
            ? patterns.slice(0, options.limit ?? 100)
            : []
    return {
        profile,
        patterns: enabledPatterns,
        metrics: buildMetrics(
            events,
            patterns.filter((pattern) => pattern.status === 'active').length
        ),
    }
}

export async function getQuickCaptureLearningPattern(
    userId: string,
    key: string
) {
    const learning = await getQuickCaptureLearningContext(userId, {
        includeForgotten: true,
        includeWhenDisabled: true,
        limit: 300,
    })
    return learning.patterns.find((pattern) => pattern.key === key)
}

export async function recordQuickCaptureLearningEvents(
    userId: string,
    inputs: QuickCaptureLearningEventInput[]
) {
    if (inputs.length === 0) return
    const profile = await QuickCaptureLearningProfile.findOne({ userId })
        .select('enabled')
        .lean<{ enabled?: boolean } | null>()
    if (profile?.enabled === false) return

    const events = inputs.map(sanitizeQuickCaptureLearningEvent)
    const userObjectId = new Types.ObjectId(userId)
    await QuickCaptureLearningEvent.bulkWrite(
        events.map((event) => ({
            updateOne: {
                filter: { userId: userObjectId, eventId: event.eventId },
                update: {
                    $setOnInsert: {
                        userId: userObjectId,
                        ...event,
                        accountId:
                            event.accountId && Types.ObjectId.isValid(event.accountId)
                                ? new Types.ObjectId(event.accountId)
                                : undefined,
                        categoryId:
                            event.categoryId && Types.ObjectId.isValid(event.categoryId)
                                ? new Types.ObjectId(event.categoryId)
                                : undefined,
                        targetId:
                            event.targetId && Types.ObjectId.isValid(event.targetId)
                                ? new Types.ObjectId(event.targetId)
                                : undefined,
                        transactionId:
                            event.transactionId &&
                            Types.ObjectId.isValid(event.transactionId)
                                ? new Types.ObjectId(event.transactionId)
                                : undefined,
                    },
                },
                upsert: true,
            },
        })),
        { ordered: false }
    )
}

export async function recordTransactionLearningEvent(params: {
    userId: string
    type:
        | 'capture_confirmed'
        | 'transaction_edited'
        | 'transaction_deleted'
        | 'transaction_undone'
    transaction: {
        _id: unknown
        type?: string
        currency?: string
        description?: string
        merchant?: string
        sourceAccountId?: unknown
        destinationAccountId?: unknown
        categoryId?: unknown
        updatedAt?: Date
    }
    sessionId?: string
    durationMs?: number
    eventId?: string
}) {
    const transactionId = resolveId(params.transaction._id)
    if (
        !transactionId ||
        !['expense', 'income'].includes(params.transaction.type ?? '') ||
        !['ARS', 'USD'].includes(params.transaction.currency ?? '')
    ) {
        return
    }
    const transactionType = params.transaction.type as 'expense' | 'income'
    const accountId = resolveId(
        transactionType === 'income'
            ? params.transaction.destinationAccountId
            : params.transaction.sourceAccountId
    )
    const revision =
        params.transaction.updatedAt?.getTime().toString() ?? randomUUID()
    await recordQuickCaptureLearningEvents(params.userId, [{
        eventId:
            params.eventId ??
            `${params.type}:${transactionId}:${revision}`,
        sessionId: params.sessionId ?? `transaction:${transactionId}`,
        type: params.type,
        method:
            params.type === 'transaction_undone'
                ? 'undo'
                : params.type === 'transaction_deleted'
                    ? 'delete'
                    : params.type === 'capture_confirmed'
                        ? 'submit'
                        : 'manual',
        inputTerms: sanitizeQuickCaptureLearningTerms([
            params.transaction.description ?? '',
        ]),
        transactionType,
        currency: params.transaction.currency as Currency,
        accountId,
        categoryId: resolveId(params.transaction.categoryId),
        merchantTerm: params.transaction.merchant,
        durationMs: params.durationMs,
        transactionId,
    }])
}

export async function updateQuickCaptureLearningProfile(params: {
    userId: string
    enabled?: boolean
    markIntroSeen?: boolean
}) {
    const set: Record<string, unknown> = {}
    if (typeof params.enabled === 'boolean') set.enabled = params.enabled
    if (params.markIntroSeen) set.introSeenAt = new Date()
    await QuickCaptureLearningProfile.updateOne(
        { userId: params.userId },
        {
            $set: set,
            $setOnInsert: { userId: params.userId },
        },
        { upsert: true }
    )
    return getQuickCaptureLearningProfile(params.userId)
}

export async function updateQuickCapturePatternStatus(params: {
    userId: string
    patternKey: string
    status: 'active' | 'forgotten'
}) {
    const pattern = await getQuickCaptureLearningPattern(
        params.userId,
        params.patternKey
    )
    if (!pattern) return undefined
    await QuickCapturePatternControl.updateOne(
        { userId: params.userId, patternKey: params.patternKey },
        {
            $set: { status: params.status },
            $setOnInsert: {
                userId: params.userId,
                patternKey: params.patternKey,
            },
        },
        { upsert: true }
    )
    return { ...pattern, status: params.status, autoApply: false }
}

export async function resetQuickCaptureLearning(userId: string) {
    const resetAt = new Date()
    await Promise.all([
        QuickCaptureLearningEvent.deleteMany({ userId }),
        QuickCapturePatternControl.deleteMany({ userId }),
        QuickCaptureLearningProfile.updateOne(
            { userId },
            {
                $set: {
                    enabled: true,
                    resetAt,
                },
                $unset: { introSeenAt: 1 },
                $setOnInsert: { userId },
            },
            { upsert: true }
        ),
    ])
    return {
        enabled: true,
        resetAt: resetAt.toISOString(),
    } satisfies QuickCaptureLearningProfileDto
}
