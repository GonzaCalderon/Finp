'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    AlertTriangle,
    Loader2,
    Save,
    Trash2,
} from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useSpaceCategories } from '@/hooks/useSpaceCategories'
import { useToast } from '@/hooks/useToast'
import { useSpaceEntryDraft } from '@/hooks/useSpaceEntryDraft'
import type { SpaceEntryCreateOptions } from '@/hooks/useSpaceEntries'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { spaceEntryEditSchema, spaceEntrySchema, type SpaceEntryFormData, type SpaceFormData } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { Currency } from '@/lib/constants'
import type {
    ISpaceEntry,
    ISpaceParticipant,
    SpaceEntryPreviewDto,
    SpaceEntryDraftDto,
    SpaceLinkCandidateDto,
    SpaceQuotesDto,
} from '@/types'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { DialogProps } from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { SpaceEntryStepper } from '@/components/spaces/dialogs/entry-steps/SpaceEntryStepper'
import { SpaceEntryDataStep } from '@/components/spaces/dialogs/entry-steps/SpaceEntryDataStep'
import { SpaceEntrySplitStep } from '@/components/spaces/dialogs/entry-steps/SpaceEntrySplitStep'
import { SpaceEntryExtrasStep } from '@/components/spaces/dialogs/entry-steps/SpaceEntryExtrasStep'
import { SpaceEntryReviewStep } from '@/components/spaces/dialogs/entry-steps/SpaceEntryReviewStep'
import { SpaceEntryNotesPanel } from '@/components/spaces/dialogs/entry-steps/SpaceEntryNotesPanel'
import {
    buildSpaceEntrySteps,
    SPACE_ENTRY_STEP_NUMBER,
    stepIndexFromNumber,
    type SpaceEntryPersonalIntent,
} from '@/components/spaces/dialogs/entry-steps/types'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import { clientDateToDateKey, dateKeyToClientDate } from '@/lib/client/space-api-adapter'
import { fetchLinkCandidatesForNewEntry } from '@/lib/client/space-personal-impact'
import { moneyFromDecimal } from '@/lib/utils/money'
import { supportsCurrency } from '@/lib/utils/accounts'
import { getDefaultFirstClosingMonth } from '@/lib/utils/installments'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ── Internal types ────────────────────────────────────────────────────────────

type EntryDraftPayload = Omit<SpaceEntryFormData, 'date'> & {
    date: string
}

function parseDraftDate(value: string, fallback: Date) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? dateKeyToClientDate(value)
        : new Date(value)
    return Number.isNaN(date.getTime()) ? fallback : date
}

function buildDefaultSplitAllocations(
    participantIds: string[],
    splitMode: SpaceEntryFormData['splitMode']
) {
    if (participantIds.length === 0) return undefined

    if (splitMode === 'percentage') {
        const base = Number((100 / participantIds.length).toFixed(2))
        let assigned = 0
        return participantIds.map((participantId, index) => {
            const percentage =
                index === participantIds.length - 1
                    ? Number((100 - assigned).toFixed(2))
                    : base
            assigned = Number((assigned + percentage).toFixed(2))
            return { participantId, percentage }
        })
    }

    if (splitMode === 'fixed') {
        return participantIds.map((participantId) => ({
            participantId,
            amount: 0,
        }))
    }

    return undefined
}

function reconcilePercentageAllocations(
    participantIds: string[],
    currentAllocations: SpaceEntryFormData['splitAllocations']
) {
    if (participantIds.length === 0) return undefined
    if (participantIds.length === 1) {
        return [{ participantId: participantIds[0], percentage: 100 }]
    }

    const existing = new Map(
        (currentAllocations ?? []).map((allocation) => [
            allocation.participantId,
            allocation.percentage,
        ])
    )
    const next = participantIds.map((participantId) => ({
        participantId,
        percentage: existing.get(participantId),
    }))
    const missing = next.filter((allocation) => typeof allocation.percentage !== 'number')
    const assigned = next.reduce(
        (acc, allocation) => acc + (typeof allocation.percentage === 'number' ? allocation.percentage : 0),
        0
    )
    const remaining = Math.max(0, 100 - assigned)

    if (missing.length > 0) {
        const base = Number((remaining / missing.length).toFixed(2))
        let distributed = 0
        missing.forEach((allocation, index) => {
            allocation.percentage =
                index === missing.length - 1
                    ? Number((remaining - distributed).toFixed(2))
                    : base
            distributed = Number((distributed + (allocation.percentage ?? 0)).toFixed(2))
        })
    }

    const total = next.reduce((acc, allocation) => acc + (allocation.percentage ?? 0), 0)
    const diff = Number((100 - total).toFixed(2))
    next[next.length - 1].percentage = Number(((next[next.length - 1].percentage ?? 0) + diff).toFixed(2))

    return next
}

function buildDefaultForm({
    activeParticipants,
    currentUserId,
    defaultCurrency,
    defaultSplitMode,
    spaceMode,
}: {
    activeParticipants: ISpaceParticipant[]
    currentUserId: string
    defaultCurrency: string
    defaultSplitMode: SpaceEntryFormData['splitMode']
    spaceMode: SpaceFormData['mode']
}): SpaceEntryFormData {
    const allParticipantIds = activeParticipants
        .map((participant) => extractId(participant._id) ?? '')
        .filter(Boolean)
    const currentParticipantId = extractId(
        activeParticipants.find((participant) => extractId(participant.userId) === currentUserId)?._id
    )
    const responsibleParticipantId = currentParticipantId ?? allParticipantIds[0]
    const defaultSharedParticipantIds =
        spaceMode === 'solo'
            ? undefined
            : defaultSplitMode === 'none'
                ? responsibleParticipantId
                    ? [responsibleParticipantId]
                    : undefined
                : allParticipantIds

    return {
        type: 'expense',
        title: '',
        description: '',
        amount: 0,
        currency: defaultCurrency,
        exchangeRate: undefined,
        date: new Date(),
        spaceCategoryId: undefined,
        paidByParticipantId: currentParticipantId,
        sharedWithParticipantIds: defaultSharedParticipantIds,
        splitMode: spaceMode === 'solo' ? 'none' : defaultSplitMode,
        splitAllocations:
            spaceMode === 'solo'
                ? undefined
                : buildDefaultSplitAllocations(allParticipantIds, defaultSplitMode),
        notes: '',
        personalAccountId: undefined,
        linkedTransactionId: undefined,
        installmentCount: undefined,
        firstClosingMonth: undefined,
        installmentQuoteAmount: undefined,
    }
}

function sanitizeDraft({
    raw,
    defaults,
    activeParticipants,
    spaceMode,
}: {
    raw: string
    defaults: SpaceEntryFormData
    activeParticipants: ISpaceParticipant[]
    spaceMode: SpaceFormData['mode']
}) {
    try {
        const parsed = JSON.parse(raw) as Partial<EntryDraftPayload>
        const activeParticipantIds = new Set(
            activeParticipants.map((participant) => extractId(participant._id) ?? '')
        )
        const sharedWithParticipantIds = Array.isArray(parsed.sharedWithParticipantIds)
            ? parsed.sharedWithParticipantIds.filter((item) => activeParticipantIds.has(item))
            : defaults.sharedWithParticipantIds
        const splitMode =
            parsed.splitMode && ['none', 'equal', 'percentage', 'fixed'].includes(parsed.splitMode)
                ? parsed.splitMode
                : defaults.splitMode

        return {
            ...defaults,
            ...parsed,
            type: 'expense',
            amount: typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : defaults.amount,
            currency: parsed.currency ?? defaults.currency,
            date: parsed.date ? parseDraftDate(parsed.date, defaults.date) : defaults.date,
            paidByParticipantId:
                parsed.paidByParticipantId && activeParticipantIds.has(parsed.paidByParticipantId)
                    ? parsed.paidByParticipantId
                    : defaults.paidByParticipantId,
            sharedWithParticipantIds:
                spaceMode === 'solo'
                    ? undefined
                    : splitMode === 'none'
                        ? sharedWithParticipantIds?.slice(0, 1)
                        : sharedWithParticipantIds,
            splitMode: spaceMode === 'solo' ? 'none' : splitMode,
            splitAllocations:
                splitMode === 'percentage' || splitMode === 'fixed'
                    ? (parsed.splitAllocations ?? []).filter((item) =>
                          activeParticipantIds.has(item.participantId)
                      )
                    : undefined,
        } satisfies SpaceEntryFormData
    } catch {
        return defaults
    }
}

function draftPayloadFromDto(draft: SpaceEntryDraftDto): EntryDraftPayload {
    return {
        type: 'expense',
        title: draft.fields.title ?? '',
        description: draft.fields.description ?? '',
        amount: draft.fields.amount ?? 0,
        currency: draft.fields.currency ?? '',
        exchangeRate: draft.fields.exchangeRate,
        date: draft.fields.dateKey ?? clientDateToDateKey(new Date()),
        spaceCategoryId: draft.fields.spaceCategoryId,
        paidByParticipantId: draft.fields.paidByParticipantId,
        sharedWithParticipantIds: draft.fields.sharedWithParticipantIds,
        splitMode: draft.fields.splitMode ?? 'equal',
        splitAllocations: draft.fields.splitAllocations,
        notes: draft.fields.notes ?? '',
        personalAccountId: draft.fields.personalImpact?.accountId,
        categoryId: draft.fields.personalImpact?.categoryId,
        linkedTransactionId: draft.fields.personalImpact?.linkedTransactionId,
        installmentCount: draft.fields.personalImpact?.installmentPlan?.installmentCount,
        firstClosingMonth: draft.fields.personalImpact?.installmentPlan?.firstClosingMonth,
    }
}

