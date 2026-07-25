'use client'

import { useMemo, useState } from 'react'
import {
    CalendarClock,
    ChevronDown,
    CircleDollarSign,
    Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { Spinner } from '@/components/shared/Spinner'
import { apiJson } from '@/lib/client/auth-client'
import {
    COMMITMENT_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'
import { cn } from '@/lib/utils'
import type { Currency } from '@/lib/constants'
import type { ICommitmentAmountEntry } from '@/types'

interface CommitmentAmountScheduleProps {
    commitmentId: string
    currency: Currency
    currentAmount: number
    currentEffectiveFrom?: Date | string
    nextDueDate?: Date | string
    schedule: ICommitmentAmountEntry[]
    onChange?: () => void
}

type EffectiveDatePreset = 'now' | 'next_due' | 'custom'

function startOfToday(): Date {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

function safeDate(value: Date | string | undefined): Date | undefined {
    if (!value) return undefined
    const parsed = value instanceof Date ? new Date(value) : new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function dateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function formatDate(value: Date | string | undefined): string {
    const date = safeDate(value)
    if (!date) return 'vigente actualmente'
    return `desde el ${date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })}`
}

export function CommitmentAmountSchedule({
    commitmentId,
    currency,
    currentAmount,
    currentEffectiveFrom,
    nextDueDate,
    schedule,
    onChange,
}: CommitmentAmountScheduleProps) {
    const [editing, setEditing] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [preset, setPreset] = useState<EffectiveDatePreset>('next_due')
    const [customDate, setCustomDate] = useState<Date | undefined>()
    const [amount, setAmount] = useState(currentAmount)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const today = startOfToday()
    const parsedNextDueDate = safeDate(nextDueDate)
    const ordered = useMemo(
        () =>
            [...schedule].sort(
                (left, right) =>
                    new Date(right.effectiveFrom).getTime() -
                    new Date(left.effectiveFrom).getTime()
            ),
        [schedule]
    )
    const effectiveDate =
        preset === 'now'
            ? today
            : preset === 'next_due'
              ? parsedNextDueDate
              : customDate

    const formatAmount = (value: number) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value)

    function beginChange() {
        setAmount(currentAmount)
        setPreset(parsedNextDueDate ? 'next_due' : 'now')
        setCustomDate(undefined)
        setError(null)
        setEditing(true)
    }

    async function saveChange() {
        if (!effectiveDate || amount <= 0) {
            setError('Indicá un monto mayor a cero y desde cuándo debe regir.')
            return
        }

        setBusy(true)
        setError(null)
        try {
            await apiJson(`/api/commitments/${commitmentId}/amounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    effectiveFrom: effectiveDate.toISOString(),
                    amount,
                }),
            })
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            onChange?.()
            setEditing(false)
            setHistoryOpen(true)
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'No se pudo cambiar el monto.'
            )
        } finally {
            setBusy(false)
        }
    }

    async function removeFutureEntry(entry: ICommitmentAmountEntry) {
        const effectiveFrom = safeDate(entry.effectiveFrom)
        if (!effectiveFrom || dateOnly(effectiveFrom) <= today) return

        setBusy(true)
        setError(null)
        try {
            await apiJson(
                `/api/commitments/${commitmentId}/amounts?effectiveFrom=${encodeURIComponent(
                    effectiveFrom.toISOString()
                )}`,
                { method: 'DELETE' }
            )
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            onChange?.()
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : 'No se pudo quitar el cambio futuro.'
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <section className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CircleDollarSign className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">Monto vigente</p>
                        <p className="text-xl font-semibold tabular-nums">
                            {formatAmount(currentAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {formatDate(currentEffectiveFrom)}
                        </p>
                    </div>
                    {!editing ? (
                        <Button
                            type="button"
                            className="min-h-11 shrink-0"
                            onClick={beginChange}
                        >
                            Cambiar monto
                        </Button>
                    ) : null}
                </section>

                {editing ? (
                    <section className="space-y-4">
                        <FormattedAmountInput
                            id="schedule-amount"
                            label="Nuevo monto"
                            value={amount}
                            currency={currency}
                            onValueChangeAction={setAmount}
                        />

                        <div className="space-y-2">
                            <p className="text-sm font-medium">¿Desde cuándo rige?</p>
                            <div className="grid gap-2 sm:grid-cols-3">
                                {[
                                    {
                                        value: 'now' as const,
                                        label: 'Desde ahora',
                                        description: formatDate(today),
                                    },
                                    {
                                        value: 'next_due' as const,
                                        label: 'Próximo vencimiento',
                                        description: parsedNextDueDate
                                            ? formatDate(parsedNextDueDate)
                                            : 'Sin fecha disponible',
                                        disabled: !parsedNextDueDate,
                                    },
                                    {
                                        value: 'custom' as const,
                                        label: 'Elegir fecha',
                                        description: 'Programar otro día',
                                    },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        disabled={option.disabled}
                                        aria-pressed={preset === option.value}
                                        className={cn(
                                            'min-h-16 rounded-2xl border p-3 text-left transition-colors',
                                            preset === option.value
                                                ? 'border-primary bg-primary/10'
                                                : 'border-border bg-background hover:bg-muted',
                                            option.disabled &&
                                                'cursor-not-allowed opacity-50'
                                        )}
                                        onClick={() => setPreset(option.value)}
                                    >
                                        <span className="block text-sm font-medium">
                                            {option.label}
                                        </span>
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                            {option.description}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {preset === 'custom' ? (
                            <DatePickerField
                                label="Fecha efectiva"
                                value={customDate}
                                minDate={today}
                                onChange={setCustomDate}
                            />
                        ) : null}

                        {effectiveDate && amount > 0 ? (
                            <div className="flex gap-3 rounded-2xl bg-muted/50 p-4 text-sm">
                                <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
                                <p>
                                    El monto será{' '}
                                    <strong>{formatAmount(amount)}</strong>{' '}
                                    {formatDate(effectiveDate)}. Lo ya registrado
                                    conservará su importe original.
                                </p>
                            </div>
                        ) : null}
                    </section>
                ) : null}

                <section className="border-t pt-3">
                    <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 w-full justify-between px-1"
                        aria-expanded={historyOpen}
                        onClick={() => setHistoryOpen((current) => !current)}
                    >
                        Historial de montos ({ordered.length})
                        <ChevronDown
                            className={cn(
                                'size-4 transition-transform',
                                historyOpen && 'rotate-180'
                            )}
                        />
                    </Button>

                    {historyOpen ? (
                        ordered.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                                {ordered.map((entry) => {
                                    const entryDate = safeDate(entry.effectiveFrom)
                                    const isFuture = Boolean(
                                        entryDate && dateOnly(entryDate) > today
                                    )
                                    return (
                                        <li
                                            key={new Date(
                                                entry.effectiveFrom
                                            ).toISOString()}
                                            className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2"
                                        >
                                            <div>
                                                <p className="font-medium tabular-nums">
                                                    {formatAmount(entry.amount)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(entry.effectiveFrom)}
                                                </p>
                                            </div>
                                            {isFuture ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-11"
                                                    disabled={busy}
                                                    aria-label={`Quitar cambio ${formatDate(
                                                        entry.effectiveFrom
                                                    )}`}
                                                    onClick={() =>
                                                        void removeFutureEntry(entry)
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    Histórico
                                                </span>
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Este compromiso todavía no tiene cambios de monto.
                            </p>
                        )
                    ) : null}
                </section>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>

            {editing ? (
                <div className="flex items-center justify-between gap-3 border-t bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() => {
                            setEditing(false)
                            setError(null)
                        }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        className="min-h-11"
                        disabled={busy || !effectiveDate || amount <= 0}
                        onClick={() => void saveChange()}
                    >
                        {busy ? <Spinner /> : 'Guardar cambio'}
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
