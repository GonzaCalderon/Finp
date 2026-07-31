'use client'

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react'
import {
    AlertCircle,
    ArrowRight,
    Check,
    ChevronDown,
    CircleDollarSign,
    Clock3,
    HelpCircle,
    Lightbulb,
    Loader2,
    Sparkles,
    Tag,
    WalletCards,
    Wand2,
    X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { apiJson } from '@/lib/client/auth-client'
import { CaptureHelpPanel } from '@/components/shared/CaptureHelpPanel'
import { CaptureOrientationCard } from '@/components/shared/CaptureOrientationCard'
import { MonthPickerField } from '@/components/shared/MonthPickerField'
import { buildCaptureDraft, putCaptureDraft } from '@/lib/client/capture-draft'
import { detectCaptureIntents } from '@/lib/utils/capture-intents'
import type {
    CaptureTransactionLaunchDraft,
    CommitmentDraftFields,
    FunctionalSuggestionActionId,
} from '@/types/capture-intent'
import type { CommitmentSuggestion } from '@/lib/utils/commitment-suggestions'
import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'
import {
    clearStoredDescriptionAliases,
    getStoredDescriptionAliases,
} from '@/components/shared/transaction-dialog-prefs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    COMMITMENT_INVALIDATION_TAGS,
    TRANSACTION_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'
import type { Currency } from '@/lib/constants'
import {
    getSupportedCurrencies,
    isSimpleTransactionAccountType,
    supportsCurrency,
} from '@/lib/utils/accounts'
import { cn } from '@/lib/utils'
import { resolveEntityId } from '@/lib/utils/entity-id'
import {
    getQuickCaptureInlineCompletion,
    normalizeQuickCaptureTerm,
    parseQuickCapture,
    quickCaptureTextFromFrequent,
    replaceQuickCaptureRange,
    resolveQuickCapturePreviewDraft,
} from '@/lib/utils/quick-capture'
import type {
    IAccount,
    ICategory,
    ITransactionRule,
    QuickCaptureAliasDto,
    QuickCaptureCommitmentDto,
    QuickCaptureContextResponse,
    QuickCaptureDraft,
    QuickCaptureFrequent,
    QuickCaptureLearningContext,
    QuickCaptureLearningEventInput,
    QuickCaptureLearningMethod,
    QuickCaptureSuggestion,
    TransactionPreviewIssue,
    TransactionPreviewResponse,
} from '@/types'

const MIGRATION_KEY = 'finp-quick-capture-alias-migration-v1'

function createClientEventId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type QuickCaptureDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    accounts: IAccount[]
    categories: ICategory[]
    rules?: ITransactionRule[]
    defaultAccountId?: string
    lastExpenseAccountId?: string
    lastIncomeAccountId?: string
    onCompleteDetails: (draft: CaptureTransactionLaunchDraft) => void
    /** Se dispara cuando se aplicó un compromiso desde el diálogo. */
    onAppliedCommitment?: (description: string, period: string) => void
}

type DraftOverrides = Partial<
    Pick<
        QuickCaptureDraft,
        'type' | 'currency' | 'date' | 'accountId' | 'categoryId' | 'merchant' | 'description'
    >
>

function toDateInputValue(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
}

function fromDateInputValue(value: string) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
}

function formatMoney(amount: number, currency: Currency) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'ARS' ? 0 : 2,
    }).format(amount)
}

function formatCaptureDate(date: Date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)
    const difference = Math.round((target.getTime() - today.getTime()) / 86_400_000)
    const label = difference === 0 ? 'hoy' : difference === -1 ? 'ayer' : undefined
    const formatted = target.toLocaleDateString('es-AR')
    return label ? `${label}, ${formatted}` : formatted
}

function buildPayload(draft: QuickCaptureDraft) {
    const accountField =
        draft.type === 'income'
            ? { destinationAccountId: draft.accountId }
            : { sourceAccountId: draft.accountId }
    return {
        type: draft.type,
        amount: draft.amount,
        currency: draft.currency,
        date: draft.date.toISOString(),
        description: draft.description,
        categoryId: draft.categoryId,
        merchant: draft.merchant,
        ...accountField,
    }
}

function localIssues(draft: QuickCaptureDraft): TransactionPreviewIssue[] {
    const issues: TransactionPreviewIssue[] = []
    if (!draft.amount || !Number.isFinite(draft.amount) || draft.amount <= 0) {
        issues.push({
            code: 'AMOUNT_REQUIRED',
            message: 'Escribí un monto mayor que cero.',
            field: 'amount',
            severity: 'error',
        })
    }
    if (!draft.description.trim()) {
        issues.push({
            code: 'DESCRIPTION_REQUIRED',
            message: 'Falta una descripción.',
            field: 'description',
            severity: 'error',
        })
    }
    if (!draft.accountId) {
        issues.push({
            code: 'ACCOUNT_REQUIRED',
            message: `Elegí la cuenta ${draft.type === 'income' ? 'destino' : 'origen'}.`,
            field: 'accountId',
            severity: 'error',
        })
    }
    return issues
}

function TokenStrip({
    text,
    tokens,
}: {
    text: string
    tokens: ReturnType<typeof parseQuickCapture>['tokens']
}) {
    if (!text.trim()) return null
    const colors: Record<string, string> = {
        amount: 'border-emerald-500/50 bg-emerald-500/10',
        currency: 'border-sky-500/50 bg-sky-500/10',
        date: 'border-violet-500/50 bg-violet-500/10',
        correction: 'border-amber-500/50 bg-amber-500/10',
        account: 'border-blue-500/50 bg-blue-500/10',
        category: 'border-fuchsia-500/50 bg-fuchsia-500/10',
        type: 'border-primary/50 bg-primary/10',
        merchant: 'border-orange-500/50 bg-orange-500/10',
        suggestion: 'border-amber-500/50 bg-amber-500/10',
        description: 'border-border bg-muted/60',
        unknown: 'border-border bg-muted/60',
    }
    return (
        <div className="flex flex-wrap gap-1.5" aria-label="Fragmentos interpretados">
            {tokens.map((token) => (
                <span
                    key={`${token.start}-${token.end}`}
                    className={cn(
                        'inline-flex min-h-7 items-center rounded-md border px-2 text-xs text-foreground',
                        colors[token.kind]
                    )}
                    style={token.color ? { borderColor: token.color } : undefined}
                    title={token.label ? `${token.value}: ${token.label}` : token.value}
                >
                    {token.value}
                    {token.label && token.label !== token.value ? (
                        <span className="ml-1 text-muted-foreground">· {token.label}</span>
                    ) : null}
                </span>
            ))}
        </div>
    )
}

function SuggestionCard({
    suggestion,
    saving,
    onOnce,
    onAlways,
    onDismiss,
}: {
    suggestion: QuickCaptureSuggestion
    saving: boolean
    onOnce: () => void
    onAlways: () => void
    onDismiss: () => void
}) {
    const canPersist = suggestion.targetType !== 'date'
    return (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
            <div className="flex items-start gap-2">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                        ¿“{suggestion.sourceText}” es {suggestion.targetLabel}?
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.reason}</p>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" className="h-7" onClick={onOnce}>
                    Sólo esta vez
                </Button>
                {canPersist ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={saving}
                        onClick={onAlways}
                    >
                        {saving ? <Loader2 className="animate-spin" /> : null}
                        Usar siempre
                    </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="h-7" onClick={onDismiss}>
                    No
                </Button>
            </div>
        </div>
    )
}

