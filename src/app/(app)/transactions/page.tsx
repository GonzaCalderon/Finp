'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, SlidersHorizontal, X, ChevronDown, Pencil, Trash2, Upload } from 'lucide-react'
import Link from 'next/link'

import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { usePreferences } from '@/hooks/usePreferences'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { InstallmentDialog } from '@/components/shared/InstallmentDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { Spinner } from '@/components/shared/Spinner'

import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { isCategoryCompatible, normalizeFilters } from '@/lib/utils/transactions'
import type { CategoryOption, Filters } from '@/lib/utils/transactions'
import type { TransactionFormData, InstallmentFormData } from '@/lib/validations'
import type { ICategory, ITransaction, IAccount } from '@/types'

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    credit_card_payment: 'Pago tarjeta',
    debt_payment: 'Pago deuda',
    adjustment: 'Ajuste',
}

const TRANSACTION_TYPE_COLORS: Record<
    string,
    'default' | 'destructive' | 'secondary' | 'outline'
> = {
    income: 'default',
    expense: 'destructive',
    transfer: 'secondary',
    credit_card_payment: 'outline',
    debt_payment: 'outline',
    adjustment: 'secondary',
}

const SORT_OPTIONS = [
    { value: 'date_desc', label: 'Más reciente' },
    { value: 'date_asc', label: 'Más antigua' },
    { value: 'amount_desc', label: 'Mayor monto' },
    { value: 'amount_asc', label: 'Menor monto' },
    { value: 'description_asc', label: 'A → Z' },
] as const

const DEFAULT_SORT = 'date_desc'

const getCurrentMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)

    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('es-AR', {
        month: 'long',
        year: 'numeric',
    })

    return { value, label }
})

type BasicOption = {
    value: string
    label: string
}

const DEFAULT_FILTERS: Filters = {
    type: '',
    categoryId: '',
    accountId: '',
}

const CATEGORY_TYPE_META: Record<string, { bg: string; border: string; text: string }> = {
    income: {
        bg: 'rgba(16, 185, 129, 0.10)',
        border: 'rgba(16, 185, 129, 0.22)',
        text: '#059669',
    },
    expense: {
        bg: 'rgba(239, 68, 68, 0.10)',
        border: 'rgba(239, 68, 68, 0.22)',
        text: '#DC2626',
    },
}

