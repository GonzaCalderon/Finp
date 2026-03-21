'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { ArrowLeftRight, SlidersHorizontal, X, ChevronDown, ArrowUpDown } from 'lucide-react'
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

const TRANSACTION_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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
]

const getCurrentMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return { value, label }
})

interface Filters {
    type: string
    categoryId: string
    accountId: string
    sort: string
}

const DEFAULT_FILTERS: Filters = {
    type: '',
    categoryId: '',
    accountId: '',
    sort: 'date_desc',
}

// Chip de filtro para desktop
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
                onClick={() => setOpen((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                    background: active ? 'var(--sky)' : 'var(--secondary)',
                    color: active ? '#fff' : 'var(--muted-foreground)',
                    border: `0.5px solid ${active ? 'var(--sky)' : 'var(--border)'}`,
                }}
            >
                {active ? selectedLabel : label}
                <ChevronDown size={12} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute top-full mt-1 left-0 z-20 rounded-lg min-w-36 shadow-lg overflow-hidden"
                         style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                        <button
                            onClick={() => { onChange(''); setOpen(false) }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                            style={{ color: !value ? 'var(--sky)' : 'var(--muted-foreground)' }}>
                            Todos
                        </button>
                        {options.map((opt) => (
                            <button key={opt.value}
                                    onClick={() => { onChange(opt.value); setOpen(false) }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                                    style={{ color: value === opt.value ? 'var(--sky)' : 'var(--foreground)', fontWeight: value === opt.value ? 500 : 400 }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// Bottom sheet de filtros para mobile
function FilterSheet({
                         open,
                         onClose,
                         filters,
                         onChange,
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
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0,0,0,0.5)' }}
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl pb-safe"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-1">
                            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
                        </div>

                        <div className="px-4 pb-6 space-y-4">
                            <div className="flex items-center justify-between py-2">
                                <h3 className="text-sm font-semibold">Filtros</h3>
                                {activeCount > 0 && (
                                    <button onClick={() => { onClear(); onClose() }}
                                            className="flex items-center gap-1 text-xs"
                                            style={{ color: 'var(--sky)' }}>
                                        <X size={12} /> Limpiar filtros
                                    </button>
                                )}
                            </div>

                            {/* Tipo */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</p>
                                <div className="flex flex-wrap gap-2">
                                    {[{ value: '', label: 'Todos' }, ...typeOptions].map((opt) => (
                                        <button key={opt.value}
                                                onClick={() => onChange('type', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background: filters.type === opt.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.type === opt.value ? '#fff' : 'var(--foreground)',
                                                }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Categoría */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoría</p>
                                <div className="flex flex-wrap gap-2">
                                    {[{ value: '', label: 'Todas' }, ...categoryOptions].map((opt) => (
                                        <button key={opt.value}
                                                onClick={() => onChange('categoryId', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background: filters.categoryId === opt.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.categoryId === opt.value ? '#fff' : 'var(--foreground)',
                                                }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Cuenta */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cuenta</p>
                                <div className="flex flex-wrap gap-2">
                                    {[{ value: '', label: 'Todas' }, ...accountOptions].map((opt) => (
                                        <button key={opt.value}
                                                onClick={() => onChange('accountId', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background: filters.accountId === opt.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.accountId === opt.value ? '#fff' : 'var(--foreground)',
                                                }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ordenar */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ordenar por</p>
                                <div className="flex flex-wrap gap-2">
                                    {SORT_OPTIONS.map((opt) => (
                                        <button key={opt.value}
                                                onClick={() => onChange('sort', opt.value)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background: filters.sort === opt.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.sort === opt.value ? '#fff' : 'var(--foreground)',
                                                }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button className="w-full" onClick={onClose}>Aplicar</Button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default function TransactionsPage() {
    const [month, setMonth] = useState(getCurrentMonth())
    const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
    const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<ITransaction | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const { transactions, loading, refreshing, error, createTransaction, updateTransaction, deleteTransaction } = useTransactions({ month })
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

    const handleEdit = (t: ITransaction) => { setSelectedTransaction(t); setTransactionDialogOpen(true) }
    const handleDelete = (id: string) => setDeleteId(id)

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
                await updateTransaction(selectedTransaction._id.toString(), data as Record<string, unknown>)
                success('Transacción actualizada correctamente')
            } else {
                await createTransaction(data as Record<string, unknown>)
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

    const setFilter = (key: keyof Filters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const clearFilters = () => setFilters(DEFAULT_FILTERS)

    // Contar filtros activos (excluir sort default)
    const activeFilterCount = useMemo(() => {
        let count = 0
        if (filters.type) count++
        if (filters.categoryId) count++
        if (filters.accountId) count++
        return count
    }, [filters])

    // Opciones para los filtros
    const typeOptions = Object.entries(TRANSACTION_TYPE_LABELS).map(([value, label]) => ({ value, label }))

    const categoryOptions = useMemo(() =>
            categories.map((c) => ({ value: c._id.toString(), label: c.name })),
        [categories]
    )

    const accountOptions = useMemo(() =>
            accounts.map((a) => ({ value: a._id.toString(), label: a.name })),
        [accounts]
    )

    // Filtrar y ordenar en cliente
    const filteredTransactions = useMemo(() => {
        let result = [...transactions]

        if (filters.type) {
            result = result.filter((t) => t.type === filters.type)
        }

        if (filters.categoryId) {
            result = result.filter((t) => {
                const catId = (t.categoryId as { _id?: { toString(): string } })?._id?.toString()
                    ?? t.categoryId?.toString()
                return catId === filters.categoryId
            })
        }

        if (filters.accountId) {
            result = result.filter((t) => {
                const srcId = (t.sourceAccountId as { _id?: { toString(): string } })?._id?.toString()
                    ?? t.sourceAccountId?.toString()
                const dstId = (t.destinationAccountId as { _id?: { toString(): string } })?._id?.toString()
                    ?? t.destinationAccountId?.toString()
                return srcId === filters.accountId || dstId === filters.accountId
            })
        }

        switch (filters.sort) {
            case 'date_asc':
                result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                break
            case 'date_desc':
                result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                break
            case 'amount_desc':
                result.sort((a, b) => b.amount - a.amount)
                break
            case 'amount_asc':
                result.sort((a, b) => a.amount - b.amount)
                break
            case 'description_asc':
                result.sort((a, b) => a.description.localeCompare(b.description))
                break
        }

        return result
    }, [transactions, filters])

    const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const totalExpense = transactions.filter((t) => t.type === 'expense' && !t.installmentPlanId).reduce((sum, t) => sum + t.amount, 0)

    const fmt = (amount: number, currency: string) =>
        hidden ? '••••' : new Intl.NumberFormat('es-AR', {
            style: 'currency', currency, maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>

    return (
        <motion.div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4" {...fadeIn}>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">Transacciones</h1>
                    {refreshing && <Spinner className="text-muted-foreground" />}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setInstallmentDialogOpen(true)}>
                        + Cuotas
                    </Button>
                    <Button size="sm" onClick={handleNewTransaction}>+ Nueva</Button>
                </div>
            </div>

            {/* Selector de mes */}
            <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-52 h-8 text-sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Métricas agrupadas */}
            <div className="rounded-xl overflow-hidden"
                 style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
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
                        <p className="text-base md:text-xl font-semibold tracking-tight truncate"
                           style={{ color: totalIncome - totalExpense >= 0 ? 'var(--sky-dark)' : 'var(--destructive)' }}>
                            {fmt(totalIncome - totalExpense, 'ARS')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Filtros — desktop */}
            <div className="hidden md:flex items-center gap-2 flex-wrap">
                <FilterChip
                    label="Tipo"
                    active={!!filters.type}
                    options={typeOptions}
                    value={filters.type}
                    onChange={(v) => setFilter('type', v)}
                />
                <FilterChip
                    label="Categoría"
                    active={!!filters.categoryId}
                    options={categoryOptions}
                    value={filters.categoryId}
                    onChange={(v) => setFilter('categoryId', v)}
                />
                <FilterChip
                    label="Cuenta"
                    active={!!filters.accountId}
                    options={accountOptions}
                    value={filters.accountId}
                    onChange={(v) => setFilter('accountId', v)}
                />
                <FilterChip
                    label="Ordenar"
                    active={filters.sort !== 'date_desc'}
                    options={SORT_OPTIONS}
                    value={filters.sort}
                    onChange={(v) => setFilter('sort', v)}
                />
                {activeFilterCount > 0 && (
                    <button onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                            style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}>
                        <X size={12} /> Limpiar
                    </button>
                )}
            </div>

            {/* Filtros — mobile */}
            <div className="flex md:hidden items-center gap-2">
                <button
                    onClick={() => setFilterSheetOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                        background: activeFilterCount > 0 ? 'var(--sky)' : 'var(--secondary)',
                        color: activeFilterCount > 0 ? '#fff' : 'var(--muted-foreground)',
                        border: `0.5px solid ${activeFilterCount > 0 ? 'var(--sky)' : 'var(--border)'}`,
                    }}>
                    <SlidersHorizontal size={13} />
                    Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
                <button
                    onClick={() => setFilterSheetOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                        background: filters.sort !== 'date_desc' ? 'var(--sky)' : 'var(--secondary)',
                        color: filters.sort !== 'date_desc' ? '#fff' : 'var(--muted-foreground)',
                        border: `0.5px solid ${filters.sort !== 'date_desc' ? 'var(--sky)' : 'var(--border)'}`,
                    }}>
                    <ArrowUpDown size={13} />
                    {SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? 'Ordenar'}
                </button>
                {activeFilterCount > 0 && (
                    <button onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors"
                            style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}>
                        <X size={12} /> Limpiar
                    </button>
                )}
            </div>

            {/* Lista de transacciones */}
            <AnimatePresence mode="wait">
                <motion.div key={`${month}-${JSON.stringify(filters)}`} className="space-y-2" {...fadeIn}>
                    {filteredTransactions.length === 0 ? (
                        <div className="rounded-xl"
                             style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                            <EmptyState
                                icon={ArrowLeftRight}
                                title={activeFilterCount > 0 ? 'Sin resultados' : 'Sin transacciones este mes'}
                                description={activeFilterCount > 0 ? 'Probá con otros filtros' : 'Registrá tu primera transacción del mes'}
                                actionLabel={activeFilterCount > 0 ? 'Limpiar filtros' : '+ Nueva transacción'}
                                onAction={activeFilterCount > 0 ? clearFilters : handleNewTransaction}
                            />
                        </div>
                    ) : (
                        <motion.div
                            className="space-y-2"
                            variants={staggerContainer}
                            initial="initial"
                            animate="animate"
                        >
                            {filteredTransactions.map((transaction) => {
                                const sourceAccount = transaction.sourceAccountId as unknown as IAccount & { color?: string } | null
                                const destAccount = transaction.destinationAccountId as unknown as IAccount & { color?: string } | null
                                return (
                                    <motion.div
                                        key={transaction._id.toString()}
                                        variants={staggerItem}
                                        className="rounded-xl"
                                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                                    >
                                        <div className="py-3 px-4 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]} className="shrink-0">
                                                    {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                </Badge>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{transaction.description}</p>
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <p className="text-xs text-muted-foreground">
                                                            {new Date(transaction.date).toLocaleDateString('es-AR')}
                                                            {transaction.merchant && ` · ${transaction.merchant}`}
                                                        </p>
                                                        {sourceAccount?.name && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                ·
                                                                {sourceAccount.color && (
                                                                    <span className="w-2 h-2 rounded-full inline-block"
                                                                          style={{ backgroundColor: sourceAccount.color }} />
                                                                )}
                                                                {sourceAccount.name}
                                                            </span>
                                                        )}
                                                        {destAccount?.name && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                →
                                                                {destAccount.color && (
                                                                    <span className="w-2 h-2 rounded-full inline-block"
                                                                          style={{ backgroundColor: destAccount.color }} />
                                                                )}
                                                                {destAccount.name}
                                                            </span>
                                                        )}
                                                        {transaction.installmentPlanId && (
                                                            <span className="text-xs" style={{ color: 'var(--sky)' }}>· en cuotas</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <p className="font-semibold tabular-nums text-sm"
                                                   style={{
                                                       color: transaction.type === 'income'
                                                           ? '#10B981'
                                                           : transaction.type === 'expense'
                                                               ? 'var(--destructive)'
                                                               : 'var(--foreground)',
                                                   }}>
                                                    {fmt(transaction.amount, transaction.currency)}
                                                </p>
                                                <div className="flex gap-1">
                                                    <Button variant="outline" size="sm" className="h-7 text-xs"
                                                            onClick={() => handleEdit(transaction)}>
                                                        Editar
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                                                            onClick={() => handleDelete(transaction._id.toString())}>
                                                        Eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Filter Sheet mobile */}
            <FilterSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                filters={filters}
                onChange={setFilter}
                onClear={clearFilters}
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

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta transacción?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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