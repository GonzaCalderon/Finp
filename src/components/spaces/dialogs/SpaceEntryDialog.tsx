'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    AlertTriangle,
    Banknote,
    Building2,
    CalendarRange,
    CircleDollarSign,
    Coins,
    CreditCard,
    PiggyBank,
    Link2,
    Loader2,
    Save,
    Trash2,
    Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
import type { AccountType, Currency } from '@/lib/constants'
import type {
    IAccount,
    ICategory,
    ISpaceCategory,
    ISpaceEntry,
    ISpaceParticipant,
    ITransaction,
    SpaceEntryPreviewDto,
    SpaceEntryDraftDto,
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
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    SpaceAmountInline,
    SpaceEntryTypeBadge,
    SpaceInitialsAvatar,
    SpaceMetaBadge,
} from '@/components/spaces/SpaceUi'
import {
    DialogProps,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import {
    SpaceDraftAttachmentsUploader,
} from '@/components/spaces/dialogs/SpaceDraftAttachmentsUploader'
import { SpaceSplitConfigurator } from '@/components/spaces/dialogs/SpaceSplitConfigurator'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { clientDateToDateKey, dateKeyToClientDate } from '@/lib/client/space-api-adapter'
import { moneyFromDecimal } from '@/lib/utils/money'
import { supportsCurrency } from '@/lib/utils/accounts'
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

// ── Account type helpers ──────────────────────────────────────────────────────

function getAccountTypeMeta(type: AccountType): { label: string; icon: LucideIcon } {
    switch (type) {
        case 'bank':
            return { label: 'Cuenta bancaria', icon: Building2 }
        case 'cash':
            return { label: 'Efectivo', icon: Banknote }
        case 'wallet':
            return { label: 'Billetera', icon: Wallet }
        case 'credit_card':
            return { label: 'Tarjeta de crédito', icon: CreditCard }
        case 'savings':
            return { label: 'Caja de ahorro', icon: PiggyBank }
        default:
            return { label: 'Cuenta', icon: CircleDollarSign }
    }
}

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
        } : undefined,
    }
}

function formFingerprint(form: SpaceEntryFormData, step: 1 | 2 | 3) {
    return JSON.stringify({
        ...form,
        date: clientDateToDateKey(form.date),
        step,
    })
}

function formatFinancialDate(date: Date) {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date)
}

