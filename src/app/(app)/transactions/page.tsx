'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, SlidersHorizontal, X, ChevronDown, ArrowUpDown } from 'lucide-react'

import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useHideAmounts } from '@/contexts/HideAmountsContext'

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
import type { TransactionFormData, InstallmentFormData } from '@/lib/validations'
import type { ITransaction, IAccount } from '@/types'

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

type Filters = {
    type: string
    categoryId: string
    accountId: string
}

const DEFAULT_FILTERS: Filters = {
    type: '',
    categoryId: '',
    accountId: '',
}

function FilterChip({
                        label,
                        active,
                        options,
                        value,
                        onChange,
                    }: {
    label: string
    active: boolean
    options: { value: string; label: string }[]
    value: string
    onChange: (v: string) => void
}) {
    const [open, setOpen] = useState(false)

    const selectedLabel = options.find((o) => o.value === value)?.label

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

                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value)
                                    setOpen(false)
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors rounded-md"
                                style={{
                                    color: value === opt.value ? 'var(--sky)' : 'var(--foreground)',
                                    fontWeight: value === opt.value ? 500 : 400,
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
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
    typeOptions: { value: string; label: string }[]
    categoryOptions: { value: string; label: string }[]
    accountOptions: { value: string; label: string }[]
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
                                        {[{ value: '', label: 'Todos' }, ...typeOptions].map((opt) => (
                                            <button
                                                key={opt.value || 'all-type'}
                                                type="button"
                                                onClick={() => onChange('type', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background:
                                                        filters.type === opt.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.type === opt.value ? '#fff' : 'var(--foreground)',
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-medium mb-2">Categoría</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ value: '', label: 'Todas' }, ...categoryOptions].map((opt) => (
                                            <button
                                                key={opt.value || 'all-category'}
                                                type="button"
                                                onClick={() => onChange('categoryId', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background:
                                                        filters.categoryId === opt.value
                                                            ? 'var(--sky)'
                                                            : 'var(--secondary)',
                                                    color: filters.categoryId === opt.value ? '#fff' : 'var(--foreground)',
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs font-medium mb-2">Cuenta</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ value: '', label: 'Todas' }, ...accountOptions].map((opt) => (
                                            <button
                                                key={opt.value || 'all-account'}
                                                type="button"
                                                onClick={() => onChange('accountId', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background:
                                                        filters.accountId === opt.value
                                                            ? 'var(--sky)'
                                                            : 'var(--secondary)',
                                                    color: filters.accountId === opt.value ? '#fff' : 'var(--foreground)',
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={onClose}
                                >
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
    const { accounts } = useAccounts()
    const { categories } = useCategories()
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

    const setAppliedFilter = (key: keyof Filters, value: string) =>
        setAppliedFilters((prev) => ({ ...prev, [key]: value }))

    const setDraftFilter = (key: keyof Filters, value: string) =>
        setDraftFilters((prev) => ({ ...prev, [key]: value }))

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
        setAppliedFilters(draftFilters)
        setFilterSheetOpen(false)
    }

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (appliedFilters.type) count++
        if (appliedFilters.categoryId) count++
        if (appliedFilters.accountId) count++
        return count
    }, [appliedFilters])

    const typeOptions = useMemo(
        () =>
            Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
            })),
        []
    )

    const categoryOptions = useMemo(
        () =>
            categories.map((category) => ({
                value: category._id.toString(),
                label: category.name,
            })),
        [categories]
    )

    const accountOptions = useMemo(
        () =>
            accounts.map((account) => ({
                value: account._id.toString(),
                label: account.name,
            })),
        [accounts]
    )

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
            <div className="p-4 md:p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-44" />
                        <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-28" />
                        <Skeleton className="h-10 w-28" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>

                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 md:p-6">
                <div
                    className="rounded-xl border p-4 text-sm"
                    style={{
                        borderColor: 'var(--destructive)',
                        color: 'var(--destructive)',
                    }}
                >
                    {error}
                </div>
            </div>
        )
    }

    return (
        <>
            <motion.div
                className="p-4 md:p-6 space-y-5"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
            >
                <motion.div
                    variants={fadeIn}
                    className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl md:text-3xl font-bold">Transacciones</h1>
                            {refreshing && <Spinner size="sm" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Registrá y revisá todos tus movimientos del mes.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setInstallmentDialogOpen(true)}
                        >
                            + Cuotas
                        </Button>
                        <Button type="button" onClick={handleNewTransaction}>
                            + Nueva
                        </Button>
                    </div>
                </motion.div>

                <motion.div variants={fadeIn}>
                    <div className="max-w-xs">
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar mes" />
                            </SelectTrigger>
                            <SelectContent>
                                {MONTHS.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </motion.div>

                <motion.div
                    variants={fadeIn}
                    className="grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                    <div
                        className="rounded-2xl border p-4"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                        <p className="text-xs text-muted-foreground mb-1">Ingresos</p>
                        <p className="text-xl font-semibold">{fmt(totalIncome, 'ARS')}</p>
                    </div>

                    <div
                        className="rounded-2xl border p-4"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                        <p className="text-xs text-muted-foreground mb-1">Gastos</p>
                        <p className="text-xl font-semibold">{fmt(totalExpense, 'ARS')}</p>
                    </div>

                    <div
                        className="rounded-2xl border p-4"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                        <p className="text-xs text-muted-foreground mb-1">Balance</p>
                        <p
                            className="text-xl font-semibold"
                            style={{
                                color:
                                    totalIncome - totalExpense >= 0
                                        ? 'var(--sky-dark)'
                                        : 'var(--destructive)',
                            }}
                        >
                            {fmt(totalIncome - totalExpense, 'ARS')}
                        </p>
                    </div>
                </motion.div>

                <motion.div variants={fadeIn} className="hidden md:flex flex-wrap items-center gap-2">
                    <FilterChip
                        label="Tipo"
                        active={Boolean(appliedFilters.type)}
                        options={typeOptions}
                        value={appliedFilters.type}
                        onChange={(value) => setAppliedFilter('type', value)}
                    />

                    <FilterChip
                        label="Categoría"
                        active={Boolean(appliedFilters.categoryId)}
                        options={categoryOptions}
                        value={appliedFilters.categoryId}
                        onChange={(value) => setAppliedFilter('categoryId', value)}
                    />

                    <FilterChip
                        label="Cuenta"
                        active={Boolean(appliedFilters.accountId)}
                        options={accountOptions}
                        value={appliedFilters.accountId}
                        onChange={(value) => setAppliedFilter('accountId', value)}
                    />

                    <FilterChip
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{
                                background: 'var(--secondary)',
                                color: 'var(--muted-foreground)',
                                border: '0.5px solid var(--border)',
                            }}
                        >
                            <X className="w-3.5 h-3.5" />
                            Limpiar
                        </button>
                    )}
                </motion.div>

                <motion.div variants={fadeIn} className="md:hidden flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={openFilterSheet}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{
                            background: activeFilterCount > 0 ? 'var(--sky)' : 'var(--secondary)',
                            color: activeFilterCount > 0 ? '#fff' : 'var(--muted-foreground)',
                            border: `0.5px solid ${
                                activeFilterCount > 0 ? 'var(--sky)' : 'var(--border)'
                            }`,
                        }}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </button>

                    <FilterChip
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            style={{
                                background: 'var(--secondary)',
                                color: 'var(--muted-foreground)',
                                border: '0.5px solid var(--border)',
                            }}
                        >
                            <X className="w-3.5 h-3.5" />
                            Limpiar
                        </button>
                    )}
                </motion.div>

                {total > 0 && (
                    <motion.div variants={fadeIn}>
                        <p className="text-xs text-muted-foreground">
                            {transactions.length} de {total} transacciones
                        </p>
                    </motion.div>
                )}

                <motion.div variants={staggerItem}>
                    {transactions.length === 0 ? (
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
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((transaction) => {
                                const sourceAccount =
                                    transaction.sourceAccountId as unknown as
                                        | (IAccount & { color?: string })
                                        | null

                                const destAccount =
                                    transaction.destinationAccountId as unknown as
                                        | (IAccount & { color?: string })
                                        | null

                                const category = transaction.categoryId as
                                    | { name?: string; color?: string }
                                    | null

                                return (
                                    <motion.div
                                        key={transaction._id.toString()}
                                        variants={staggerItem}
                                        className="rounded-2xl border p-4"
                                        style={{
                                            borderColor: 'var(--border)',
                                            background: 'var(--card)',
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="md:hidden flex items-center justify-between gap-3 mb-2">
                                                    <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]}>
                                                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                    </Badge>

                                                    <p className="text-sm font-semibold whitespace-nowrap">
                                                        {fmt(transaction.amount, transaction.currency)}
                                                    </p>
                                                </div>

                                                <div className="hidden md:flex items-center gap-2 mb-2">
                                                    <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]}>
                                                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                    </Badge>
                                                </div>

                                                <p className="font-medium break-words">
                                                    {transaction.description}
                                                </p>

                                                <p className="mt-1 text-sm text-muted-foreground break-words">
                                                    {new Date(transaction.date).toLocaleDateString('es-AR')}
                                                    {transaction.merchant ? ` · ${transaction.merchant}` : ''}
                                                    {category?.name ? ` · ${category.name}` : ''}
                                                    {sourceAccount?.name ? ` · ${sourceAccount.name}` : ''}
                                                    {destAccount?.name ? ` → ${destAccount.name}` : ''}
                                                    {transaction.installmentPlanId ? ' · en cuotas' : ''}
                                                </p>
                                            </div>

                                            <div className="hidden md:flex items-start gap-2 shrink-0">
                                                <p className="text-sm font-semibold whitespace-nowrap mr-2">
                                                    {fmt(transaction.amount, transaction.currency)}
                                                </p>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEdit(transaction)}
                                                >
                                                    Editar
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDelete(transaction._id.toString())}
                                                >
                                                    Eliminar
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="md:hidden flex gap-2 mt-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleEdit(transaction)}
                                            >
                                                Editar
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleDelete(transaction._id.toString())}
                                            >
                                                Eliminar
                                            </Button>
                                        </div>
                                    </motion.div>
                                )
                            })}

                            {hasMore && (
                                <div className="pt-2 flex justify-center">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={loadMore}
                                        disabled={loadingMore}
                                    >
                                        {loadingMore ? (
                                            <>
                                                <Spinner size="sm" />
                                                <span className="ml-2">Cargando...</span>
                                            </>
                                        ) : (
                                            `Cargar más (${total - transactions.length} restantes)`
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </motion.div>

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
                        <AlertDialogTitle>¿Eliminar transacción?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}