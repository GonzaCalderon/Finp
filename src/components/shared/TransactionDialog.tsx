'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, ChevronDown, ChevronUp, Wand2 } from 'lucide-react'

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
import type { ITransaction, IAccount, ICategory, ITransactionRule } from '@/types'
import { Spinner } from '@/components/shared/Spinner'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { evaluateRules } from '@/lib/utils/rules'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'

interface TransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: ITransaction | null
    accounts: IAccount[]
    categories: ICategory[]
    onSubmit: (data: TransactionFormData) => Promise<void>
    rules?: ITransactionRule[]
    defaultAccountId?: string
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
const SECONDARY_TYPES: TransactionFormInput['type'][] = ['transfer', 'credit_card_payment', 'adjustment']
const SECONDARY_TYPE_LABELS: Partial<Record<TransactionFormInput['type'], string>> = {
    transfer: 'Transferencia',
    credit_card_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}

export function TransactionDialog({
                                      open,
                                      onOpenChange,
                                      transaction,
                                      accounts,
                                      categories,
                                      onSubmit,
                                      rules = [],
                                      defaultAccountId,
                                  }: TransactionDialogProps) {
    const {
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting, submitCount },
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
    // Tracks whether the user manually picked a category (overrides rule suggestion)
    const [categoryManuallySet, setCategoryManuallySet] = useState(false)
    const [appliedRuleName, setAppliedRuleName] = useState<string | null>(null)

    const scrollRef = useRef<HTMLDivElement>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

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
            // Destino ingreso: no puede ser tarjeta ni deuda
            return accounts.filter(a => a.type !== 'credit_card' && a.type !== 'debt')
        }
        if (type === 'expense') {
            // Gasto: cualquier cuenta excepto deuda (credit_card OK para pago en 1 cuota)
            return accounts.filter(a => a.type !== 'debt')
        }
        if (type === 'credit_card_payment' || type === 'debt_payment') {
            // Origen del pago: no puede ser tarjeta ni deuda (se paga desde banco/efectivo/etc.)
            return accounts.filter(a => a.type !== 'credit_card' && a.type !== 'debt')
        }
        return accounts
    }, [accounts, type])

    const destinationAccounts = useMemo(() => {
        // credit_card_payment cubre tanto tarjetas como deudas (son el mismo flujo desde el usuario)
        if (type === 'credit_card_payment') {
            return accounts.filter(a => a.type === 'credit_card' || a.type === 'debt')
        }
        if (type === 'debt_payment') return accounts.filter(a => a.type === 'debt')
        return accounts
    }, [accounts, type])

    useEffect(() => {
        if (!open) return

        setCategoryManuallySet(false)
        setAppliedRuleName(null)

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
            sourceAccountId: defaultAccountId,
            destinationAccountId: undefined,
            notes: '',
            merchant: '',
        })
        setShowMoreOptions(false)
    }, [open, transaction, reset, defaultAccountId])

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

    // Rule suggestion: evaluate rules when description or merchant changes (only for new transactions)
    useEffect(() => {
        if (transaction) return // don't apply rules when editing
        if (!isQuickFlow) return // only for expense/income
        if (categoryManuallySet) return // user overrode, respect that

        const activeRules = rules.filter((r) => r.isActive)
        if (activeRules.length === 0) return

        const { matched, rule } = evaluateRules(activeRules, {
            type,
            description,
            merchant,
        })

        if (matched && rule) {
            const ruleCategoryId =
                (rule.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                rule.categoryId?.toString()
            if (ruleCategoryId) {
                setValue('categoryId', ruleCategoryId, { shouldValidate: true })
            }
            if (!merchant && rule.normalizeMerchant) {
                setValue('merchant', rule.normalizeMerchant, { shouldValidate: true })
            }
            setAppliedRuleName(rule.name)
        } else {
            setAppliedRuleName(null)
        }
    }, [description, merchant, type, rules, transaction, isQuickFlow, categoryManuallySet, setValue])

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
                    <div ref={scrollRef} className="overflow-y-auto px-5 py-4 space-y-5">
                        {/* Tipo */}
                        <div className="space-y-2">
                            <Label>Tipo</Label>

                            {/* Tipos principales: gasto e ingreso como acceso rápido */}
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

                            {/* Tipos secundarios: 3 botones compactos */}
                            <div className="grid grid-cols-3 gap-1.5">
                                {SECONDARY_TYPES.map((option) => {
                                    const selected = type === option
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() =>
                                                setValue('type', option, { shouldValidate: true })
                                            }
                                            className="rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors"
                                            style={{
                                                background: selected
                                                    ? 'rgba(99,102,241,0.12)'
                                                    : 'var(--secondary)',
                                                color: selected
                                                    ? '#6366F1'
                                                    : 'var(--muted-foreground)',
                                                borderColor: selected
                                                    ? 'rgba(99,102,241,0.5)'
                                                    : 'var(--border)',
                                            }}
                                        >
                                            {SECONDARY_TYPE_LABELS[option]}
                                        </button>
                                    )
                                })}
                            </div>

                            {errors.type ? (
                                <p className="text-sm text-destructive">{errors.type.message}</p>
                            ) : null}
                        </div>

                        {/* Monto + Moneda en la misma fila */}
                        <div className="grid grid-cols-3 gap-3 items-start">
                            <div className="col-span-2">
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
                            </div>
                            <div className="space-y-2">
                                <Label>Moneda</Label>
                                <Select
                                    value={currency}
                                    onValueChange={(value) =>
                                        setValue(
                                            'currency',
                                            value as TransactionFormInput['currency'],
                                            { shouldValidate: true }
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Moneda" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ARS">ARS</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errors.currency ? (
                                    <p className="text-sm text-destructive">{errors.currency.message}</p>
                                ) : null}
                            </div>
                        </div>

                        {/* Descripción — full width */}
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
                                <p className="text-sm text-destructive">{errors.description.message}</p>
                            ) : isQuickFlow && !transaction && rules.length > 0 ? (
                                <p
                                    className="flex items-center gap-1.5 text-xs"
                                    style={{ color: 'var(--muted-foreground)' }}
                                >
                                    <Wand2 size={10} className="shrink-0" />
                                    La descripción puede disparar reglas automáticas
                                </p>
                            ) : null}
                        </div>

                        {/* Cuenta de origen — antes de categoría */}
                        {showSource && (
                            <div className="space-y-2">
                                <Label>Cuenta de origen</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={(value) =>
                                        setValue('sourceAccountId', value || undefined, {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná cuenta de origen" />
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

                        {/* Cuenta destino (ingresos) — antes de categoría */}
                        {showDestination && type === 'income' && (
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
                                        {destinationAccounts.map((account) => (
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

                        {/* Categoría */}
                        {showCategory && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Categoría</Label>
                                    {appliedRuleName && !transaction && (
                                        <span
                                            className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
                                            style={{
                                                background: 'rgba(56,189,248,0.10)',
                                                color: 'var(--sky)',
                                            }}
                                        >
                                            <Wand2 size={10} />
                                            {appliedRuleName}
                                        </span>
                                    )}
                                </div>

                                {filteredCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {filteredCategories.map((category) => {
                                            const selected = categoryId === category._id.toString()
                                            return (
                                                <button
                                                    key={category._id.toString()}
                                                    type="button"
                                                    onClick={() => {
                                                        setValue('categoryId', category._id.toString(), {
                                                            shouldValidate: true,
                                                        })
                                                        setCategoryManuallySet(true)
                                                        setAppliedRuleName(null)
                                                    }}
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

                        {/* Cuenta destino (transferencias y otros) */}
                        {showDestination && type !== 'income' && (
                            <div className="space-y-2">
                                <Label>
                                    {['credit_card_payment', 'debt_payment'].includes(type)
                                        ? 'Tarjeta o cuenta a pagar'
                                        : 'Cuenta destino'}
                                </Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={(value) =>
                                        setValue('destinationAccountId', value || undefined, {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={
                                            ['credit_card_payment', 'debt_payment'].includes(type)
                                                ? 'Seleccioná tarjeta o deuda'
                                                : 'Seleccioná cuenta destino'
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinationAccounts.map((account) => (
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

                        {/* Más opciones (fecha, comercio, notas) */}
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
