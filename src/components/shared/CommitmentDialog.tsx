'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { commitmentSchema, type CommitmentFormData } from '@/lib/validations'
import { Spinner } from '@/components/shared/Spinner'
import type { IScheduledCommitment, ICategory } from '@/types'

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
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
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

    const expenseCategories = categories.filter((c) => c.type === 'expense')
    const recurrence = watch('recurrence')
    const currency = watch('currency')
    const categoryId = watch('categoryId')
    const applyMode = watch('applyMode')
    const startDate = watch('startDate')
    const endDate = watch('endDate')

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
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{commitment ? 'Editar compromiso' : 'Nuevo compromiso'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input id="description" placeholder="Ej: Alquiler" autoFocus {...register('description')} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto</Label>
                            <Input id="amount" type="number" min="0" step="0.01" placeholder="0.00"
                                   {...register('amount', { valueAsNumber: true })} />
                            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <Select value={currency} onValueChange={(v) => setValue('currency', v as CommitmentFormData['currency'])}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                                <Input id="dayOfMonth" type="number" min="1" max="31" placeholder="Ej: 10"
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
                                <SelectItem value="auto_month_start">Automático al inicio del mes</SelectItem>
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
                        <div className="space-y-2">
                            <Label>Fecha de inicio <span className="text-destructive">*</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? startDate.toLocaleDateString('es-AR') : 'Seleccioná fecha'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={(d) => d && setValue('startDate', d, { shouldValidate: true })}
                                    />
                                </PopoverContent>
                            </Popover>
                            {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Fecha de fin <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? endDate.toLocaleDateString('es-AR') : 'Sin fecha de fin'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={(d) => setValue('endDate', d ?? undefined)}
                                        disabled={(date) => startDate ? date < startDate : false}
                                    />
                                </PopoverContent>
                            </Popover>
                            {endDate && (
                                <button
                                    type="button"
                                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={() => setValue('endDate', undefined)}
                                >
                                    Quitar fecha de fin
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
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