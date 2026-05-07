'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { COMMON_CURRENCIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { CreateDebtPayload } from '@/hooks/useDebts'

interface CreateDebtDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    prefillName?: string
    onSubmit: (payload: CreateDebtPayload) => Promise<void>
}

export function CreateDebtDialog({ open, onOpenChange, prefillName, onSubmit }: CreateDebtDialogProps) {
    const [direction, setDirection] = useState<'payable' | 'receivable'>('payable')
    const [counterpartyName, setCounterpartyName] = useState(prefillName ?? '')
    const [amount, setAmount] = useState('')
    const [currency, setCurrency] = useState('ARS')
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    function reset() {
        setDirection('payable')
        setCounterpartyName(prefillName ?? '')
        setAmount('')
        setCurrency('ARS')
        setDate(new Date())
        setNotes('')
        setErrors({})
    }

    function validate() {
        const errs: Record<string, string> = {}
        if (!counterpartyName.trim()) errs.counterpartyName = 'Ingresá el nombre de la persona'
        const parsed = parseFloat(amount.replace(',', '.'))
        if (!amount || isNaN(parsed) || parsed <= 0) errs.amount = 'Ingresá un monto válido'
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
                amount: parseFloat(amount.replace(',', '.')),
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva deuda</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
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
                        />
                        {errors.counterpartyName && <p className="text-xs text-destructive">{errors.counterpartyName}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="amount">Monto</Label>
                            <Input
                                id="amount"
                                inputMode="decimal"
                                placeholder="0,00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <Label>Moneda</Label>
                            <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {COMMON_CURRENCIES.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Registrar deuda'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