function draftFieldsFromForm(
    form: SpaceEntryFormData,
    reportingCurrency: string,
    quotes?: SpaceQuotesDto | null
): SpaceEntryDraftDto['fields'] {
    const quote = quotes?.quotes.find((candidate) =>
        candidate.sourceCurrency === form.currency &&
        candidate.targetCurrency === reportingCurrency &&
        candidate.status === 'current' &&
        Number(candidate.rate) === form.exchangeRate
    )

    return {
        title: form.title,
        description: form.description,
        amount: Number.isFinite(form.amount) ? form.amount : 0,
        money: moneyFromDecimal(form.currency, Number.isFinite(form.amount) ? form.amount : 0),
        currency: form.currency,
        exchangeRate: form.exchangeRate,
        exchangeRateDecimal: quote?.rate,
        conversionSnapshot: quote ? {
            rate: quote.rate,
            direction: quote.direction,
            source: quote.source,
            observedAt: quote.observedAt,
            capturedAt: quote.capturedAt,
            expiresAt: quote.expiresAt,
            path: quote.path,
        } : undefined,
        expectedQuoteFingerprint: quote?.fingerprint,
        dateKey: clientDateToDateKey(form.date),
        paidByParticipantId: form.paidByParticipantId,
        sharedWithParticipantIds: form.sharedWithParticipantIds,
        splitMode: form.splitMode,
        splitAllocations: form.splitAllocations,
        spaceCategoryId: form.spaceCategoryId,
        notes: form.notes,
        personalImpact: form.personalAccountId || form.categoryId || form.linkedTransactionId ? {
            accountId: form.personalAccountId,
            categoryId: form.categoryId,
            description: form.title,
            linkedTransactionId: form.linkedTransactionId,
            installmentPlan: form.installmentCount && form.firstClosingMonth ? {
                installmentCount: form.installmentCount,
                firstClosingMonth: form.firstClosingMonth,
            } : undefined,
        } : undefined,
    }
}

function formFingerprint(form: SpaceEntryFormData, step: 1 | 2 | 3 | 4) {
    return JSON.stringify({
        ...form,
        date: clientDateToDateKey(form.date),
        step,
    })
}

/**
 * Un borrador recuperado no guarda la intención: la deduce de qué campo quedó
 * elegido. Los dos nunca conviven — el servidor rechaza cuenta personal y
 * vínculo a la vez— así que la lectura no es ambigua.
 */
function personalIntentFromForm(form: SpaceEntryFormData): SpaceEntryPersonalIntent {
    if (form.linkedTransactionId) return 'link_existing'
    if (form.personalAccountId) return 'create_transaction'
    return 'space_only'
}

