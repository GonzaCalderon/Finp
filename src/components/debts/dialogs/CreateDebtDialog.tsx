'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { COMMON_CURRENCIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CreateDebtPayload } from '@/hooks/useDebts'

interface CreateDebtDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    prefillName?: string
    lockCounterparty?: boolean
    onSubmit: (payload: CreateDebtPayload) => Promise<void>
}

export function CreateDebtDialog({ open, onOpenChange, prefillName, lockCounterparty, onSubmit }: CreateDebtDialogProps) {
    const [direction, setDirection] = useState<'payable' | 'receivable'>('payable')
    const [counterpartyName, setCounterpartyName] = useState(prefillName ?? '')
    const [amountValue, setAmountValue] = useState<number | undefined>(undefined)
    const [currency, setCurrency] = useState('ARS')
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    function reset() {
        setDirection('payable')
        setCounterpartyName(prefillName ?? '')
        setAmountValue(undefined)
        setCurrency('ARS')
        setDate(new Date())
        setNotes('')
        setErrors({})
    }

    function validate() {
        const errs: Record<string, string> = {}
        if (!counterpartyName.trim()) errs.counterpartyName = 'Ingresá el nombre de la persona'
        if (!amountValue || amountValue <= 0) errs.amount = 'Ingresá un monto válido'
        if (!date) errs.date = 'Seleccioná una fecha'
        return errs
    }

    async function handleSubmit() {
        const errs = validate()
        if (Object.keys(errs).length > 0) {
            setErrors(errs)
            return
        }
        setSubmitting(true)
        try {
            await onSubmit({
                direction,
                counterpartyName: counterpartyName.trim(),
                amount: amountValue!,
                currency,
                date: date!,
                notes: notes.trim() || undefined,
            })
            reset()
            onOpenChange(false)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
            <DialogContent
                variant="fullscreen-mobile"
                className="gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-md"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    <div className="shrink-0 border-b border-border/70 px-5 py-5 sm:px-6">
                        <DialogHeader>
                            <DialogTitle>Nueva deuda</DialogTitle>
                            <DialogDescription>
                                Registra una deuda manual para hacer seguimiento del saldo pendiente.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                    {lockCounterparty && counterpartyName && (
                        <p className="text-xs text-muted-foreground rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                            Esta acción se registrará dentro de la relación con <strong>{counterpartyName}</strong>.
                        </p>
                    )}

                    <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['payable', 'receivable'] as const).map((dir) => (
                                <button
                                    key={dir}
                                    type="button"
                                    onClick={() => setDirection(dir)}
                                    className={cn(
                                        'rounded-xl border py-2.5 text-sm font-medium transition-colors',
                                        direction === dir
                                            ? 'border-foreground bg-foreground text-background'
                                            : 'border-border text-muted-foreground hover:border-foreground/40'
                                    )}
                                >
                                    {dir === 'payable' ? 'Debo' : 'Me deben'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="counterpartyName">Persona</Label>
                        <Input
                            id="counterpartyName"
                            placeholder="Nombre de la persona"
                            value={counterpartyName}
                            onChange={(e) => setCounterpartyName(e.target.value)}
                            disabled={lockCounterparty}
                        />
                        {errors.counterpartyName && <p className="text-xs text-destructive">{errors.counterpartyName}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <FormattedAmountInput
                            id="amount"
                            label="Monto"
                            value={amountValue}
                            currency={currency}
                            error={errors.amount}
                            onValueChangeAction={setAmountValue}
                        />
                        <CurrencySelector
                            value={currency}
                            options={COMMON_CURRENCIES}
                            onValueChange={setCurrency}
                        />
                    </div>

                    <DatePickerField
                        value={date}
                        isOpen={datePickerOpen}
                        onOpenChange={setDatePickerOpen}
                        onChange={setDate}
                        error={errors.date}
                        showErrors
                    />

                    <div className="space-y-1.5">
                        <Label htmlFor="notes">Nota (opcional)</Label>
                        <Input
                            id="notes"
                            placeholder="Motivo o descripción"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Guardando…' : 'Registrar deuda'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
