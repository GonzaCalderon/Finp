'use client'

import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { commitmentSchema, type CommitmentFormData } from '@/lib/validations'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { Spinner } from '@/components/shared/Spinner'
import type { IScheduledCommitment, ICategory } from '@/types'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'

interface CommitmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    commitment: IScheduledCommitment | null
    categories: ICategory[]
    onSubmit: (data: CommitmentFormData) => Promise<void>
}

export function CommitmentDialog({
                                     open,
                                     onOpenChange,
                                     commitment,
                                     categories,
                                     onSubmit,
                                 }: CommitmentDialogProps) {
    const {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        formState: { errors, isSubmitting, submitCount },
    } = useForm<CommitmentFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(commitmentSchema) as any,
        defaultValues: {
            currency: 'ARS',
            recurrence: 'monthly',
            applyMode: 'manual',
            startDate: new Date(),
        },
    })

    const scrollRef = useRef<HTMLFormElement>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    const expenseCategories = categories.filter((c) => c.type === 'expense')
    const recurrence = useWatch({ control, name: 'recurrence' })
    const amount = useWatch({ control, name: 'amount' })
    const currency = useWatch({ control, name: 'currency' })
    const categoryId = useWatch({ control, name: 'categoryId' })
    const applyMode = useWatch({ control, name: 'applyMode' })
    const startDate = useWatch({ control, name: 'startDate' })
    const endDate = useWatch({ control, name: 'endDate' })

    useEffect(() => {
        if (open) {
            if (commitment) {
                reset({
                    description: commitment.description,
                    amount: commitment.amount,
                    currency: commitment.currency,
                    recurrence: commitment.recurrence,
                    dayOfMonth: commitment.dayOfMonth,
                    applyMode: commitment.applyMode,
                    categoryId: (commitment.categoryId as { _id?: { toString(): string } })?._id?.toString() ?? commitment.categoryId?.toString() ?? '',
                    startDate: commitment.startDate
                        ? new Date(String(commitment.startDate))
                        : new Date(),
                    endDate: commitment.endDate
                        ? new Date(String(commitment.endDate))
                        : undefined,
                })
            } else {
                reset({
                    currency: 'ARS',
                    recurrence: 'monthly',
                    applyMode: 'manual',
                    startDate: new Date(),
                })
            }
        }
    }, [open, commitment, reset])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="max-w-md p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>{commitment ? 'Editar compromiso' : 'Nuevo compromiso'}</DialogTitle>
                    <DialogDescription>
                        Defini monto, recurrencia y modo de aplicacion del compromiso.
                    </DialogDescription>
                </DialogHeader>

                <form ref={scrollRef} onSubmit={handleSubmit(onSubmit)} className="flex max-h-[100dvh] flex-col sm:max-h-[85vh]">
                    <div className="overflow-y-auto px-5 py-4 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input id="description" placeholder="Ej: Alquiler" autoFocus {...register('description')} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormattedAmountInput
                            id="amount"
                            label="Monto"
                            value={amount}
                            currency={currency}
                            autoFocus
                            error={errors.amount?.message}
                            onValueChangeAction={(value) =>
                                setValue('amount', value, { shouldValidate: true, shouldDirty: true })
                            }
                        />
                        <CurrencySelector
                            value={currency}
                            options={['ARS', 'USD'] as const}
                            onValueChange={(value) =>
                                setValue('currency', value, { shouldValidate: true, shouldDirty: true })
                            }
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Recurrencia</Label>
                            <Select value={recurrence} onValueChange={(v) => setValue('recurrence', v as CommitmentFormData['recurrence'])}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Mensual</SelectItem>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                    <SelectItem value="once">Una vez</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {recurrence === 'monthly' && (
                            <div className="space-y-2">
                                <Label htmlFor="dayOfMonth">Día del mes</Label>
                                <Input id="dayOfMonth" type="number" inputMode="numeric" min="1" max="31" placeholder="Ej: 10"
                                       {...register('dayOfMonth', { valueAsNumber: true })} />
                                {errors.dayOfMonth && <p className="text-xs text-destructive">{errors.dayOfMonth.message}</p>}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Modo de aplicación</Label>
                        <Select value={applyMode} onValueChange={(v) => setValue('applyMode', v as CommitmentFormData['applyMode'])}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="auto_month_start">Preparado para automatización</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {expenseCategories.length > 0 && (
                        <div className="space-y-2">
                            <Label>Categoría (opcional)</Label>
                            <Select value={categoryId} onValueChange={(v) => setValue('categoryId', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccioná categoría" /></SelectTrigger>
                                <SelectContent>
                                    {expenseCategories.map((c) => (
                                        <SelectItem key={c._id.toString()} value={c._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {c.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
                                                {c.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <DatePickerField
                            label="Fecha de inicio *"
                            value={startDate}
                            error={errors.startDate?.message}
                            onChange={(date) => {
                                if (date) setValue('startDate', date, { shouldValidate: true, shouldDirty: true })
                            }}
                        />
                        <DatePickerField
                            label="Fecha de fin (opcional)"
                            value={endDate}
                            minDate={startDate}
                            clearable
                            onChange={(date) =>
                                setValue('endDate', date, { shouldValidate: true, shouldDirty: true })
                            }
                        />
                    </div>

                    </div>

                    <div
                        className="sticky bottom-0 border-t bg-background px-5 py-4 safe-area-pb flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2"><Spinner />Guardando...</span>
                            ) : commitment ? 'Guardar cambios' : 'Crear compromiso'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
