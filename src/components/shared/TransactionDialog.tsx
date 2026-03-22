'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react'

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

import {
    transactionSchema,
    type TransactionFormInput,
    type TransactionFormData,
} from '@/lib/validations'
import type { ITransaction, IAccount, ICategory } from '@/types'
import { Spinner } from '@/components/shared/Spinner'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'

interface TransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: ITransaction | null
    accounts: IAccount[]
    categories: ICategory[]
    onSubmit: (data: TransactionFormData) => Promise<void>
}

const TRANSACTION_TYPE_LABELS: Record<TransactionFormInput['type'], string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de deuda',
    adjustment: 'Ajuste',
}

const QUICK_TYPES: TransactionFormInput['type'][] = ['expense', 'income']

export function TransactionDialog({
                                      open,
                                      onOpenChange,
                                      transaction,
                                      accounts,
                                      categories,
                                      onSubmit,
                                  }: TransactionDialogProps) {
    const {
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

    const [showMoreOptions, setShowMoreOptions] = useState(false)

    const watchedValues = watch()

    const type: TransactionFormInput['type'] =
        typeof watchedValues.type === 'string'
            ? (watchedValues.type as TransactionFormInput['type'])
            : 'expense'

    const amount =
        typeof watchedValues.amount === 'number' ? watchedValues.amount : 0

    const date =
        watchedValues.date instanceof Date ? watchedValues.date : undefined

    const currency: TransactionFormInput['currency'] =
        watchedValues.currency === 'USD' ? 'USD' : 'ARS'

    const sourceAccountId =
        typeof watchedValues.sourceAccountId === 'string'
            ? watchedValues.sourceAccountId
            : ''

    const destinationAccountId =
        typeof watchedValues.destinationAccountId === 'string'
            ? watchedValues.destinationAccountId
            : ''

    const categoryId =
        typeof watchedValues.categoryId === 'string' ? watchedValues.categoryId : ''

    const description =
        typeof watchedValues.description === 'string'
            ? watchedValues.description
            : ''

    const merchant =
        typeof watchedValues.merchant === 'string' ? watchedValues.merchant : ''

    const notes = typeof watchedValues.notes === 'string' ? watchedValues.notes : ''

    const filteredCategories = useMemo(
        () =>
            categories.filter((category) => {
                if (type === 'income') return category.type === 'income'
                if (type === 'expense') return category.type === 'expense'
                return false
            }),
        [categories, type]
    )

    const showSource = [
        'expense',
        'transfer',
        'credit_card_payment',
        'debt_payment',
        'adjustment',
    ].includes(type)

    const showDestination = [
        'income',
        'transfer',
        'credit_card_payment',
        'debt_payment',
    ].includes(type)

    const showCategory = ['income', 'expense'].includes(type)
    const isQuickFlow = type === 'income' || type === 'expense'

    const suggestedAccounts = useMemo(() => {
        if (type === 'income') {
            return accounts.filter(
                (account) => account.type !== 'credit_card' && account.type !== 'debt'
            )
        }

        if (type === 'expense') {
            return accounts.filter((account) => account.type !== 'debt')
        }

        return accounts
    }, [accounts, type])

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
                    (transaction.destinationAccountId as {
                        _id?: { toString(): string }
                    })?._id?.toString() ??
                    transaction.destinationAccountId?.toString() ??
                    undefined,
                notes: transaction.notes ?? '',
                merchant: transaction.merchant ?? '',
            })
            setShowMoreOptions(Boolean(transaction.notes || transaction.merchant))
            return
        }

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
        setShowMoreOptions(false)
    }, [open, transaction, reset])

    useEffect(() => {
        if (!showCategory) {
            setValue('categoryId', undefined, { shouldValidate: true })
        }
    }, [showCategory, setValue])

    useEffect(() => {
        if (!showSource) {
            setValue('sourceAccountId', undefined, { shouldValidate: true })
        }
        if (!showDestination) {
            setValue('destinationAccountId', undefined, { shouldValidate: true })
        }
    }, [showSource, showDestination, setValue])

    const handleFormSubmit = async (data: TransactionFormData) => {
        await onSubmit(data)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>
                        {transaction ? 'Editar transacción' : 'Nueva transacción'}
                    </DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit(handleFormSubmit)}
                    className="flex max-h-[85vh] flex-col"
                >
                    <div className="overflow-y-auto px-5 py-4 space-y-5">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {QUICK_TYPES.map((option) => {
                                    const selected = type === option
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() =>
                                                setValue('type', option, {
                                                    shouldValidate: true,
                                                })
                                            }
                                            className="rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                                            style={{
                                                background: selected ? 'var(--sky)' : 'var(--secondary)',
                                                color: selected ? '#fff' : 'var(--foreground)',
                                                borderColor: selected ? 'var(--sky)' : 'var(--border)',
                                            }}
                                        >
                                            {TRANSACTION_TYPE_LABELS[option]}
                                        </button>
                                    )
                                })}
                            </div>

                            {!isQuickFlow && (
                                <Select
                                    value={type}
                                    onValueChange={(value) =>
                                        setValue('type', value as TransactionFormInput['type'], {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(TRANSACTION_TYPE_LABELS).map(
                                            ([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            )
                                        )}
                                    </SelectContent>
                                </Select>
                            )}

                            {errors.type ? (
                                <p className="text-sm text-destructive">{errors.type.message}</p>
                            ) : null}
                        </div>

                        <FormattedAmountInput
                            id="amount"
                            label="Monto"
                            value={amount}
                            currency={currency}
                            autoFocus
                            error={errors.amount?.message}
                            onValueChangeAction={(nextAmount) =>
                                setValue('amount', nextAmount, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                })
                            }
                        />

                        <div className="space-y-2">
                            <Label>Moneda</Label>
                            <Select
                                value={currency}
                                onValueChange={(value) =>
                                    setValue(
                                        'currency',
                                        value as TransactionFormInput['currency'],
                                        {
                                            shouldValidate: true,
                                        }
                                    )
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná moneda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.currency ? (
                                <p className="text-sm text-destructive">
                                    {errors.currency.message}
                                </p>
                            ) : null}
                        </div>

                        {showCategory && (
                            <div className="space-y-2">
                                <Label>Categoría</Label>

                                {filteredCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {filteredCategories.map((category) => {
                                            const selected = categoryId === category._id.toString()
                                            return (
                                                <button
                                                    key={category._id.toString()}
                                                    type="button"
                                                    onClick={() =>
                                                        setValue('categoryId', category._id.toString(), {
                                                            shouldValidate: true,
                                                        })
                                                    }
                                                    className="rounded-full border px-3 py-2 text-xs font-medium transition-colors"
                                                    style={{
                                                        background: selected
                                                            ? category.color || 'var(--sky)'
                                                            : category.type === 'income'
                                                                ? 'rgba(16, 185, 129, 0.10)'
                                                                : 'rgba(239, 68, 68, 0.10)',
                                                        color: selected
                                                            ? '#fff'
                                                            : category.type === 'income'
                                                                ? '#059669'
                                                                : '#DC2626',
                                                        borderColor: selected
                                                            ? category.color || 'var(--sky)'
                                                            : category.type === 'income'
                                                                ? 'rgba(16, 185, 129, 0.22)'
                                                                : 'rgba(239, 68, 68, 0.22)',
                                                    }}
                                                >
                                                    {category.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No hay categorías para este tipo.
                                    </p>
                                )}

                                {errors.categoryId ? (
                                    <p className="text-sm text-destructive">
                                        {errors.categoryId.message}
                                    </p>
                                ) : null}
                            </div>
                        )}

                        {showSource && (
                            <div className="space-y-2">
                                <Label>Cuenta origen</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={(value) =>
                                        setValue('sourceAccountId', value || undefined, {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná cuenta origen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suggestedAccounts.map((account) => (
                                            <SelectItem
                                                key={account._id.toString()}
                                                value={account._id.toString()}
                                            >
                                                {account.name} · {account.currency}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.sourceAccountId ? (
                                    <p className="text-sm text-destructive">
                                        {errors.sourceAccountId.message}
                                    </p>
                                ) : null}
                            </div>
                        )}

                        {showDestination && (
                            <div className="space-y-2">
                                <Label>Cuenta destino</Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={(value) =>
                                        setValue('destinationAccountId', value || undefined, {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná cuenta destino" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map((account) => (
                                            <SelectItem
                                                key={account._id.toString()}
                                                value={account._id.toString()}
                                            >
                                                {account.name} · {account.currency}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.destinationAccountId ? (
                                    <p className="text-sm text-destructive">
                                        {errors.destinationAccountId.message}
                                    </p>
                                ) : null}
                            </div>
                        )}

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setShowMoreOptions((prev) => !prev)}
                                className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"
                                style={{ borderColor: 'var(--border)' }}
                            >
                                <span>Más opciones</span>
                                {showMoreOptions ? (
                                    <ChevronUp size={16} />
                                ) : (
                                    <ChevronDown size={16} />
                                )}
                            </button>

                            {showMoreOptions && (
                                <div
                                    className="space-y-4 rounded-xl border p-3"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    <div className="space-y-2">
                                        <Label>Fecha</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-start">
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date instanceof Date
                                                        ? date.toLocaleDateString('es-AR')
                                                        : 'Seleccioná fecha'}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={date}
                                                    onSelect={(selectedDate) =>
                                                        selectedDate &&
                                                        setValue('date', selectedDate, {
                                                            shouldValidate: true,
                                                        })
                                                    }
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        {errors.date ? (
                                            <p className="text-sm text-destructive">
                                                {errors.date.message}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="description">Descripción</Label>
                                        <Input
                                            id="description"
                                            value={description}
                                            onChange={(e) =>
                                                setValue('description', e.target.value, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                            placeholder="Ej: Compra en kiosco"
                                        />
                                        {errors.description ? (
                                            <p className="text-sm text-destructive">
                                                {errors.description.message}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                                        <Input
                                            id="merchant"
                                            value={merchant}
                                            onChange={(e) =>
                                                setValue('merchant', e.target.value, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                        {errors.merchant ? (
                                            <p className="text-sm text-destructive">
                                                {errors.merchant.message}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Notas (opcional)</Label>
                                        <Input
                                            id="notes"
                                            value={notes}
                                            onChange={(e) =>
                                                setValue('notes', e.target.value, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                        {errors.notes ? (
                                            <p className="text-sm text-destructive">
                                                {errors.notes.message}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className="border-t px-5 py-4 flex gap-2 sticky bottom-0 bg-background"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                            {isSubmitting ? (
                                <>
                                    <Spinner className="mr-2" />
                                    Guardando...
                                </>
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