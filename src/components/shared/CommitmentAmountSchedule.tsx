'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/shared/Spinner'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { apiJson } from '@/lib/client/auth-client'
import { COMMITMENT_INVALIDATION_TAGS, invalidateData } from '@/lib/client/data-sync'
import type { Currency } from '@/lib/constants'
import type { ICommitmentAmountEntry } from '@/types'

interface CommitmentAmountScheduleProps {
    commitmentId: string
    currency: Currency
    schedule: ICommitmentAmountEntry[]
    onChange?: () => void
}

const fmtDate = (value: Date | string) =>
    new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

/**
 * Agenda de montos efectivos por fecha.
 *
 * Programar un aumento no reescribe las aplicaciones ya registradas: cada una
 * conserva la foto del importe con el que se registró.
 */
export function CommitmentAmountSchedule({
    commitmentId,
    currency,
    schedule,
    onChange,
}: CommitmentAmountScheduleProps) {
    const [adding, setAdding] = useState(false)
    const [effectiveFrom, setEffectiveFrom] = useState<Date | undefined>(undefined)
    const [amount, setAmount] = useState(0)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const ordered = [...schedule].sort(
        (a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime()
    )

    const formatAmount = (value: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)

    async function addEntry() {
        if (!effectiveFrom || amount <= 0) {
            setError('Indicá desde cuándo rige y un monto mayor a 0.')
            return
        }

        setBusy(true)
        setError(null)
        try {
            await apiJson(`/api/commitments/${commitmentId}/amounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ effectiveFrom: effectiveFrom.toISOString(), amount }),
            })
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            onChange?.()
            setAdding(false)
            setEffectiveFrom(undefined)
            setAmount(0)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo agregar el tramo.')
        } finally {
            setBusy(false)
        }
    }

    async function removeEntry(entry: ICommitmentAmountEntry) {
        setBusy(true)
        setError(null)
        try {
            const iso = new Date(entry.effectiveFrom).toISOString()
            await apiJson(
                `/api/commitments/${commitmentId}/amounts?effectiveFrom=${encodeURIComponent(iso)}`,
                { method: 'DELETE' }
            )
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            onChange?.()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo eliminar el tramo.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-2 rounded-lg border border-foreground/[0.08] p-3">
            <div className="flex items-center justify-between gap-2">
                <Label className="mb-0">Agenda de montos</Label>
                {!adding && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(true)}>
                        <Plus className="size-3.5" />
                        Programar aumento
                    </Button>
                )}
            </div>

            {ordered.length === 0 && !adding && (
                <p className="text-xs text-muted-foreground">
                    Sin tramos programados. El compromiso usa su monto actual.
                </p>
            )}

            {ordered.length > 0 && (
                <ul className="space-y-1">
                    {ordered.map((entry) => (
                        <li
                            key={new Date(entry.effectiveFrom).toISOString()}
                            className="flex items-center justify-between gap-2 rounded-md bg-foreground/[0.03] px-2 py-1.5 text-sm"
                        >
                            <span className="text-muted-foreground">Desde {fmtDate(entry.effectiveFrom)}</span>
                            <span className="flex items-center gap-1">
                                <span className="font-medium tabular-nums">{formatAmount(entry.amount)}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    disabled={busy}
                                    aria-label={`Eliminar tramo desde ${fmtDate(entry.effectiveFrom)}`}
                                    onClick={() => removeEntry(entry)}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {adding && (
                <div className="space-y-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    <div className="grid grid-cols-2 gap-3">
                        <DatePickerField
                            label="Rige desde"
                            value={effectiveFrom}
                            onChange={(date) => setEffectiveFrom(date ?? undefined)}
                        />
                        <FormattedAmountInput
                            id="schedule-amount"
                            label="Nuevo monto"
                            value={amount}
                            currency={currency}
                            onValueChangeAction={setAmount}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                                setAdding(false)
                                setError(null)
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button type="button" size="sm" disabled={busy} onClick={addEntry}>
                            {busy ? <Spinner /> : 'Agregar'}
                        </Button>
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <p className="text-xs text-muted-foreground">
                Un aumento programado sólo afecta los períodos futuros. Las aplicaciones ya
                registradas conservan su importe.
            </p>
        </div>
    )
}
