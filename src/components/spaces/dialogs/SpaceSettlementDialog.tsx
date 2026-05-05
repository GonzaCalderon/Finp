'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import {
    spaceSettlementSchema,
    type SpaceEntryFormData,
    type SpaceSettlementData,
} from '@/lib/validations'
import { extractId, formatCurrencyAmount } from '@/lib/utils/spaces'
import type { ISpaceParticipant } from '@/types'
import {
    Dialog,
    DialogContent,
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
import { cn } from '@/lib/utils'

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

export function SpaceSettlementDialog({
    open,
    onOpenChange,
    onSubmit,
    participants,
    defaultCurrency,
    reportingCurrency,
    prefill,
    suggestedPayments,
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<unknown>
    participants: ISpaceParticipant[]
    defaultCurrency: string
    reportingCurrency: string
    prefill?: SettlementPrefill
    suggestedPayments?: SuggestedPayment[]
}) {
    const { error: toastError } = useToast()
    const activeParticipants = participants.filter((p) => p.isActive)
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

    useEffect(() => {
        if (!open) return
        setForm(buildDefaultForm(activeParticipants, defaultCurrency, prefill, hasSuggestions))
        setErrors({})
        setSubmitting(false)
        setPreset(prefill?.amount != null ? 'total' : null)
        setSelectedSuggestion(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

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
                                <SpaceDialogField label="Monto pagado">
                                    <Input
                                        ref={amountInputRef}
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step="any"
                                        value={form.amount}
                                        onChange={(e) => {
                                            setForm((prev) => ({ ...prev, amount: e.target.value }))
                                            if (preset !== 'custom') setPreset('custom')
                                        }}
                                        placeholder="0"
                                    />
                                    {errors.amount ? (
                                        <p className="text-xs text-destructive">{errors.amount}</p>
                                    ) : null}
                                </SpaceDialogField>

                                <SpaceDialogField label="Moneda">
                                    <Select
                                        value={form.currency}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({ ...prev, currency: value }))
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currencies.map((currency) => (
                                                <SelectItem key={currency} value={currency}>
                                                    {currency}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SpaceDialogField>
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
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Guardar pago'}
                    </Button>
                </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
