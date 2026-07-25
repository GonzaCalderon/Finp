'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { IAccount } from '@/types'
import {Spinner} from "@/components/shared/Spinner";
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'

interface CommitmentToApply {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
    /** Monto vigente para el período, resuelto por el servidor. */
    resolvedAmount?: number
    amountPolicy?: 'fixed' | 'variable'
    amountCertainty?: 'confirmed' | 'calculated' | 'estimated' | 'pending_amount'
    /** Cuenta habitual del compromiso, si tiene una. */
    defaultAccountId?: string
}

interface ApplyCommitmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    commitment: CommitmentToApply | null
    accounts: IAccount[]
    period: string
    onSubmit: (commitmentId: string, data: Record<string, unknown>) => Promise<void>
}

type AccountWithColor = IAccount & { color?: string }

export function ApplyCommitmentDialog({
                                          open,
                                          onOpenChange,
                                          commitment,
                                          accounts,
                                          period,
                                          onSubmit,
                                      }: ApplyCommitmentDialogProps) {
    const {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        formState: { isSubmitting },
    } = useForm({
        defaultValues: {
            amount: 0,
            accountId: '',
            notes: '',
            date: new Date().toISOString().split('T')[0],
        },
    })

    const accountId = useWatch({ control, name: 'accountId' })
    const amount = useWatch({ control, name: 'amount' })
    const date = useWatch({ control, name: 'date' })
    const [formError, setFormError] = useState<string | null>(null)

    const isVariable = commitment?.amountPolicy === 'variable'

    // El error se limpia al cerrar (handleOpenChange) y al reenviar, no acá:
    // llamar a setState dentro del efecto dispara renders en cascada.
    useEffect(() => {
        if (open && commitment) {
            reset({
                // Se prefiere el monto vigente del período sobre el de la plantilla.
                amount: commitment.resolvedAmount ?? commitment.amount,
                accountId: commitment.defaultAccountId ?? '',
                notes: '',
                date: new Date().toISOString().split('T')[0],
            })
        }
    }, [open, commitment, reset])

    const handleOpenChange = (next: boolean) => {
        if (!next) setFormError(null)
        onOpenChange(next)
    }

    const handleFormSubmit = async (data: Record<string, unknown>) => {
        if (!commitment) return

        // El servidor revalida, pero conviene explicar el problema sin ida y vuelta.
        if (!data.accountId) {
            setFormError('Elegí la cuenta de la que sale el dinero.')
            return
        }
        if (typeof data.amount !== 'number' || data.amount <= 0) {
            setFormError('Ingresá un monto mayor a 0.')
            return
        }

        setFormError(null)
        await onSubmit(commitment._id, {
            ...data,
            period,
        })
    }

    const formatAmount = (amount: number, currency: string) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount)

    if (!commitment) return null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="max-w-sm p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>Aplicar compromiso</DialogTitle>
                    <DialogDescription>
                        {commitment.description} · {formatAmount(commitment.amount, commitment.currency)}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="flex max-h-[100dvh] flex-col sm:max-h-[85vh]">
                    <div className="overflow-y-auto px-5 py-4 space-y-4">
                    <FormattedAmountInput
                        id="amount"
                        label={isVariable ? 'Monto real *' : 'Monto'}
                        value={amount}
                        currency={commitment.currency}
                        autoFocus
                        onValueChangeAction={(value) =>
                            setValue('amount', value, { shouldDirty: true })
                        }
                    />

                    {isVariable && (
                        <p className="-mt-2 text-xs text-muted-foreground">
                            {commitment.amountCertainty === 'pending_amount'
                                ? 'Este compromiso tiene monto variable: ingresá el importe de este período.'
                                : 'Este compromiso tiene monto variable. El importe propuesto es una estimación: confirmá el real antes de registrar.'}
                        </p>
                    )}

                    <div className="space-y-2">
                        <Label>Cuenta de débito</Label>
                        <Select
                            value={accountId}
                            onValueChange={(v) => setValue('accountId', v)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccioná cuenta" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts
                                    .filter((a) => !['credit_card', 'debt'].includes(a.type))
                                    .map((a) => {
                                        const acc = a as AccountWithColor
                                        return (
                                            <SelectItem key={acc._id.toString()} value={acc._id.toString()}>
                                                <div className="flex items-center gap-2">
                                                    {acc.color && (
                                                        <div
                                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: acc.color }}
                                                        />
                                                    )}
                                                    <span>{acc.name}</span>
                                                    <span className="text-xs text-muted-foreground">{acc.currency}</span>
                                                </div>
                                            </SelectItem>
                                        )
                                    })}
                            </SelectContent>
                        </Select>
                    </div>

                    <DatePickerField
                        value={date ? new Date(`${date}T12:00:00`) : undefined}
                        onChange={(nextDate) => {
                            if (!nextDate) return
                            const nextValue = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
                            setValue('date', nextValue, { shouldDirty: true })
                        }}
                    />

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Input
                            id="notes"
                            placeholder="Notas adicionales"
                            {...register('notes')}
                        />
                    </div>

                    {formError && (
                        <p role="alert" className="text-xs text-destructive">
                            {formError}
                        </p>
                    )}
                    </div>

                    <div
                        className="sticky bottom-0 border-t bg-background px-5 py-4 safe-area-pb flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                            Cancelar
                        </Button>


                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
      <Spinner /> Guardando...
    </span>
                            ) : 'Aplicar compromiso'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
