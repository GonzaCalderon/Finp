'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useAccounts } from '@/hooks/useAccounts'
import {
    spaceSettlementSchema,
    type SpaceEntryFormData,
    type SpaceSettlementData,
} from '@/lib/validations'
import { extractId, formatCurrencyAmount } from '@/lib/utils/spaces'
import type {
    ISpaceParticipant,
    SpaceApiCapability,
    SpaceDebtDto,
    SpaceQuotesDto,
    SpaceSettlementPreviewDto,
    SpaceSummarySnapshot,
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
import { SpaceInitialsAvatar } from '@/components/spaces/SpaceUi'
import {
    type DialogProps,
    formatDateInput,
    normalizeDialogDate,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { cn } from '@/lib/utils'
import { apiJson, ApiError } from '@/lib/client/auth-client'
import { DEBT_INVALIDATION_TAGS, invalidateData } from '@/lib/client/data-sync'
import {
    moneyFromDecimal,
    moneyToNumber,
    type ConversionSnapshot,
    type MoneyDto,
} from '@/lib/utils/money'

export interface SettlementPrefill {
    payerId?: string
    receiverId?: string
    amount?: number
}

export type SuggestedPayment = {
    from: { participantId: string; displayName: string }
    to: { participantId: string; displayName: string }
    amount: number
}

type ActiveContext = {
    from: { participantId: string; displayName: string }
    to: { participantId: string; displayName: string }
    amount: number
}

type FormState = {
    payerId: string
    receiverId: string
    amount: string
    currency: string
    date: string
    notes: string
}

type AmountPreset = 'total' | 'half' | 'custom' | null

type SpaceSettlementDialogProps = DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<unknown>
    participants: ISpaceParticipant[]
    defaultCurrency: string
    reportingCurrency: string
    prefill?: SettlementPrefill
    suggestedPayments?: SuggestedPayment[]
    spaceCurrencies?: string[]
    quotes?: SpaceQuotesDto | null
    balancesByCurrency?: SpaceSummarySnapshot['balancesByCurrency']
    onQuotesRefresh?: () => Promise<unknown> | void
    v2?: {
        spaceId: string
        expectedRevision: number
        currentUserId: string
        capabilities: SpaceApiCapability[]
    }
}

function buildDefaultForm(
    participants: ISpaceParticipant[],
    defaultCurrency: string,
    prefill?: SettlementPrefill,
    hasSuggestions?: boolean
): FormState {
    const activeIds = participants
        .filter((p) => p.isActive)
        .map((p) => extractId(p._id) ?? '')
        .filter(Boolean)

    // When opened with suggestions but no prefill, start empty so user picks a suggestion
    const startEmpty = hasSuggestions && !prefill?.payerId

    return {
        payerId: prefill?.payerId ?? (startEmpty ? '' : (activeIds[0] ?? '')),
        receiverId: prefill?.receiverId ?? (startEmpty ? '' : (activeIds[1] ?? '')),
        amount: prefill?.amount != null ? String(prefill.amount) : '',
        currency: defaultCurrency,
        date: formatDateInput(),
        notes: '',
    }
}

function SpaceSettlementDialogLegacy({
    open,
    onOpenChange,
    onSubmit,
    participants,
    defaultCurrency,
    reportingCurrency,
    prefill,
    suggestedPayments,
    v2,
}: SpaceSettlementDialogProps) {
    const { error: toastError } = useToast()
    const { accounts } = useAccounts()
    const v2SpaceId = v2?.spaceId
    const v2ExpectedRevision = v2?.expectedRevision
    const v2CurrentUserId = v2?.currentUserId
    const v2Capabilities = v2?.capabilities
    const activeParticipants = v2 ? participants : participants.filter((p) => p.isActive)
    const amountInputRef = useRef<HTMLInputElement>(null)
    const hasSuggestions = Boolean(suggestedPayments && suggestedPayments.length > 0)

    const [form, setForm] = useState<FormState>(() =>
        buildDefaultForm(activeParticipants, defaultCurrency, prefill, hasSuggestions)
    )
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<keyof SpaceSettlementData | 'form', string>>>({})
    const [preset, setPreset] = useState<AmountPreset>(prefill?.amount != null ? 'total' : null)
    const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedPayment | null>(null)
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [debts, setDebts] = useState<SpaceDebtDto[]>([])
    const [accountId, setAccountId] = useState('')
    const [serverPreview, setServerPreview] = useState<SpaceSettlementPreviewDto | null>(null)
    const [previewing, setPreviewing] = useState(false)
    const idempotencyKeyRef = useRef<string | null>(null)

    useEffect(() => {
        if (!open) return
        setForm(buildDefaultForm(activeParticipants, defaultCurrency, prefill, hasSuggestions))
        setErrors({})
        setSubmitting(false)
        setPreset(prefill?.amount != null ? 'total' : null)
        setSelectedSuggestion(null)
        setServerPreview(null)
        idempotencyKeyRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    useEffect(() => {
        if (!open || !v2SpaceId) return
        void apiJson<{ data: SpaceDebtDto[] }>(`/api/spaces/${v2SpaceId}/debts`)
            .then((response) => setDebts(response.data))
            .catch((error) => {
                setDebts([])
                setErrors((current) => ({
                    ...current,
                    form: error instanceof Error ? error.message : 'No se pudo cargar el saldo.',
                }))
            })
    }, [open, v2SpaceId])

    const currencies = Array.from(new Set([defaultCurrency, reportingCurrency]))

    const payerName =
        activeParticipants.find((p) => extractId(p._id) === form.payerId)?.displayName ?? ''
    const receiverName =
        activeParticipants.find((p) => extractId(p._id) === form.receiverId)?.displayName ?? ''

    // Build prefill context from the explicit prefill prop
    const prefillPayer = prefill?.payerId
        ? activeParticipants.find((p) => extractId(p._id) === prefill.payerId) ?? null
        : null
    const prefillReceiver = prefill?.receiverId
        ? activeParticipants.find((p) => extractId(p._id) === prefill.receiverId) ?? null
        : null
    const prefillAmount = prefill?.amount ?? 0
    const hasPrefillContext = Boolean(prefillPayer && prefillReceiver && prefillAmount > 0)

    // Active context: prefer explicit prefill, then selected suggestion
    const activeContext: ActiveContext | null = hasPrefillContext
        ? {
              from: { participantId: extractId(prefillPayer!._id) ?? '', displayName: prefillPayer!.displayName },
              to: { participantId: extractId(prefillReceiver!._id) ?? '', displayName: prefillReceiver!.displayName },
              amount: prefillAmount,
          }
        : selectedSuggestion ?? null

    const effectiveAmount = activeContext?.amount ?? 0
    const parsedAmount = parseFloat(form.amount) || 0
    const sameCurrency = !form.currency || form.currency === reportingCurrency
    const remaining = activeContext && sameCurrency ? Math.max(0, effectiveAmount - parsedAmount) : null
    const isFullPayment = activeContext != null && parsedAmount >= effectiveAmount - 0.01
    const showPreview = activeContext != null && parsedAmount > 0.01
    const showSuggestionsPanel = !hasPrefillContext && hasSuggestions
    const currentParticipantId = extractId(
        participants.find((participant) => extractId(participant.userId) === v2CurrentUserId)?._id
    )
    const isOwnSettlement = Boolean(
        v2 && currentParticipantId &&
        (currentParticipantId === form.payerId || currentParticipantId === form.receiverId)
    )
    const matchingDebt = isOwnSettlement
        ? debts.find((debt) =>
            debt.counterpartyParticipantId === (
                currentParticipantId === form.payerId ? form.receiverId : form.payerId
            ) && debt.direction === (currentParticipantId === form.payerId ? 'payable' : 'receivable')
        )
        : undefined
    const canRepresent = v2Capabilities?.includes('act_for_participant') ?? false
    const compatibleAccounts = accounts.filter((account) =>
        account.isActive && (
            account.currency === form.currency || account.supportedCurrencies?.includes(form.currency as never)
        )
    )

    useEffect(() => {
        if (!open || !v2SpaceId || parsedAmount <= 0 || !form.payerId || !form.receiverId) {
            setServerPreview(null)
            return
        }
        if (isOwnSettlement && !matchingDebt) {
            setServerPreview(null)
            return
        }
        if (!isOwnSettlement && !canRepresent) {
            setServerPreview(null)
            return
        }
        const controller = new AbortController()
        const timer = window.setTimeout(() => {
            setPreviewing(true)
            const body = isOwnSettlement
                ? { mode: 'own', debtId: matchingDebt!.id, amount: parsedAmount, currency: form.currency }
                : {
                    mode: 'represented',
                    payerParticipantId: form.payerId,
                    receiverParticipantId: form.receiverId,
                    amount: parsedAmount,
                    currency: form.currency,
                }
            void apiJson<{ data: SpaceSettlementPreviewDto }>(
                `/api/spaces/${v2SpaceId}/settlements/preview`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    signal: controller.signal,
                }
            ).then((response) => {
                setServerPreview(response.data)
                setErrors((current) => ({ ...current, form: undefined }))
            }).catch((error) => {
                if (error instanceof DOMException && error.name === 'AbortError') return
                setServerPreview(null)
                setErrors((current) => ({
                    ...current,
                    form: error instanceof Error ? error.message : 'No se pudo calcular el pago.',
                }))
            }).finally(() => setPreviewing(false))
        }, 250)
        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [canRepresent, form.currency, form.payerId, form.receiverId, isOwnSettlement, matchingDebt, open, parsedAmount, v2SpaceId])

    function applySuggestion(suggestion: SuggestedPayment) {
        const isAlreadySelected =
            selectedSuggestion?.from.participantId === suggestion.from.participantId &&
            selectedSuggestion?.to.participantId === suggestion.to.participantId
        if (isAlreadySelected) {
            setSelectedSuggestion(null)
            setForm((prev) => ({ ...prev, payerId: '', receiverId: '', amount: '' }))
            setPreset(null)
            return
        }
        setSelectedSuggestion(suggestion)
        setForm((prev) => ({
            ...prev,
            payerId: suggestion.from.participantId,
            receiverId: suggestion.to.participantId,
            amount: String(suggestion.amount),
        }))
        setPreset('total')
    }

    function applyPreset(p: AmountPreset) {
        setPreset(p)
        if (p === 'total') {
            setForm((prev) => ({ ...prev, amount: String(effectiveAmount) }))
        } else if (p === 'half') {
            const half = Math.round((effectiveAmount / 2) * 100) / 100
            setForm((prev) => ({ ...prev, amount: String(half) }))
        } else {
            setTimeout(() => amountInputRef.current?.focus(), 0)
        }
    }

    async function handleSubmit() {
        const result = spaceSettlementSchema.safeParse({
            payerId: form.payerId,
            receiverId: form.receiverId,
            amount: form.amount,
            currency: form.currency,
            date: form.date,
            notes: form.notes || undefined,
        })

        if (!result.success) {
            const fieldErrors: typeof errors = {}
            for (const issue of result.error.issues) {
                const key = issue.path[0] as keyof SpaceSettlementData
                if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
            }
            setErrors(fieldErrors)
            return
        }

        const data = result.data

        if (v2) {
            if (!serverPreview || v2ExpectedRevision === undefined || !v2SpaceId) {
                setErrors((current) => ({ ...current, form: 'Revisá el preview financiero antes de confirmar.' }))
                return
            }
            if (isOwnSettlement && !accountId) {
                setErrors((current) => ({ ...current, form: 'Elegí la cuenta personal que participa del pago.' }))
                return
            }
            if (!isOwnSettlement && !canRepresent) {
                setErrors((current) => ({ ...current, form: 'No podés registrar pagos en nombre de otras personas.' }))
                return
            }
            setSubmitting(true)
            setErrors({})
            try {
                idempotencyKeyRef.current ??= crypto.randomUUID()
                const body = isOwnSettlement
                    ? {
                        mode: 'own',
                        debtId: matchingDebt!.id,
                        accountId,
                        expectedRevision: v2ExpectedRevision,
                        amount: data.amount,
                        currency: data.currency,
                        dateKey: formatDateInput(data.date),
                        description: data.notes,
                    }
                    : {
                        mode: 'represented',
                        payerParticipantId: data.payerId,
                        receiverParticipantId: data.receiverId,
                        expectedRevision: v2ExpectedRevision,
                        amount: data.amount,
                        currency: data.currency,
                        dateKey: formatDateInput(data.date),
                        description: data.notes,
                    }
                await apiJson(`/api/spaces/${v2SpaceId}/settlements`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKeyRef.current,
                    },
                    body: JSON.stringify(body),
                })
                invalidateData(DEBT_INVALIDATION_TAGS)
                idempotencyKeyRef.current = null
                onOpenChange(false)
            } catch (error) {
                const message = error instanceof Error ? error.message : 'No se pudo registrar el pago.'
                setErrors((current) => ({ ...current, form: message }))
                if (error instanceof ApiError && error.status === 409) {
                    invalidateData(DEBT_INVALIDATION_TAGS)
                }
                toastError(message)
            } finally {
                setSubmitting(false)
            }
            return
        }
        const title = `Pago de ${payerName} a ${receiverName}`

        const entryData: SpaceEntryFormData = {
            type: 'settlement',
            title,
            amount: data.amount,
            currency: data.currency,
            date: data.date,
            paidByParticipantId: data.payerId,
            sharedWithParticipantIds: [data.receiverId],
            splitMode: 'none',
            notes: data.notes,
        }

        setSubmitting(true)
        setErrors({})
        try {
            await onSubmit(entryData)
            onOpenChange(false)
        } catch {
            toastError('No se pudo registrar el pago')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="gap-0 overflow-hidden p-0 sm:max-w-lg">
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
                    <DialogTitle className="text-base font-semibold">Registrar pago</DialogTitle>
                    <DialogDescription className="sr-only">
                        Revisá quién paga, quién recibe y el impacto financiero antes de confirmar.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                    <div className="space-y-4">

                        {/* Contexto de deuda cuando viene de un pago recomendado (prefill) */}
                        {hasPrefillContext ? (
                            <div className="space-y-1 rounded-[20px] border border-primary/20 bg-primary/6 px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <SpaceInitialsAvatar
                                        name={activeContext!.from.displayName}
                                        className="h-6 w-6 text-[10px]"
                                    />
                                    <p className="text-sm font-semibold text-foreground">
                                        {activeContext!.from.displayName} le debe a {activeContext!.to.displayName}
                                    </p>
                                </div>
                                <p className="pl-8 text-xs text-muted-foreground">
                                    Saldo pendiente: {formatCurrencyAmount(effectiveAmount, reportingCurrency)}
                                </p>
                            </div>
                        ) : null}

                        {/* Panel de sugerencias (solo cuando se abre sin prefill) */}
                        {showSuggestionsPanel ? (
                            <SpaceDialogPanel>
                                <SpaceDialogSectionEyebrow>Sugerencias</SpaceDialogSectionEyebrow>
                                <div className="mt-2 space-y-1">
                                    {suggestedPayments!.map((payment) => {
                                        const isSelected =
                                            selectedSuggestion?.from.participantId === payment.from.participantId &&
                                            selectedSuggestion?.to.participantId === payment.to.participantId
                                        return (
                                            <button
                                                key={`${payment.from.participantId}-${payment.to.participantId}`}
                                                type="button"
                                                onClick={() => applySuggestion(payment)}
                                                className={cn(
                                                    'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                                                    isSelected
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'text-foreground hover:bg-muted/60'
                                                )}
                                            >
                                                <SpaceInitialsAvatar
                                                    name={payment.from.displayName}
                                                    className="h-6 w-6 shrink-0 text-[10px]"
                                                />
                                                <span className="min-w-0 max-w-[5rem] truncate font-medium">
                                                    {payment.from.displayName}
                                                </span>
                                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <SpaceInitialsAvatar
                                                    name={payment.to.displayName}
                                                    className="h-6 w-6 shrink-0 text-[10px]"
                                                />
                                                <span className="min-w-0 max-w-[5rem] truncate font-medium">
                                                    {payment.to.displayName}
                                                </span>
                                                <span className="ml-auto shrink-0 font-semibold">
                                                    {formatCurrencyAmount(payment.amount, defaultCurrency)}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                                {selectedSuggestion ? (
                                    <p className="mt-3 text-center text-xs text-muted-foreground">
                                        Podés ajustar el monto abajo para hacer un pago parcial.
                                    </p>
                                ) : (
                                    <p className="mt-3 text-center text-xs text-muted-foreground">
                                        Seleccioná una sugerencia o completá los campos manualmente.
                                    </p>
                                )}
                            </SpaceDialogPanel>
                        ) : null}

                        {/* Participantes */}
                        <SpaceDialogPanel>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <SpaceDialogField label="Quién pagó">
                                    <Select
                                        value={form.payerId}
                                        onValueChange={(value) => {
                                            setForm((prev) => ({
                                                ...prev,
                                                payerId: value,
                                                receiverId: prev.receiverId === value ? prev.payerId : prev.receiverId,
                                            }))
                                            if (selectedSuggestion) setSelectedSuggestion(null)
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Elegí un participante" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeParticipants.map((participant) => (
                                                <SelectItem
                                                    key={extractId(participant._id)}
                                                    value={extractId(participant._id) ?? ''}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <SpaceInitialsAvatar
                                                            name={participant.displayName}
                                                            className="h-6 w-6 text-[10px]"
                                                        />
                                                        <span>{participant.displayName}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.payerId ? (
                                        <p className="text-xs text-destructive">{errors.payerId}</p>
                                    ) : null}
                                </SpaceDialogField>

                                <SpaceDialogField label="A quién le pagó">
                                    <Select
                                        value={form.receiverId}
                                        onValueChange={(value) => {
                                            setForm((prev) => ({ ...prev, receiverId: value }))
                                            if (selectedSuggestion) setSelectedSuggestion(null)
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Elegí un participante" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeParticipants
                                                .filter((p) => extractId(p._id) !== form.payerId)
                                                .map((participant) => (
                                                    <SelectItem
                                                        key={extractId(participant._id)}
                                                        value={extractId(participant._id) ?? ''}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <SpaceInitialsAvatar
                                                                name={participant.displayName}
                                                                className="h-6 w-6 text-[10px]"
                                                            />
                                                            <span>{participant.displayName}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.receiverId ? (
                                        <p className="text-xs text-destructive">{errors.receiverId}</p>
                                    ) : null}
                                </SpaceDialogField>
                            </div>
                        </SpaceDialogPanel>

                        {/* Monto */}
                        <SpaceDialogPanel>
                            {/* Presets: visibles cuando hay contexto activo (prefill o sugerencia seleccionada) */}
                            {effectiveAmount > 0 ? (
                                <div className="mb-4 grid grid-cols-3 gap-2">
                                    {(
                                        [
                                            { id: 'total' as const, label: 'Total', value: effectiveAmount },
                                            {
                                                id: 'half' as const,
                                                label: '50%',
                                                value: Math.round((effectiveAmount / 2) * 100) / 100,
                                            },
                                            { id: 'custom' as const, label: 'Otro', value: null },
                                        ] as const
                                    ).map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => applyPreset(option.id)}
                                            className={cn(
                                                'rounded-[16px] border px-3 py-2.5 text-center text-sm transition-colors',
                                                preset === option.id
                                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                                    : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            <p className="font-semibold">{option.label}</p>
                                            <p className="mt-0.5 text-[11px] opacity-75">
                                                {option.value !== null
                                                    ? formatCurrencyAmount(option.value, form.currency)
                                                    : 'Manual'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <FormattedAmountInput
                                    id="settlement-amount"
                                    inputRef={amountInputRef}
                                    label="Monto pagado"
                                    value={form.amount ? Number(form.amount) : undefined}
                                    currency={form.currency}
                                    error={errors.amount}
                                    onValueChangeAction={(amount) => {
                                        setForm((prev) => ({ ...prev, amount: amount ? String(amount) : '' }))
                                        if (preset !== 'custom') setPreset('custom')
                                    }}
                                />

                                <CurrencySelector
                                    value={form.currency}
                                    options={currencies}
                                    onValueChange={(currency) =>
                                        setForm((prev) => ({ ...prev, currency }))
                                    }
                                />
                            </div>

                            <div className="mt-4">
                                <DatePickerField
                                    label="Fecha del pago"
                                    value={normalizeDialogDate(form.date)}
                                    isOpen={datePickerOpen}
                                    onOpenChange={setDatePickerOpen}
                                    onChange={(date) =>
                                        setForm((prev) => ({ ...prev, date: formatDateInput(date) }))
                                    }
                                    error={errors.date}
                                    showErrors={Boolean(errors.date)}
                                />
                            </div>
                        </SpaceDialogPanel>

                        {/* Preview antes/después */}
                        {showPreview ? (
                            <SpaceDialogPanel>
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Saldo pendiente</span>
                                        <span className="font-semibold text-foreground">
                                            {formatCurrencyAmount(effectiveAmount, reportingCurrency)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5 text-sm">
                                        <span className="text-muted-foreground">Este pago</span>
                                        <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                                            {formatCurrencyAmount(parsedAmount, form.currency)}
                                        </span>
                                    </div>
                                    {remaining !== null ? (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Saldo restante</span>
                                            <span
                                                className="font-semibold"
                                                style={{
                                                    color: isFullPayment
                                                        ? 'var(--chart-3)'
                                                        : 'var(--destructive)',
                                                }}
                                            >
                                                {formatCurrencyAmount(
                                                    isFullPayment ? 0 : remaining,
                                                    reportingCurrency
                                                )}
                                            </span>
                                        </div>
                                    ) : null}
                                    <p className="text-xs text-muted-foreground">
                                        {isFullPayment
                                            ? 'Con este pago el saldo queda saldado.'
                                            : remaining !== null
                                                ? `Después de este pago quedarán ${formatCurrencyAmount(remaining, reportingCurrency)}.`
                                                : 'El saldo restante depende del tipo de cambio aplicado.'}
                                    </p>
                                </div>
                            </SpaceDialogPanel>
                        ) : null}

                        {v2 && isOwnSettlement ? (
                            <SpaceDialogPanel>
                                <SpaceDialogField label="Cuenta personal" hint="El movimiento se registrará en Mi Finp">
                                    <Select value={accountId} onValueChange={setAccountId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Elegí una cuenta compatible" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {compatibleAccounts.map((account) => (
                                                <SelectItem key={String(account._id)} value={String(account._id)}>
                                                    {account.name} · {account.currency}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SpaceDialogField>
                            </SpaceDialogPanel>
                        ) : null}

                        {v2 && (serverPreview || previewing || errors.form) ? (
                            <SpaceDialogPanel>
                                <SpaceDialogSectionEyebrow>Revisión financiera</SpaceDialogSectionEyebrow>
                                {previewing ? <p className="mt-2 text-sm text-muted-foreground">Calculando impacto…</p> : null}
                                {serverPreview ? (
                                    <div className="mt-3 space-y-2 text-sm">
                                        <div className="flex justify-between"><span>Impacto en tu cuenta</span><strong>{formatCurrencyAmount(serverPreview.actorAccountImpactAmount, serverPreview.currency)}</strong></div>
                                        <div className="flex justify-between"><span>Impacto operacional</span><strong>{formatCurrencyAmount(serverPreview.actorOperationalAmount, serverPreview.currency)}</strong></div>
                                        <div className="flex justify-between gap-3">
                                            <span>Saldo restante</span>
                                            <strong className="text-right">
                                                {serverPreview.remainingBalanceReporting !== undefined
                                                    ? formatCurrencyAmount(serverPreview.remainingBalanceReporting, serverPreview.reportingCurrency)
                                                    : serverPreview.remainingByCurrency?.map((money) =>
                                                        formatCurrencyAmount(moneyToNumber(money), money.currency)
                                                    ).join(' + ') || 'Sin saldo'}
                                            </strong>
                                        </div>
                                        {!serverPreview.actorMovesPersonalAccount ? (
                                            <p className="text-xs text-muted-foreground">Es una liquidación representada: no mueve ninguna cuenta personal tuya.</p>
                                        ) : null}
                                    </div>
                                ) : null}
                                {errors.form ? <p className="mt-2 text-xs text-destructive" role="alert">{errors.form}</p> : null}
                            </SpaceDialogPanel>
                        ) : null}

                        {/* Comentario */}
                        <SpaceDialogPanel>
                            <SpaceDialogField label="Comentario" hint="Opcional">
                                <SpaceDialogTextArea
                                    value={form.notes}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                                    }
                                    placeholder="Ej. Transferencia por el alquiler de abril"
                                    className="min-h-[80px]"
                                />
                            </SpaceDialogField>
                        </SpaceDialogPanel>
                    </div>
                </div>

                <DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || Boolean(v2 && (previewing || !serverPreview))}>
                        {submitting ? 'Guardando…' : 'Guardar pago'}
                    </Button>
                </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}

type SettlementComponentChoice = {
    key: string
    debtId?: string
    currency: string
    money: MoneyDto
    order: number
}

type SettlementLegDraft = {
    id: string
    currency: string
    amount: string
    accountId: string
    manualTargets: string[]
    manualRates: Record<string, string>
}

function quoteSnapshot(quote: SpaceQuotesDto['quotes'][number]): ConversionSnapshot {
    return {
        rate: quote.rate,
        direction: quote.direction,
        source: quote.source,
        observedAt: quote.observedAt,
        capturedAt: quote.capturedAt,
        expiresAt: quote.expiresAt,
        path: quote.path,
    }
}

function manualSnapshot(sourceCurrency: string, targetCurrency: string, rate: string, actorUserId: string): ConversionSnapshot {
    const now = new Date().toISOString()
    return {
        rate,
        direction: 'multiply',
        source: 'manual',
        manualAuthorUserId: actorUserId,
        observedAt: now,
        capturedAt: now,
        path: [{ fromCurrency: sourceCurrency, toCurrency: targetCurrency, rate, source: 'manual' }],
    }
}

function conversionTargetsForLeg(
    leg: SettlementLegDraft,
    components: SettlementComponentChoice[],
    reportingCurrency: string
) {
    const targets = new Set<string>()
    if (leg.currency !== reportingCurrency) targets.add(reportingCurrency)
    const numericAmount = Number(leg.amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return Array.from(targets)
    const paid = moneyFromDecimal(leg.currency, numericAmount)
    const sameCurrencyUnits = components
        .filter((component) => component.currency === leg.currency)
        .reduce((sum, component) => sum + BigInt(component.money.minorUnits), BigInt(0))
    if (BigInt(paid.minorUnits) > sameCurrencyUnits) {
        for (const component of components) {
            if (component.currency !== leg.currency) targets.add(component.currency)
        }
    }
    return Array.from(targets)
}

function SpaceSettlementDialogV2({
    open,
    onOpenChange,
    participants,
    defaultCurrency,
    reportingCurrency,
    prefill,
    suggestedPayments,
    spaceCurrencies = [defaultCurrency],
    quotes,
    balancesByCurrency,
    onQuotesRefresh,
    v2,
}: SpaceSettlementDialogProps) {
    const { error: toastError } = useToast()
    const { accounts } = useAccounts()
    const activeParticipants = participants.filter((participant) => participant.isActive)
    const v2SpaceId = v2!.spaceId
    const v2CurrentUserId = v2!.currentUserId
    const v2ExpectedRevision = v2!.expectedRevision
    const v2Capabilities = v2!.capabilities
    const currentParticipantId = extractId(
        participants.find((participant) => extractId(participant.userId) === v2CurrentUserId)?._id
    ) ?? ''
    const [payerId, setPayerId] = useState('')
    const [receiverId, setReceiverId] = useState('')
    const [debts, setDebts] = useState<SpaceDebtDto[]>([])
    const [selectedComponents, setSelectedComponents] = useState<string[]>([])
    const [legs, setLegs] = useState<SettlementLegDraft[]>([])
    const [customQuotes, setCustomQuotes] = useState<SpaceQuotesDto['quotes']>([])
    const [preview, setPreview] = useState<SpaceSettlementPreviewDto | null>(null)
    const [previewing, setPreviewing] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [date, setDate] = useState(formatDateInput())
    const [notes, setNotes] = useState('')
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const idempotencyKeyRef = useRef<string | null>(null)

    useEffect(() => {
        if (!open) return
        const suggested = prefill?.payerId && prefill.receiverId
            ? { payerId: prefill.payerId, receiverId: prefill.receiverId }
            : suggestedPayments?.[0]
                ? {
                    payerId: suggestedPayments[0].from.participantId,
                    receiverId: suggestedPayments[0].to.participantId,
                }
                : { payerId: currentParticipantId, receiverId: '' }
        setPayerId(suggested.payerId ?? currentParticipantId)
        setReceiverId(suggested.receiverId ?? '')
        setLegs([{
            id: crypto.randomUUID(),
            currency: defaultCurrency,
            amount: prefill?.amount ? String(prefill.amount) : '',
            accountId: '',
            manualTargets: [],
            manualRates: {},
        }])
        setSelectedComponents([])
        setPreview(null)
        setError(null)
        setDate(formatDateInput())
        setNotes('')
        setCustomQuotes([])
        idempotencyKeyRef.current = null
    }, [currentParticipantId, defaultCurrency, open, prefill, suggestedPayments])

    useEffect(() => {
        if (!open) return
        void apiJson<{ data: SpaceDebtDto[] }>(`/api/spaces/${v2SpaceId}/debts`)
            .then((response) => setDebts(response.data))
            .catch((cause) => setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las deudas.'))
    }, [open, v2SpaceId])

    const isOwnSettlement = Boolean(
        currentParticipantId && (payerId === currentParticipantId || receiverId === currentParticipantId)
    )
    const canRepresent = v2Capabilities.includes('act_for_participant')

    const componentChoices = useMemo<SettlementComponentChoice[]>(() => {
        if (!payerId || !receiverId || payerId === receiverId) return []
        if (isOwnSettlement) {
            const direction = payerId === currentParticipantId ? 'payable' : 'receivable'
            const counterpartyParticipantId = payerId === currentParticipantId ? receiverId : payerId
            return debts
                .filter((debt) => debt.direction === direction && debt.counterpartyParticipantId === counterpartyParticipantId)
                .map((debt, order) => ({
                    key: debt.id,
                    debtId: debt.id,
                    currency: debt.currency,
                    money: debt.remainingMoney ?? moneyFromDecimal(debt.currency, debt.remainingAmount),
                    order,
                }))
        }
        if (!canRepresent) return []
        const rows = balancesByCurrency ?? []
        const currencies = Array.from(new Set(rows.map((row) => row.currency)))
        return currencies.flatMap((currency, order) => {
            const payer = rows.find((row) => row.participantId === payerId && row.currency === currency)
            const receiver = rows.find((row) => row.participantId === receiverId && row.currency === currency)
            if (!payer || !receiver) return []
            const payerUnits = BigInt(payer.balance.minorUnits)
            const receiverUnits = BigInt(receiver.balance.minorUnits)
            if (payerUnits >= BigInt(0) || receiverUnits <= BigInt(0)) return []
            const units = -payerUnits < receiverUnits ? -payerUnits : receiverUnits
            return [{
                key: `represented:${currency}`,
                currency,
                money: { ...payer.balance, minorUnits: units.toString() },
                order,
            }]
        })
    }, [balancesByCurrency, canRepresent, currentParticipantId, debts, isOwnSettlement, payerId, receiverId])

    useEffect(() => {
        const available = new Set(componentChoices.map((component) => component.key))
        setSelectedComponents((current) => {
            const retained = current.filter((key) => available.has(key))
            return retained.length ? retained : componentChoices.map((component) => component.key)
        })
    }, [componentChoices])

    const components = useMemo(
        () => componentChoices.filter((component) => selectedComponents.includes(component.key)),
        [componentChoices, selectedComponents]
    )
    const requiredPairs = useMemo(() => Array.from(new Set(legs.flatMap((leg) => {
        if (!leg.currency) return []
        return conversionTargetsForLeg(leg, components, reportingCurrency)
            .map((target) => `${leg.currency}:${target}`)
    }))), [components, legs, reportingCurrency])
    const requiredPairsKey = requiredPairs.join(',')

    useEffect(() => {
        if (!open || requiredPairs.length === 0) {
            setCustomQuotes([])
            return
        }
        let cancelled = false
        void apiJson<{ data: SpaceQuotesDto }>(
            `/api/spaces/${v2SpaceId}/quotes?pairs=${encodeURIComponent(requiredPairsKey)}`
        ).then((response) => {
            if (!cancelled) setCustomQuotes(response.data.quotes)
        }).catch(() => {
            if (!cancelled) setCustomQuotes([])
        })
        return () => { cancelled = true }
    }, [open, requiredPairs, requiredPairsKey, v2SpaceId])

    const allQuotes = useMemo(() => [...customQuotes, ...(quotes?.quotes ?? [])], [customQuotes, quotes?.quotes])
    const findQuote = (sourceCurrency: string, targetCurrency: string) => allQuotes.find((quote) =>
        quote.sourceCurrency === sourceCurrency && quote.targetCurrency === targetCurrency
    )

    function buildLegPayload(leg: SettlementLegDraft, includeFingerprints: boolean) {
        const amount = Number(leg.amount)
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Completá un monto válido en cada tramo.')
        const money = moneyFromDecimal(leg.currency, amount)
        const targets = conversionTargetsForLeg(leg, components, reportingCurrency)
        const conversions = targets.map((targetCurrency) => {
            const manualRate = leg.manualTargets.includes(targetCurrency)
                ? leg.manualRates[targetCurrency]
                : undefined
            if (manualRate && Number(manualRate) > 0) {
                return {
                    targetCurrency,
                    snapshot: manualSnapshot(leg.currency, targetCurrency, manualRate, v2CurrentUserId),
                }
            }
            const quote = findQuote(leg.currency, targetCurrency)
            if (!quote || quote.status !== 'current') {
                throw new Error(`Actualizá la cotización ${leg.currency}/${targetCurrency} o ingresala manualmente.`)
            }
            return {
                targetCurrency,
                snapshot: quoteSnapshot(quote),
                ...(includeFingerprints ? { expectedQuoteFingerprint: quote.fingerprint } : {}),
            }
        })
        const reportingConversion = conversions.find((conversion) => conversion.targetCurrency === reportingCurrency)
        return {
            id: leg.id,
            currency: leg.currency,
            money,
            accountId: isOwnSettlement && leg.accountId ? leg.accountId : undefined,
            reportingSnapshot: reportingConversion?.snapshot,
            ...(includeFingerprints && reportingConversion && 'expectedQuoteFingerprint' in reportingConversion
                ? { expectedQuoteFingerprint: reportingConversion.expectedQuoteFingerprint }
                : {}),
            conversions: conversions
                .filter((conversion) => conversion.targetCurrency !== leg.currency)
                .map((conversion) => ({
                    targetCurrency: conversion.targetCurrency,
                    snapshot: conversion.snapshot,
                    ...(includeFingerprints && 'expectedQuoteFingerprint' in conversion
                        ? { expectedQuoteFingerprint: conversion.expectedQuoteFingerprint }
                        : {}),
                })),
        }
    }

    useEffect(() => {
        if (!open || !payerId || !receiverId || components.length === 0 || legs.length === 0) {
            setPreview(null)
            return
        }
        if (!isOwnSettlement && !canRepresent) {
            setPreview(null)
            setError('No podés registrar pagos en nombre de otras personas.')
            return
        }
        const timer = window.setTimeout(() => {
            let previewLegs
            try {
                previewLegs = legs.map((leg) => buildLegPayload(leg, false))
            } catch (cause) {
                setPreview(null)
                setError(cause instanceof Error ? cause.message : 'Revisá las cotizaciones.')
                return
            }
            setPreviewing(true)
            setError(null)
            idempotencyKeyRef.current = null
            void apiJson<{ data: SpaceSettlementPreviewDto }>(
                `/api/spaces/${v2SpaceId}/settlements/preview`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mode: isOwnSettlement ? 'own' : 'represented',
                        ...(!isOwnSettlement ? { payerParticipantId: payerId, receiverParticipantId: receiverId } : {}),
                        components: components.map((component) => ({
                            debtId: component.debtId,
                            currency: component.currency,
                            money: component.money,
                            order: component.order,
                        })),
                        legs: previewLegs.map((leg) => ({
                            id: leg.id,
                            currency: leg.currency,
                            money: leg.money,
                            reportingSnapshot: leg.reportingSnapshot,
                            conversions: leg.conversions,
                        })),
                    }),
                }
            ).then((response) => setPreview(response.data))
                .catch((cause) => {
                    setPreview(null)
                    setError(cause instanceof Error ? cause.message : 'No se pudo calcular la aplicación del pago.')
                })
                .finally(() => setPreviewing(false))
        }, 300)
        return () => window.clearTimeout(timer)
    // buildLegPayload intentionally reads the visible draft captured by these dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        allQuotes,
        canRepresent,
        components,
        isOwnSettlement,
        legs,
        open,
        payerId,
        receiverId,
        v2,
    ])

    function updateLeg(id: string, patch: Partial<SettlementLegDraft>) {
        setLegs((current) => current.map((leg) => leg.id === id ? { ...leg, ...patch } : leg))
    }

    async function submit() {
        if (!preview) {
            setError('Revisá la aplicación financiera antes de confirmar.')
            return
        }
        setSubmitting(true)
        setError(null)
        try {
            const submitLegs = legs.map((leg) => buildLegPayload(leg, true))
            idempotencyKeyRef.current ??= crypto.randomUUID()
            await apiJson(`/api/spaces/${v2SpaceId}/settlements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': idempotencyKeyRef.current,
                },
                body: JSON.stringify({
                    mode: isOwnSettlement ? 'own' : 'represented',
                    ...(!isOwnSettlement ? { payerParticipantId: payerId, receiverParticipantId: receiverId } : {}),
                    expectedRevision: v2ExpectedRevision,
                    dateKey: date,
                    description: notes || undefined,
                    components: components.map((component) => ({
                        debtId: component.debtId,
                        currency: component.currency,
                        money: component.money,
                        order: component.order,
                    })),
                    legs: submitLegs,
                }),
            })
            idempotencyKeyRef.current = null
            invalidateData(DEBT_INVALIDATION_TAGS)
            onOpenChange(false)
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'No se pudo confirmar la liquidación.'
            setError(message)
            if (cause instanceof ApiError && cause.status === 409) {
                await onQuotesRefresh?.()
                invalidateData(DEBT_INVALIDATION_TAGS)
            }
            toastError(message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
                        <DialogTitle className="text-base font-semibold">Liquidar saldo por moneda</DialogTitle>
                        <DialogDescription className="sr-only">
                            Elegí los componentes de deuda, los tramos de pago y sus conversiones antes de confirmar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                        <SpaceDialogPanel>
                            <SpaceDialogSectionEyebrow>1 · Relación</SpaceDialogSectionEyebrow>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <SpaceDialogField label="Quién paga">
                                    <Select value={payerId} onValueChange={(value) => {
                                        setPayerId(value)
                                        if (value === receiverId) setReceiverId('')
                                    }}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Elegí una persona" /></SelectTrigger>
                                        <SelectContent>{activeParticipants.map((participant) => (
                                            <SelectItem key={extractId(participant._id)} value={extractId(participant._id) ?? ''}>{participant.displayName}</SelectItem>
                                        ))}</SelectContent>
                                    </Select>
                                </SpaceDialogField>
                                <SpaceDialogField label="Quién recibe">
                                    <Select value={receiverId} onValueChange={setReceiverId}>
                                        <SelectTrigger className="w-full"><SelectValue placeholder="Elegí una persona" /></SelectTrigger>
                                        <SelectContent>{activeParticipants.filter((participant) => extractId(participant._id) !== payerId).map((participant) => (
                                            <SelectItem key={extractId(participant._id)} value={extractId(participant._id) ?? ''}>{participant.displayName}</SelectItem>
                                        ))}</SelectContent>
                                    </Select>
                                </SpaceDialogField>
                            </div>
                            {!isOwnSettlement && payerId && receiverId ? (
                                <p className="mt-3 text-xs text-muted-foreground">Liquidación representada: no moverá ninguna cuenta personal tuya.</p>
                            ) : null}
                        </SpaceDialogPanel>

                        <SpaceDialogPanel>
                            <SpaceDialogSectionEyebrow>2 · Componentes de deuda</SpaceDialogSectionEyebrow>
                            <div className="mt-3 space-y-2">
                                {componentChoices.length ? componentChoices.map((component) => {
                                    const selected = selectedComponents.includes(component.key)
                                    return (
                                        <button
                                            key={component.key}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => setSelectedComponents((current) => selected
                                                ? current.filter((key) => key !== component.key)
                                                : [...current, component.key]
                                            )}
                                            className={cn(
                                                'flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors',
                                                selected ? 'border-primary/30 bg-primary/8' : 'border-border bg-background/70'
                                            )}
                                        >
                                            <span className="text-sm font-medium">Deuda en {component.currency}</span>
                                            <span className="font-semibold tabular-nums">{formatCurrencyAmount(moneyToNumber(component.money), component.currency)}</span>
                                        </button>
                                    )
                                }) : (
                                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No hay componentes vigentes para esta relación.</p>
                                )}
                            </div>
                        </SpaceDialogPanel>

                        <SpaceDialogPanel>
                            <div className="flex items-center justify-between gap-3">
                                <SpaceDialogSectionEyebrow>3 · Tramos de pago</SpaceDialogSectionEyebrow>
                                <Button type="button" size="sm" variant="outline" onClick={() => setLegs((current) => [...current, {
                                    id: crypto.randomUUID(), currency: defaultCurrency, amount: '', accountId: '', manualTargets: [], manualRates: {},
                                }])}>
                                    <Plus className="h-3.5 w-3.5" /> Agregar tramo
                                </Button>
                            </div>
                            <div className="mt-3 space-y-3">
                                {legs.map((leg, index) => {
                                    const targets = conversionTargetsForLeg(leg, components, reportingCurrency)
                                    const compatibleAccounts = accounts.filter((account) => account.isActive && (
                                        account.currency === leg.currency || account.supportedCurrencies?.includes(leg.currency as never)
                                    ))
                                    return (
                                        <div key={leg.id} className="rounded-2xl border border-foreground/[0.08] bg-background/70 p-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold">Tramo {index + 1}</p>
                                                {legs.length > 1 ? (
                                                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Eliminar tramo ${index + 1}`} onClick={() => setLegs((current) => current.filter((item) => item.id !== leg.id))}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                <FormattedAmountInput
                                                    id={`settlement-leg-${leg.id}`}
                                                    label="Monto efectivamente pagado"
                                                    value={leg.amount ? Number(leg.amount) : undefined}
                                                    currency={leg.currency}
                                                    onValueChangeAction={(amount) => updateLeg(leg.id, { amount: amount ? String(amount) : '' })}
                                                />
                                                <CurrencySelector value={leg.currency} options={spaceCurrencies} onValueChange={(currency) => updateLeg(leg.id, {
                                                    currency, accountId: '', manualTargets: [], manualRates: {},
                                                })} />
                                            </div>
                                            {isOwnSettlement ? (
                                                <div className="mt-3">
                                                    <SpaceDialogField label="Mi Finp" hint="Podés decidir o vincular este tramo más tarde">
                                                        <Select value={leg.accountId || 'later'} onValueChange={(value) => updateLeg(leg.id, { accountId: value === 'later' ? '' : value })}>
                                                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="later">Elegir después en Mi Finp</SelectItem>
                                                                {compatibleAccounts.map((account) => (
                                                                    <SelectItem key={String(account._id)} value={String(account._id)}>{account.name} · {account.currency}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </SpaceDialogField>
                                                </div>
                                            ) : null}
                                            {targets.length ? (
                                                <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                                                    {targets.map((target) => {
                                                        const quote = findQuote(leg.currency, target)
                                                        const manual = leg.manualTargets.includes(target)
                                                        return (
                                                            <div key={target} className="rounded-xl bg-muted/35 p-2.5">
                                                                <div className="flex items-center justify-between gap-2 text-xs">
                                                                    <span>{leg.currency}/{target}</span>
                                                                    <button type="button" className="font-medium text-primary" onClick={() => updateLeg(leg.id, {
                                                                        manualTargets: manual ? leg.manualTargets.filter((item) => item !== target) : [...leg.manualTargets, target],
                                                                    })}>{manual ? 'Usar referencia' : 'Cambiar cotización'}</button>
                                                                </div>
                                                                {manual ? (
                                                                    <Input
                                                                        inputMode="decimal"
                                                                        className="mt-2"
                                                                        aria-label={`Cotización manual ${leg.currency}/${target}`}
                                                                        value={leg.manualRates[target] ?? ''}
                                                                        onChange={(event) => updateLeg(leg.id, { manualRates: { ...leg.manualRates, [target]: event.target.value } })}
                                                                        placeholder={`Valor de 1 ${leg.currency} en ${target}`}
                                                                    />
                                                                ) : (
                                                                    <p className={cn('mt-1 text-xs', quote?.status === 'current' ? 'text-muted-foreground' : 'text-warning-foreground')}>
                                                                        {quote?.status === 'current'
                                                                            ? `1 ${leg.currency} = ${quote.rate} ${target} · ${quote.source === 'dolarapi_official' ? 'DolarAPI oficial' : 'Frankfurter'}`
                                                                            : 'Referencia no disponible o desactualizada.'}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    )
                                })}
                            </div>
                        </SpaceDialogPanel>

                        <SpaceDialogPanel>
                            <SpaceDialogSectionEyebrow>4 · Revisión financiera</SpaceDialogSectionEyebrow>
                            {previewing ? <p className="mt-3 text-sm text-muted-foreground">Calculando aplicaciones y saldos…</p> : null}
                            {preview ? (
                                <div className="mt-3 space-y-3">
                                    {preview.applications?.map((application, index) => (
                                        <div key={`${application.legId}-${application.debtCurrency}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-foreground/[0.07] p-3 text-sm">
                                            <div>
                                                <p className="font-medium">Tramo en {application.paid.currency} → deuda en {application.debtCurrency}</p>
                                                <p className="text-xs text-muted-foreground">Se aplican {formatCurrencyAmount(moneyToNumber(application.applied), application.applied.currency)}</p>
                                            </div>
                                            <span className="font-semibold">{formatCurrencyAmount(moneyToNumber(application.paid), application.paid.currency)}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-border/60 pt-3">
                                        <p className="text-xs font-medium text-muted-foreground">Saldo restante por moneda</p>
                                        <div className="mt-1 flex flex-wrap gap-3 text-sm font-semibold">
                                            {preview.remainingByCurrency?.map((money) => (
                                                <span key={money.currency}>{formatCurrencyAmount(moneyToNumber(money), money.currency)}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">La diferencia de cambio queda trazada y no se registra como ingreso ni gasto operacional.</p>
                                </div>
                            ) : null}
                            {error ? (
                                <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm text-warning-foreground" role="alert">
                                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            ) : null}
                        </SpaceDialogPanel>

                        <SpaceDialogPanel>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <DatePickerField
                                    label="Fecha del pago"
                                    value={normalizeDialogDate(date)}
                                    isOpen={datePickerOpen}
                                    onOpenChange={setDatePickerOpen}
                                    onChange={(value) => setDate(formatDateInput(value))}
                                    showErrors={false}
                                />
                                <SpaceDialogField label="Comentario" hint="Opcional">
                                    <SpaceDialogTextArea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ej. Transferencia por el viaje" />
                                </SpaceDialogField>
                            </div>
                        </SpaceDialogPanel>
                    </div>
                    <DialogFooter className="shrink-0 border-t border-border/60 px-5 py-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
                        <Button onClick={() => void submit()} disabled={submitting || previewing || !preview}>
                            {submitting ? 'Confirmando…' : 'Confirmar liquidación'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function SpaceSettlementDialog(props: SpaceSettlementDialogProps) {
    return props.v2
        ? <SpaceSettlementDialogV2 {...props} />
        : <SpaceSettlementDialogLegacy {...props} />
}