function BasicFilterChip({
                             label,
                             active,
                             options,
                             value,
                             onChange,
                         }: {
    label: string
    active: boolean
    options: BasicOption[]
    value: string
    onChange: (v: string) => void
}) {
    const [open, setOpen] = useState(false)

    const selectedLabel = options.find((option) => option.value === value)?.label

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                    background: active ? 'var(--sky)' : 'var(--secondary)',
                    color: active ? '#fff' : 'var(--muted-foreground)',
                    border: `0.5px solid ${active ? 'var(--sky)' : 'var(--border)'}`,
                }}
            >
                {active ? selectedLabel : label}
                <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar selector"
                    />

                    <div
                        className="absolute top-full mt-2 right-0 z-40 min-w-44 rounded-xl border shadow-lg p-1.5"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                onChange('')
                                setOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors rounded-md"
                            style={{
                                color: !value ? 'var(--sky)' : 'var(--muted-foreground)',
                            }}
                        >
                            Todos
                        </button>

                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value)
                                    setOpen(false)
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors rounded-md"
                                style={{
                                    color: value === option.value ? 'var(--sky)' : 'var(--foreground)',
                                    fontWeight: value === option.value ? 500 : 400,
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

function TypeFilterChip({
                            value,
                            onChange,
                            activeCategoryType,
                        }: {
    value: string
    onChange: (value: string) => void
    activeCategoryType: string
}) {
    const [open, setOpen] = useState(false)

    const selectedLabel = TRANSACTION_TYPE_LABELS[value] ?? 'Tipo'

    const typeOptions = [
        { value: 'income', label: 'Ingreso' },
        { value: 'expense', label: 'Gasto' },
    ]

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                    background: value ? 'var(--sky)' : 'var(--secondary)',
                    color: value ? '#fff' : 'var(--muted-foreground)',
                    border: `0.5px solid ${value ? 'var(--sky)' : 'var(--border)'}`,
                }}
            >
                {value ? selectedLabel : 'Tipo'}
                <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar selector"
                    />

                    <div
                        className="absolute top-full mt-2 right-0 z-40 min-w-44 rounded-xl border shadow-lg p-1.5"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                onChange('')
                                setOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors rounded-md"
                            style={{
                                color: !value ? 'var(--sky)' : 'var(--muted-foreground)',
                            }}
                        >
                            Todos
                        </button>

                        {typeOptions.map((option) => {
                            const isSuggestedConflict =
                                activeCategoryType && activeCategoryType !== option.value

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value)
                                        setOpen(false)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors rounded-md"
                                    style={{
                                        color: value === option.value ? 'var(--sky)' : 'var(--foreground)',
                                        fontWeight: value === option.value ? 500 : 400,
                                        opacity: isSuggestedConflict ? 0.7 : 1,
                                    }}
                                >
                                    {option.label}
                                    {isSuggestedConflict ? ' · limpia categoría' : ''}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

function CategoryFilterChip({
                                value,
                                onChange,
                                options,
                                selectedType,
                            }: {
    value: string
    onChange: (value: string) => void
    options: CategoryOption[]
    selectedType: string
}) {
    const [open, setOpen] = useState(false)

    const selectedCategory = options.find((option) => option.value === value)

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                    background: value ? 'var(--sky)' : 'var(--secondary)',
                    color: value ? '#fff' : 'var(--muted-foreground)',
                    border: `0.5px solid ${value ? 'var(--sky)' : 'var(--border)'}`,
                }}
            >
                {value ? selectedCategory?.label : 'Categoría'}
                <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar selector"
                    />

                    <div
                        className="absolute top-full mt-2 right-0 z-40 min-w-60 max-w-72 rounded-xl border shadow-lg p-1.5"
                        style={{
                            background: 'var(--card)',
                            borderColor: 'var(--border)',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                onChange('')
                                setOpen(false)
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors rounded-md"
                            style={{
                                color: !value ? 'var(--sky)' : 'var(--muted-foreground)',
                            }}
                        >
                            Todas
                        </button>

                        <div className="mt-1 space-y-1">
                            {options.map((option) => {
                                const meta = CATEGORY_TYPE_META[option.type] ?? {
                                    bg: 'var(--secondary)',
                                    border: 'var(--border)',
                                    text: 'var(--foreground)',
                                }

                                const isSelected = value === option.value
                                const isDisabled = !isCategoryCompatible(option.type, selectedType)

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        disabled={isDisabled}
                                        onClick={() => {
                                            onChange(option.value)
                                            setOpen(false)
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border"
                                        style={{
                                            background: isSelected ? option.color ?? meta.text : meta.bg,
                                            color: isSelected ? '#fff' : isDisabled ? 'var(--muted-foreground)' : meta.text,
                                            borderColor: isSelected ? option.color ?? meta.text : meta.border,
                                            opacity: isDisabled ? 0.45 : 1,
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate">{option.label}</span>
                      <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                              background: isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.55)',
                              color: isSelected ? '#fff' : meta.text,
                          }}
                      >
                        {option.type === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function FilterSheet({
                         open,
                         onClose,
                         filters,
                         onChange,
                         onApply,
                         onClear,
                         typeOptions,
                         categoryOptions,
                         accountOptions,
                         activeCount,
                     }: {
    open: boolean
    onClose: () => void
    filters: Filters
    onChange: (key: keyof Filters, value: string) => void
    onApply: () => void
    onClear: () => void
    typeOptions: BasicOption[]
    categoryOptions: CategoryOption[]
    accountOptions: BasicOption[]
    activeCount: number
}) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        aria-label="Cerrar filtros"
                        className="fixed inset-0 z-40 bg-black/40 md:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-3xl border-t shadow-2xl"
                        style={{
                            background: 'var(--background)',
                            borderColor: 'var(--border)',
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                    >
                        <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-muted" />

                        <div className="px-4 pb-5 max-h-[80vh] overflow-y-auto">
                            <div className="flex items-start justify-between gap-4 mb-5">
                                <div>
                                    <h3 className="text-base font-semibold">Filtros</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Ajustá los filtros y aplicalos cuando estés listo.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-full p-2 transition-colors hover:bg-muted"
                                    aria-label="Cerrar filtros"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {activeCount > 0 && (
                                <div className="mb-5">
                                    <button
                                        type="button"
                                        onClick={onClear}
                                        className="flex items-center gap-1 text-xs font-medium"
                                        style={{ color: 'var(--sky)' }}
                                    >
                                        Limpiar filtros
                                    </button>
                                </div>
                            )}

                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs font-medium mb-2">Tipo</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ value: '', label: 'Todos' }, ...typeOptions].map((option) => {
                                            const selectedCategory = categoryOptions.find(
                                                (category) => category.value === filters.categoryId
                                            )
                                            const isConflict =
                                                option.value &&
                                                selectedCategory &&
                                                selectedCategory.type !== option.value

                                            return (
                                                <button
                                                    key={option.value || 'all-type'}
                                                    type="button"
                                                    onClick={() => onChange('type', option.value)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                    style={{
                                                        background:
                                                            filters.type === option.value ? 'var(--sky)' : 'var(--secondary)',
                                                        color: filters.type === option.value ? '#fff' : 'var(--foreground)',
                                                        opacity: isConflict ? 0.75 : 1,
                                                    }}
                                                >
                                                    {option.label}
                                                    {isConflict ? ' · limpia categoría' : ''}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-medium mb-2">Categoría</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onChange('categoryId', '')}
                                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors border"
                                            style={{
                                                background: filters.categoryId === '' ? 'var(--sky)' : 'var(--secondary)',
                                                color: filters.categoryId === '' ? '#fff' : 'var(--foreground)',
                                                borderColor: filters.categoryId === '' ? 'var(--sky)' : 'var(--border)',
                                            }}
                                        >
                                            Todas
                                        </button>

                                        {categoryOptions.map((option) => {
                                            const meta = CATEGORY_TYPE_META[option.type] ?? {
                                                bg: 'var(--secondary)',
                                                border: 'var(--border)',
                                                text: 'var(--foreground)',
                                            }

                                            const isSelected = filters.categoryId === option.value
                                            const isDisabled = !isCategoryCompatible(option.type, filters.type)

                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    onClick={() => onChange('categoryId', option.value)}
                                                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors border"
                                                    style={{
                                                        background: isSelected ? option.color ?? meta.text : meta.bg,
                                                        color: isSelected ? '#fff' : isDisabled ? 'var(--muted-foreground)' : meta.text,
                                                        borderColor: isSelected ? option.color ?? meta.text : meta.border,
                                                        opacity: isDisabled ? 0.45 : 1,
                                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    }}
                                                >
                                                    {option.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-medium mb-2">Cuenta</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ value: '', label: 'Todas' }, ...accountOptions].map((option) => (
                                            <button
                                                key={option.value || 'all-account'}
                                                type="button"
                                                onClick={() => onChange('accountId', option.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background:
                                                        filters.accountId === option.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.accountId === option.value ? '#fff' : 'var(--foreground)',
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                    Cancelar
                                </Button>
                                <Button type="button" className="flex-1" onClick={onApply}>
                                    Aplicar
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default function TransactionsPage() {
    const [month, setMonth] = useState(getCurrentMonth())
    const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [sort, setSort] = useState(DEFAULT_SORT)
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
    const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<ITransaction | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { rules } = useTransactionRules()
    const { preferences } = usePreferences()

    const categoryOptions = useMemo<CategoryOption[]>(
        () =>
            categories.map((category: ICategory) => ({
                value: category._id.toString(),
                label: category.name,
                type: category.type,
                color: category.color,
            })),
        [categories]
    )

    const {
        transactions,
        loading,
        refreshing,
        loadingMore,
        error,
        hasMore,
        total,
        loadMore,
        createTransaction,
        updateTransaction,
        deleteTransaction,
    } = useTransactions({
        month,
        type: appliedFilters.type || undefined,
        categoryId: appliedFilters.categoryId || undefined,
        accountId: appliedFilters.accountId || undefined,
        sort,
    })

    const { createPlan } = useInstallments()
    const { success, error: toastError } = useToast()
    const { hidden } = useHideAmounts()

    usePageTitle('Transacciones')

    const handleNewTransaction = useCallback(() => {
        setSelectedTransaction(null)
        setTransactionDialogOpen(true)
    }, [])

    useKeyboardShortcuts([{ key: 'n', handler: handleNewTransaction }])

    const handleEdit = (transaction: ITransaction) => {
        setSelectedTransaction(transaction)
        setTransactionDialogOpen(true)
    }

    const handleDelete = (id: string) => {
        setDeleteId(id)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return

        try {
            await deleteTransaction(deleteId)
            success('Transacción eliminada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar transacción')
        } finally {
            setDeleteId(null)
        }
    }

    const handleTransactionSubmit = async (data: TransactionFormData) => {
        try {
            if (selectedTransaction) {
                await updateTransaction(selectedTransaction._id.toString(), data)
                success('Transacción actualizada correctamente')
            } else {
                await createTransaction(data)
                success('Transacción registrada correctamente')
            }

            setTransactionDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar transacción')
        }
    }

    const handleInstallmentSubmit = async (data: InstallmentFormData) => {
        try {
            await createPlan(data as never)
            success('Compra en cuotas registrada correctamente')
            setInstallmentDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al registrar compra en cuotas')
        }
    }

    const setAppliedFilter = (key: keyof Filters, value: string) => {
        setAppliedFilters((prev) => normalizeFilters({ ...prev, [key]: value }, categoryOptions))
    }

    const setDraftFilter = (key: keyof Filters, value: string) => {
        setDraftFilters((prev) => normalizeFilters({ ...prev, [key]: value }, categoryOptions))
    }

    const clearAppliedFilters = () => {
        setAppliedFilters(DEFAULT_FILTERS)
        setDraftFilters(DEFAULT_FILTERS)
    }

    const clearDraftFilters = () => {
        setDraftFilters(DEFAULT_FILTERS)
    }

    const openFilterSheet = () => {
        setDraftFilters(appliedFilters)
        setFilterSheetOpen(true)
    }

    const applyDraftFilters = () => {
        setAppliedFilters(normalizeFilters(draftFilters, categoryOptions))
        setFilterSheetOpen(false)
    }

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (appliedFilters.type) count++
        if (appliedFilters.categoryId) count++
        if (appliedFilters.accountId) count++
        return count
    }, [appliedFilters])

    const typeOptions = useMemo<BasicOption[]>(
        () => [
            { value: 'income', label: 'Ingreso' },
            { value: 'expense', label: 'Gasto' },
        ],
        []
    )

    const accountOptions = useMemo<BasicOption[]>(
        () =>
            accounts.map((account) => ({
                value: account._id.toString(),
                label: account.name,
            })),
        [accounts]
    )

    const selectedAppliedCategoryType =
        categoryOptions.find((category) => category.value === appliedFilters.categoryId)?.type ?? ''

    const totalIncome = transactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amount, 0)

    const totalExpense = transactions
        .filter((transaction) => transaction.type === 'expense' && !transaction.installmentPlanId)
        .reduce((sum, transaction) => sum + transaction.amount, 0)

    const fmt = (amount: number, currency: string) =>
        hidden
            ? '••••'
            : new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(amount)

    if (loading) {
        return (
            <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <Skeleton className="h-8 w-52" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <div className="space-y-2">
                    {[...Array(5)].map((_, index) => (
                        <Skeleton key={index} className="h-16 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return <div className="p-8 text-center text-destructive text-sm">{error}</div>
    }

    return (
        <motion.div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4" {...fadeIn}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">Transacciones</h1>
                    {refreshing && <Spinner className="text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-36 sm:w-44 h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTHS.map((monthOption) => (
                                <SelectItem key={monthOption.value} value={monthOption.value}>
                                    {monthOption.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="hidden sm:flex" asChild>
                        <Link href="/transactions/import">
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Importar
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="hidden sm:flex" onClick={() => setInstallmentDialogOpen(true)}>
                        + Cuotas
                    </Button>
                    <Button size="sm" className="hidden sm:flex" onClick={handleNewTransaction} data-testid="btn-nueva-transaccion">
                        + Nueva
                    </Button>
                </div>
            </div>

            <div
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
            >
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
                    <div className="p-3 md:p-4" style={{ borderTop: '2px solid #10B981' }}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ingresos</p>
                        <p className="text-base md:text-xl font-semibold tracking-tight text-green-500 truncate">
                            {fmt(totalIncome, 'ARS')}
                        </p>
                    </div>
                    <div className="p-3 md:p-4" style={{ borderTop: '2px solid var(--destructive)' }}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Gastos</p>
                        <p className="text-base md:text-xl font-semibold tracking-tight text-destructive truncate">
                            {fmt(totalExpense, 'ARS')}
                        </p>
                    </div>
                    <div className="p-3 md:p-4" style={{ borderTop: '2px solid var(--sky)' }}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                        <p
                            className="text-base md:text-xl font-semibold tracking-tight truncate"
                            style={{
                                color:
                                    totalIncome - totalExpense >= 0 ? 'var(--sky-dark)' : 'var(--destructive)',
                            }}
                        >
                            {fmt(totalIncome - totalExpense, 'ARS')}
                        </p>
                    </div>
                </div>
            </div>

            <div className="hidden md:flex items-center gap-2 flex-wrap">
                <TypeFilterChip
                    value={appliedFilters.type}
                    onChange={(value) => setAppliedFilter('type', value)}
                    activeCategoryType={selectedAppliedCategoryType}
                />

                <CategoryFilterChip
                    value={appliedFilters.categoryId}
                    onChange={(value) => setAppliedFilter('categoryId', value)}
                    options={categoryOptions}
                    selectedType={appliedFilters.type}
                />

                <BasicFilterChip
                    label="Cuenta"
                    active={Boolean(appliedFilters.accountId)}
                    options={accountOptions}
                    value={appliedFilters.accountId}
                    onChange={(value) => setAppliedFilter('accountId', value)}
                />

                <BasicFilterChip
                    label="Ordenar"
                    active={sort !== DEFAULT_SORT}
                    options={SORT_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                    }))}
                    value={sort}
                    onChange={(value) => setSort(value || DEFAULT_SORT)}
                />

                {activeFilterCount > 0 && (
                    <button
                        type="button"
                        onClick={clearAppliedFilters}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                        style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}
                    >
                        <X size={12} /> Limpiar
                    </button>
                )}
            </div>

            <div className="flex md:hidden items-center gap-2">
                <button
                    type="button"
                    onClick={openFilterSheet}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                        background: activeFilterCount > 0 ? 'var(--sky)' : 'var(--secondary)',
                        color: activeFilterCount > 0 ? '#fff' : 'var(--muted-foreground)',
                        border: `0.5px solid ${activeFilterCount > 0 ? 'var(--sky)' : 'var(--border)'}`,
                    }}
                >
                    <SlidersHorizontal size={13} />
                    Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>

                <BasicFilterChip
                    label="Ordenar"
                    active={sort !== DEFAULT_SORT}
                    options={SORT_OPTIONS.map((option) => ({
                        value: option.value,
                        label: option.label,
                    }))}
                    value={sort}
                    onChange={(value) => setSort(value || DEFAULT_SORT)}
                />

                {activeFilterCount > 0 && (
                    <button
                        type="button"
                        onClick={clearAppliedFilters}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                        style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}
                    >
                        <X size={12} /> Limpiar
                    </button>
                )}
            </div>

            {total > 0 && (
                <p className="text-xs text-muted-foreground">
                    {transactions.length} de {total} transacciones
                </p>
            )}

            <AnimatePresence mode="wait">
                <motion.div
                    key={`${month}-${JSON.stringify(appliedFilters)}-${sort}`}
                    className="space-y-2"
                    {...fadeIn}
                >
                    {transactions.length === 0 ? (
                        <div
                            className="rounded-xl"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                        >
                            <EmptyState
                                icon={ArrowLeftRight}
                                title={activeFilterCount > 0 ? 'Sin resultados' : 'Sin transacciones este mes'}
                                description={
                                    activeFilterCount > 0
                                        ? 'Probá con otros filtros'
                                        : 'Registrá tu primera transacción del mes'
                                }
                                actionLabel={activeFilterCount > 0 ? 'Limpiar filtros' : '+ Nueva transacción'}
                                onAction={activeFilterCount > 0 ? clearAppliedFilters : handleNewTransaction}
                            />
                        </div>
                    ) : (
                        <>
                            <motion.div
                                className="space-y-2"
                                variants={staggerContainer}
                                initial="initial"
                                animate="animate"
                            >
                                {transactions.map((transaction) => {
                                    const sourceAccount =
                                        (transaction.sourceAccountId as unknown as (IAccount & { color?: string }) | null)
                                    const destAccount =
                                        (transaction.destinationAccountId as unknown as (IAccount & { color?: string }) | null)
                                    const category = transaction.categoryId as { name?: string; color?: string } | null

                                    return (
                                        <motion.div
                                            key={transaction._id.toString()}
                                            variants={staggerItem}
                                            className="rounded-xl"
                                            data-testid="transaction-item"
                                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                                        >
                                            <div className="py-3 px-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center justify-between sm:hidden">
                                                    <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]} className="shrink-0">
                                                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                    </Badge>
                                                    <div className="flex items-center gap-2">
                                                        <p
                                                            className="font-semibold tabular-nums text-sm"
                                                            style={{
                                                                color:
                                                                    transaction.type === 'income'
                                                                        ? '#10B981'
                                                                        : transaction.type === 'expense'
                                                                            ? 'var(--destructive)'
                                                                            : 'var(--foreground)',
                                                            }}
                                                        >
                                                            {fmt(transaction.amount, transaction.currency)}
                                                        </p>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon-sm"
                                                            onClick={() => handleEdit(transaction)}
                                                            aria-label="Editar"
                                                            data-testid="btn-editar-transaccion"
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="icon-sm"
                                                            onClick={() => handleDelete(transaction._id.toString())}
                                                            aria-label="Eliminar"
                                                            data-testid="btn-eliminar-transaccion"
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Badge
                                                        variant={TRANSACTION_TYPE_COLORS[transaction.type]}
                                                        className="shrink-0 hidden sm:flex"
                                                    >
                                                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                    </Badge>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium">{transaction.description}</p>
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            <p className="text-xs text-muted-foreground">
                                                                {new Date(transaction.date).toLocaleDateString('es-AR')}
                                                                {transaction.merchant && ` · ${transaction.merchant}`}
                                                            </p>

                                                            {category?.name && (
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  ·
                                                                    {category.color && (
                                                                        <span
                                                                            className="w-2 h-2 rounded-full inline-block shrink-0"
                                                                            style={{ backgroundColor: category.color }}
                                                                        />
                                                                    )}
                                                                    {category.name}
                                </span>
                                                            )}

                                                            {sourceAccount?.name && (
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  ·
                                                                    {sourceAccount.color && (
                                                                        <span
                                                                            className="w-2 h-2 rounded-full inline-block shrink-0"
                                                                            style={{ backgroundColor: sourceAccount.color }}
                                                                        />
                                                                    )}
                                                                    {sourceAccount.name}
                                </span>
                                                            )}

                                                            {destAccount?.name && (
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  →
                                                                    {destAccount.color && (
                                                                        <span
                                                                            className="w-2 h-2 rounded-full inline-block shrink-0"
                                                                            style={{ backgroundColor: destAccount.color }}
                                                                        />
                                                                    )}
                                                                    {destAccount.name}
                                </span>
                                                            )}

                                                            {transaction.installmentPlanId && (
                                                                <span className="text-xs" style={{ color: 'var(--sky)' }}>
                                  · en cuotas
                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="hidden sm:flex items-center gap-2 shrink-0">
                                                    <p
                                                        className="font-semibold tabular-nums text-sm"
                                                        style={{
                                                            color:
                                                                transaction.type === 'income'
                                                                    ? '#10B981'
                                                                    : transaction.type === 'expense'
                                                                        ? 'var(--destructive)'
                                                                        : 'var(--foreground)',
                                                        }}
                                                    >
                                                        {fmt(transaction.amount, transaction.currency)}
                                                    </p>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleEdit(transaction)}
                                                            data-testid="btn-editar-transaccion"
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => handleDelete(transaction._id.toString())}
                                                            data-testid="btn-eliminar-transaccion"
                                                        >
                                                            Eliminar
                                                        </Button>
                                                    </div>
                                                </div>

                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </motion.div>

                            {hasMore && (
                                <div className="pt-2 flex justify-center">
                                    <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                                        {loadingMore ? (
                                            <span className="flex items-center gap-2">
                        <Spinner /> Cargando...
                      </span>
                                        ) : (
                                            `Cargar más (${total - transactions.length} restantes)`
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            </AnimatePresence>

            <FilterSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                filters={draftFilters}
                onChange={setDraftFilter}
                onApply={applyDraftFilters}
                onClear={clearDraftFilters}
                typeOptions={typeOptions}
                categoryOptions={categoryOptions}
                accountOptions={accountOptions}
                activeCount={activeFilterCount}
            />

            <TransactionDialog
                open={transactionDialogOpen}
                onOpenChange={setTransactionDialogOpen}
                transaction={selectedTransaction}
                accounts={accounts}
                categories={categories}
                onSubmit={handleTransactionSubmit}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
            />

            <InstallmentDialog
                open={installmentDialogOpen}
                onOpenChange={setInstallmentDialogOpen}
                accounts={accounts}
                categories={categories}
                onSubmit={handleInstallmentSubmit}
            />

            <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta transacción?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    )
}