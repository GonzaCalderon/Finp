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
import { transactionSchema, type TransactionFormData } from '@/lib/validations'
import type { ITransaction, IAccount, ICategory } from '@/types'

interface TransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: ITransaction | null
    accounts: IAccount[]
    categories: ICategory[]
    onSubmit: (data: TransactionFormData) => Promise<void>
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de deuda',
    adjustment: 'Ajuste',
}

export function TransactionDialog({
                                      open,
                                      onOpenChange,
                                      transaction,
                                      accounts,
                                      categories,
                                      onSubmit,
                                  }: TransactionDialogProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            type: 'expense',
            currency: 'ARS',
            date: new Date(),
        },
    })

    const type = watch('type')
    const date = watch('date')
    const currency = watch('currency')
    const sourceAccountId = watch('sourceAccountId')
    const destinationAccountId = watch('destinationAccountId')
    const categoryId = watch('categoryId')

    const filteredCategories = categories.filter((c) => {
        if (type === 'income') return c.type === 'income'
        if (type === 'expense') return c.type === 'expense'
        return false
    })

    const showSource = ['expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment'].includes(type)
    const showDestination = ['income', 'transfer', 'credit_card_payment', 'debt_payment'].includes(type)
    const showCategory = ['income', 'expense'].includes(type)

    useEffect(() => {
        if (open) {
            if (transaction) {
                reset({
                    type: transaction.type,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    date: new Date(transaction.date),
                    description: transaction.description,
                    categoryId: transaction.categoryId?.toString() ?? '',
                    sourceAccountId: transaction.sourceAccountId?.toString() ?? '',
                    destinationAccountId: transaction.destinationAccountId?.toString() ?? '',
                    notes: transaction.notes ?? '',
                    merchant: transaction.merchant ?? '',
                })
            } else {
                reset({
                    type: 'expense',
                    currency: 'ARS',
                    date: new Date(),
                })
            }
        }
    }, [open, transaction, reset])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{transaction ? 'Editar transacción' : 'Nueva transacción'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={type} onValueChange={(v) => setValue('type', v as TransactionFormData['type'], { shouldValidate: true })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto</Label>
                            <Input id="amount" type="number" min="0" step="0.01" placeholder="0.00" {...register('amount')} />
                            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <Select value={currency} onValueChange={(v) => setValue('currency', v as TransactionFormData['currency'])}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? date.toLocaleDateString('es-AR') : 'Seleccioná fecha'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={(d) => d && setValue('date', d, { shouldValidate: true })}
                                />
                            </PopoverContent>
                        </Popover>
                        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input id="description" placeholder="Ej: Supermercado Dia" {...register('description')} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                    </div>

                    {showCategory && filteredCategories.length > 0 && (
                        <div className="space-y-2">
                            <Label>Categoría</Label>
                            <Select value={categoryId} onValueChange={(v) => setValue('categoryId', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccioná categoría" /></SelectTrigger>
                                <SelectContent>
                                    {filteredCategories.map((c) => (
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

                    {showSource && (
                        <div className="space-y-2">
                            <Label>Cuenta origen</Label>
                            <Select value={sourceAccountId} onValueChange={(v) => setValue('sourceAccountId', v, { shouldValidate: true })}>
                                <SelectTrigger><SelectValue placeholder="Seleccioná cuenta" /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id.toString()} value={a._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {(a as IAccount & { color?: string }).color && (
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (a as IAccount & { color?: string }).color }} />
                                                )}
                                                <span>{a.name}</span>
                                                <span className="text-xs text-muted-foreground">{a.currency}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.sourceAccountId && <p className="text-xs text-destructive">{errors.sourceAccountId.message}</p>}
                        </div>
                    )}

                    {showDestination && (
                        <div className="space-y-2">
                            <Label>Cuenta destino</Label>
                            <Select value={destinationAccountId} onValueChange={(v) => setValue('destinationAccountId', v, { shouldValidate: true })}>
                                <SelectTrigger><SelectValue placeholder="Seleccioná cuenta" /></SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id.toString()} value={a._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {(a as IAccount & { color?: string }).color && (
                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (a as IAccount & { color?: string }).color }} />
                                                )}
                                                <span>{a.name}</span>
                                                <span className="text-xs text-muted-foreground">{a.currency}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.destinationAccountId && <p className="text-xs text-destructive">{errors.destinationAccountId.message}</p>}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                        <Input id="merchant" placeholder="Ej: Carrefour" {...register('merchant')} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Input id="notes" placeholder="Notas adicionales" {...register('notes')} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : transaction ? 'Guardar cambios' : 'Crear transacción'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}