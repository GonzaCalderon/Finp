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
import {
    transactionSchema,
    type TransactionFormInput,
    type TransactionFormData,
} from '@/lib/validations'
import type { ITransaction, IAccount, ICategory } from '@/types'
import { Spinner } from '@/components/shared/Spinner'

interface TransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: ITransaction | null
    accounts: IAccount[]
    categories: ICategory[]
    onSubmit: (data: TransactionFormData) => Promise<void>
}

const TRANSACTION_TYPE_LABELS: Record<TransactionFormData['type'], string> = {
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
    } = useForm<TransactionFormInput, unknown, TransactionFormData>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            type: 'expense',
            amount: 0,
            currency: 'ARS',
            date: new Date(),
            description: '',
            categoryId: undefined,
            sourceAccountId: undefined,
            destinationAccountId: undefined,
            notes: '',
            merchant: '',
        },
    })

    const type = watch('type') as TransactionFormData['type']
    const date = watch('date') as Date | undefined
    const currency = watch('currency') as TransactionFormData['currency']
    const sourceAccountId = watch('sourceAccountId') as string | undefined
    const destinationAccountId = watch('destinationAccountId') as string | undefined
    const categoryId = watch('categoryId') as string | undefined

    const filteredCategories = categories.filter((c) => {
        if (type === 'income') return c.type === 'income'
        if (type === 'expense') return c.type === 'expense'
        return false
    })

    const showSource = ['expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment'].includes(type)
    const showDestination = ['income', 'transfer', 'credit_card_payment', 'debt_payment'].includes(type)
    const showCategory = ['income', 'expense'].includes(type)

    useEffect(() => {
        if (!open) return

        if (transaction) {
            reset({
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                date: new Date(transaction.date),
                description: transaction.description,
                categoryId:
                    (transaction.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                    transaction.categoryId?.toString() ??
                    undefined,
                sourceAccountId:
                    (transaction.sourceAccountId as { _id?: { toString(): string } })?._id?.toString() ??
                    transaction.sourceAccountId?.toString() ??
                    undefined,
                destinationAccountId:
                    (transaction.destinationAccountId as { _id?: { toString(): string } })?._id?.toString() ??
                    transaction.destinationAccountId?.toString() ??
                    undefined,
                notes: transaction.notes ?? '',
                merchant: transaction.merchant ?? '',
            })
        } else {
            reset({
                type: 'expense',
                amount: 0,
                currency: 'ARS',
                date: new Date(),
                description: '',
                categoryId: undefined,
                sourceAccountId: undefined,
                destinationAccountId: undefined,
                notes: '',
                merchant: '',
            })
        }
    }, [open, transaction, reset])

    const handleFormSubmit = async (data: TransactionFormData) => {
        await onSubmit(data)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{transaction ? 'Editar transacción' : 'Nueva transacción'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                            value={type}
                            onValueChange={(v) =>
                                setValue('type', v as TransactionFormInput['type'], { shouldValidate: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Monto</Label>
                            <Input
                                id="amount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                autoFocus
                                {...register('amount', { valueAsNumber: true })}
                            />
                            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <Select
                                value={currency}
                                onValueChange={(v) =>
                                    setValue('currency', v as TransactionFormInput['currency'], {
                                        shouldValidate: true,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Seleccioná fecha'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date instanceof Date ? date : undefined}
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
                            <Select
                                value={categoryId ?? ''}
                                onValueChange={(v) =>
                                    setValue('categoryId', v || undefined, { shouldValidate: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredCategories.map((c) => (
                                        <SelectItem key={c._id.toString()} value={c._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {c.color && (
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: c.color }}
                                                    />
                                                )}
                                                {c.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.categoryId && (
                                <p className="text-xs text-destructive">{errors.categoryId.message}</p>
                            )}
                        </div>
                    )}

                    {showSource && (
                        <div className="space-y-2">
                            <Label>Cuenta origen</Label>
                            <Select
                                value={sourceAccountId ?? ''}
                                onValueChange={(v) =>
                                    setValue('sourceAccountId', v || undefined, { shouldValidate: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id.toString()} value={a._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {(a as IAccount & { color?: string }).color && (
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{
                                                            backgroundColor: (a as IAccount & { color?: string }).color,
                                                        }}
                                                    />
                                                )}
                                                <span>{a.name}</span>
                                                <span className="text-xs text-muted-foreground">{a.currency}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.sourceAccountId && (
                                <p className="text-xs text-destructive">{errors.sourceAccountId.message}</p>
                            )}
                        </div>
                    )}

                    {showDestination && (
                        <div className="space-y-2">
                            <Label>Cuenta destino</Label>
                            <Select
                                value={destinationAccountId ?? ''}
                                onValueChange={(v) =>
                                    setValue('destinationAccountId', v || undefined, { shouldValidate: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map((a) => (
                                        <SelectItem key={a._id.toString()} value={a._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {(a as IAccount & { color?: string }).color && (
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{
                                                            backgroundColor: (a as IAccount & { color?: string }).color,
                                                        }}
                                                    />
                                                )}
                                                <span>{a.name}</span>
                                                <span className="text-xs text-muted-foreground">{a.currency}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.destinationAccountId && (
                                <p className="text-xs text-destructive">{errors.destinationAccountId.message}</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                        <Input id="merchant" placeholder="Ej: Carrefour" {...register('merchant')} />
                        {errors.merchant && <p className="text-xs text-destructive">{errors.merchant.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Input id="notes" placeholder="Notas adicionales" {...register('notes')} />
                        {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
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
                            ) : transaction ? (
                                'Guardar cambios'
                            ) : (
                                'Crear transacción'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}