export function QuickCaptureDialog({
    open,
    onOpenChange,
    accounts,
    categories,
    rules = [],
    defaultAccountId,
    lastExpenseAccountId,
    lastIncomeAccountId,
    onCompleteDetails,
    onAppliedCommitment,
}: QuickCaptureDialogProps) {
    const router = useRouter()
    const [text, setText] = useState('')
    const [aliases, setAliases] = useState<QuickCaptureAliasDto[]>([])
    const [frequents, setFrequents] = useState<QuickCaptureFrequent[]>([])
    const [learning, setLearning] = useState<QuickCaptureLearningContext>()
    // Contexto de orientación: compromisos aplicables y descartes persistentes.
    const [commitments, setCommitments] = useState<QuickCaptureCommitmentDto[]>([])
    const [learnedCommitmentCandidates, setLearnedCommitmentCandidates] =
        useState<CommitmentSuggestion[]>([])
    const [currentPeriod, setCurrentPeriod] = useState<string | undefined>()
    const [dismissedSubjects, setDismissedSubjects] = useState<string[]>([])
    const [orientationBusy, setOrientationBusy] = useState(false)
    const [orientationError, setOrientationError] = useState<string | null>(null)
    // Descartes que valen sólo para esta sesión ("Ahora no" / "Registrar aparte").
    const [sessionDismissedSubjects, setSessionDismissedSubjects] = useState<string[]>([])
    const [helpOpen, setHelpOpen] = useState(false)
    const [captureIntroDismissed, setCaptureIntroDismissed] = useState(false)
    const captureIntroSeenRef = useRef(false)
    /**
     * Intro de una sola vez, con campo propio: el banner de aprendizaje sólo
     * aparece cuando ya hay patrones, así que un usuario nuevo nunca lo veía.
     */
    const showCaptureIntro =
        !captureIntroDismissed &&
        !helpOpen &&
        Boolean(learning) &&
        !learning?.profile.captureIntroSeenAt
    const [overrides, setOverrides] = useState<DraftOverrides>({})
    const [preview, setPreview] = useState<TransactionPreviewResponse>()
    const [previewing, setPreviewing] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [contextLoading, setContextLoading] = useState(false)
    const [savingSuggestionId, setSavingSuggestionId] = useState<string>()
    const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([])
    const [duplicateConfirmed, setDuplicateConfirmed] = useState(false)
    const [showManualDetails, setShowManualDetails] = useState(false)
    const [showLearningIntro, setShowLearningIntro] = useState(false)
    const [selectedCardAccountId, setSelectedCardAccountId] = useState<string>()
    const [cardFirstClosingMonth, setCardFirstClosingMonth] = useState<string>()
    const [dismissedPersonalizationKeys, setDismissedPersonalizationKeys] =
        useState<string[]>([])
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const inputMirrorRef = useRef<HTMLDivElement>(null)
    const spaceCompletionRef = useRef<{
        beforeText: string
        afterText: string
        suggestionId: string
        patternKey?: string
        source?: QuickCaptureSuggestion['source']
        targetType: QuickCaptureSuggestion['targetType']
        targetId?: string
        targetValue?: string
        confidence: number
    } | null>(null)
    const learningSessionIdRef = useRef('')
    const learningOpenedAtRef = useRef(0)
    const learningCompletedRef = useRef(false)
    const learningEnabledRef = useRef(true)
    const learningEventQueueRef = useRef<QuickCaptureLearningEventInput[]>([])
    const shownSuggestionKeysRef = useRef(new Set<string>())
    const learningFlushTimerRef = useRef<number | null>(null)
    const learnedCandidatesRequestedRef = useRef(false)

    const simpleAccounts = useMemo(
        () => accounts.filter((account) =>
            account.isActive !== false &&
            isSimpleTransactionAccountType(account.type)
        ),
        [accounts]
    )
    const creditCards = useMemo(
        () => accounts
            .filter((account) => account.type === 'credit_card' && account.isActive !== false)
            .map((account) => ({
                id: resolveEntityId(account._id),
                name: account.name,
                currencies: getSupportedCurrencies(account),
                isActive: account.isActive,
            })),
        [accounts]
    )

    const interpretation = useMemo(
        () => parseQuickCapture(text, {
            accounts,
            categories,
            aliases,
            frequents,
            rules,
            learnedPatterns: (learning?.patterns ?? []).filter(
                (pattern) => !dismissedPersonalizationKeys.includes(pattern.key)
            ),
            defaultAccountId,
            lastExpenseAccountId,
            lastIncomeAccountId,
        }),
        [
            accounts,
            aliases,
            categories,
            defaultAccountId,
            frequents,
            lastExpenseAccountId,
            lastIncomeAccountId,
            rules,
            learning?.patterns,
            dismissedPersonalizationKeys,
            text,
        ]
    )

    const draft = useMemo<QuickCaptureDraft>(
        () => ({ ...interpretation.draft, ...overrides }),
        [interpretation.draft, overrides]
    )
    const activeSuggestions = interpretation.suggestions.filter(
        (suggestion) => !dismissedSuggestions.includes(suggestion.id)
    )
    const activePersonalizations = useMemo(
        () => interpretation.personalizations ?? [],
        [interpretation.personalizations]
    )
    const inlineCompletion = getQuickCaptureInlineCompletion(
        text,
        activeSuggestions[0]
    )
    const cardSuggestions = inlineCompletion
        ? activeSuggestions.filter(
            (suggestion) => suggestion.id !== inlineCompletion.suggestion.id
        )
        : activeSuggestions
    const resolvedDraft = useMemo(
        () => resolveQuickCapturePreviewDraft(draft, preview),
        [draft, preview]
    )

    const selectedCategory = categories.find(
        (category) =>
            resolveEntityId(category._id) === resolvedDraft.categoryId
    )
    const filteredCategories = categories.filter(
        (category) => !category.isArchived && category.type === resolvedDraft.type
    )
    /**
     * Las clasificaciones de tarjeta se muestran aun con datos incompletos para
     * impedir que el texto termine como un gasto simple. Las recomendaciones se
     * mantienen no bloqueantes y usan el mismo orden de prioridad del dominio.
     */
    const orientation = useMemo(() => {
        const [suggestion] = detectCaptureIntents({
            text,
            draft,
            commitments,
            currentPeriod,
            learnedCommitmentCandidates,
            creditCards,
            selectedCardAccountId,
            dismissedSubjects: [...dismissedSubjects, ...sessionDismissedSubjects],
        })

        if (suggestion?.card) return suggestion
        if (localIssues(draft).length > 0) return null
        return suggestion ?? null
    }, [
        text,
        draft,
        commitments,
        currentPeriod,
        learnedCommitmentCandidates,
        creditCards,
        selectedCardAccountId,
        dismissedSubjects,
        sessionDismissedSubjects,
    ])

    const cardPurchaseFields =
        orientation?.draft?.kind === 'card_purchase'
            ? orientation.draft.fields
            : undefined
    const effectiveCardAccountId =
        selectedCardAccountId ?? cardPurchaseFields?.cardAccountId ?? orientation?.card?.accountId
    const effectiveFirstClosingMonth =
        cardFirstClosingMonth ?? cardPurchaseFields?.firstClosingMonth
    const selectedAccount = accounts.find(
        (account) =>
            resolveEntityId(account._id) ===
            (orientation?.card ? effectiveCardAccountId : resolvedDraft.accountId)
    )
    const orientationCardAccounts = orientation?.card
        ? accounts.filter(
            (account) =>
                account.type === 'credit_card' &&
                account.isActive !== false &&
                orientation.card?.candidateAccountIds.includes(
                    resolveEntityId(account._id)
                ) &&
                supportsCurrency(account, resolvedDraft.currency)
        )
        : []
    const clientIssues = cardPurchaseFields
        ? localIssues({
            ...draft,
            accountId: effectiveCardAccountId,
            description: cardPurchaseFields.description ?? draft.description,
        })
        : orientation?.card
            ? []
            : localIssues(draft)
    const previewPayload = useMemo(() => {
        if (cardPurchaseFields) {
            return {
                type: 'credit_card_expense',
                amount: cardPurchaseFields.amount,
                currency: cardPurchaseFields.currency ?? draft.currency,
                date: cardPurchaseFields.date ?? draft.date.toISOString(),
                description: cardPurchaseFields.description ?? draft.description,
                categoryId: cardPurchaseFields.categoryId ?? draft.categoryId,
                merchant: cardPurchaseFields.merchant ?? draft.merchant,
                sourceAccountId: effectiveCardAccountId,
            }
        }
        if (orientation?.card) return null
        return buildPayload(draft)
    }, [
        cardPurchaseFields,
        draft,
        effectiveCardAccountId,
        orientation?.card,
    ])
    const issues = clientIssues.length > 0 ? clientIssues : preview?.issues ?? []
    const blockingIssues = issues.filter((issue) => issue.severity === 'error')
    const warnings = issues.filter((issue) => issue.severity === 'warning')
    const hasCurrencyConflict = issues.some((issue) =>
        issue.code === 'SOURCE_ACCOUNT_CURRENCY_UNSUPPORTED' ||
        issue.code === 'DESTINATION_ACCOUNT_CURRENCY_UNSUPPORTED'
    )
    const compatibleAccounts = simpleAccounts.filter((account) =>
        resolveEntityId(account._id) !== resolvedDraft.accountId &&
        supportsCurrency(account, resolvedDraft.currency)
    )
    const hasDuplicate = Boolean(preview?.duplicate)
    const canSubmit =
        !submitting &&
        !previewing &&
        !orientation?.card &&
        clientIssues.length === 0 &&
        preview?.valid === true &&
        blockingIssues.length === 0 &&
        (!hasDuplicate || duplicateConfirmed)

    const reset = useCallback(() => {
        setText('')
        setOverrides({})
        setPreview(undefined)
        setDismissedSuggestions([])
        setDuplicateConfirmed(false)
        setShowManualDetails(false)
        setShowLearningIntro(false)
        setDismissedPersonalizationKeys([])
        setSelectedCardAccountId(undefined)
        setCardFirstClosingMonth(undefined)
        setLearnedCommitmentCandidates([])
        learnedCandidatesRequestedRef.current = false
        setSubmitting(false)
        spaceCompletionRef.current = null
    }, [])

    const flushLearningEvents = useCallback(async (keepalive = false) => {
        if (!learningEnabledRef.current) {
            learningEventQueueRef.current = []
            return
        }
        const events = learningEventQueueRef.current.splice(0, 50)
        if (events.length === 0) return
        if (learningFlushTimerRef.current !== null) {
            window.clearTimeout(learningFlushTimerRef.current)
            learningFlushTimerRef.current = null
        }
        try {
            const response = await fetch('/api/quick-capture/learning/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events }),
                keepalive,
            })
            if (!response.ok && !keepalive) {
                learningEventQueueRef.current.unshift(...events)
            }
        } catch {
            if (!keepalive) learningEventQueueRef.current.unshift(...events)
        }
    }, [])

    const queueLearningEvent = useCallback((
        event: Omit<QuickCaptureLearningEventInput, 'eventId' | 'sessionId'>
    ) => {
        if (!learningEnabledRef.current) return
        const sessionId =
            learningSessionIdRef.current ||
            `capture:${createClientEventId()}`
        learningSessionIdRef.current = sessionId
        learningEventQueueRef.current.push({
            ...event,
            eventId: createClientEventId(),
            sessionId,
        })
        if (learningEventQueueRef.current.length >= 10) {
            void flushLearningEvents()
            return
        }
        if (learningFlushTimerRef.current !== null) {
            window.clearTimeout(learningFlushTimerRef.current)
        }
        learningFlushTimerRef.current = window.setTimeout(() => {
            void flushLearningEvents()
        }, 900)
    }, [flushLearningEvents])

    useEffect(() => () => {
        if (learningFlushTimerRef.current !== null) {
            window.clearTimeout(learningFlushTimerRef.current)
            learningFlushTimerRef.current = null
        }
        void flushLearningEvents(true)
    }, [flushLearningEvents])

    const loadContext = useCallback(async () => {
        setContextLoading(true)
        try {
            const response = await fetch('/api/quick-capture/context', { cache: 'no-store' })
            if (!response.ok) throw new Error('No se pudo cargar la captura rápida')
            const data = await response.json() as QuickCaptureContextResponse
            const migrationCompleted =
                typeof window !== 'undefined' &&
                localStorage.getItem(MIGRATION_KEY) === 'done'
            const storedAliases = migrationCompleted
                ? []
                : getStoredDescriptionAliases()
            if (migrationCompleted) clearStoredDescriptionAliases()
            const now = new Date().toISOString()
            const legacyAliases: QuickCaptureAliasDto[] = storedAliases.flatMap((alias) => {
                const normalizedTerm = normalizeQuickCaptureTerm(alias.term)
                const entries: QuickCaptureAliasDto[] = [{
                    _id: `legacy-description:${normalizedTerm}`,
                    term: alias.term,
                    normalizedTerm,
                    targetType: 'description',
                    targetValue: alias.description,
                    targetLabel: alias.description,
                    usageCount: 0,
                    createdAt: now,
                    updatedAt: now,
                }]
                if (alias.merchant) {
                    entries.push({
                        _id: `legacy-merchant:${normalizedTerm}`,
                        term: alias.term,
                        normalizedTerm,
                        targetType: 'merchant',
                        targetValue: alias.merchant,
                        targetLabel: alias.merchant,
                        usageCount: 0,
                        createdAt: now,
                        updatedAt: now,
                    })
                }
                return entries
            })
            setAliases([
                ...data.aliases,
                ...legacyAliases.filter((legacy) =>
                    !data.aliases.some((alias) =>
                        alias.normalizedTerm === legacy.normalizedTerm &&
                        alias.targetType === legacy.targetType
                    )
                ),
            ])
            setFrequents(data.frequents)
            setLearning(data.learning)
            setCommitments(data.commitments ?? [])
            setCurrentPeriod(data.currentPeriod)
            setDismissedSubjects(data.dismissedSuggestions ?? [])
            learningEnabledRef.current = data.learning?.profile.enabled !== false

            if (!migrationCompleted) {
                const migrated = await Promise.allSettled(
                    storedAliases.flatMap((alias) => {
                        const requests = [
                            fetch('/api/quick-capture/aliases', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    term: alias.term,
                                    targetType: 'description',
                                    targetValue: alias.description,
                                }),
                            }).then((migrationResponse) => {
                                if (!migrationResponse.ok) {
                                    throw new Error('No se pudo migrar un atajo local')
                                }
                                return migrationResponse
                            }),
                        ]
                        if (alias.merchant) {
                            requests.push(fetch('/api/quick-capture/aliases', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    term: alias.term,
                                    targetType: 'merchant',
                                    targetValue: alias.merchant,
                                }),
                            }).then((migrationResponse) => {
                                if (!migrationResponse.ok) {
                                    throw new Error('No se pudo migrar un comercio local')
                                }
                                return migrationResponse
                            }))
                        }
                        return requests
                    })
                )
                if (migrated.every((result) => result.status === 'fulfilled')) {
                    localStorage.setItem(MIGRATION_KEY, 'done')
                    clearStoredDescriptionAliases()
                    const refreshed = await fetch('/api/quick-capture/context', {
                        cache: 'no-store',
                    })
                    if (refreshed.ok) {
                        const refreshedData = await refreshed.json() as QuickCaptureContextResponse
                        setAliases(refreshedData.aliases)
                        setLearning(refreshedData.learning)
                    }
                }
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo iniciar la captura')
        } finally {
            setContextLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!open) return
        learnedCandidatesRequestedRef.current = false
        setLearnedCommitmentCandidates([])
        learningSessionIdRef.current = `capture:${createClientEventId()}`
        learningOpenedAtRef.current = Date.now()
        learningCompletedRef.current = false
        shownSuggestionKeysRef.current.clear()
        queueLearningEvent({
            type: 'capture_opened',
            method: 'automatic',
        })
        void loadContext()
        requestAnimationFrame(() => inputRef.current?.focus())
    }, [loadContext, open, queueLearningEvent])

    useEffect(() => {
        if (
            !open ||
            text.trim().length < 3 ||
            learnedCandidatesRequestedRef.current
        ) {
            return
        }

        const timer = window.setTimeout(() => {
            learnedCandidatesRequestedRef.current = true
            void fetch('/api/commitments/suggestions', { cache: 'no-store' })
                .then(async (response) => {
                    if (!response.ok) throw new Error('No se pudieron cargar candidatos')
                    return response.json() as Promise<{ suggestions?: CommitmentSuggestion[] }>
                })
                .then((data) => setLearnedCommitmentCandidates(data.suggestions ?? []))
                .catch(() => {
                    // La orientación aprendida es una mejora: no bloquea la captura.
                })
        }, 250)

        return () => window.clearTimeout(timer)
    }, [open, text])

    useEffect(() => {
        if (
            !open ||
            !learning?.profile.enabled ||
            learning.profile.introSeenAt ||
            learning.patterns.length === 0
        ) {
            return
        }
        setShowLearningIntro(true)
        setLearning((current) => current ? {
            ...current,
            profile: {
                ...current.profile,
                introSeenAt: new Date().toISOString(),
            },
        } : current)
        void fetch('/api/quick-capture/learning/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markIntroSeen: true }),
        })
    }, [learning, open])

    useEffect(() => {
        if (!open || !learning?.profile.enabled) return
        activeSuggestions.forEach((suggestion, position) => {
            const fingerprint = [
                learningSessionIdRef.current,
                suggestion.id,
                normalizeQuickCaptureTerm(text),
            ].join('|')
            if (shownSuggestionKeysRef.current.has(fingerprint)) return
            shownSuggestionKeysRef.current.add(fingerprint)
            queueLearningEvent({
                type: 'suggestion_shown',
                method: suggestion.autoApplicable ? 'automatic' : undefined,
                inputTerms: text.split(/\s+/),
                transactionType: draft.type,
                currency: draft.currency,
                suggestionId: suggestion.id,
                patternKey: suggestion.patternKey,
                source: suggestion.source,
                targetType: suggestion.targetType,
                targetId: suggestion.targetId,
                targetValue: suggestion.targetValue,
                confidence: suggestion.confidence,
                position,
            })
        })
        activePersonalizations.forEach((personalization, index) => {
            const suggestionId =
                `personalization:${personalization.patternKey}`
            const fingerprint = [
                learningSessionIdRef.current,
                suggestionId,
                normalizeQuickCaptureTerm(text),
            ].join('|')
            if (shownSuggestionKeysRef.current.has(fingerprint)) return
            shownSuggestionKeysRef.current.add(fingerprint)
            queueLearningEvent({
                type: 'suggestion_shown',
                method: 'automatic',
                inputTerms: text.split(/\s+/),
                transactionType: draft.type,
                currency: draft.currency,
                suggestionId,
                patternKey: personalization.patternKey,
                source: 'learned',
                targetType: personalization.targetType,
                targetId: personalization.targetId,
                targetValue: personalization.targetValue,
                confidence: personalization.confidence,
                position: activeSuggestions.length + index,
            })
        })
    }, [
        activePersonalizations,
        activeSuggestions,
        draft.currency,
        draft.type,
        learning?.profile.enabled,
        open,
        queueLearningEvent,
        text,
    ])

    useEffect(() => {
        if (!open || !orientation) return
        const fingerprint = [
            learningSessionIdRef.current,
            'intent',
            orientation.intent,
            orientation.subjectKey,
        ].join('|')
        if (shownSuggestionKeysRef.current.has(fingerprint)) return
        shownSuggestionKeysRef.current.add(fingerprint)
        queueLearningEvent({
            type: 'intent_detected',
            method: 'automatic',
            suggestionId: orientation.intent,
            transactionType: draft.type,
            currency: draft.currency,
        })
    }, [draft.currency, draft.type, open, orientation, queueLearningEvent])

    useEffect(() => {
        if (!open || clientIssues.length > 0 || !previewPayload) {
            setPreview(undefined)
            setPreviewing(false)
            return
        }

        const controller = new AbortController()
        setPreview(undefined)
        setPreviewing(true)
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch('/api/transactions/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(previewPayload),
                    signal: controller.signal,
                })
                if (!response.ok) throw new Error('No se pudo validar la captura')
                const result = await response.json() as TransactionPreviewResponse
                setPreview(result)
                setDuplicateConfirmed(false)
            } catch (error) {
                if (controller.signal.aborted) return
                setPreview({
                    valid: false,
                    issues: [{
                        code: 'PREVIEW_UNAVAILABLE',
                        message: error instanceof Error
                            ? error.message
                            : 'No se pudo validar la captura.',
                        severity: 'error',
                    }],
                })
            } finally {
                if (!controller.signal.aborted) setPreviewing(false)
            }
        }, 280)

        return () => {
            controller.abort()
            window.clearTimeout(timer)
        }
    }, [clientIssues.length, open, previewPayload])

    function applySuggestion(
        suggestion: QuickCaptureSuggestion,
        options: {
            appendSpace?: boolean
            method?: QuickCaptureLearningMethod
        } = {}
    ) {
        queueLearningEvent({
            type: 'suggestion_accepted',
            method: options.method ?? 'tap',
            inputTerms: text.split(/\s+/),
            transactionType: draft.type,
            currency: draft.currency,
            suggestionId: suggestion.id,
            patternKey: suggestion.patternKey,
            source: suggestion.source,
            targetType: suggestion.targetType,
            targetId: suggestion.targetId,
            targetValue: suggestion.targetValue,
            confidence: suggestion.confidence,
        })
        if (!options.appendSpace) spaceCompletionRef.current = null
        const completeText = () => {
            setText((current) => {
                const replacement = `${
                    suggestion.targetValue ?? suggestion.targetLabel
                }${options.appendSpace ? ' ' : ''}`
                const nextText = replaceQuickCaptureRange(
                    current,
                    suggestion.start,
                    suggestion.end,
                    replacement
                )
                if (options.appendSpace) {
                    spaceCompletionRef.current = {
                        beforeText: current,
                        afterText: nextText,
                        suggestionId: suggestion.id,
                        patternKey: suggestion.patternKey,
                        source: suggestion.source,
                        targetType: suggestion.targetType,
                        targetId: suggestion.targetId,
                        targetValue: suggestion.targetValue,
                        confidence: suggestion.confidence,
                    }
                }
                requestAnimationFrame(() => {
                    inputRef.current?.focus()
                    const caretPosition =
                        suggestion.start + replacement.length
                    inputRef.current?.setSelectionRange(
                        caretPosition,
                        caretPosition
                    )
                })
                return nextText
            })
        }
        if (suggestion.targetType === 'account') {
            setOverrides((current) => ({ ...current, accountId: suggestion.targetId }))
            if (options.appendSpace) {
                completeText()
            } else if (!suggestion.preserveSourceText) {
                setText((current) =>
                    replaceQuickCaptureRange(current, suggestion.start, suggestion.end, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim()
                )
            }
        } else if (suggestion.targetType === 'category') {
            setOverrides((current) => ({ ...current, categoryId: suggestion.targetId }))
            if (!suggestion.preserveSourceText) {
                setText((current) =>
                    replaceQuickCaptureRange(current, suggestion.start, suggestion.end, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim()
                )
            }
        } else if (suggestion.targetType === 'merchant') {
            setOverrides((current) => ({ ...current, merchant: suggestion.targetValue }))
            if (!suggestion.preserveSourceText) {
                setText((current) =>
                    replaceQuickCaptureRange(current, suggestion.start, suggestion.end, '')
                        .replace(/\s{2,}/g, ' ')
                        .trim()
                )
            }
        } else if (suggestion.targetType === 'description') {
            completeText()
        }
        setDismissedSuggestions((current) => [...current, suggestion.id])
    }

    function dismissSuggestion(
        suggestion: QuickCaptureSuggestion,
        method: QuickCaptureLearningMethod
    ) {
        queueLearningEvent({
            type: 'suggestion_dismissed',
            method,
            inputTerms: text.split(/\s+/),
            transactionType: draft.type,
            currency: draft.currency,
            suggestionId: suggestion.id,
            patternKey: suggestion.patternKey,
            source: suggestion.source,
            targetType: suggestion.targetType,
            targetId: suggestion.targetId,
            targetValue: suggestion.targetValue,
            confidence: suggestion.confidence,
        })
        setDismissedSuggestions((current) =>
            current.includes(suggestion.id)
                ? current
                : [...current, suggestion.id]
        )
    }

    function dismissPersonalization(
        personalization: (typeof activePersonalizations)[number]
    ) {
        queueLearningEvent({
            type: 'suggestion_dismissed',
            method: 'tap',
            inputTerms: text.split(/\s+/),
            transactionType: draft.type,
            currency: draft.currency,
            patternKey: personalization.patternKey,
            source: 'learned',
            targetType: personalization.targetType,
            targetId: personalization.targetId,
            targetValue: personalization.targetValue,
            confidence: personalization.confidence,
        })
        setDismissedPersonalizationKeys((current) =>
            current.includes(personalization.patternKey)
                ? current
                : [...current, personalization.patternKey]
        )
    }

    function setPersonalizedOverride(
        field: 'accountId' | 'categoryId' | 'merchant',
        value: string | undefined
    ) {
        const targetType =
            field === 'accountId'
                ? 'account'
                : field === 'categoryId'
                    ? 'category'
                    : 'merchant'
        const personalization = activePersonalizations.find(
            (item) => item.targetType === targetType
        )
        if (personalization) {
            queueLearningEvent({
                type: 'field_corrected',
                method: 'manual',
                inputTerms: text.split(/\s+/),
                transactionType: draft.type,
                currency: draft.currency,
                patternKey: personalization.patternKey,
                source: 'learned',
                targetType,
                targetId: personalization.targetId,
                targetValue: personalization.targetValue,
                confidence: personalization.confidence,
            })
            setDismissedPersonalizationKeys((current) =>
                current.includes(personalization.patternKey)
                    ? current
                    : [...current, personalization.patternKey]
            )
        }
        setOverrides((current) => ({ ...current, [field]: value }))
    }

    function restoreDismissedCompletion(record: NonNullable<
        typeof spaceCompletionRef.current
    >) {
        queueLearningEvent({
            type: 'suggestion_reverted',
            method: 'double_space',
            inputTerms: record.beforeText.split(/\s+/),
            transactionType: draft.type,
            currency: draft.currency,
            suggestionId: record.suggestionId,
            patternKey: record.patternKey,
            source: record.source,
            targetType: record.targetType,
            targetId: record.targetId,
            targetValue: record.targetValue,
            confidence: record.confidence,
        })
        const restoredText = `${record.beforeText.trimEnd()} `
        spaceCompletionRef.current = null
        setText(restoredText)
        setOverrides({})
        setDismissedSuggestions((current) =>
            current.includes(record.suggestionId)
                ? current
                : [...current, record.suggestionId]
        )
        requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.setSelectionRange(
                restoredText.length,
                restoredText.length
            )
        })
    }

    function handleInputChange(nextText: string, inputType?: string) {
        const spaceCompletion = spaceCompletionRef.current
        if (
            spaceCompletion &&
            nextText === `${spaceCompletion.afterText} ` &&
            (!inputType || inputType === 'insertText')
        ) {
            restoreDismissedCompletion(spaceCompletion)
            return
        }

        const insertedSpaceAfterCurrentText =
            inlineCompletion &&
            nextText === `${text} ` &&
            (!inputType || inputType === 'insertText')

        if (insertedSpaceAfterCurrentText) {
            applySuggestion(inlineCompletion.suggestion, {
                appendSpace: true,
                method: 'space',
            })
            return
        }

        spaceCompletionRef.current = null
        setText(nextText)
        setOverrides({})
        setDismissedSuggestions([])
        setSelectedCardAccountId(undefined)
        setCardFirstClosingMonth(undefined)
    }

    async function persistSuggestion(suggestion: QuickCaptureSuggestion) {
        setSavingSuggestionId(suggestion.id)
        try {
            const response = await fetch('/api/quick-capture/aliases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    term: suggestion.sourceText,
                    targetType: suggestion.targetType,
                    targetId: suggestion.targetId,
                    targetValue: suggestion.targetValue,
                }),
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo guardar el atajo')
            }
            setAliases((current) => [
                result.alias as QuickCaptureAliasDto,
                ...current.filter((alias) => alias._id !== result.alias._id),
            ])
            applySuggestion(suggestion, { method: 'always' })
            toast.success(`Desde ahora “${suggestion.sourceText}” será ${suggestion.targetLabel}`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar el atajo')
        } finally {
            setSavingSuggestionId(undefined)
        }
    }

    function toFullFormDraft(): CaptureTransactionLaunchDraft {
        return {
            type: resolvedDraft.type,
            amount: resolvedDraft.amount,
            currency: resolvedDraft.currency,
            date: resolvedDraft.date,
            description: resolvedDraft.description,
            categoryId: resolvedDraft.categoryId,
            merchant: resolvedDraft.merchant,
            sourceAccountId:
                resolvedDraft.type === 'expense' ? resolvedDraft.accountId : undefined,
            destinationAccountId:
                resolvedDraft.type === 'income' ? resolvedDraft.accountId : undefined,
        }
    }

    function completeDetails() {
        const completeDraft = toFullFormDraft()
        learningCompletedRef.current = true
        queueLearningEvent({
            type: 'capture_handoff',
            method: 'handoff',
            inputTerms: text.split(/\s+/),
            transactionType: draft.type,
            currency: draft.currency,
            accountId: draft.accountId,
            categoryId: draft.categoryId,
            merchantTerm: draft.merchant,
            durationMs: Date.now() - learningOpenedAtRef.current,
        })
        void flushLearningEvents(true)
        onOpenChange(false)
        onCompleteDetails(completeDraft)
    }

    /**
     * Abre y cierra la galería de ejemplos. Abrirla marca la intro como vista:
     * el usuario ya conoció las capacidades y no hace falta volver a anunciarlas.
     */
    function toggleHelp() {
        const next = !helpOpen
        setHelpOpen(next)
        if (next) markCaptureIntroSeen()
    }

    function markCaptureIntroSeen() {
        if (captureIntroSeenRef.current) return
        captureIntroSeenRef.current = true
        setCaptureIntroDismissed(true)
        // Best-effort: si falla, la intro vuelve a aparecer. No bloquea nada.
        void fetch('/api/quick-capture/learning/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markCaptureIntroSeen: true }),
        }).catch(() => {})
    }

    /**
     * Resuelve una propuesta de orientación.
     *
     * `apply_commitment` se confirma acá porque reutiliza las mismas validaciones
     * financieras y de período del servicio de Compromisos. `create_commitment`
     * deriva: configurar una plantilla es responsabilidad de su página.
     */
    async function handleOrientationAction(actionId: FunctionalSuggestionActionId) {
        const suggestion = orientation
        if (!suggestion) return

        setOrientationError(null)

        if (actionId === 'dismiss' || actionId === 'record_simple') {
            setSessionDismissedSubjects((current) => [...current, suggestion.subjectKey])
            queueLearningEvent({
                type: 'intent_dismissed',
                method: actionId === 'record_simple' ? 'submit' : 'tap',
                suggestionId: suggestion.intent,
                inputTerms: text.split(/\s+/),
                transactionType: draft.type,
                currency: draft.currency,
            })
            return
        }

        if (actionId === 'never') {
            if (suggestion.canPersistDismissal === false) return
            setSessionDismissedSubjects((current) => [...current, suggestion.subjectKey])
            setDismissedSubjects((current) => [...current, suggestion.subjectKey])
            queueLearningEvent({
                type: 'intent_dismissed',
                method: 'never',
                suggestionId: suggestion.intent,
            })
            // Best-effort: si falla, la propuesta vuelve en la próxima sesión.
            void fetch('/api/quick-capture/suggestions/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    intent: suggestion.intent,
                    subjectKey: suggestion.subjectKey,
                }),
            }).catch(() => {})
            return
        }

        queueLearningEvent({
            type: 'intent_accepted',
            method: suggestion.intent === 'apply_commitment' ? 'submit' : 'derive',
            suggestionId: suggestion.intent,
            inputTerms: text.split(/\s+/),
            transactionType: draft.type,
            currency: draft.currency,
        })

        if (suggestion.card) {
            const cardAccountId =
                selectedCardAccountId ??
                suggestion.card.accountId ??
                (suggestion.draft?.kind === 'card_purchase'
                    ? suggestion.draft.fields.cardAccountId
                    : suggestion.draft?.kind === 'card_payment'
                        ? suggestion.draft.fields.destinationAccountId
                        : undefined)

            if (
                suggestion.card.operation !== 'existing_installment' &&
                !cardAccountId
            ) {
                setOrientationError('Elegí la tarjeta para continuar.')
                return
            }

            if (suggestion.draft?.kind === 'card_review') {
                learningCompletedRef.current = true
                queueLearningEvent({
                    type: 'capture_handoff',
                    method: 'handoff',
                    suggestionId: suggestion.intent,
                })
                void flushLearningEvents(true)
                onOpenChange(false)
                router.push(suggestion.draft.fields.href)
                return
            }

            if (suggestion.draft?.kind === 'card_payment') {
                const fields = suggestion.draft.fields
                const handoff: CaptureTransactionLaunchDraft = {
                    type: 'credit_card_payment',
                    amount: fields.amount,
                    currency: fields.currency ?? resolvedDraft.currency,
                    date: fields.date ? new Date(fields.date) : resolvedDraft.date,
                    description: fields.description ?? 'Pago de tarjeta',
                    destinationAccountId: cardAccountId,
                    origin: 'quick_capture',
                    captureIntent: suggestion.intent,
                    captureSessionId: learningSessionIdRef.current,
                    allowPotentialDuplicate: duplicateConfirmed,
                    requireSourceAccountSelection: true,
                }
                learningCompletedRef.current = true
                queueLearningEvent({
                    type: 'capture_handoff',
                    method: 'handoff',
                    suggestionId: suggestion.intent,
                })
                void flushLearningEvents(true)
                onOpenChange(false)
                onCompleteDetails(handoff)
                return
            }

            if (suggestion.draft?.kind === 'card_purchase') {
                const fields = suggestion.draft.fields
                const amount = fields.amount ?? resolvedDraft.amount
                const description =
                    fields.description ?? resolvedDraft.description
                const installmentCount =
                    fields.installmentCount ?? suggestion.card.installmentCount ?? 1
                const firstClosingMonth =
                    cardFirstClosingMonth ??
                    fields.firstClosingMonth ??
                    suggestion.card.firstClosingMonth

                if (!amount || amount <= 0) {
                    setOrientationError('Ingresá el monto de la compra.')
                    return
                }
                if (!description.trim()) {
                    setOrientationError('Ingresá una descripción para la compra.')
                    return
                }
                if (!firstClosingMonth) {
                    setOrientationError('Elegí el mes de la primera cuota.')
                    return
                }

                if (installmentCount > 1) {
                    const handoff: CaptureTransactionLaunchDraft = {
                        type: 'credit_card_expense',
                        amount,
                        currency: fields.currency ?? resolvedDraft.currency,
                        date: fields.date ? new Date(fields.date) : resolvedDraft.date,
                        description,
                        categoryId: fields.categoryId ?? resolvedDraft.categoryId,
                        merchant: fields.merchant ?? resolvedDraft.merchant,
                        sourceAccountId: cardAccountId,
                        installmentCount,
                        firstClosingMonth,
                        origin: 'quick_capture',
                        captureIntent: suggestion.intent,
                        captureSessionId: learningSessionIdRef.current,
                        allowPotentialDuplicate: duplicateConfirmed,
                    }
                    learningCompletedRef.current = true
                    queueLearningEvent({
                        type: 'capture_handoff',
                        method: 'handoff',
                        suggestionId: suggestion.intent,
                    })
                    void flushLearningEvents(true)
                    onOpenChange(false)
                    onCompleteDetails(handoff)
                    return
                }

                if (preview?.duplicate && !duplicateConfirmed) {
                    setOrientationError(
                        'Confirmá que querés registrar esta posible compra duplicada.'
                    )
                    return
                }
                if (preview && !preview.valid) {
                    setOrientationError(
                        preview.issues[0]?.message ?? 'Revisá los datos de la compra.'
                    )
                    return
                }

                setOrientationBusy(true)
                try {
                    const result = await apiJson<{
                        transaction?: { _id?: unknown }
                    }>('/api/installments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            description,
                            totalAmount: amount,
                            currency: fields.currency ?? resolvedDraft.currency,
                            installmentCount: 1,
                            accountId: cardAccountId,
                            categoryId: fields.categoryId ?? resolvedDraft.categoryId,
                            purchaseDate:
                                fields.date ?? resolvedDraft.date.toISOString(),
                            firstClosingMonth,
                            merchant: fields.merchant ?? resolvedDraft.merchant,
                            quickCapture: true,
                            allowPotentialDuplicate: duplicateConfirmed,
                            quickCaptureLearning: {
                                sessionId: learningSessionIdRef.current,
                                durationMs:
                                    Date.now() - learningOpenedAtRef.current,
                            },
                        }),
                    })
                    const transactionId = result.transaction?._id
                        ? String(result.transaction._id)
                        : undefined
                    queueLearningEvent({
                        type: 'intent_completed',
                        method: 'submit',
                        suggestionId: suggestion.intent,
                        transactionId,
                        durationMs: Date.now() - learningOpenedAtRef.current,
                    })
                    learningCompletedRef.current = true
                    await flushLearningEvents()
                    invalidateData([
                        ...TRANSACTION_INVALIDATION_TAGS,
                        'credit-card-expenses',
                        'projection',
                    ])
                    onOpenChange(false)
                    reset()
                    toast.success('Compra con tarjeta registrada', {
                        duration: 8_000,
                        description: `${description} · ${formatMoney(
                            amount,
                            fields.currency ?? resolvedDraft.currency
                        )}`,
                        action: transactionId
                            ? {
                                label: 'Deshacer',
                                onClick: async () => {
                                    try {
                                        await apiJson(
                                            `/api/transactions/${transactionId}?reason=quick_capture_undo`,
                                            { method: 'DELETE' }
                                        )
                                        invalidateData([
                                            ...TRANSACTION_INVALIDATION_TAGS,
                                            'credit-card-expenses',
                                            'projection',
                                        ])
                                        toast.success('Compra deshecha')
                                    } catch (error) {
                                        toast.error(
                                            error instanceof Error
                                                ? error.message
                                                : 'No se pudo deshacer la compra'
                                        )
                                    }
                                },
                            }
                            : undefined,
                    })
                } catch (error) {
                    setOrientationError(
                        error instanceof Error
                            ? error.message
                            : 'No se pudo registrar la compra.'
                    )
                } finally {
                    setOrientationBusy(false)
                }
                return
            }
        }

        if (suggestion.intent === 'create_commitment') {
            // El sobre viaja por sessionStorage; en la URL sólo va su id.
            const commitmentDraft =
                suggestion.draft?.kind === 'commitment'
                    ? suggestion.draft
                    : undefined
            const envelope = buildCaptureDraft<CommitmentDraftFields>({
                intent: 'create_commitment',
                sessionId: learningSessionIdRef.current,
                fields: commitmentDraft?.fields ?? suggestion.draftFields ?? {},
                provenance:
                    commitmentDraft?.provenance ??
                    suggestion.draftProvenance ??
                    {},
                confidence: suggestion.confidence,
            })
            putCaptureDraft(envelope)

            // Aceptar el CTA no es completar la función: `intent_completed` lo
            // emite Compromisos cuando la plantilla realmente se crea.
            learningCompletedRef.current = true
            void flushLearningEvents(true)
            onOpenChange(false)
            router.push(`/commitments?draft=${envelope.draftId}`)
            return
        }

        if (suggestion.intent === 'apply_commitment' && suggestion.commitment) {
            const commitment = suggestion.commitment
            const accountId = resolvedDraft.accountId ?? commitment.accountId

            if (!accountId) {
                setOrientationError('Elegí la cuenta de la que sale el dinero.')
                return
            }

            const amount = resolvedDraft.amount ?? commitment.resolvedAmount
            if (!amount || amount <= 0) {
                setOrientationError('Ingresá el monto de este período.')
                return
            }

            setOrientationBusy(true)
            try {
                await apiJson(`/api/commitments/${commitment.commitmentId}/apply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        period: commitment.period,
                        amount,
                        accountId,
                        date: toDateInputValue(resolvedDraft.date),
                        origin: 'quick_capture',
                    }),
                })

                invalidateData(COMMITMENT_INVALIDATION_TAGS)
                queueLearningEvent({
                    type: 'intent_completed',
                    method: 'submit',
                    suggestionId: suggestion.intent,
                    durationMs: Date.now() - learningOpenedAtRef.current,
                })
                learningCompletedRef.current = true
                void flushLearningEvents(true)
                onAppliedCommitment?.(commitment.description, commitment.period)
                onOpenChange(false)
            } catch (err) {
                // El texto y la propuesta se conservan: la derivación falló, no la captura.
                setOrientationError(
                    err instanceof Error ? err.message : 'No se pudo aplicar el compromiso.'
                )
            } finally {
                setOrientationBusy(false)
            }
        }
    }

    async function submit() {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...buildPayload(draft),
                    quickCapture: true,
                    allowPotentialDuplicate: duplicateConfirmed,
                    quickCaptureLearning: {
                        sessionId: learningSessionIdRef.current,
                        durationMs: Date.now() - learningOpenedAtRef.current,
                        aliasIds: interpretation.appliedAliasIds ?? [],
                    },
                }),
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error ?? 'No se pudo registrar el movimiento')
            }
            const transactionId = resolveEntityId(result.transaction?._id)
            learningCompletedRef.current = true
            activePersonalizations.forEach((personalization) => {
                queueLearningEvent({
                    type: 'suggestion_accepted',
                    method: 'automatic',
                    inputTerms: text.split(/\s+/),
                    transactionType: draft.type,
                    currency: draft.currency,
                    patternKey: personalization.patternKey,
                    source: 'learned',
                    targetType: personalization.targetType,
                    targetId: personalization.targetId,
                    targetValue: personalization.targetValue,
                    confidence: personalization.confidence,
                    transactionId,
                })
            })
            await flushLearningEvents()
            invalidateData([
                ...TRANSACTION_INVALIDATION_TAGS,
                'rules',
                'projection',
            ])
            onOpenChange(false)
            reset()
            toast.success('Movimiento registrado', {
                duration: 8_000,
                description: `${resolvedDraft.description} · ${formatMoney(
                    resolvedDraft.amount ?? 0,
                    resolvedDraft.currency
                )}`,
                action: transactionId
                    ? {
                        label: 'Deshacer',
                        onClick: async () => {
                            try {
                                const undoResponse = await fetch(
                                    `/api/transactions/${transactionId}?reason=quick_capture_undo`,
                                    { method: 'DELETE' }
                                )
                                if (!undoResponse.ok) {
                                    const undoResult = await undoResponse.json()
                                    throw new Error(undoResult.error ?? 'No se pudo deshacer')
                                }
                                invalidateData([
                                    ...TRANSACTION_INVALIDATION_TAGS,
                                    'rules',
                                    'projection',
                                ])
                                toast.success('Movimiento deshecho')
                            } catch (error) {
                                toast.error(
                                    error instanceof Error
                                        ? error.message
                                        : 'No se pudo deshacer el movimiento'
                                )
                            }
                        },
                    }
                    : undefined,
            })
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo registrar')
            setSubmitting(false)
        }
    }

    function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.nativeEvent.isComposing) return
        const isCaretAtCompletion =
            event.currentTarget.selectionStart === event.currentTarget.selectionEnd &&
            event.currentTarget.selectionEnd >=
                (inlineCompletion?.suggestion.end ?? Number.POSITIVE_INFINITY)
        if (event.key === ' ' && inlineCompletion && isCaretAtCompletion) {
            event.preventDefault()
            applySuggestion(inlineCompletion.suggestion, {
                appendSpace: true,
                method: 'space',
            })
            return
        }
        if (event.key === 'Escape' && inlineCompletion) {
            event.preventDefault()
            spaceCompletionRef.current = null
            dismissSuggestion(inlineCompletion.suggestion, 'escape')
            return
        }
        if (event.key === 'Tab' && inlineCompletion && isCaretAtCompletion) {
            event.preventDefault()
            applySuggestion(inlineCompletion.suggestion, {
                appendSpace: true,
                method: 'tab',
            })
            return
        }
        if (event.key === 'Tab' && activeSuggestions[0]) {
            event.preventDefault()
            applySuggestion(activeSuggestions[0], { method: 'tab' })
            return
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            if (inlineCompletion && isCaretAtCompletion) {
                applySuggestion(inlineCompletion.suggestion, {
                    appendSpace: true,
                    method: 'enter',
                })
                return
            }
            if (activeSuggestions[0]) {
                applySuggestion(activeSuggestions[0], { method: 'enter' })
                return
            }
            if (orientation?.card) {
                void handleOrientationAction('primary')
                return
            }
            void submit()
        }
    }

    const summaryType = resolvedDraft.type
    const summaryDescription = resolvedDraft.description
    const summaryCategory = preview?.category?.name ?? selectedCategory?.name
    const summaryAccount = preview?.accountImpact?.accountName ?? selectedAccount?.name
    const summaryAmount = resolvedDraft.amount
    const summaryCurrency = resolvedDraft.currency
    const summaryDate = resolvedDraft.date

    function handleDialogOpenChange(nextOpen: boolean) {
        if (!nextOpen && !submitting && !learningCompletedRef.current) {
            queueLearningEvent({
                type: 'capture_abandoned',
                method: 'close',
                inputTerms: text.split(/\s+/),
                transactionType: draft.type,
                currency: draft.currency,
                accountId: draft.accountId,
                categoryId: draft.categoryId,
                merchantTerm: draft.merchant,
                durationMs: Date.now() - learningOpenedAtRef.current,
            })
            void flushLearningEvents(true)
        }
        onOpenChange(nextOpen)
        if (!nextOpen && !submitting) reset()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={handleDialogOpenChange}
        >
            <DialogContent
                className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
                aria-describedby="quick-capture-description"
            >
                <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-6 sm:py-4">
                    <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Sparkles className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <DialogTitle>Captura rápida</DialogTitle>
                            <DialogDescription id="quick-capture-description">
                                Escribí como te salga. Revisamos todo antes de guardar.
                            </DialogDescription>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-testid="capture-help-toggle"
                            aria-expanded={helpOpen}
                            className="shrink-0 text-xs text-muted-foreground"
                            onClick={toggleHelp}
                        >
                            <HelpCircle className="size-3.5" />
                            <span className="hidden sm:inline">¿Qué puedo escribir?</span>
                        </Button>
                    </div>
                </DialogHeader>

                {showCaptureIntro ? (
                    <div
                        data-testid="capture-intro"
                        className="flex shrink-0 items-start gap-2 border-b bg-violet-500/[0.055] px-4 py-2.5 sm:px-6"
                    >
                        <Wand2 className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">Escribí como hablás</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                Finp puede registrar un movimiento o guiarte hacia compromisos y tarjetas.
                                Probá con <em>Café 1500 ayer mp</em> o{' '}
                                <em>Alquiler 650000 el 5 de cada mes</em>.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
                            aria-label="Entendido"
                            onClick={markCaptureIntroSeen}
                        >
                            <X className="size-3" />
                        </Button>
                    </div>
                ) : null}

                {showLearningIntro ? (
                    <div className="flex shrink-0 items-start gap-2 border-b bg-primary/[0.045] px-4 py-2.5 sm:px-6">
                        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">
                                Finp aprende de tus movimientos confirmados
                            </p>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                                Con el uso prioriza mejor tus cuentas, categorías y comercios.
                                Podés revisar lo aprendido en Configuración.
                            </p>
                        </div>
                        <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="-mr-2 -mt-1 size-7"
                            aria-label="Cerrar explicación de aprendizaje"
                            onClick={() => setShowLearningIntro(false)}
                        >
                            <X />
                        </Button>
                    </div>
                ) : null}

                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="grid min-w-0 gap-4 p-3 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.85fr)] lg:gap-5">
                        <div className="min-w-0 space-y-3 sm:space-y-4">
                            <div className="rounded-2xl border bg-card p-3 shadow-sm">
                                <label htmlFor="quick-capture-input" className="sr-only">
                                    Describí el movimiento
                                </label>
                                <div className="relative">
                                    <div
                                        ref={inputMirrorRef}
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-0 z-0 min-h-16 overflow-hidden whitespace-pre-wrap break-words px-1 py-1 text-lg leading-relaxed sm:min-h-24 sm:text-xl"
                                    >
                                        <span className="text-transparent">{text}</span>
                                        {inlineCompletion ? (
                                            <span
                                                className="text-muted-foreground/45"
                                                data-testid="quick-capture-inline-completion"
                                            >
                                                {inlineCompletion.suffix}
                                            </span>
                                        ) : null}
                                    </div>
                                    <textarea
                                        ref={inputRef}
                                        id="quick-capture-input"
                                        value={text}
                                        onChange={(event) => {
                                            handleInputChange(
                                                event.target.value,
                                                (event.nativeEvent as InputEvent).inputType
                                            )
                                        }}
                                        onKeyDown={handleInputKeyDown}
                                        onScroll={(event) => {
                                            if (inputMirrorRef.current) {
                                                inputMirrorRef.current.scrollTop =
                                                    event.currentTarget.scrollTop
                                                inputMirrorRef.current.scrollLeft =
                                                    event.currentTarget.scrollLeft
                                            }
                                        }}
                                        rows={2}
                                        placeholder="Ej: Café 1500 ayer mp"
                                        className="relative z-10 min-h-16 w-full resize-none bg-transparent px-1 py-1 text-lg leading-relaxed outline-none placeholder:text-muted-foreground/65 sm:min-h-24 sm:text-xl"
                                        autoComplete="off"
                                        spellCheck={false}
                                        aria-describedby="quick-capture-input-hint"
                                    />
                                </div>
                                <div className="flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
                                    {inlineCompletion ? (
                                        <Button
                                            id="quick-capture-input-hint"
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="-mx-1 h-auto min-h-7 min-w-0 justify-start overflow-hidden px-1 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
                                            aria-label={`Completar ${inlineCompletion.target}`}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => applySuggestion(
                                                inlineCompletion.suggestion,
                                                {
                                                    appendSpace: true,
                                                    method: 'tap',
                                                }
                                            )}
                                        >
                                            <>
                                                <span className="sm:hidden">
                                                    Apretá Enter o Espacio para completar
                                                </span>
                                                <span className="hidden sm:inline">
                                                    Enter, Tab o Espacio para completar
                                                </span>
                                                {' '}
                                                <strong>“{inlineCompletion.target}”</strong>
                                            </>
                                        </Button>
                                    ) : (
                                        <span
                                            id="quick-capture-input-hint"
                                            className="min-w-0 truncate"
                                            aria-live="polite"
                                        >
                                            <>
                                                <span className="sm:hidden">
                                                    Enter acepta o registra
                                                </span>
                                                <span className="hidden sm:inline">
                                                    Tab o Enter acepta · después Enter registra
                                                </span>
                                            </>
                                        </span>
                                    )}
                                    <span className="hidden shrink-0 md:inline">
                                        Shift + Enter baja
                                    </span>
                                </div>
                            </div>

                            <TokenStrip text={text} tokens={interpretation.tokens} />

                            {activePersonalizations.length > 0 ? (
                                <div className="space-y-1.5" aria-live="polite">
                                    {activePersonalizations.map((personalization) => (
                                        <div
                                            key={personalization.patternKey}
                                            className="flex min-w-0 items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.035] px-3 py-2"
                                        >
                                            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <Badge variant="secondary">
                                                        Personalizada
                                                    </Badge>
                                                    <span className="text-xs font-medium">
                                                        {personalization.targetLabel}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                                    {personalization.reason}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                size="icon-sm"
                                                variant="ghost"
                                                className="-mr-1 -mt-1 size-7 shrink-0"
                                                aria-label={`No usar ${personalization.targetLabel} esta vez`}
                                                onClick={() =>
                                                    dismissPersonalization(personalization)
                                                }
                                            >
                                                <X />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {helpOpen ? (
                                <CaptureHelpPanel
                                    onClose={() => setHelpOpen(false)}
                                    onPickExample={(example) => {
                                        setHelpOpen(false)
                                        setText(example)
                                        inputRef.current?.focus()
                                    }}
                                />
                            ) : null}

                            {orientation ? (
                                <div className="space-y-2">
                                    {orientation.card &&
                                    orientation.card.operation !== 'existing_installment' ? (
                                        <div
                                            data-testid="quick-capture-card-fields"
                                            className="grid gap-3 rounded-xl border border-violet-500/20 bg-background p-3 sm:grid-cols-2"
                                        >
                                            <div className="space-y-1.5">
                                                <span className="text-xs font-medium text-muted-foreground">
                                                    Tarjeta
                                                </span>
                                                <Select
                                                    value={effectiveCardAccountId}
                                                    onValueChange={(accountId) => {
                                                        setSelectedCardAccountId(accountId)
                                                        setOrientationError(null)
                                                    }}
                                                >
                                                    <SelectTrigger
                                                        aria-label="Tarjeta"
                                                        data-testid="quick-capture-card-select"
                                                    >
                                                        <SelectValue placeholder="Elegí una tarjeta" />
                                                    </SelectTrigger>
                                                    <SelectContent position="popper">
                                                        {orientationCardAccounts.map((account) => (
                                                            <SelectItem
                                                                key={resolveEntityId(account._id)}
                                                                value={resolveEntityId(account._id)}
                                                            >
                                                                {account.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {orientation.card.operation === 'purchase' ? (
                                                <MonthPickerField
                                                    id="quick-capture-first-closing-month"
                                                    testId="quick-capture-first-closing-month"
                                                    label="Primera cuota"
                                                    value={effectiveFirstClosingMonth}
                                                    onValueChange={(value) => {
                                                        setCardFirstClosingMonth(value)
                                                        setOrientationError(null)
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <CaptureOrientationCard
                                        suggestion={orientation}
                                        busy={orientationBusy}
                                        error={orientationError}
                                        effectiveAmount={
                                            resolvedDraft.amount ??
                                            orientation.commitment?.resolvedAmount
                                        }
                                        accountName={selectedAccount?.name}
                                        onAction={(actionId) => {
                                            void handleOrientationAction(actionId)
                                        }}
                                    />
                                </div>
                            ) : null}

                            {text.trim() ? (
                                <div
                                    className="rounded-xl border bg-muted/35 p-3 lg:hidden"
                                    aria-live="polite"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                            Resumen
                                        </span>
                                        {previewing || contextLoading ? (
                                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                                        ) : preview?.valid ? (
                                            <Check className="size-3.5 text-emerald-600" />
                                        ) : null}
                                    </div>
                                    <p className="mt-1.5 text-sm leading-relaxed">
                                        {summaryType === 'income' ? 'Ingreso' : 'Gasto'}
                                        {summaryAmount ? ` de ${formatMoney(summaryAmount, summaryCurrency)}` : ''}
                                        {summaryDescription ? ` por “${summaryDescription}”` : ''}
                                        {summaryCategory ? ` en ${summaryCategory}` : ' sin categoría'}
                                        {` · ${formatCaptureDate(summaryDate)}`}
                                        {summaryAccount ? ` · ${summaryAccount}` : ''}
                                        {resolvedDraft.merchant
                                            ? ` · ${resolvedDraft.merchant}`
                                            : ''}
                                    </p>
                                    {preview?.appliedRule ? (
                                        <Badge variant="secondary" className="mt-2">
                                            <Sparkles />
                                            Regla: {preview.appliedRule.name}
                                        </Badge>
                                    ) : null}
                                </div>
                            ) : null}

                            {frequents.length > 0 && !text.trim() ? (
                                <section className="min-w-0 overflow-hidden" aria-label="Accesos frecuentes">
                                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                        Frecuentes
                                    </p>
                                    <div className="flex w-full min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1">
                                        {frequents.map((frequent) => (
                                            <button
                                                key={frequent.key}
                                                type="button"
                                                className="w-[min(12rem,82vw)] min-w-[min(12rem,82vw)] max-w-full snap-start rounded-xl border bg-background p-3 text-left transition-colors hover:bg-muted/60"
                                                onClick={() => {
                                                    setText(quickCaptureTextFromFrequent(frequent))
                                                    setOverrides({
                                                        type: frequent.type,
                                                        accountId: frequent.accountId,
                                                        categoryId: frequent.categoryId,
                                                        merchant: frequent.merchant,
                                                    })
                                                }}
                                            >
                                                <span className="block truncate text-sm font-medium">
                                                    {frequent.description}
                                                </span>
                                                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <CurrencyFlagIcon
                                                        currency={frequent.currency}
                                                        size="xs"
                                                    />
                                                    {formatMoney(frequent.amount, frequent.currency)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            ) : null}

                            {cardSuggestions.length > 0 ? (
                                <section className="space-y-2" aria-label="Sugerencias">
                                    {cardSuggestions.map((suggestion) => (
                                        <SuggestionCard
                                            key={suggestion.id}
                                            suggestion={suggestion}
                                            saving={savingSuggestionId === suggestion.id}
                                            onOnce={() => applySuggestion(
                                                suggestion,
                                                { method: 'tap' }
                                            )}
                                            onAlways={() => void persistSuggestion(suggestion)}
                                            onDismiss={() =>
                                                dismissSuggestion(suggestion, 'tap')
                                            }
                                        />
                                    ))}
                                </section>
                            ) : null}

                            {interpretation.unresolvedTokens.length > 0 ? (
                                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.045] p-3 text-sm">
                                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                    <p>
                                        No reconozco{' '}
                                        <strong>“{interpretation.unresolvedTokens.join('”, “')}”</strong>.
                                        Por ahora queda en la descripción; podés elegir cuenta o categoría al ajustar los detalles.
                                    </p>
                                </div>
                            ) : null}

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between lg:hidden"
                                aria-expanded={showManualDetails}
                                aria-controls="quick-capture-manual-details"
                                onClick={() => setShowManualDetails((current) => !current)}
                            >
                                Ajustar tipo, moneda, fecha, cuenta o categoría
                                <ChevronDown className={cn(
                                    'transition-transform',
                                    showManualDetails && 'rotate-180'
                                )} />
                            </Button>

                            <div className={cn(
                                'gap-3 sm:grid-cols-2 lg:grid',
                                showManualDetails ? 'grid' : 'hidden'
                            )} id="quick-capture-manual-details">
                                <div className="space-y-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Tipo
                                    </span>
                                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                                        {(['expense', 'income'] as const).map((type) => (
                                            <Button
                                                key={type}
                                                type="button"
                                                size="sm"
                                                variant={resolvedDraft.type === type ? 'secondary' : 'ghost'}
                                                className={cn(
                                                    'rounded-lg',
                                                    resolvedDraft.type === type && 'bg-background shadow-sm'
                                                )}
                                                onClick={() => setOverrides((current) => ({
                                                    ...current,
                                                    type,
                                                    categoryId: undefined,
                                                }))}
                                            >
                                                {type === 'expense' ? 'Gasto' : 'Ingreso'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Moneda
                                    </span>
                                    <CurrencyPillSelector
                                        value={resolvedDraft.currency}
                                        options={['ARS', 'USD'] as const}
                                        compact
                                        onValueChange={(currency) => setOverrides((current) => ({
                                            ...current,
                                            currency,
                                        }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="quick-capture-date"
                                        className="text-xs font-medium text-muted-foreground"
                                    >
                                        Fecha
                                    </label>
                                    <Input
                                        id="quick-capture-date"
                                        type="date"
                                        value={toDateInputValue(resolvedDraft.date)}
                                        onChange={(event) => setOverrides((current) => ({
                                            ...current,
                                            date: fromDateInputValue(event.target.value),
                                        }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Cuenta
                                    </span>
                                    <Select
                                        value={resolvedDraft.accountId}
                                        onValueChange={(accountId) =>
                                            setPersonalizedOverride(
                                                'accountId',
                                                accountId
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-full"
                                            aria-label="Cuenta"
                                        >
                                            <SelectValue placeholder="Elegir cuenta" />
                                        </SelectTrigger>
                                        <SelectContent position="popper">
                                            {simpleAccounts.map((account) => (
                                                <SelectItem
                                                        key={resolveEntityId(account._id)}
                                                        value={resolveEntityId(account._id)}
                                                    disabled={!supportsCurrency(
                                                        account,
                                                        resolvedDraft.currency
                                                    )}
                                                >
                                                    <span
                                                        className="size-2 rounded-full"
                                                        style={{ backgroundColor: account.color ?? 'var(--primary)' }}
                                                    />
                                                    {account.name}
                                                    <span className="ml-auto text-xs text-muted-foreground">
                                                        {supportsCurrency(account, 'ARS') ? 'ARS' : ''}
                                                        {supportsCurrency(account, 'ARS') && supportsCurrency(account, 'USD')
                                                            ? ' · '
                                                            : ''}
                                                        {supportsCurrency(account, 'USD') ? 'USD' : ''}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Categoría
                                    </span>
                                    <Select
                                        value={resolvedDraft.categoryId ?? 'none'}
                                        onValueChange={(categoryId) =>
                                            setPersonalizedOverride(
                                                'categoryId',
                                                categoryId === 'none'
                                                    ? undefined
                                                    : categoryId
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            className="w-full"
                                            aria-label="Categoría"
                                        >
                                            <SelectValue placeholder="Sin categoría" />
                                        </SelectTrigger>
                                        <SelectContent position="popper">
                                            <SelectItem value="none">Sin categoría</SelectItem>
                                            {filteredCategories.map((category) => (
                                                <SelectItem
                                                        key={resolveEntityId(category._id)}
                                                        value={resolveEntityId(category._id)}
                                                >
                                                    <span
                                                        className="size-2 rounded-full"
                                                        style={{ backgroundColor: category.color ?? 'var(--primary)' }}
                                                    />
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <label
                                        htmlFor="quick-capture-merchant"
                                        className="text-xs font-medium text-muted-foreground"
                                    >
                                        Comercio
                                    </label>
                                    <Input
                                        id="quick-capture-merchant"
                                        value={resolvedDraft.merchant ?? ''}
                                        placeholder="Sin comercio"
                                        onChange={(event) =>
                                            setPersonalizedOverride(
                                                'merchant',
                                                event.target.value || undefined
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <aside className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
                            <div className="hidden rounded-2xl border bg-muted/35 p-4 lg:block">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                        Resumen
                                    </span>
                                    {previewing || contextLoading ? (
                                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                                    ) : preview?.valid ? (
                                        <Check className="size-4 text-emerald-600" />
                                    ) : null}
                                </div>
                                <p className="text-[15px] leading-relaxed text-foreground">
                                    Vas a registrar{' '}
                                    {summaryDescription ? (
                                        <><strong>“{summaryDescription}”</strong> como un{' '}</>
                                    ) : (
                                        <>un{' '}</>
                                    )}
                                    <strong>{summaryType === 'income' ? 'ingreso' : 'gasto'}</strong>
                                    {summaryAmount ? (
                                        <>
                                            {' '}de{' '}
                                            <strong className="inline-flex items-center gap-1">
                                                <CurrencyFlagIcon currency={summaryCurrency} size="xs" />
                                                {formatMoney(summaryAmount, summaryCurrency)}
                                            </strong>
                                        </>
                                    ) : null}
                                    {summaryCategory ? <> en <strong>{summaryCategory}</strong></> : null}
                                    {resolvedDraft.merchant ? (
                                        <> · comercio <strong>{resolvedDraft.merchant}</strong></>
                                    ) : null}
                                    , {formatCaptureDate(summaryDate)}
                                    {summaryAccount ? (
                                        <> {summaryType === 'income' ? 'hacia' : 'desde'} <strong>{summaryAccount}</strong></>
                                    ) : null}
                                    .
                                </p>
                                {preview?.appliedRule ? (
                                    <Badge variant="secondary" className="mt-3">
                                        <Sparkles />
                                        Regla: {preview.appliedRule.name}
                                    </Badge>
                                ) : null}
                            </div>

                            {preview?.accountImpact ? (
                                <div className={cn(
                                    'rounded-xl border p-3',
                                    preview.accountImpact.resultingBalance < 0
                                        ? 'border-amber-500/35 bg-amber-500/[0.06]'
                                        : 'bg-background'
                                )}>
                                    <div className="flex items-center gap-2">
                                        <WalletCards className="size-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">
                                            Impacto en {preview.accountImpact.accountName}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-sm">
                                        <CurrencyFlagIcon
                                            currency={preview.accountImpact.currency}
                                            size="xs"
                                        />
                                        <span className="text-muted-foreground">
                                            {formatMoney(
                                                preview.accountImpact.currentBalance,
                                                preview.accountImpact.currency
                                            )}
                                        </span>
                                        <ArrowRight className="size-3.5 text-muted-foreground" />
                                        <strong>
                                            {formatMoney(
                                                preview.accountImpact.resultingBalance,
                                                preview.accountImpact.currency
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            ) : null}

                            {issues.length > 0 ? (
                                <div className="space-y-2" role="status" aria-live="polite">
                                    {issues.map((issue) => (
                                        <div
                                            key={issue.code}
                                            className={cn(
                                                'flex gap-2 rounded-xl border p-3 text-sm',
                                                issue.severity === 'error'
                                                    ? 'border-destructive/35 bg-destructive/[0.055] text-destructive'
                                                    : 'border-amber-500/35 bg-amber-500/[0.055]'
                                            )}
                                        >
                                            {issue.severity === 'error' ? (
                                                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                            ) : (
                                                <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                            )}
                                            <span>{issue.message}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {hasCurrencyConflict && compatibleAccounts.length > 0 ? (
                                <div className="rounded-xl border bg-background p-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Cuentas compatibles con {resolvedDraft.currency}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {compatibleAccounts.slice(0, 4).map((account) => (
                                            <Button
                                                key={resolveEntityId(account._id)}
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    setPersonalizedOverride(
                                                        'accountId',
                                                        resolveEntityId(account._id)
                                                    )
                                                }
                                            >
                                                <CurrencyFlagIcon
                                                    currency={resolvedDraft.currency}
                                                    size="xs"
                                                />
                                                {account.name}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {hasDuplicate ? (
                                <Button
                                    type="button"
                                    variant={duplicateConfirmed ? 'secondary' : 'outline'}
                                    className="h-auto w-full justify-start whitespace-normal py-2.5 text-left"
                                    onClick={() => setDuplicateConfirmed((current) => !current)}
                                >
                                    <span className={cn(
                                        'flex size-4 shrink-0 items-center justify-center rounded border',
                                        duplicateConfirmed && 'border-primary bg-primary text-primary-foreground'
                                    )}>
                                        {duplicateConfirmed ? <Check className="size-3" /> : null}
                                    </span>
                                    Registrar de todos modos
                                </Button>
                            ) : null}

                            {warnings.some((issue) => issue.code === 'FUTURE_DATE') ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full"
                                    onClick={completeDetails}
                                >
                                    Crear compromiso o completar
                                </Button>
                            ) : null}
                        </aside>
                    </div>
                </div>

                <DialogFooter className="flex-row items-center justify-between gap-2 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            if (orientation?.card) {
                                void handleOrientationAction('primary')
                                return
                            }
                            completeDetails()
                        }}
                        className="min-w-0"
                    >
                        <Tag className="hidden sm:block" />
                        {orientation?.card ? 'Continuar con tarjeta' : 'Completar detalles'}
                    </Button>
                    <Button
                        type="button"
                        disabled={!canSubmit}
                        onClick={() => void submit()}
                        className="min-w-32"
                    >
                        {submitting ? <Loader2 className="animate-spin" /> : <CircleDollarSign />}
                        Registrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
