'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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

interface CommitmentToApply {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
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

const getCurrentMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

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
        setValue,
        watch,
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

    const accountId = watch('accountId')

    useEffect(() => {
        if (open && commitment) {
            reset({
                amount: commitment.amount,
                accountId: '',
                notes: '',
                date: new Date().toISOString().split('T')[0],
            })
        }
    }, [open, commitment, reset])

    const handleFormSubmit = async (data: Record<string, unknown>) => {
        if (!commitment) return
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Aplicar compromiso</DialogTitle>
                    <DialogDescription>
                        {commitment.description} · {formatAmount(commitment.amount, commitment.currency)}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto</Label>
                        <Input
                            id="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            {...register('amount', { valueAsNumber: true })}
                        />
                    </div>

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

                    <div className="space-y-2">
                        <Label htmlFor="date">Fecha</Label>
                        <Input
                            id="date"
                            type="date"
                            {...register('date')}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Input
                            id="notes"
                            placeholder="Notas adicionales"
                            {...register('notes')}
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>


                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
      <Spinner /> Guardando...
    </span>
                            ) : commitment ? 'Guardar cambios' : 'Crear cuenta'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}