function formatFinancialAmount(currency: string, amount: number) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
    }).format(amount)
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
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [preview, setPreview] = useState<SpaceEntryPreviewDto | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [showAdvancedLink, setShowAdvancedLink] = useState(false)
    const [recentTransactions, setRecentTransactions] = useState<ITransaction[]>([])
    const [draftHydrated, setDraftHydrated] = useState(false)
    const [discardDraftOpen, setDiscardDraftOpen] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const focusFirstError = () => {
        requestAnimationFrame(() => {
            const firstError = scrollContainerRef.current?.querySelector<HTMLElement>('.text-destructive')
            firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            firstError?.focus()
        })
    }
    const previousCurrencyRef = useRef(form.currency)
    const draftBaselineRef = useRef<string | null>(null)
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
        setStep(1)
        setPreview(null)
        setPreviewError(null)
        setShowAdvancedLink(false)
        setRecentTransactions([])
        setDiscardDraftOpen(false)

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
            draftBaselineRef.current = formFingerprint(nextForm, 1)
            setDraftHydrated(true)
            return
        }

        setDraftHydrated(false)
        void loadDraft()
            .then((serverDraft) => {
                if (hydrationRunRef.current !== hydrationRun) return
                let nextForm = defaults
                let nextStep: 1 | 2 | 3 = 1

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
                            const parsed = JSON.parse(cached) as { form?: EntryDraftPayload; step?: 1 | 2 | 3 }
                            if (parsed.form) {
                                nextForm = sanitizeDraft({
                                    raw: JSON.stringify(parsed.form),
                                    defaults,
                                    activeParticipants,
                                    spaceMode,
                                })
                                recoveredFallback = true
                            }
                            if (parsed.step && [1, 2, 3].includes(parsed.step)) nextStep = parsed.step
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
                setStep(nextStep)
                draftBaselineRef.current = formFingerprint(nextForm, nextStep)
                setDraftHydrated(true)
            })
            .catch(() => {
                if (hydrationRunRef.current !== hydrationRun) return
                let nextForm = defaults
                let nextStep: 1 | 2 | 3 = 1
                if (fallbackDraftStorageKey && typeof window !== 'undefined') {
                    const cached = window.localStorage.getItem(fallbackDraftStorageKey)
                    if (cached) {
                        try {
                            const parsed = JSON.parse(cached) as { form?: EntryDraftPayload; step?: 1 | 2 | 3 }
                            if (parsed.form) {
                                nextForm = sanitizeDraft({
                                    raw: JSON.stringify(parsed.form),
                                    defaults,
                                    activeParticipants,
                                    spaceMode,
                                })
                            }
                            if (parsed.step && [1, 2, 3].includes(parsed.step)) nextStep = parsed.step
                        } catch {
                            window.localStorage.removeItem(fallbackDraftStorageKey)
                        }
                    }
                }
                setForm(nextForm)
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
    const initialLinkedTransactionImpactsCurrentUser = Boolean(
        initialData?.linkedTransactionId &&
        currentUserId &&
        extractId(availableParticipants.find(
            (participant) => extractId(participant._id) === extractId(initialData.paidByParticipantId)
        )?.userId) === currentUserId
    )
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

    useEffect(() => {
        const previewEligible = mode === 'edit' || (mode === 'create' && step === 3)
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
        form.exchangeRate,
        form.linkedTransactionId,
        form.paidByParticipantId,
        form.sharedWithParticipantIds,
        form.splitAllocations,
        form.splitMode,
        mode,
        open,
        spaceId,
        step,
    ])

    useEffect(() => {
        if (!open || mode !== 'create' || step !== 3 || !showAdvancedLink) return
        let cancelled = false
        void apiJson<{ transactions: ITransaction[] }>(
            `/api/transactions?limit=25&sort=date_desc&currency=${form.currency}`
        ).then((response) => {
            if (cancelled) return
            const expected = preview?.accountImpactAmount || preview?.ownShareAmount || form.amount
            setRecentTransactions(response.transactions.filter(
                (transaction) => Math.abs(transaction.amount - expected) <= 0.01
            ))
        }).catch(() => {
            if (!cancelled) setRecentTransactions([])
        })
        return () => {
            cancelled = true
        }
    }, [form.amount, form.currency, mode, open, preview?.accountImpactAmount, preview?.ownShareAmount, showAdvancedLink, step])

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

    const clearDraftCaches = useCallback(() => {
        if (typeof window !== 'undefined') {
            if (legacyDraftStorageKey) window.sessionStorage.removeItem(legacyDraftStorageKey)
            if (fallbackDraftStorageKey) window.localStorage.removeItem(fallbackDraftStorageKey)
        }
        setPersistedDraft(null)
        onDraftChange?.(null)
    }, [fallbackDraftStorageKey, legacyDraftStorageKey, onDraftChange, setPersistedDraft])

    const persistDraftSnapshot = useCallback(async (
        snapshot: SpaceEntryFormData = form,
        currentStep: 1 | 2 | 3 = step,
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

    useEffect(() => {
        if (!open || mode !== 'create' || contractVersion !== 2 || !draftHydrated || submitting) return
        const fingerprint = formFingerprint(form, step)
        if (!persistedDraft && draftBaselineRef.current === fingerprint) return

        const timer = window.setTimeout(() => {
            void persistDraftSnapshot().catch(() => undefined)
        }, 700)
        return () => window.clearTimeout(timer)
    }, [
        contractVersion,
        draftHydrated,
        form,
        mode,
        open,
        persistedDraft,
        persistDraftSnapshot,
        step,
        submitting,
    ])

    const handleSaveDraft = async () => {
        try {
            await persistDraftSnapshot(form, step, true)
            onOpenChange(false)
        } catch {
            // El estado visible del borrador conserva el error y permite reintentar.
        }
    }

    const handleDialogOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            onOpenChange(true)
            return
        }
        if (mode === 'create' && draftHydrated) {
            void persistDraftSnapshot().catch(() => undefined)
        }
        onOpenChange(false)
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
            setStep(latest.step)
            draftBaselineRef.current = formFingerprint(nextForm, latest.step)
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
            focusFirstError()
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

    const handleNextStep = () => {
        if (mode === 'edit') return
        if (step === 1) {
            const nextErrors: Record<string, string> = {}
            if (!form.title.trim()) nextErrors.title = 'Ingresá una descripción.'
            if (!Number.isFinite(form.amount) || form.amount <= 0) nextErrors.amount = 'Ingresá un monto mayor a cero.'
            if (!form.paidByParticipantId) nextErrors.paidByParticipantId = 'Elegí quién pagó.'
            if (form.currency !== reportingCurrency && !form.exchangeRate) {
                nextErrors.exchangeRate = 'Ingresá la cotización para la moneda de reporte.'
            }
            if (Object.keys(nextErrors).length) {
                setFieldErrors(nextErrors)
                focusFirstError()
                return
            }
            setFieldErrors({})
            setStep(2)
            return
        }
        if (step === 2) {
            const parsed = spaceEntrySchema.safeParse({ ...form, type: 'expense' })
            if (!parsed.success) {
                const nextErrors: Record<string, string> = {}
                for (const issue of parsed.error.issues) {
                    const key = String(issue.path[0] ?? '')
                    if (key && !nextErrors[key]) nextErrors[key] = issue.message
                }
                setFieldErrors(nextErrors)
                focusFirstError()
                return
            }
            setFieldErrors({})
            setStep(3)
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
            focusFirstError()
            return
        }

        if (contractVersion === 2 && (previewLoading || !preview)) {
            setError(previewError ?? 'Esperá a que termine la revisión financiera antes de confirmar.')
            focusFirstError()
            return
        }
        if (preview?.linkExisting && !preview.linkExisting.compatible) {
            setError('La transacción elegida no coincide con la revisión financiera. Elegí otra o creá una nueva.')
            focusFirstError()
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
                ? await persistDraftSnapshot(submission, 3)
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

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[1120px] gap-0 overflow-hidden p-0 sm:max-h-[94vh] sm:max-w-[1120px]"
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
                            <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Pasos del gasto">
                                {(['Datos', 'Reparto', 'Revisión'] as const).map((label, index) => {
                                    const value = (index + 1) as 1 | 2 | 3
                                    const active = step === value
                                    const complete = step > value
                                    return (
                                        <li key={label}>
                                            <button
                                                type="button"
                                                className={`min-h-11 w-full rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : complete ? 'border-foreground/10 bg-muted/60 text-foreground' : 'border-foreground/10 text-muted-foreground'}`}
                                                onClick={() => complete && setStep(value)}
                                                aria-current={active ? 'step' : undefined}
                                            >
                                                {value}. {label}
                                            </button>
                                        </li>
                                    )
                                })}
                            </ol>
                        ) : null}
                        {mode === 'create' && contractVersion === 2 && draftHydrated ? (
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
                                                ? 'Guardado de forma privada'
                                                : draftSaveState === 'conflict'
                                                    ? 'Hay una versión más reciente'
                                                    : draftSaveState === 'error'
                                                        ? 'No se pudo guardar; conservamos una copia en este dispositivo'
                                                        : 'Se guardará automáticamente al empezar'}
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
                        {mode === 'edit' && initialLinkedTransactionImpactsCurrentUser ? (
                            <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    Este movimiento impactó en tu Finp personal. Revisá la transacción vinculada para mantener tus finanzas consistentes.
                                </span>
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
                    <div ref={scrollContainerRef} className="relative min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        {mode === 'create' && contractVersion === 2 && !draftHydrated ? (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-sm" aria-live="polite">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Recuperando tu borrador…
                                </div>
                            </div>
                        ) : null}
                        <div className="space-y-5">
                            <div className={`grid gap-5 ${mode === 'edit' ? 'xl:grid-cols-[1.2fr_0.8fr]' : ''}`}>

                                {/* ── Left column ── */}
                                <div className={`space-y-5 ${mode === 'create' && step === 3 ? 'hidden' : ''}`}>

                                    {/* Monto, moneda, fecha, descripción, pagó, categoría */}
                                    <div className={mode === 'edit' || step === 1 ? 'block' : 'hidden'}>
                                    <SpaceDialogPanel>
                                        <div className="grid gap-4">
                                            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.55fr_0.7fr]">
                                                <FormattedAmountInput
                                                    id="entry-amount"
                                                    label="Monto"
                                                    value={form.amount || undefined}
                                                    currency={form.currency}
                                                    error={fieldErrors.amount}
                                                    labelClassName="text-sm font-medium text-foreground"
                                                    onValueChangeAction={(value) => {
                                                        setForm((previous) => ({ ...previous, amount: value }))
                                                        clearFieldError('amount')
                                                    }}
                                                />

                                                <CurrencySelector
                                                    value={form.currency}
                                                    options={spaceCurrencies}
                                                    onValueChange={(currency) => {
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            currency,
                                                            personalAccountId: undefined,
                                                            categoryId: undefined,
                                                        }))
                                                        clearFieldError('currency')
                                                    }}
                                                    error={fieldErrors.currency}
                                                />

                                                <DatePickerField
                                                    label="Fecha"
                                                    value={form.date instanceof Date ? form.date : undefined}
                                                    isOpen={datePickerOpen}
                                                    onOpenChange={(open) => {
                                                        if (open) clearFieldError('date')
                                                        setDatePickerOpen(open)
                                                    }}
                                                    onChange={(date) => {
                                                        if (date) setForm((previous) => ({ ...previous, date }))
                                                    }}
                                                    error={fieldErrors.date}
                                                    showErrors={Boolean(fieldErrors.date)}
                                                />
                                            </div>

                                            <SpaceDialogField id="entry-title" label="Descripción" error={fieldErrors.title}>
                                                <Input
                                                    id="entry-title"
                                                    value={form.title}
                                                    onChange={(event) => {
                                                        setForm((previous) => ({ ...previous, title: event.target.value }))
                                                        clearFieldError('title')
                                                    }}
                                                    placeholder="Ej. Almuerzo equipo en Santiago"
                                                    className={fieldErrors.title ? 'border-destructive focus-visible:ring-destructive/25' : ''}
                                                />
                                            </SpaceDialogField>

                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <SpaceDialogField id="entry-paid-by" label="Pagó" error={fieldErrors.paidByParticipantId}>
                                                    <Select
                                                        value={form.paidByParticipantId}
                                                        onValueChange={(value) => {
                                                            clearFieldError('paidByParticipantId')
                                                            setForm((previous) => {
                                                                const nextIsCurrentUser =
                                                                    extractId(
                                                                        availableParticipants.find(
                                                                            (participant) =>
                                                                                extractId(participant._id) === value
                                                                        )?.userId
                                                                    ) === currentUserId
                                                                const shouldMoveResponsibility =
                                                                    previous.splitMode === 'none' &&
                                                                    (!previous.sharedWithParticipantIds?.[0] ||
                                                                        previous.sharedWithParticipantIds[0] ===
                                                                            previous.paidByParticipantId)

                                                                return {
                                                                    ...previous,
                                                                    paidByParticipantId: value,
                                                                    sharedWithParticipantIds: shouldMoveResponsibility
                                                                        ? [value]
                                                                        : previous.sharedWithParticipantIds,
                                                                    personalAccountId: nextIsCurrentUser
                                                                        ? previous.personalAccountId
                                                                        : undefined,
                                                                }
                                                            })
                                                        }}
                                                    >
                                                        <SelectTrigger
                                                            id="entry-paid-by"
                                                            aria-labelledby="entry-paid-by-label entry-paid-by"
                                                            className="w-full"
                                                        >
                                                            <SelectValue placeholder="Elegí un participante" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {payerParticipants.map((participant) => (
                                                                <SelectItem
                                                                    key={extractId(participant._id)}
                                                                    value={extractId(participant._id) ?? ''}
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <SpaceInitialsAvatar
                                                                            name={participant.displayName}
                                                                            className="h-6 w-6 text-[10px]"
                                                                        />
                                                                        <span>
                                                                            {participant.displayName}
                                                                            {!participant.isActive ? ' · inactivo' : ''}
                                                                        </span>
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </SpaceDialogField>

                                                <SpaceDialogField id="entry-space-category" label="Categoría del espacio">
                                                    <Select
                                                        value={form.spaceCategoryId ?? 'none'}
                                                        onValueChange={(value) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                spaceCategoryId: value === 'none' ? undefined : value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger
                                                            id="entry-space-category"
                                                            aria-labelledby="entry-space-category-label entry-space-category"
                                                            className="w-full"
                                                        >
                                                            <SelectValue placeholder="Sin categoría" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sin categoría</SelectItem>
                                                            {filteredCategories.map((category: ISpaceCategory) => (
                                                                <SelectItem
                                                                    key={extractId(category._id)}
                                                                    value={extractId(category._id) ?? ''}
                                                                >
                                                                    {category.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </SpaceDialogField>
                                            </div>

                                            {form.currency !== reportingCurrency ? (
                                                <FormattedAmountInput
                                                    id="space-exchange-rate"
                                                    label={`Cotización a ${reportingCurrency}`}
                                                    value={form.exchangeRate}
                                                    currency={reportingCurrency}
                                                    helperText="Necesaria para reflejar el movimiento correctamente en la moneda de reporte."
                                                    error={fieldErrors.exchangeRate}
                                                    placeholder={`Valor de 1 ${form.currency}`}
                                                    onValueChangeAction={(exchangeRate) => {
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            exchangeRate: exchangeRate || undefined,
                                                        }))
                                                        clearFieldError('exchangeRate')
                                                    }}
                                                />
                                            ) : null}
                                            {form.currency !== reportingCurrency ? (
                                                <p className="text-xs text-muted-foreground" aria-live="polite">
                                                    {automaticQuoteSelected && activeQuote
                                                        ? `Referencia automática · ${activeQuote.source === 'dolarapi_official' ? 'DolarAPI oficial' : 'Frankfurter'} · ${activeQuote.status === 'current' ? 'actualizada' : 'desactualizada'}`
                                                        : 'Cotización manual: Finp guardará este valor, su autor y el momento de confirmación.'}
                                                </p>
                                            ) : null}
                                        </div>
                                    </SpaceDialogPanel>
                                    </div>

                                    {/* Split configurator */}
                                    {(mode === 'edit' || step === 2) && spaceMode !== 'solo' ? (
                                        <div>
                                            <SpaceSplitConfigurator
                                                participants={splitParticipants}
                                                amount={Number.isFinite(form.amount) ? form.amount : 0}
                                                currency={form.currency}
                                                paidByParticipantId={form.paidByParticipantId}
                                                selectedParticipantIds={form.sharedWithParticipantIds ?? []}
                                                splitMode={form.splitMode}
                                                allocations={form.splitAllocations}
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
                                                onAllocationsChange={(allocs) => {
                                                    updateSplitAllocations(allocs)
                                                    clearFieldError('splitAllocations')
                                                }}
                                            />
                                            {(fieldErrors.sharedWithParticipantIds ?? fieldErrors.splitAllocations) ? (
                                                <p className="mt-2 text-xs font-medium text-destructive" tabIndex={-1}>
                                                    {fieldErrors.sharedWithParticipantIds ?? fieldErrors.splitAllocations}
                                                </p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>

                                {/* ── Right column ── */}
                                <div className={`space-y-5 ${mode === 'create' && step !== 3 ? 'hidden' : ''}`}>

                                    {/* Resumen */}
                                    <SpaceDialogPanel>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <SpaceDialogSectionEyebrow>Resumen</SpaceDialogSectionEyebrow>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                    Vista rápida antes de guardar
                                                </h3>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <SpaceEntryTypeBadge type={form.type} />
                                                <SpaceMetaBadge icon={Coins}>
                                                    {form.currency} · reporte en {reportingCurrency}
                                                </SpaceMetaBadge>
                                                <SpaceMetaBadge icon={CalendarRange}>
                                                    {formatFinancialDate(form.date)}
                                                </SpaceMetaBadge>
                                            </div>

                                            <div className="rounded-[24px] border border-foreground/[0.07] bg-background/72 p-4">
                                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                                    Monto
                                                </p>
                                                <SpaceAmountInline
                                                    amount={Number.isFinite(form.amount) ? form.amount : 0}
                                                    currency={form.currency}
                                                    hidden={false}
                                                    className="mt-2 text-2xl font-semibold"
                                                    exact
                                                />
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    {paidByParticipant
                                                        ? `Lo registra ${paidByParticipant.displayName}.`
                                                        : 'Todavía falta elegir quién paga.'}
                                                </p>
                                            </div>
                                        </div>
                                    </SpaceDialogPanel>

                                    {mode === 'create' || contractVersion === 2 ? (
                                        <SpaceDialogPanel>
                                            <div className="space-y-4" aria-live="polite">
                                                <div>
                                                    <SpaceDialogSectionEyebrow>Revisión financiera</SpaceDialogSectionEyebrow>
                                                    <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                                                        Qué cambia al confirmar
                                                    </h3>
                                                </div>
                                                {previewLoading ? (
                                                    <p className="text-sm text-muted-foreground">Calculando con las reglas del Espacio…</p>
                                                ) : preview ? (
                                                    <dl className="grid grid-cols-2 gap-3 text-sm">
                                                        {[
                                                            ['Total', preview.totalAmount],
                                                            ['Tu parte', preview.ownShareAmount],
                                                            ['Impacto real de cuenta', preview.accountImpactAmount],
                                                            ['Gasto operacional', preview.operationalAmount],
                                                            ['Adelanto recuperable', preview.recoverableAdvanceAmount],
                                                            ['Cambio en deuda', preview.debtDeltaReporting],
                                                        ].map(([label, amount]) => (
                                                            <div key={label as string} className="rounded-xl border border-foreground/[0.07] bg-background/70 p-3">
                                                                <dt className="text-xs text-muted-foreground">{label}</dt>
                                                                <dd className="mt-1 font-semibold">
                                                                    <SpaceAmountInline
                                                                        amount={amount as number}
                                                                        currency={label === 'Cambio en deuda' ? preview.reportingCurrency : preview.currency}
                                                                        hidden={false}
                                                                        exact
                                                                    />
                                                                </dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                ) : previewError ? (
                                                    <p className="rounded-xl border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive" tabIndex={-1}>
                                                        {previewError}
                                                    </p>
                                                ) : (
                                                    <p className="rounded-xl border border-foreground/[0.07] bg-muted/35 p-3 text-sm text-muted-foreground">
                                                        Completá monto, pagador y reparto para calcular la revisión.
                                                    </p>
                                                )}
                                            </div>
                                        </SpaceDialogPanel>
                                    ) : null}

                                    {/* Pagado desde — solo en modo crear */}
                                    {mode === 'create' && isCurrentUserPayer ? (
                                        <SpaceDialogPanel>
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <SpaceDialogSectionEyebrow>Impacto personal</SpaceDialogSectionEyebrow>
                                                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                        Pagado desde
                                                    </h3>
                                                </div>

                                                <SpaceDialogField id="entry-personal-account" label="Cuenta o tarjeta">
                                                    <Select
                                                        value={form.personalAccountId ?? 'none'}
                                                        onValueChange={(value) => {
                                                            if (value !== 'none') {
                                                                setShowAdvancedLink(false)
                                                            }
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                personalAccountId:
                                                                    value === 'none' ? undefined : value,
                                                                categoryId:
                                                                    value === 'none' ? undefined : previous.categoryId,
                                                                linkedTransactionId:
                                                                    value === 'none' ? previous.linkedTransactionId : undefined,
                                                            }))
                                                        }}
                                                    >
                                                        <SelectTrigger
                                                            id="entry-personal-account"
                                                            aria-labelledby="entry-personal-account-label entry-personal-account"
                                                            className="w-full"
                                                        >
                                                            <SelectValue placeholder="Solo registrar en el espacio" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none" textValue="Solo registrar en el espacio">
                                                                <span className="flex items-center gap-2.5">
                                                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-muted">
                                                                        <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    </span>
                                                                    <span className="text-sm text-muted-foreground">
                                                                        Solo registrar en el espacio
                                                                    </span>
                                                                </span>
                                                            </SelectItem>
                                                            {filteredAccounts.map((account: IAccount) => {
                                                                const meta = getAccountTypeMeta(account.type)
                                                                const Icon = meta.icon
                                                                return (
                                                                    <SelectItem
                                                                        key={extractId(account._id)}
                                                                        value={extractId(account._id) ?? ''}
                                                                        textValue={account.name}
                                                                    >
                                                                        <span className="flex items-center gap-2.5">
                                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-muted">
                                                                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                            </span>
                                                                            <span>
                                                                                <span className="block text-sm font-medium leading-tight">
                                                                                    {account.name}
                                                                                </span>
                                                                                <span className="block text-xs leading-tight text-muted-foreground">
                                                                                    {meta.label} · {account.currency}
                                                                                </span>
                                                                            </span>
                                                                        </span>
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </SpaceDialogField>

                                                {filteredAccounts.length === 0 ? (
                                                    <p className="rounded-[18px] border border-warning-soft bg-warning-soft/40 px-3 py-2 text-xs text-warning-foreground">
                                                        Para impactarlo en Finp personal vas a necesitar registrarlo en una moneda compatible o resolverlo con una conversión.
                                                    </p>
                                                ) : null}

                                                {form.personalAccountId ? (
                                                    <SpaceDialogField
                                                        id="entry-personal-category"
                                                        label="Categoría personal"
                                                        hint="Solo impacta en tu Finp personal. La categoría del espacio se conserva aparte."
                                                    >
                                                        <Select
                                                            value={form.categoryId ?? 'none'}
                                                            onValueChange={(value) =>
                                                                setForm((previous) => ({
                                                                    ...previous,
                                                                    categoryId: value === 'none' ? undefined : value,
                                                                }))
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                id="entry-personal-category"
                                                                aria-labelledby="entry-personal-category-label entry-personal-category"
                                                                className="w-full"
                                                            >
                                                                <SelectValue placeholder="Sin categoría" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">Sin categoría</SelectItem>
                                                                {personalExpenseCategories.map((category: ICategory) => (
                                                                    <SelectItem
                                                                        key={extractId(category._id)}
                                                                        value={extractId(category._id) ?? ''}
                                                                    >
                                                                        {category.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </SpaceDialogField>
                                                ) : null}

                                                <p className="text-xs text-muted-foreground">
                                                    {selectedPersonalAccount?.type === 'credit_card'
                                                        ? `Se registrará un consumo en un pago por ${formatFinancialAmount(form.currency, form.amount)} en la tarjeta. Tu gasto personal seguirá siendo tu parte.`
                                                        : 'Elegí una cuenta o tarjeta si querés impactarlo también en tu Finp personal.'}
                                                </p>
                                            </div>
                                        </SpaceDialogPanel>
                                    ) : null}

                                    {mode === 'create' && isCurrentUserPayer ? (
                                        <SpaceDialogPanel>
                                            <div className="space-y-3">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                                                    onClick={() => {
                                                        setShowAdvancedLink((value) => !value)
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            linkedTransactionId: undefined,
                                                            ...(showAdvancedLink ? {} : { personalAccountId: undefined, categoryId: undefined }),
                                                        }))
                                                    }}
                                                >
                                                    <Link2 className="h-4 w-4" />
                                                    Vincular una transacción existente (avanzado)
                                                </button>
                                                {showAdvancedLink ? (
                                                    <SpaceDialogField id="entry-linked-transaction" label="Transacción compatible">
                                                        <Select
                                                            value={form.linkedTransactionId ?? ''}
                                                            onValueChange={(linkedTransactionId) =>
                                                                setForm((previous) => ({
                                                                    ...previous,
                                                                    linkedTransactionId,
                                                                    personalAccountId: undefined,
                                                                    categoryId: undefined,
                                                                }))
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                id="entry-linked-transaction"
                                                                aria-labelledby="entry-linked-transaction-label entry-linked-transaction"
                                                                className="w-full"
                                                            >
                                                                <SelectValue placeholder="Elegí una transacción" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {recentTransactions.map((transaction) => (
                                                                    <SelectItem
                                                                        key={extractId(transaction._id)}
                                                                        value={extractId(transaction._id) ?? ''}
                                                                    >
                                                                        {transaction.description} · {transaction.amount} {transaction.currency}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </SpaceDialogField>
                                                ) : null}
                                                {preview?.linkExisting && !preview.linkExisting.compatible ? (
                                                    <p className="text-xs font-medium text-destructive" tabIndex={-1}>
                                                        La transacción no coincide en monto o moneda con este impacto.
                                                    </p>
                                                ) : null}
                                            </div>
                                        </SpaceDialogPanel>
                                    ) : null}

                                    {/* Adjuntos — solo en modo crear */}
                                    {mode === 'create' ? (
                                        <SpaceDraftAttachmentsUploader
                                            attachments={persistedDraft?.attachments ?? []}
                                            disabled={submitting || draftLoading}
                                            onUpload={handleDraftAttachmentUpload}
                                            onRemove={async (attachmentId) => {
                                                await removeDraftAttachment(attachmentId)
                                            }}
                                            onBlockingChange={setDraftAttachmentsBlocked}
                                        />
                                    ) : null}

                                    {/* Borrador — solo en modo crear */}
                                    {mode === 'create' ? (
                                    <SpaceDialogPanel>
                                        <div className="space-y-3">
                                            <SpaceDialogSectionEyebrow>Borrador</SpaceDialogSectionEyebrow>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start rounded-full text-muted-foreground"
                                                onClick={() => void handleSaveDraft()}
                                                disabled={submitting || draftLoading || draftSaveState === 'saving'}
                                            >
                                                {draftSaveState === 'saving' ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                                Guardar borrador y cerrar
                                            </Button>
                                        </div>
                                    </SpaceDialogPanel>
                                    ) : null}
                                </div>
                            </div>

                            {/* Notas */}
                            <div className={mode === 'edit' || step === 3 ? 'block' : 'hidden'}>
                            <SpaceDialogPanel>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Notas</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Contexto adicional
                                        </h3>
                                    </div>
                                    <SpaceDialogTextArea
                                        value={form.notes ?? ''}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                notes: event.target.value,
                                            }))
                                        }
                                        rows={4}
                                        placeholder="Notas internas, contexto o recordatorios útiles para el equipo."
                                    />
                                </div>
                            </SpaceDialogPanel>
                            </div>

                            {error ? (
                                <p className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive" tabIndex={-1}>
                                    {error}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 sm:px-6">
                        <Button
                            className="min-h-11 rounded-full"
                            onClick={() => {
                                if (mode === 'create' && step < 3) handleNextStep()
                                else void handleSubmit()
                            }}
                            disabled={
                                submitting ||
                                draftAttachmentsBlocked ||
                                (mode === 'create' && step === 3 && contractVersion === 2 && (previewLoading || !preview))
                            }
                        >
                            {submitting
                                ? (mode === 'edit' ? 'Guardando cambios...' : 'Guardando...')
                                : mode === 'edit'
                                    ? 'Guardar cambios'
                                    : step < 3
                                        ? 'Continuar'
                                        : form.personalAccountId || form.linkedTransactionId
                                            ? 'Guardar y agregar a Mi Finp'
                                            : preview?.personalAction === 'not_applicable'
                                                ? 'Guardar en Espacios'
                                                : 'Guardar; decidir Mi Finp después'}
                        </Button>
                        {mode === 'create' && step > 1 ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 rounded-full"
                                onClick={() => setStep((step - 1) as 1 | 2)}
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
                </div>
            </DialogContent>
        </Dialog>
    )
}