function formatFinancialDate(date: Date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SpaceEntryDialog({
    open,
    onOpenChange,
    onSubmit,
    onEditComplete,
    spaceId,
    participants,
    currentUserId,
    defaultCurrency,
    reportingCurrency,
    spaceCurrencies,
    defaultSplitMode,
    spaceMode,
    spaceTimezone,
    draftKey,
    mode = 'create',
    initialData,
    initialHasSubsequentSettlement,
    contractVersion,
    spaceRevision = 0,
    quotes,
    onDraftChange,
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData, options?: SpaceEntryCreateOptions) => Promise<ISpaceEntry>
    onEditComplete?: (entry: ISpaceEntry) => void
    spaceId: string
    participants: ISpaceParticipant[]
    currentUserId: string
    defaultCurrency: string
    reportingCurrency: string
    spaceCurrencies: string[]
    defaultSplitMode: SpaceEntryFormData['splitMode']
    spaceMode: SpaceFormData['mode']
    spaceTimezone?: string
    draftKey?: string
    mode?: 'create' | 'edit'
    initialData?: ISpaceEntry
    initialHasSubsequentSettlement?: boolean
    contractVersion?: 2
    spaceRevision?: number
    quotes?: SpaceQuotesDto | null
    onDraftChange?: (draft: SpaceEntryDraftDto | null) => void
}) {
    const { categories } = useSpaceCategories(spaceId)
    const { categories: personalCategories } = useCategories()
    const { accounts, loading: accountsLoading } = useAccounts()
    const { success, warning } = useToast()

    const activeParticipants = useMemo(
        () => participants.filter((participant) => participant.isActive),
        [participants]
    )
    const historicalPayerId = extractId(initialData?.paidByParticipantId)
    const historicalSharedParticipantIds = useMemo(() => new Set([
        ...(initialData?.sharedWithParticipantIds ?? []).map((participantId) => extractId(participantId)),
        ...(initialData?.splitAllocations ?? []).map((allocation) => extractId(allocation.participantId)),
    ].filter((participantId): participantId is string => Boolean(participantId))), [initialData])
    const historicalParticipantIds = useMemo(() => new Set([
        historicalPayerId,
        ...historicalSharedParticipantIds,
    ].filter((participantId): participantId is string => Boolean(participantId))), [
        historicalPayerId,
        historicalSharedParticipantIds,
    ])
    const availableParticipants = useMemo(
        () => participants.filter((participant) =>
            participant.isActive || historicalParticipantIds.has(extractId(participant._id) ?? '')
        ),
        [historicalParticipantIds, participants]
    )
    const payerParticipants = useMemo(
        () => participants.filter((participant) =>
            participant.isActive || extractId(participant._id) === historicalPayerId
        ),
        [historicalPayerId, participants]
    )
    const splitParticipants = useMemo(
        () => participants.filter((participant) =>
            participant.isActive || historicalSharedParticipantIds.has(extractId(participant._id) ?? '')
        ),
        [historicalSharedParticipantIds, participants]
    )

    const [form, setForm] = useState<SpaceEntryFormData>(
        buildDefaultForm({
            activeParticipants,
            currentUserId,
            defaultCurrency,
            defaultSplitMode,
            spaceMode,
        })
    )
    const [draftAttachmentsBlocked, setDraftAttachmentsBlocked] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [hasSubsequentSettlementWarning, setHasSubsequentSettlementWarning] = useState(false)
    const steps = useMemo(() => buildSpaceEntrySteps(spaceMode), [spaceMode])
    const [stepIndex, setStepIndex] = useState(0)
    const currentStep = steps[Math.min(stepIndex, steps.length - 1)]
    const step = SPACE_ENTRY_STEP_NUMBER[currentStep.id]
    const isLastStep = stepIndex >= steps.length - 1
    const setStep = useCallback(
        (value: number) => setStepIndex(stepIndexFromNumber(steps, value)),
        [steps]
    )
    const [preview, setPreview] = useState<SpaceEntryPreviewDto | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState<string | null>(null)
    // Un fallo de red sin cambiar ningún campo no vuelve a disparar el efecto de
    // preview por sí solo: "Reintentar" lo fuerza incrementando este nonce.
    const [previewRetryNonce, setPreviewRetryNonce] = useState(0)
    // Las tres formas de impacto personal son excluyentes: el estado es la
    // intención, no un efecto lateral de qué campo quedó lleno.
    const [personalIntent, setPersonalIntent] = useState<SpaceEntryPersonalIntent>('space_only')
    const [candidates, setCandidates] = useState<SpaceLinkCandidateDto[]>([])
    const [candidatesLoading, setCandidatesLoading] = useState(false)
    const [candidatesError, setCandidatesError] = useState<string | null>(null)
    const [candidatesExcludedCount, setCandidatesExcludedCount] = useState(0)
    const [candidatesRetryNonce, setCandidatesRetryNonce] = useState(0)
    const [draftHydrated, setDraftHydrated] = useState(false)
    const [discardDraftOpen, setDiscardDraftOpen] = useState(false)
    const [cancelDraftOpen, setCancelDraftOpen] = useState(false)
    const [cancelDraftPending, setCancelDraftPending] = useState(false)
    const [cancelDraftError, setCancelDraftError] = useState<string | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const stepHeadingRef = useRef<HTMLHeadingElement>(null)
    // Cada intento rechazado incrementa el contador; el hook compartido lleva el
    // foco y el scroll al primer error (design.md §9, espacios.md §11).
    const [submitAttempt, setSubmitAttempt] = useState(0)
    // Sólo se incrementa cuando el intento se rechaza, así que siempre hay un
    // error visible que reclamar.
    const rejectAttempt = useCallback(() => setSubmitAttempt((current) => current + 1), [])
    useScrollToFirstError(submitAttempt, true, scrollContainerRef, {
        focus: true,
        block: 'center',
    })
    const previousCurrencyRef = useRef(form.currency)
    const draftBaselineRef = useRef<string | null>(null)
    const draftExistedAtOpenRef = useRef(false)
    const initializedOpenRef = useRef(false)
    const hydrationRunRef = useRef(0)

    const legacyDraftStorageKey = draftKey ? `finp:space-entry-draft:${draftKey}` : undefined
    const fallbackDraftStorageKey = draftKey ? `finp:space-entry-draft-fallback:v2:${draftKey}` : undefined
    const draftApi = useSpaceEntryDraft({
        spaceId,
        expectedSpaceRevision: spaceRevision,
    })
    const {
        draft: persistedDraft,
        loading: draftLoading,
        saveState: draftSaveState,
        error: draftError,
        load: loadDraft,
        save: saveDraft,
        discard: discardDraft,
        uploadAttachment: uploadDraftAttachment,
        removeAttachment: removeDraftAttachment,
        setDraft: setPersistedDraft,
    } = draftApi

    useEffect(() => {
        if (!open) {
            initializedOpenRef.current = false
            hydrationRunRef.current += 1
            return
        }
        if (initializedOpenRef.current) return
        initializedOpenRef.current = true
        const hydrationRun = ++hydrationRunRef.current

        setSubmitting(false)
        setError(null)
        setHasSubsequentSettlementWarning(false)
        setStepIndex(0)
        setPreview(null)
        setPreviewError(null)
        setPersonalIntent('space_only')
        setCandidates([])
        setCandidatesError(null)
        setCandidatesExcludedCount(0)
        setDiscardDraftOpen(false)
        setCancelDraftOpen(false)
        setCancelDraftPending(false)
        setCancelDraftError(null)
        draftExistedAtOpenRef.current = false

        // Edit mode: pre-populate form from initialData
        if (mode === 'edit' && initialData) {
            const knownIds = new Set(availableParticipants.map((p) => extractId(p._id) ?? ''))
            setForm({
                type: 'expense',
                title: initialData.title,
                description: initialData.description ?? '',
                amount: initialData.amount,
                currency: initialData.currency,
                exchangeRate: initialData.exchangeRate,
                date: initialData.dateKey
                    ? dateKeyToClientDate(initialData.dateKey)
                    : initialData.date instanceof Date
                        ? initialData.date
                        : new Date(initialData.date),
                spaceCategoryId: extractId(initialData.spaceCategoryId) ?? undefined,
                paidByParticipantId: extractId(initialData.paidByParticipantId) ?? undefined,
                sharedWithParticipantIds: (initialData.sharedWithParticipantIds ?? [])
                    .map((id) => extractId(id) ?? '')
                    .filter((id) => id && knownIds.has(id)),
                splitMode: spaceMode === 'solo' ? 'none' : initialData.splitMode,
                splitAllocations: (initialData.splitAllocations ?? [])
                    .map((a) => ({
                        participantId: extractId(a.participantId) ?? '',
                        percentage: a.percentage,
                        amount: a.amount,
                    }))
                    .filter((a) => a.participantId),
                notes: initialData.notes ?? '',
                personalAccountId: undefined,
                linkedTransactionId: undefined,
            })
            setHasSubsequentSettlementWarning(initialHasSubsequentSettlement ?? false)
            setDraftAttachmentsBlocked(false)
            setDraftHydrated(true)
            return
        }

        const defaults = buildDefaultForm({
            activeParticipants,
            currentUserId,
            defaultCurrency,
            defaultSplitMode,
            spaceMode,
        })
        setForm(defaults)
        setDraftAttachmentsBlocked(false)

        if (contractVersion !== 2) {
            const savedDraft =
                legacyDraftStorageKey && typeof window !== 'undefined'
                    ? window.sessionStorage.getItem(legacyDraftStorageKey)
                    : null
            const nextForm = savedDraft
                ? sanitizeDraft({ raw: savedDraft, defaults, activeParticipants, spaceMode })
                : defaults
            setForm(nextForm)
            setPersonalIntent(personalIntentFromForm(nextForm))
            draftBaselineRef.current = formFingerprint(nextForm, 1)
            setDraftHydrated(true)
            return
        }

        setDraftHydrated(false)
        void loadDraft()
            .then((serverDraft) => {
                if (hydrationRunRef.current !== hydrationRun) return
                draftExistedAtOpenRef.current = Boolean(serverDraft)
                let nextForm = defaults
                let nextStep: 1 | 2 | 3 | 4 = 1

                if (serverDraft) {
                    nextForm = sanitizeDraft({
                        raw: JSON.stringify(draftPayloadFromDto(serverDraft)),
                        defaults,
                        activeParticipants,
                        spaceMode,
                    })
                    nextStep = serverDraft.step
                } else if (typeof window !== 'undefined') {
                    let recoveredFallback = false
                    const cached = fallbackDraftStorageKey
                        ? window.localStorage.getItem(fallbackDraftStorageKey)
                        : null
                    if (cached) {
                        try {
                            const parsed = JSON.parse(cached) as { form?: EntryDraftPayload; step?: 1 | 2 | 3 | 4 }
                            if (parsed.form) {
                                nextForm = sanitizeDraft({
                                    raw: JSON.stringify(parsed.form),
                                    defaults,
                                    activeParticipants,
                                    spaceMode,
                                })
                                recoveredFallback = true
                            }
                            if (parsed.step && [1, 2, 3, 4].includes(parsed.step)) nextStep = parsed.step
                        } catch {
                            if (fallbackDraftStorageKey) {
                                window.localStorage.removeItem(fallbackDraftStorageKey)
                            }
                        }
                    }
                    if (!recoveredFallback && legacyDraftStorageKey) {
                        const legacyDraft = window.sessionStorage.getItem(legacyDraftStorageKey)
                        if (legacyDraft) {
                            nextForm = sanitizeDraft({
                                raw: legacyDraft,
                                defaults,
                                activeParticipants,
                                spaceMode,
                            })
                        }
                    }
                }

                setForm(nextForm)
                setPersonalIntent(personalIntentFromForm(nextForm))
                setStep(nextStep)
                draftBaselineRef.current = formFingerprint(nextForm, nextStep)
                setDraftHydrated(true)
            })
            .catch(() => {
                if (hydrationRunRef.current !== hydrationRun) return
                let nextForm = defaults
                let nextStep: 1 | 2 | 3 | 4 = 1
                if (fallbackDraftStorageKey && typeof window !== 'undefined') {
                    const cached = window.localStorage.getItem(fallbackDraftStorageKey)
                    if (cached) {
                        try {
                            const parsed = JSON.parse(cached) as { form?: EntryDraftPayload; step?: 1 | 2 | 3 | 4 }
                            if (parsed.form) {
                                nextForm = sanitizeDraft({
                                    raw: JSON.stringify(parsed.form),
                                    defaults,
                                    activeParticipants,
                                    spaceMode,
                                })
                            }
                            if (parsed.step && [1, 2, 3, 4].includes(parsed.step)) nextStep = parsed.step
                        } catch {
                            window.localStorage.removeItem(fallbackDraftStorageKey)
                        }
                    }
                }
                setForm(nextForm)
                setPersonalIntent(personalIntentFromForm(nextForm))
                setStep(nextStep)
                draftBaselineRef.current = formFingerprint(nextForm, nextStep)
                setDraftHydrated(true)
            })
    }, [
        activeParticipants,
        availableParticipants,
        currentUserId,
        defaultCurrency,
        defaultSplitMode,
        contractVersion,
        fallbackDraftStorageKey,
        initialData,
        initialHasSubsequentSettlement,
        legacyDraftStorageKey,
        loadDraft,
        mode,
        open,
        setStep,
        spaceMode,
    ])

    useEffect(() => {
        if (spaceMode === 'solo') return
        if (form.splitMode !== 'percentage' && form.splitMode !== 'fixed') return

        const participantIds = form.sharedWithParticipantIds ?? []
        const currentAllocations = form.splitAllocations ?? []
        const currentIds = new Set(currentAllocations.map((item) => item.participantId))
        const requiresReset =
            participantIds.length !== currentAllocations.length ||
            participantIds.some((participantId) => !currentIds.has(participantId)) ||
            (form.splitMode === 'percentage' &&
                currentAllocations.some((item) => typeof item.percentage !== 'number')) ||
            (form.splitMode === 'fixed' &&
                currentAllocations.some((item) => typeof item.amount !== 'number'))

        if (!requiresReset) return

        setForm((previous) => ({
            ...previous,
            splitAllocations:
                previous.splitMode === 'percentage'
                    ? reconcilePercentageAllocations(participantIds, previous.splitAllocations)
                    : buildDefaultSplitAllocations(participantIds, previous.splitMode),
        }))
    }, [form.sharedWithParticipantIds, form.splitMode, form.splitAllocations, spaceMode])

    useEffect(() => {
        if (spaceCurrencies.includes(form.currency)) return
        setForm((previous) => ({
            ...previous,
            currency: spaceCurrencies[0] ?? reportingCurrency,
            personalAccountId: undefined,
            categoryId: undefined,
            installmentCount: undefined,
            firstClosingMonth: undefined,
            installmentQuoteAmount: undefined,
        }))
    }, [form.currency, reportingCurrency, spaceCurrencies])

    const activeQuote = useMemo(
        () => quotes?.quotes.find((quote) =>
            quote.sourceCurrency === form.currency &&
            quote.targetCurrency === reportingCurrency
        ),
        [form.currency, quotes?.quotes, reportingCurrency]
    )
    const automaticQuoteSelected = Boolean(
        activeQuote?.status === 'current' && Number(activeQuote.rate) === form.exchangeRate
    )

    useEffect(() => {
        const currencyChanged = previousCurrencyRef.current !== form.currency
        previousCurrencyRef.current = form.currency
        if (form.currency === reportingCurrency) {
            if (form.exchangeRate !== undefined) {
                setForm((previous) => ({ ...previous, exchangeRate: undefined }))
            }
            return
        }
        if (activeQuote?.status !== 'current') return
        if (!currencyChanged && form.exchangeRate !== undefined) return
        setForm((previous) => ({ ...previous, exchangeRate: Number(activeQuote.rate) }))
    }, [activeQuote?.rate, activeQuote?.status, form.currency, form.exchangeRate, reportingCurrency])

    const paidByParticipant = availableParticipants.find(
        (participant) => extractId(participant._id) === form.paidByParticipantId
    )
    const isCurrentUserPayer = extractId(paidByParticipant?.userId) === currentUserId
    const filteredAccounts = useMemo(
        () =>
            accounts.filter((account) => account.isActive !== false &&
                supportsCurrency(account, form.currency as Currency)
            ),
        [accounts, form.currency]
    )
    const selectedPersonalAccount = useMemo(
        () => filteredAccounts.find((account) => extractId(account._id) === form.personalAccountId),
        [filteredAccounts, form.personalAccountId]
    )

    useEffect(() => {
        if (accountsLoading || !form.personalAccountId || selectedPersonalAccount) return
        setForm((previous) => ({
            ...previous,
            personalAccountId: undefined,
            categoryId: undefined,
            installmentCount: undefined,
            firstClosingMonth: undefined,
            installmentQuoteAmount: undefined,
        }))
    }, [accountsLoading, form.personalAccountId, selectedPersonalAccount])
    const filteredCategories = useMemo(
        () => categories.filter((category) => category.type === 'expense'),
        [categories]
    )
    const personalExpenseCategories = useMemo(
        () => personalCategories.filter((category) => category.type === 'expense' && !category.isArchived),
        [personalCategories]
    )
    const selectedSpaceCategory = useMemo(
        () => filteredCategories.find((category) => extractId(category._id) === form.spaceCategoryId),
        [filteredCategories, form.spaceCategoryId]
    )

    // Cambiar de paso lleva el foco al encabezado del paso (`espacios.md` §11).
    // No corre al abrir ni al rehidratar un borrador: reanudar no debe saltar
    // sobre el contenido que el usuario todavía no vio.
    const announcedStepRef = useRef<number | null>(null)
    useEffect(() => {
        if (!open || mode !== 'create') {
            announcedStepRef.current = null
            return
        }
        // Hasta que el borrador termina de hidratar, el paso todavía puede
        // cambiar solo: se registra sin mover el foco.
        if (!draftHydrated || announcedStepRef.current === null) {
            announcedStepRef.current = stepIndex
            return
        }
        if (announcedStepRef.current === stepIndex) return
        announcedStepRef.current = stepIndex
        stepHeadingRef.current?.focus()
    }, [draftHydrated, mode, open, stepIndex])

    const hasSplitStep = steps.some((item) => item.id === 'split')
    /**
     * La autoridad de si hace falta una cuenta personal es la revisión del
     * servidor: sólo una salida real la exige. Mientras no hay revisión se
     * asume que sí, que es el caso del pagador.
     */
    const requiresPersonalAccount = preview ? preview.accountImpactAmount > 0 : true

    const handlePersonalIntentChange = (next: SpaceEntryPersonalIntent) => {
        setPersonalIntent(next)
        clearFieldError('personalIntent')
        setForm((previous) => ({
            ...previous,
            personalAccountId: next === 'create_transaction' ? previous.personalAccountId : undefined,
            categoryId: next === 'create_transaction' ? previous.categoryId : undefined,
            linkedTransactionId: next === 'link_existing' ? previous.linkedTransactionId : undefined,
            installmentCount: next === 'create_transaction' ? previous.installmentCount : undefined,
            firstClosingMonth: next === 'create_transaction' ? previous.firstClosingMonth : undefined,
            installmentQuoteAmount: next === 'create_transaction' ? previous.installmentQuoteAmount : undefined,
        }))
    }

    useEffect(() => {
        const previewEligible =
            mode === 'edit' ||
            (mode === 'create' && (currentStep.id === 'extras' || currentStep.id === 'review'))
        if (!open || !previewEligible || contractVersion !== 2) {
            setPreviewLoading(false)
            return
        }
        const sharedParticipantIds = form.sharedWithParticipantIds?.length
            ? form.sharedWithParticipantIds
            : form.paidByParticipantId
                ? [form.paidByParticipantId]
                : []
        if (
            !form.paidByParticipantId ||
            !sharedParticipantIds.length ||
            !Number.isFinite(form.amount) ||
            form.amount <= 0
        ) {
            setPreview(null)
            setPreviewLoading(false)
            return
        }
        let cancelled = false
        setPreview(null)
        setPreviewLoading(true)
        setPreviewError(null)
        const timer = window.setTimeout(async () => {
            try {
                const response = await apiJson<{ data: SpaceEntryPreviewDto }>(
                    `/api/spaces/${spaceId}/entries/preview`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            amount: form.amount,
                            money: moneyFromDecimal(form.currency, form.amount),
                            currency: form.currency,
                            exchangeRate: form.exchangeRate,
                            exchangeRateDecimal: automaticQuoteSelected ? activeQuote?.rate : undefined,
                            conversionSnapshot: automaticQuoteSelected && activeQuote ? {
                                rate: activeQuote.rate,
                                direction: activeQuote.direction,
                                source: activeQuote.source,
                                observedAt: activeQuote.observedAt,
                                capturedAt: activeQuote.capturedAt,
                                expiresAt: activeQuote.expiresAt,
                                path: activeQuote.path,
                            } : undefined,
                            paidByParticipantId: form.paidByParticipantId,
                            sharedWithParticipantIds: sharedParticipantIds,
                            splitMode: form.splitMode,
                            splitAllocations: form.splitAllocations,
                            linkedTransactionId: form.linkedTransactionId,
                        }),
                    }
                )
                if (!cancelled) setPreview(response.data)
            } catch (err) {
                if (!cancelled) {
                    setPreview(null)
                    setPreviewError(err instanceof Error ? err.message : 'No se pudo calcular la revisión financiera.')
                }
            } finally {
                if (!cancelled) setPreviewLoading(false)
            }
        }, 250)
        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [
        contractVersion,
        activeQuote,
        automaticQuoteSelected,
        form.amount,
        form.currency,
        form.date,
        form.exchangeRate,
        form.linkedTransactionId,
        form.paidByParticipantId,
        form.sharedWithParticipantIds,
        form.splitAllocations,
        form.splitMode,
        mode,
        open,
        previewRetryNonce,
        spaceId,
        currentStep.id,
    ])

    useEffect(() => {
        if (
            !open ||
            mode !== 'create' ||
            currentStep.id !== 'extras' ||
            personalIntent !== 'link_existing' ||
            !spaceTimezone
        ) {
            return
        }
        const sharedParticipantIds = form.sharedWithParticipantIds?.length
            ? form.sharedWithParticipantIds
            : form.paidByParticipantId
                ? [form.paidByParticipantId]
                : []
        if (!form.paidByParticipantId || !sharedParticipantIds.length || !Number.isFinite(form.amount) || form.amount <= 0) {
            setCandidates([])
            setCandidatesExcludedCount(0)
            setCandidatesLoading(false)
            return
        }
        let cancelled = false
        setCandidatesLoading(true)
        setCandidatesError(null)
        fetchLinkCandidatesForNewEntry({
            spaceId,
            amount: form.amount,
            currency: form.currency,
            paidByParticipantId: form.paidByParticipantId,
            sharedWithParticipantIds: sharedParticipantIds,
            splitMode: form.splitMode,
            splitAllocations: form.splitAllocations,
            dateKey: clientDateToDateKey(form.date),
            timezone: spaceTimezone,
        }).then((result) => {
            if (cancelled) return
            setCandidates(result.candidates)
            const excludedTotal = result.excluded.amountMismatch
                + result.excluded.operationalMismatch
                + result.excluded.accountMismatch
                + result.excluded.alreadyLinked
            setCandidatesExcludedCount(excludedTotal)
        }).catch((err) => {
            if (cancelled) return
            setCandidates([])
            setCandidatesError(err instanceof Error ? err.message : 'No pudimos cargar tus transacciones.')
        }).finally(() => {
            if (!cancelled) setCandidatesLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [
        candidatesRetryNonce,
        form.amount,
        form.currency,
        form.date,
        form.paidByParticipantId,
        form.sharedWithParticipantIds,
        form.splitAllocations,
        form.splitMode,
        mode,
        open,
        personalIntent,
        spaceId,
        spaceTimezone,
        currentStep.id,
    ])

    useEffect(() => {
        if (!form.linkedTransactionId || candidatesLoading) return
        const selectedStillMatches = candidates.some(
            (candidate) => candidate.transactionId === form.linkedTransactionId
        )
        if (selectedStillMatches) return
        setForm((previous) => ({ ...previous, linkedTransactionId: undefined }))
    }, [candidates, candidatesLoading, form.linkedTransactionId])

    useEffect(() => {
        if (!form.spaceCategoryId) return
        if (categories.length === 0) return
        const selectedStillMatches = filteredCategories.some(
            (category) => extractId(category._id) === form.spaceCategoryId
        )
        if (selectedStillMatches) return

        setForm((previous) => ({
            ...previous,
            spaceCategoryId: undefined,
        }))
    }, [categories.length, filteredCategories, form.spaceCategoryId])

    useEffect(() => {
        if (!form.personalAccountId) {
            if (!form.categoryId) return
            setForm((previous) => ({ ...previous, categoryId: undefined }))
            return
        }

        if (form.categoryId || !selectedSpaceCategory) return

        const normalizeCategoryName = (value: string) =>
            value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const normalizedSpaceName = normalizeCategoryName(selectedSpaceCategory.name)
        const match = personalExpenseCategories.find(
            (category) => {
                const normalizedPersonalName = normalizeCategoryName(category.name)
                return (
                    normalizedPersonalName === normalizedSpaceName ||
                    normalizedPersonalName.includes(normalizedSpaceName) ||
                    normalizedSpaceName.includes(normalizedPersonalName)
                )
            }
        )

        if (!match) return

        setForm((previous) => ({
            ...previous,
            categoryId: extractId(match._id),
        }))
    }, [form.categoryId, form.personalAccountId, personalExpenseCategories, selectedSpaceCategory])

    const updateSplitAllocations = (
        allocations: NonNullable<SpaceEntryFormData['splitAllocations']>
    ) => {
        setForm((previous) => ({
            ...previous,
            splitAllocations: allocations,
        }))
    }

    const toggleSharedParticipant = (participantId: string) => {
        setForm((previous) => {
            const current = previous.sharedWithParticipantIds ?? []
            const next = current.includes(participantId)
                ? current.filter((item) => item !== participantId)
                : [...current, participantId]

            return {
                ...previous,
                sharedWithParticipantIds: next,
            }
        })
    }

    const setResponsibleParticipant = (participantId: string) => {
        setForm((previous) => ({
            ...previous,
            splitMode: 'none',
            sharedWithParticipantIds: [participantId],
            splitAllocations: undefined,
        }))
    }

    const applySplitPreset = (preset: SpaceEntryFormData['splitMode']) => {
        const allParticipantIds = splitParticipants
            .map((participant) => extractId(participant._id) ?? '')
            .filter(Boolean)

        setForm((previous) => {
            const selectedIds =
                previous.splitMode !== 'none' &&
                previous.sharedWithParticipantIds &&
                previous.sharedWithParticipantIds.length > 1
                    ? previous.sharedWithParticipantIds
                    : allParticipantIds

            if (preset === 'none') {
                const responsibleId =
                    previous.sharedWithParticipantIds?.[0] ??
                    previous.paidByParticipantId ??
                    allParticipantIds[0]
                return {
                    ...previous,
                    splitMode: 'none',
                    sharedWithParticipantIds: responsibleId ? [responsibleId] : undefined,
                    splitAllocations: undefined,
                }
            }

            if (preset === 'equal') {
                return {
                    ...previous,
                    splitMode: 'equal',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: undefined,
                }
            }

            if (preset === 'percentage') {
                return {
                    ...previous,
                    splitMode: 'percentage',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: buildDefaultSplitAllocations(selectedIds, 'percentage'),
                }
            }

            if (preset === 'fixed') {
                return {
                    ...previous,
                    splitMode: 'fixed',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: buildDefaultSplitAllocations(selectedIds, 'fixed'),
                }
            }

            return previous
        })
    }

    const clearFieldError = (field: string) => {
        setFieldErrors((prev) => {
            if (!prev[field]) return prev
            const next = { ...prev }
            delete next[field]
            return next
        })
    }

    const clearLocalDraftCopies = useCallback(() => {
        if (typeof window !== 'undefined') {
            if (legacyDraftStorageKey) window.sessionStorage.removeItem(legacyDraftStorageKey)
            if (fallbackDraftStorageKey) window.localStorage.removeItem(fallbackDraftStorageKey)
        }
    }, [fallbackDraftStorageKey, legacyDraftStorageKey])

    const clearDraftCaches = useCallback(() => {
        clearLocalDraftCopies()
        setPersistedDraft(null)
        onDraftChange?.(null)
    }, [clearLocalDraftCopies, onDraftChange, setPersistedDraft])

    const persistDraftSnapshot = useCallback(async (
        snapshot: SpaceEntryFormData = form,
        currentStep: 1 | 2 | 3 | 4 = step,
        notify = false
    ) => {
        if (mode !== 'create') return null

        const payload: EntryDraftPayload = {
            ...snapshot,
            amount: Number.isFinite(snapshot.amount) ? snapshot.amount : 0,
            date: clientDateToDateKey(snapshot.date),
        }

        if (contractVersion !== 2) {
            if (legacyDraftStorageKey && typeof window !== 'undefined') {
                window.sessionStorage.setItem(legacyDraftStorageKey, JSON.stringify(payload))
                if (notify) success('Borrador guardado')
            }
            return null
        }

        const fingerprint = formFingerprint(snapshot, currentStep)
        if (!persistedDraft && draftBaselineRef.current === fingerprint) return null

        try {
            const saved = await saveDraft(
                draftFieldsFromForm(snapshot, reportingCurrency, quotes),
                currentStep
            )
            if (typeof window !== 'undefined') {
                if (fallbackDraftStorageKey) window.localStorage.removeItem(fallbackDraftStorageKey)
                if (legacyDraftStorageKey) window.sessionStorage.removeItem(legacyDraftStorageKey)
            }
            draftBaselineRef.current = fingerprint
            onDraftChange?.(saved)
            if (notify) success('Borrador guardado')
            return saved
        } catch (saveError) {
            if (fallbackDraftStorageKey && typeof window !== 'undefined') {
                window.localStorage.setItem(
                    fallbackDraftStorageKey,
                    JSON.stringify({ form: payload, step: currentStep })
                )
            }
            throw saveError
        }
    }, [
        contractVersion,
        fallbackDraftStorageKey,
        form,
        legacyDraftStorageKey,
        mode,
        onDraftChange,
        persistedDraft,
        quotes,
        reportingCurrency,
        saveDraft,
        step,
        success,
    ])

    const handleSaveDraft = async () => {
        setCancelDraftPending(true)
        setCancelDraftError(null)
        try {
            await persistDraftSnapshot(form, step, true)
            setCancelDraftOpen(false)
            onOpenChange(false)
        } catch (cause) {
            setCancelDraftError(cause instanceof Error ? cause.message : 'No pudimos guardar el borrador.')
        } finally {
            setCancelDraftPending(false)
        }
    }

    const handleRetryDraftSave = async () => {
        try {
            await persistDraftSnapshot(form, step)
        } catch {
            // El hook mantiene el error visible y el fallback local conserva los datos.
        }
    }

    const handleExitWithoutSaving = async () => {
        setCancelDraftPending(true)
        setCancelDraftError(null)
        try {
            if (!draftExistedAtOpenRef.current) {
                if (persistedDraft) await discardDraft()
                clearDraftCaches()
            } else {
                clearLocalDraftCopies()
            }
            setCancelDraftOpen(false)
            onOpenChange(false)
        } catch (cause) {
            setCancelDraftError(cause instanceof Error ? cause.message : 'No pudimos salir sin guardar.')
        } finally {
            setCancelDraftPending(false)
        }
    }

    const handleDialogOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            onOpenChange(true)
            return
        }
        if (mode !== 'create' || contractVersion !== 2 || !draftHydrated) {
            onOpenChange(false)
            return
        }
        const hasLocalChanges = draftBaselineRef.current !== formFingerprint(form, step)
        const createdDraftDuringThisOpen = !draftExistedAtOpenRef.current && Boolean(persistedDraft)
        if (!hasLocalChanges && !createdDraftDuringThisOpen) {
            onOpenChange(false)
            return
        }
        setCancelDraftError(null)
        setCancelDraftOpen(true)
    }

    const handleDiscardDraft = async () => {
        try {
            await discardDraft()
            clearDraftCaches()
            setDiscardDraftOpen(false)
            success('Borrador descartado')
            onOpenChange(false)
        } catch (discardError) {
            setError(discardError instanceof Error ? discardError.message : 'No pudimos descartar el borrador.')
            setDiscardDraftOpen(false)
        }
    }

    const handleReloadDraft = async () => {
        try {
            const latest = await loadDraft()
            if (!latest) return
            const defaults = buildDefaultForm({
                activeParticipants,
                currentUserId,
                defaultCurrency,
                defaultSplitMode,
                spaceMode,
            })
            const nextForm = sanitizeDraft({
                raw: JSON.stringify(draftPayloadFromDto(latest)),
                defaults,
                activeParticipants,
                spaceMode,
            })
            setForm(nextForm)
            setPersonalIntent(personalIntentFromForm(nextForm))
            setStep(latest.step)
            draftBaselineRef.current = formFingerprint(nextForm, latest.step)
            draftExistedAtOpenRef.current = true
        } catch {
            // loadDraft ya expone el error recuperable en el panel.
        }
    }

    const handleDraftAttachmentUpload = async (
        file: File,
        idempotencyKey: string,
        attachmentId?: string
    ) => {
        let saved = await persistDraftSnapshot(form, step)
        if (!saved) {
            saved = await saveDraft(draftFieldsFromForm(form, reportingCurrency, quotes), step)
            onDraftChange?.(saved)
        }
        await uploadDraftAttachment({ file, idempotencyKey, attachmentId })
    }

    const handleEditSubmit = async () => {
        if (!initialData) return

        const entryId = extractId(initialData._id)
        if (!entryId) return

        const normalizedAllocations =
            form.splitMode === 'fixed' && (form.sharedWithParticipantIds?.length ?? 0) === 1
                ? form.sharedWithParticipantIds?.map((id) => ({
                      participantId: id,
                      amount: Number.isFinite(form.amount) ? form.amount : 0,
                  }))
                : form.splitAllocations

        const payload = {
            title: form.title || undefined,
            description: form.description || undefined,
            amount: Number.isFinite(form.amount) && form.amount > 0 ? form.amount : undefined,
            currency: form.currency || undefined,
            exchangeRate: form.exchangeRate || undefined,
            date: form.date,
            spaceCategoryId: form.spaceCategoryId ?? null,
            paidByParticipantId: form.paidByParticipantId || undefined,
            sharedWithParticipantIds: spaceMode === 'solo' ? undefined : form.sharedWithParticipantIds,
            splitMode: spaceMode === 'solo' ? 'none' : form.splitMode,
            splitAllocations:
                form.splitMode === 'percentage' || form.splitMode === 'fixed'
                    ? normalizedAllocations
                    : undefined,
            notes: form.notes || undefined,
        }

        const parsed = spaceEntryEditSchema.safeParse(payload)

        if (!parsed.success) {
            const nextFieldErrors: Record<string, string> = {}
            for (const issue of parsed.error.issues) {
                const key = String(issue.path[0] ?? '')
                if (key && !nextFieldErrors[key]) nextFieldErrors[key] = issue.message
            }
            setFieldErrors(nextFieldErrors)
            setError(null)
            rejectAttempt()
            return
        }

        // La edición cambia balances y deuda: usa la misma revisión vigente que el alta.
        if (contractVersion === 2 && (previewLoading || !preview)) {
            setError(previewError ?? 'Esperá a que termine la revisión financiera antes de confirmar.')
            rejectAttempt()
            return
        }
        if (preview?.linkExisting && !preview.linkExisting.compatible) {
            setError('La transacción elegida no coincide con la revisión financiera. Elegí otra o creá una nueva.')
            rejectAttempt()
            return
        }

        setSubmitting(true)
        setError(null)
        setFieldErrors({})

        try {
            if (contractVersion === 2) {
                await apiJson(`/api/spaces/${spaceId}/entries/${entryId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify({
                        expectedRevision: initialData.revision ?? 0,
                        title: form.title,
                        description: form.description || undefined,
                        amount: form.amount,
                        money: moneyFromDecimal(form.currency, form.amount),
                        currency: form.currency,
                        exchangeRate: form.exchangeRate,
                        dateKey: clientDateToDateKey(form.date),
                        spaceCategoryId: form.spaceCategoryId,
                        paidByParticipantId: form.paidByParticipantId,
                        sharedWithParticipantIds: form.sharedWithParticipantIds?.length
                            ? form.sharedWithParticipantIds
                            : form.paidByParticipantId
                                ? [form.paidByParticipantId]
                                : [],
                        splitMode: spaceMode === 'solo' ? 'none' : form.splitMode,
                        splitAllocations:
                            form.splitMode === 'percentage' || form.splitMode === 'fixed'
                                ? normalizedAllocations
                                : undefined,
                        notes: form.notes || undefined,
                    }),
                })
                invalidateData(SPACE_INVALIDATION_TAGS)
                onEditComplete?.({
                    ...initialData,
                    ...form,
                    status: 'recorded',
                    revision: (initialData.revision ?? 0) + 1,
                } as ISpaceEntry)
                onOpenChange(false)
                return
            }
            const response = await fetch(`/api/spaces/${spaceId}/entries/${entryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data),
            })

            const json = await response.json() as { entry?: ISpaceEntry; error?: string; hasSubsequentSettlement?: boolean }

            if (!response.ok) {
                setError(json.error ?? 'No pudimos guardar los cambios.')
                return
            }

            if (json.hasSubsequentSettlement) {
                warning('Hay pagos registrados después de este movimiento. El balance fue actualizado.')
            }

            onEditComplete?.(json.entry!)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar los cambios.')
        } finally {
            setSubmitting(false)
        }
    }

    const parseWithSchema = () => {
        const parsed = spaceEntrySchema.safeParse({ ...form, type: 'expense' })
        if (parsed.success) return null
        const nextErrors: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? '')
            if (key && !nextErrors[key]) nextErrors[key] = issue.message
        }
        return nextErrors
    }

    /**
     * La intención personal ya elegida tiene que poder confirmarse: el servidor
     * exige cuenta cuando la revisión indica salida real, y un vínculo sin
     * transacción elegida no es un vínculo (`espacios.md` §10).
     */
    const validatePersonalIntent = (): Record<string, string> | null => {
        if (!isCurrentUserPayer) return null
        if (personalIntent === 'create_transaction') {
            if (!requiresPersonalAccount) return null
            if (filteredAccounts.length === 0) {
                return {
                    personalIntent: `Necesitás una cuenta en ${form.currency} para registrarlo en tu Finp, o elegí «Sólo en el Espacio».`,
                }
            }
            if (!form.personalAccountId) {
                return { personalIntent: 'Elegí la cuenta o tarjeta desde la que pagaste.' }
            }
            if (selectedPersonalAccount?.type === 'credit_card' && !form.firstClosingMonth) {
                return { personalIntent: 'Elegí el mes de la primera cuota.' }
            }
            return null
        }
        if (personalIntent === 'link_existing' && !form.linkedTransactionId) {
            return { personalIntent: 'Elegí una transacción compatible o cambiá la opción.' }
        }
        return null
    }

    const goToStep = (index: number) => {
        setFieldErrors({})
        setStepIndex(Math.max(0, Math.min(index, steps.length - 1)))
    }

    const handleNextStep = () => {
        if (mode === 'edit') return

        if (currentStep.id === 'data') {
            const nextErrors: Record<string, string> = {}
            if (!form.title.trim()) nextErrors.title = 'Ingresá una descripción.'
            if (!Number.isFinite(form.amount) || form.amount <= 0) nextErrors.amount = 'Ingresá un monto mayor a cero.'
            if (!form.paidByParticipantId) nextErrors.paidByParticipantId = 'Elegí quién pagó.'
            if (form.currency !== reportingCurrency && !form.exchangeRate) {
                nextErrors.exchangeRate = 'Ingresá la cotización para la moneda de reporte.'
            }
            // Sin paso de reparto —un Espacio `solo`— el esquema completo se
            // valida acá; si no, nada lo verificaría antes de la revisión.
            if (!Object.keys(nextErrors).length && !hasSplitStep) {
                Object.assign(nextErrors, parseWithSchema() ?? {})
            }
            if (Object.keys(nextErrors).length) {
                setFieldErrors(nextErrors)
                rejectAttempt()
                return
            }
            goToStep(stepIndex + 1)
            return
        }

        if (currentStep.id === 'split') {
            const nextErrors = parseWithSchema()
            if (nextErrors) {
                setFieldErrors(nextErrors)
                rejectAttempt()
                return
            }
            goToStep(stepIndex + 1)
            return
        }

        if (currentStep.id === 'extras') {
            const nextErrors = validatePersonalIntent()
            if (nextErrors) {
                setFieldErrors(nextErrors)
                rejectAttempt()
                return
            }
            goToStep(stepIndex + 1)
        }
    }

    const handleSubmit = async () => {
        if (mode === 'edit') {
            await handleEditSubmit()
            return
        }

        // Normalize 1-participant fixed mode: allocation should equal full amount
        const normalizedAllocations =
            form.splitMode === 'fixed' && (form.sharedWithParticipantIds?.length ?? 0) === 1
                ? form.sharedWithParticipantIds?.map((id) => ({
                      participantId: id,
                      amount: Number.isFinite(form.amount) ? form.amount : 0,
                  }))
                : form.splitAllocations

        const parsed = spaceEntrySchema.safeParse({
            ...form,
            type: 'expense',
            splitMode: spaceMode === 'solo' ? 'none' : form.splitMode,
            sharedWithParticipantIds:
                spaceMode === 'solo' ? undefined : form.sharedWithParticipantIds,
            splitAllocations:
                form.splitMode === 'percentage' || form.splitMode === 'fixed'
                    ? normalizedAllocations
                    : undefined,
        })

        if (!parsed.success) {
            const nextFieldErrors: Record<string, string> = {}
            for (const issue of parsed.error.issues) {
                const key = String(issue.path[0] ?? '')
                if (key && !nextFieldErrors[key]) nextFieldErrors[key] = issue.message
            }
            setFieldErrors(nextFieldErrors)
            setError(null)
            rejectAttempt()
            return
        }

        if (contractVersion === 2 && (previewLoading || !preview)) {
            setError(previewError ?? 'Esperá a que termine la revisión financiera antes de confirmar.')
            rejectAttempt()
            return
        }
        if (preview?.linkExisting && !preview.linkExisting.compatible) {
            setError('La transacción elegida no coincide con la revisión financiera. Elegí otra o creá una nueva.')
            rejectAttempt()
            return
        }

        setSubmitting(true)
        setError(null)
        setFieldErrors({})

        try {
            const submission = {
                ...parsed.data,
                categoryId: parsed.data.personalAccountId ? parsed.data.categoryId : undefined,
            }
            const savedDraft = contractVersion === 2
                ? await persistDraftSnapshot(submission, SPACE_ENTRY_STEP_NUMBER.review)
                : null
            if (contractVersion === 2 && !savedDraft) {
                throw new Error('No pudimos preparar el borrador para publicarlo.')
            }
            await onSubmit(
                submission,
                savedDraft ? {
                    draftPublication: {
                        draftId: savedDraft.id,
                        expectedRevision: savedDraft.revision,
                    },
                } : undefined
            )
            clearDraftCaches()
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar el gasto.')
        } finally {
            setSubmitting(false)
        }
    }

    const linkedCandidate = candidates.find(
        (candidate) => candidate.transactionId === form.linkedTransactionId
    )
    const personalIntentSummary = !isCurrentUserPayer
        ? undefined
        : personalIntent === 'link_existing'
            ? linkedCandidate
                ? `Se vinculará con «${linkedCandidate.description}» de tu Finp.`
                : 'Se vinculará con una transacción existente de tu Finp.'
            : personalIntent === 'create_transaction'
                ? selectedPersonalAccount
                    ? selectedPersonalAccount.type === 'credit_card'
                        ? `Se creará un plan de ${form.installmentCount ?? 1} cuota${(form.installmentCount ?? 1) === 1 ? '' : 's'} en ${selectedPersonalAccount.name}.`
                        : `Se creará una transacción en ${selectedPersonalAccount.name}.`
                    : 'Se registrará como gasto operacional en tu Finp, sin mover una cuenta.'
                : 'Queda sólo en el Espacio; podés decidir tu Finp después.'

    const dataStep = (
        <SpaceEntryDataStep
            amount={form.amount}
            currency={form.currency}
            date={form.date instanceof Date ? form.date : undefined}
            title={form.title}
            paidByParticipantId={form.paidByParticipantId}
            spaceCategoryId={form.spaceCategoryId}
            exchangeRate={form.exchangeRate}
            reportingCurrency={reportingCurrency}
            spaceCurrencies={spaceCurrencies}
            payerParticipants={payerParticipants}
            spaceCategories={filteredCategories}
            datePickerOpen={datePickerOpen}
            fieldErrors={fieldErrors}
            activeQuote={activeQuote}
            automaticQuoteSelected={automaticQuoteSelected}
            onAmountChange={(value) => {
                setForm((previous) => ({ ...previous, amount: value }))
                clearFieldError('amount')
            }}
            onCurrencyChange={(currency) => {
                setForm((previous) => ({
                    ...previous,
                    currency,
                    personalAccountId: undefined,
                    categoryId: undefined,
                    installmentCount: undefined,
                    firstClosingMonth: undefined,
                    installmentQuoteAmount: undefined,
                }))
                clearFieldError('currency')
            }}
            onDateChange={(date) => setForm((previous) => ({ ...previous, date }))}
            onDatePickerOpenChange={(nextOpen) => {
                if (nextOpen) clearFieldError('date')
                setDatePickerOpen(nextOpen)
            }}
            onTitleChange={(value) => {
                setForm((previous) => ({ ...previous, title: value }))
                clearFieldError('title')
            }}
            onPaidByChange={(value) => {
                clearFieldError('paidByParticipantId')
                setForm((previous) => {
                    const nextIsCurrentUser =
                        extractId(
                            availableParticipants.find(
                                (participant) => extractId(participant._id) === value
                            )?.userId
                        ) === currentUserId
                    const shouldMoveResponsibility =
                        previous.splitMode === 'none' &&
                        (!previous.sharedWithParticipantIds?.[0] ||
                            previous.sharedWithParticipantIds[0] === previous.paidByParticipantId)

                    return {
                        ...previous,
                        paidByParticipantId: value,
                        sharedWithParticipantIds: shouldMoveResponsibility
                            ? [value]
                            : previous.sharedWithParticipantIds,
                        personalAccountId: nextIsCurrentUser ? previous.personalAccountId : undefined,
                        installmentCount: nextIsCurrentUser ? previous.installmentCount : undefined,
                        firstClosingMonth: nextIsCurrentUser ? previous.firstClosingMonth : undefined,
                        installmentQuoteAmount: nextIsCurrentUser ? previous.installmentQuoteAmount : undefined,
                    }
                })
            }}
            onSpaceCategoryChange={(spaceCategoryId) =>
                setForm((previous) => ({ ...previous, spaceCategoryId }))
            }
            onExchangeRateChange={(exchangeRate) => {
                setForm((previous) => ({ ...previous, exchangeRate }))
                clearFieldError('exchangeRate')
            }}
        />
    )

    const splitStep = (
        <SpaceEntrySplitStep
            participants={splitParticipants}
            amount={Number.isFinite(form.amount) ? form.amount : 0}
            currency={form.currency}
            paidByParticipantId={form.paidByParticipantId}
            selectedParticipantIds={form.sharedWithParticipantIds ?? []}
            splitMode={form.splitMode}
            allocations={form.splitAllocations}
            error={fieldErrors.sharedWithParticipantIds ?? fieldErrors.splitAllocations}
            onToggleParticipant={(id) => {
                toggleSharedParticipant(id)
                clearFieldError('sharedWithParticipantIds')
                clearFieldError('splitAllocations')
            }}
            onResponsibleChange={setResponsibleParticipant}
            onApplyPreset={(preset) => {
                applySplitPreset(preset)
                clearFieldError('splitAllocations')
            }}
            onAllocationsChange={(allocations) => {
                updateSplitAllocations(allocations)
                clearFieldError('splitAllocations')
            }}
        />
    )

    const reviewStep = (
        <SpaceEntryReviewStep
            entryType={form.type}
            amount={form.amount}
            currency={form.currency}
            reportingCurrency={reportingCurrency}
            formattedDate={formatFinancialDate(form.date)}
            payerName={paidByParticipant?.displayName}
            personalIntentSummary={mode === 'create' ? personalIntentSummary : undefined}
            preview={preview}
            previewLoading={previewLoading}
            previewError={previewError}
            showFinancialReview={mode === 'create' || contractVersion === 2}
            onPreviewRetry={() => setPreviewRetryNonce((current) => current + 1)}
        />
    )

    const renderCurrentStep = () => {
        if (currentStep.id === 'data') return dataStep
        if (currentStep.id === 'split') return splitStep
        if (currentStep.id === 'review') return reviewStep
        return (
            <SpaceEntryExtrasStep
                isCurrentUserPayer={isCurrentUserPayer}
                intent={personalIntent}
                personalAccountId={form.personalAccountId}
                categoryId={form.categoryId}
                linkedTransactionId={form.linkedTransactionId}
                currency={form.currency}
                amount={Number.isFinite(form.amount) ? form.amount : 0}
                operationalAmount={preview?.operationalAmount}
                purchaseDate={form.date instanceof Date ? form.date : new Date(form.date)}
                installmentCount={form.installmentCount ?? 1}
                firstClosingMonth={form.firstClosingMonth ?? ''}
                installmentQuoteAmount={form.installmentQuoteAmount}
                requiresPersonalAccount={requiresPersonalAccount}
                accounts={filteredAccounts}
                personalCategories={personalExpenseCategories}
                intentError={fieldErrors.personalIntent}
                linkIncompatible={Boolean(preview?.linkExisting && !preview.linkExisting.compatible)}
                candidates={candidates}
                candidatesLoading={candidatesLoading}
                candidatesError={candidatesError}
                candidatesExcludedCount={candidatesExcludedCount}
                attachments={persistedDraft?.attachments ?? []}
                attachmentsDisabled={submitting || draftLoading}
                onIntentChange={handlePersonalIntentChange}
                onPersonalAccountChange={(personalAccountId) => {
                    clearFieldError('personalIntent')
                    const selectedAccount = filteredAccounts.find(
                        (account) => extractId(account._id) === personalAccountId
                    )
                    setForm((previous) => ({
                        ...previous,
                        personalAccountId,
                        linkedTransactionId: undefined,
                        installmentCount: selectedAccount?.type === 'credit_card'
                            ? previous.installmentCount ?? 1
                            : undefined,
                        firstClosingMonth: selectedAccount?.type === 'credit_card'
                            ? previous.firstClosingMonth ?? getDefaultFirstClosingMonth(previous.date)
                            : undefined,
                        installmentQuoteAmount: selectedAccount?.type === 'credit_card'
                            ? previous.installmentQuoteAmount
                            : undefined,
                    }))
                }}
                onCategoryChange={(categoryId) => setForm((previous) => ({ ...previous, categoryId }))}
                onLinkedTransactionChange={(linkedTransactionId) => {
                    clearFieldError('personalIntent')
                    setForm((previous) => ({
                        ...previous,
                        linkedTransactionId,
                        personalAccountId: undefined,
                        categoryId: undefined,
                        installmentCount: undefined,
                        firstClosingMonth: undefined,
                        installmentQuoteAmount: undefined,
                    }))
                }}
                onInstallmentCountChange={(installmentCount) =>
                    setForm((previous) => ({ ...previous, installmentCount }))
                }
                onFirstClosingMonthChange={(firstClosingMonth) => {
                    clearFieldError('personalIntent')
                    setForm((previous) => ({ ...previous, firstClosingMonth }))
                }}
                onInstallmentQuoteAmountChange={(installmentQuoteAmount) =>
                    setForm((previous) => ({ ...previous, installmentQuoteAmount }))
                }
                onTotalAmountChange={(amount) => setForm((previous) => ({ ...previous, amount }))}
                onCandidatesRetry={() => setCandidatesRetryNonce((current) => current + 1)}
                onAttachmentUpload={handleDraftAttachmentUpload}
                onAttachmentRemove={async (attachmentId) => {
                    await removeDraftAttachment(attachmentId)
                }}
                onAttachmentsBlockingChange={setDraftAttachmentsBlocked}
                notes={form.notes ?? ''}
                onNotesChange={(notes) => setForm((previous) => ({ ...previous, notes }))}
            />
        )
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[1120px] gap-0 overflow-hidden p-0 [&_[data-slot=dialog-close]]:size-11 sm:max-h-[94vh] sm:max-w-[1120px] sm:[&_[data-slot=dialog-close]]:size-7"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-[94vh]">
                    {/* ── Header ── */}
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-3">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                                Movimiento del espacio
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl tracking-tight">
                                    {mode === 'edit' ? 'Editar movimiento' : 'Nuevo gasto'}
                                </DialogTitle>
                                <DialogDescription>
                                    {mode === 'edit'
                                        ? 'Modificá los campos que necesitás. Los adjuntos se gestionan desde el detalle del movimiento.'
                                        : 'Monto, pagador y reparto. Los comprobantes y notas son opcionales.'}
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                        {mode === 'create' ? (
                            <SpaceEntryStepper
                                steps={steps}
                                currentIndex={stepIndex}
                                onSelectStep={goToStep}
                            />
                        ) : null}
                        {mode === 'create' && contractVersion === 2 && (
                            draftLoading ||
                            Boolean(persistedDraft) ||
                            draftSaveState === 'saving' ||
                            Boolean(draftError)
                        ) ? (
                            <div className="mt-3 space-y-2">
                                <p
                                    className="flex items-center gap-2 text-xs text-muted-foreground"
                                    aria-live="polite"
                                    data-testid="space-entry-draft-save-status"
                                >
                                    {draftLoading || draftSaveState === 'saving' ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Save className="h-3.5 w-3.5" />
                                    )}
                                    {draftLoading
                                        ? 'Recuperando borrador…'
                                        : draftSaveState === 'saving'
                                            ? 'Guardando…'
                                            : draftSaveState === 'saved'
                                                ? 'Borrador guardado de forma privada'
                                                : draftSaveState === 'conflict'
                                                    ? 'Hay una versión más reciente'
                                                    : draftSaveState === 'error'
                                                        ? 'No se pudo guardar; conservamos una copia en este dispositivo'
                                                        : 'Borrador privado guardado'}
                                </p>
                                {draftError ? (
                                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                                        <p>{draftError}</p>
                                        {draftSaveState === 'conflict' ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2 h-7 rounded-full px-2"
                                                onClick={() => void handleReloadDraft()}
                                            >
                                                Cargar la versión más reciente
                                            </Button>
                                        ) : draftSaveState === 'error' ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2 h-7 rounded-full px-2"
                                                onClick={() => void handleRetryDraftSave()}
                                            >
                                                Reintentar guardado
                                            </Button>
                                        ) : null}
                                    </div>
                                ) : null}
                                {persistedDraft ? (
                                    <AlertDialog open={discardDraftOpen} onOpenChange={setDiscardDraftOpen}>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 rounded-full px-2 text-xs text-destructive hover:text-destructive"
                                            onClick={() => setDiscardDraftOpen(true)}
                                            disabled={submitting || draftSaveState === 'saving'}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Descartar borrador
                                        </Button>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Descartar este borrador?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Se eliminará sólo tu borrador privado. No cambiarán los movimientos ni los balances del espacio.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Conservar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    variant="destructive"
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        void handleDiscardDraft()
                                                    }}
                                                >
                                                    Descartar
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                ) : null}
                            </div>
                        ) : null}
                        {hasSubsequentSettlementWarning ? (
                            <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    Hay pagos registrados después de este movimiento. Si lo editás, el balance puede cambiar y esos pagos seguirán registrados.
                                </span>
                            </div>
                        ) : null}
                    </div>

                    {/* ── Body ── */}
                    <div
                        ref={scrollContainerRef}
                        tabIndex={0}
                        aria-label="Contenido del movimiento"
                        className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
                    >
                        {mode === 'create' && contractVersion === 2 && !draftHydrated ? (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm" aria-live="polite">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Recuperando tu borrador…
                                </div>
                            </div>
                        ) : null}

                        {mode === 'create' ? (
                            <div className="space-y-5" data-testid={`space-entry-step-${currentStep.id}`}>
                                <div className="space-y-1">
                                    <h2
                                        ref={stepHeadingRef}
                                        tabIndex={-1}
                                        className="text-lg font-semibold tracking-tight text-foreground outline-none"
                                    >
                                        {currentStep.title}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">{currentStep.description}</p>
                                </div>
                                {renderCurrentStep()}
                                {error ? (
                                    <p className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive" tabIndex={-1}>
                                        {error}
                                    </p>
                                ) : null}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                                    <div className="space-y-5">
                                        {dataStep}
                                        {hasSplitStep ? splitStep : null}
                                    </div>
                                    <div className="space-y-5">{reviewStep}</div>
                                </div>
                                <SpaceEntryNotesPanel
                                    notes={form.notes ?? ''}
                                    onNotesChange={(notes) => setForm((previous) => ({ ...previous, notes }))}
                                />
                                {error ? (
                                    <p className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive" tabIndex={-1}>
                                        {error}
                                    </p>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 safe-area-pb sm:px-6">
                        <Button
                            className="min-h-11 rounded-full"
                            onClick={() => {
                                if (mode === 'create' && !isLastStep) handleNextStep()
                                else void handleSubmit()
                            }}
                            disabled={
                                submitting ||
                                draftAttachmentsBlocked ||
                                (contractVersion === 2 &&
                                    (mode === 'edit' || (mode === 'create' && isLastStep)) &&
                                    (previewLoading || !preview))
                            }
                        >
                            {submitting
                                ? (mode === 'edit' ? 'Guardando cambios...' : 'Guardando...')
                                : mode === 'edit'
                                    ? 'Guardar cambios'
                                    : !isLastStep
                                        ? 'Continuar'
                                        : personalIntent !== 'space_only'
                                            ? 'Guardar y agregar a Mi Finp'
                                            : preview?.personalAction === 'not_applicable'
                                                ? 'Guardar en Espacios'
                                                : 'Guardar; decidir Mi Finp después'}
                        </Button>
                        {mode === 'create' && stepIndex > 0 ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 rounded-full"
                                onClick={() => goToStep(stepIndex - 1)}
                                disabled={submitting}
                            >
                                Atrás
                            </Button>
                        ) : null}
                        <Button
                            variant="ghost"
                            className="min-h-11 rounded-full"
                            onClick={() => handleDialogOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                    </DialogFooter>

                    <AlertDialog
                        open={cancelDraftOpen}
                        onOpenChange={(nextOpen) => {
                            if (!cancelDraftPending) setCancelDraftOpen(nextOpen)
                        }}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Querés guardar este movimiento para después?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Podés conservarlo como borrador privado, salir sin guardar estos cambios o seguir editando.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            {cancelDraftError ? (
                                <p className="text-sm text-destructive" role="alert">
                                    {cancelDraftError}
                                </p>
                            ) : null}
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={cancelDraftPending}>
                                    Seguir editando
                                </AlertDialogCancel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={cancelDraftPending}
                                    onClick={() => void handleExitWithoutSaving()}
                                >
                                    Salir sin guardar
                                </Button>
                                <AlertDialogAction
                                    disabled={cancelDraftPending}
                                    onClick={(event) => {
                                        event.preventDefault()
                                        void handleSaveDraft()
                                    }}
                                >
                                    {cancelDraftPending ? 'Guardando…' : 'Guardar borrador'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </DialogContent>
        </Dialog>
    )
}
