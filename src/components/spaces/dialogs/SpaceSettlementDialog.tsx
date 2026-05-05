'use client'

import { useEffect, useRef, useState } from 'react'
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
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { cn } from '@/lib/utils'

export interface SettlementPrefill {
    payerId?: string
    receiverId?: string
    amount?: number
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
    prefill?: SettlementPrefill
): FormState {
    const activeIds = participants
        .filter((p) => p.isActive)
        .map((p) => extractId(p._id) ?? '')
        .filter(Boolean)

    return {
        payerId: prefill?.payerId ?? activeIds[0] ?? '',
        receiverId: prefill?.receiverId ?? activeIds[1] ?? '',
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
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<unknown>
    participants: ISpaceParticipant[]
    defaultCurrency: string
    reportingCurrency: string
    prefill?: SettlementPrefill
}) {
    const { error: toastError } = useToast()
    const activeParticipants = participants.filter((p) => p.isActive)
    const amountInputRef = useRef<HTMLInputElement>(null)

    const [form, setForm] = useState<FormState>(() =>
        buildDefaultForm(activeParticipants, defaultCurrency, prefill)
    )
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<keyof SpaceSettlementData | 'form', string>>>({})
    const [preset, setPreset] = useState<AmountPreset>(prefill?.amount != null ? 'total' : null)

    useEffect(() => {
        if (!open) return
        setForm(buildDefaultForm(activeParticipants, defaultCurrency, prefill))
        setErrors({})
        setSubmitting(false)
        setPreset(prefill?.amount != null ? 'total' : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const currencies = Array.from(new Set([defaultCurrency, reportingCurrency]))

    const payerName =
        activeParticipants.find((p) => extractId(p._id) === form.payerId)?.displayName ?? ''
    const receiverName =
        activeParticipants.find((p) => extractId(p._id) === form.receiverId)?.displayName ?? ''

    const prefillPayer = prefill?.payerId
        ? activeParticipants.find((p) => extractId(p._id) === prefill.payerId) ?? null
        : null
    const prefillReceiver = prefill?.receiverId
        ? activeParticipants.find((p) => extractId(p._id) === prefill.receiverId) ?? null
        : null
    const prefillAmount = prefill?.amount ?? 0
    const hasPrefillContext = Boolean(prefillPayer && prefillReceiver && prefillAmount > 0)

    const parsedAmount = parseFloat(form.amount) || 0
    const sameCurrency = !form.currency || form.currency === reportingCurrency
    const remaining = hasPrefillContext && sameCurrency
        ? Math.max(0, prefillAmount - parsedAmount)
        : null
    const isFullPayment = hasPrefillContext && parsedAmount >= prefillAmount - 0.01
    const showPreview = hasPrefillContext && parsedAmount > 0.01

    function applyPreset(p: AmountPreset) {
        setPreset(p)
        if (p === 'total') {
            setForm((prev) => ({ ...prev, amount: String(prefillAmount) }))
        } else if (p === 'half') {
            const half = Math.round((prefillAmount / 2) * 100) / 100
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
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-lg">
                <DialogHeader className="border-b border-border/60 px-5 py-4">
                    <DialogTitle className="text-base font-semibold">Registrar pago</DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto px-5 py-5">
                    <div className="space-y-4">

                        {/* Contexto de deuda cuando viene de un pago recomendado */}
                        {hasPrefillContext ? (
                            <div className="rounded-[20px] border border-primary/20 bg-primary/6 px-4 py-3 space-y-1">
                                <div className="flex items-center gap-2">
                                    <SpaceInitialsAvatar
                                        name={prefillPayer!.displayName}
                                        className="h-6 w-6 text-[10px]"
                                    />
                                    <p className="text-sm font-semibold text-foreground">
                                        {prefillPayer!.displayName} le debe a {prefillReceiver!.displayName}
                                    </p>
                                </div>
                                <p className="pl-8 text-xs text-muted-foreground">
                                    Saldo pendiente: {formatCurrencyAmount(prefillAmount, reportingCurrency)}
                                </p>
                            </div>
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
                                        onValueChange={(value) =>
                                            setForm((prev) => ({ ...prev, receiverId: value }))
                                        }
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
                            {/* Opciones rápidas: solo cuando hay un monto sugerido */}
                            {prefillAmount > 0 ? (
                                <div className="mb-4 grid grid-cols-3 gap-2">
                                    {(
                                        [
                                            { id: 'total' as const, label: 'Total', value: prefillAmount },
                                            {
                                                id: 'half' as const,
                                                label: '50%',
                                                value: Math.round((prefillAmount / 2) * 100) / 100,
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
                                <SpaceDialogField label="Fecha del pago">
                                    <Input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, date: e.target.value }))
                                        }
                                    />
                                    {errors.date ? (
                                        <p className="text-xs text-destructive">{errors.date}</p>
                                    ) : null}
                                </SpaceDialogField>
                            </div>
                        </SpaceDialogPanel>

                        {/* Preview antes/después */}
                        {showPreview ? (
                            <SpaceDialogPanel>
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Saldo actual</span>
                                        <span className="font-semibold text-foreground">
                                            {formatCurrencyAmount(prefillAmount, reportingCurrency)}
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

                <DialogFooter className="border-t border-border/60 px-5 py-4">
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
            </DialogContent>
        </Dialog>
    )
}
