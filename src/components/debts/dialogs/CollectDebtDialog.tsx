'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { formatDebtAmount } from '@/components/debts/DebtsUi'
import { isAccountCurrencyCompatible } from '@/lib/utils/debt'
import type { IDebt } from '@/types/debt'
import type { IAccount } from '@/types'
import type { CollectDebtPayload } from '@/hooks/useDebts'

interface CollectDebtDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    debt: IDebt | null
    accounts: IAccount[]
    onSubmit: (debtId: string, payload: CollectDebtPayload) => Promise<void>
}

export function CollectDebtDialog({ open, onOpenChange, debt, accounts, onSubmit }: CollectDebtDialogProps) {
    const [amountValue, setAmountValue] = useState<number | undefined>(undefined)
    const [accountId, setAccountId] = useState('')
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [datePickerOpen, setDatePickerOpen] = useState(false)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    const compatibleAccounts = accounts.filter(
        (a) => a.isActive && a.type !== 'credit_card' && a.type !== 'debt' &&
            isAccountCurrencyCompatible(a.currency, a.supportedCurrencies, debt?.currency ?? '')
    )

    const selectedAccount = compatibleAccounts.find((a) => a._id.toString() === accountId)
    const parsedAmount = amountValue ?? 0
    const remaining = debt?.remainingAmount ?? 0
    const newRemaining = Math.max(0, remaining - parsedAmount)

    function reset() {
        setAmountValue(undefined)
        setAccountId('')
        setDate(new Date())
        setNotes('')
        setErrors({})
    }

    function validate() {
        const errs: Record<string, string> = {}
        if (!amountValue || amountValue <= 0) errs.amount = 'Ingresá un monto válido'
        else if (amountValue > remaining) errs.amount = `El monto no puede superar ${formatDebtAmount(remaining, debt?.currency ?? '')}`
        if (!accountId) errs.accountId = 'Seleccioná una cuenta'
        if (!date) errs.date = 'Seleccioná una fecha'
        return errs
    }

    async function handleSubmit() {
        if (!debt) return
        const errs = validate()
        if (Object.keys(errs).length > 0) { setErrors(errs); return }
        setSubmitting(true)
        try {
            await onSubmit(debt._id.toString(), {
                amount: amountValue!,
                accountId,
                date: date!,
                notes: notes.trim() || undefined,
            })
            reset()
            onOpenChange(false)
        } finally {
            setSubmitting(false)
        }
    }

    if (!debt) return null

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar cobro</DialogTitle>
                    <DialogDescription>
                        Registra un cobro y actualiza el saldo que te deben.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border p-3 text-sm space-y-0.5" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                        <span className="text-muted-foreground">Deuda con </span>
                        <span className="font-medium">{debt.counterpartyNameSnapshot}</span>
                        <span className="text-muted-foreground"> · Me deben: </span>
                        <span className="font-medium">{formatDebtAmount(debt.remainingAmount, debt.currency)}</span>
                    </div>

                    <FormattedAmountInput
                        id="collect-amount"
                        label="Monto a cobrar"
                        value={amountValue}
                        currency={debt.currency}
                        error={errors.amount}
                        placeholder="0"
                        onValueChangeAction={setAmountValue}
                        labelAction={
                            <button
                                type="button"
                                className="text-xs font-medium text-primary hover:underline"
                                onClick={() => setAmountValue(remaining)}
                            >
                                Cobro total
                            </button>
                        }
                    />

                    <div className="space-y-1.5">
                        <Label>Cuenta de entrada</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná una cuenta" />
                            </SelectTrigger>
                            <SelectContent>
                                {compatibleAccounts.map((acc) => (
                                    <SelectItem key={acc._id.toString()} value={acc._id.toString()}>
                                        {acc.name} · {acc.currency}
                                    </SelectItem>
                                ))}
                                {compatibleAccounts.length === 0 && (
                                    <SelectItem value="_none" disabled>
                                        No hay cuentas compatibles con {debt.currency}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        {errors.accountId && <p className="text-xs text-destructive">{errors.accountId}</p>}
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
                        <Label htmlFor="collect-notes">Nota (opcional)</Label>
                        <Input
                            id="collect-notes"
                            placeholder="Descripción del cobro"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div
                        className="rounded-lg border p-3 space-y-1.5 text-xs"
                        style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
                    >
                        <div className="flex items-center gap-1.5 text-muted-foreground font-medium mb-1">
                            <Info size={13} />
                            Preview del cobro
                        </div>
                        {selectedAccount && parsedAmount > 0 && (
                            <p>
                                La cuenta <strong>{selectedAccount.name}</strong> subirá{' '}
                                <strong>{formatDebtAmount(parsedAmount, debt.currency)}</strong>
                            </p>
                        )}
                        {parsedAmount > 0 && (
                            <p>
                                La deuda a cobrar con <strong>{debt.counterpartyNameSnapshot}</strong> bajará a{' '}
                                <strong>{formatDebtAmount(newRemaining, debt.currency)}</strong>
                            </p>
                        )}
                        <p className="text-muted-foreground">No suma ingreso operativo.</p>
                        {debt.sourceType === 'space' && (
                            <p className="text-muted-foreground">También se registrará el cobro en el espacio.</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando…' : 'Registrar cobro'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
