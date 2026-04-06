'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ChevronDown, CreditCard, Pencil, SlidersHorizontal, Trash2, X } from 'lucide-react'

import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import {
    useCreditCardExpenses,
    getRemainingDebt,
    type CCExpenseItem,
    getInstallmentStatus as getPlanStatus,
} from '@/hooks/useCreditCardExpenses'
import { useInstallments } from '@/hooks/useInstallments'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences } from '@/hooks/usePreferences'
import { useToast } from '@/hooks/useToast'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { useHideAmounts } from '@/contexts/HideAmountsContext'

import { CreditCardExpenseSheet } from '@/components/shared/CreditCardExpenseSheet'
import { EmptyState } from '@/components/shared/EmptyState'
import { InstallmentDialog } from '@/components/shared/InstallmentDialog'
import { MobileCardCarousel } from '@/components/shared/MobileCardCarousel'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { TransactionDialog } from '@/components/shared/TransactionDialog'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DURATION, easeSmooth, fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { InstallmentFormData, TransactionFormData } from '@/lib/validations'
import type { ITransaction } from '@/types'
import type { InstallmentPlanWithTransaction } from '@/hooks/useCreditCardExpenses'
import { getSingleCreditCardExpenseStatusForMonth } from '@/lib/utils/credit-card'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    TRANSACTION_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'

type StatusFilter = 'active' | 'finished' | 'all'
type InstallmentFilter = 'all' | 'single' | 'multi'
type SortFilter = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
type PageFilters = {
    cardFilter: string
    categoryFilter: string
    statusFilter: StatusFilter
    installmentFilter: InstallmentFilter
}
type BasicOption = {
    value: string
    label: string
}

type CurrencyTotals = {
    ars: number
    usd: number
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Activas' },
    { value: 'finished', label: 'Finalizadas' },
    { value: 'all', label: 'Todas' },
]

const INSTALLMENT_OPTIONS: { value: InstallmentFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'single', label: '1 cuota' },
    { value: 'multi', label: 'En cuotas' },
]

const SORT_OPTIONS: { value: SortFilter; label: string }[] = [
    { value: 'date_desc', label: 'Más reciente' },
    { value: 'date_asc', label: 'Más antigua' },
    { value: 'amount_desc', label: 'Mayor monto' },
    { value: 'amount_asc', label: 'Menor monto' },
]

const DEFAULT_FILTERS: PageFilters = {
    cardFilter: 'all',
    categoryFilter: 'all',
    statusFilter: 'active',
    installmentFilter: 'all',
}

function getCurrentMonth() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function easeOutCubic(value: number) {
    return 1 - Math.pow(1 - value, 3)
}

function useAnimatedTotals(totals: CurrencyTotals) {
    const [animated, setAnimated] = useState(totals)

    useEffect(() => {
        let frame = 0
        const previous = animated
        const startedAt = performance.now()
        const duration = 550

        const tick = (now: number) => {
            const progress = Math.min((now - startedAt) / duration, 1)
            const eased = easeOutCubic(progress)

            setAnimated({
                ars: previous.ars + (totals.ars - previous.ars) * eased,
                usd: previous.usd + (totals.usd - previous.usd) * eased,
            })

            if (progress < 1) {
                frame = requestAnimationFrame(tick)
            }
        }

        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totals.ars, totals.usd])

    return animated
}

function OverviewMetricCard({
    title,
    totals,
    hidden,
    accent,
    primaryColor,
    secondaryColor,
    supporting,
}: {
    title: string
    totals: CurrencyTotals
    hidden: boolean
    accent: string
    primaryColor: string
    secondaryColor: string
    supporting?: React.ReactNode
}) {
    return (
        <motion.div
            variants={staggerItem}
            className="relative rounded-2xl border p-4 md:p-5"
            style={{
                background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                boxShadow: 'var(--card-shadow)',
            }}
        >
            <div className="absolute left-4 right-4 top-0 h-px overflow-hidden rounded-full opacity-80">
                <div className="h-full w-full rounded-full" style={{ background: accent }} />
            </div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:text-xs">
                {title}
            </p>
            <div className="mt-3">
                <CurrencyBreakdownAmount
                    totals={totals}
                    hidden={hidden}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    hideZeroSecondary
                    preserveSecondarySpace
                    className="text-lg font-semibold tracking-tight md:text-[1.8rem]"
                />
            </div>
            {supporting && (
                <div className="mt-3 border-t border-foreground/[0.07] pt-3 text-xs text-muted-foreground">
                    {supporting}
                </div>
            )}
        </motion.div>
    )
}

const MONTHS = Array.from({ length: 25 }, (_, index) => {
    const offset = index - 12
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() + offset)

    return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric',
        }),
    }
})

function formatMonthCompact(value: string) {
    const [year, month] = value.split('-').map(Number)
    return new Date(year, month - 1, 1).toLocaleDateString('es-AR', {
        month: 'short',
        year: '2-digit',
    }).replace('.', '')
}

function getRefName(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { name?: unknown }
    return typeof candidate.name === 'string' ? candidate.name : null
}

function getRefColor(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { color?: unknown }
    return typeof candidate.color === 'string' ? candidate.color : null
}

function getRefId(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value !== 'object') return ''
    const candidate = value as { _id?: unknown; toString?: () => string }
    if (typeof candidate._id === 'string') {
        return candidate._id
    }
    if (candidate._id && typeof candidate._id === 'object' && 'toString' in candidate._id) {
        const ref = candidate._id as { toString(): string }
        return ref.toString()
    }
    return typeof candidate.toString === 'function' ? candidate.toString() : ''
}

function getItemStatus(item: CCExpenseItem, selectedMonth: string, monthStartDay: number) {
    if (item.kind === 'plan') return getPlanStatus(item.plan, selectedMonth)
    return getSingleCreditCardExpenseStatusForMonth(item.transaction, selectedMonth, monthStartDay)
}

function getHumanStatusLabel(item: CCExpenseItem, selectedMonth: string, monthStartDay: number) {
    const status = getItemStatus(item, selectedMonth, monthStartDay)
    if (status.state === 'active') return status.label
    if (status.state === 'finished') return 'Finalizado'

    if (item.kind === 'plan') {
        return `Primera cuota en ${formatMonthCompact(item.plan.firstClosingMonth)}`
    }

    const purchaseDate = item.transaction.date instanceof Date
        ? item.transaction.date
        : new Date(item.transaction.date)

    return `Impacta en ${purchaseDate.toLocaleDateString('es-AR', {
        month: 'short',
        year: '2-digit',
    }).replace('.', '')}`
}

function matchesItemStatus(item: CCExpenseItem, selectedMonth: string, monthStartDay: number, filter: StatusFilter) {
    if (filter === 'all') return true
    const status = getItemStatus(item, selectedMonth, monthStartDay)
    if (filter === 'active') return status.state !== 'finished'
    return status.state === 'finished'
}

function matchesInstallmentMode(item: CCExpenseItem, filter: InstallmentFilter) {
    if (filter === 'all') return true
    if (filter === 'single') return item.kind === 'single'
    return item.kind === 'plan'
}

function getMonthlyImpact(item: CCExpenseItem, selectedMonth: string, monthStartDay: number) {
    const status = getItemStatus(item, selectedMonth, monthStartDay)
    if (status.state !== 'active') return 0
    return item.kind === 'plan' ? item.plan.installmentAmount : item.transaction.amount
}

function getRemainingForItem(item: CCExpenseItem, selectedMonth: string, monthStartDay: number) {
    if (item.kind === 'plan') return getRemainingDebt(item.plan, selectedMonth)
    const status = getItemStatus(item, selectedMonth, monthStartDay)
    return status.state === 'finished' ? 0 : item.transaction.amount
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
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px"
                style={{
                    background: active ? 'rgba(96,184,224,0.16)' : 'var(--secondary)',
                    color: active ? 'var(--sky-dark)' : 'var(--muted-foreground)',
                    border: `0.5px solid ${open || active ? 'rgba(96,184,224,0.32)' : 'var(--border)'}`,
                    boxShadow: open ? '0 10px 24px rgba(0,0,0,0.12)' : undefined,
                }}
            >
                {active ? selectedLabel : label}
                <motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: DURATION.fast, ease: easeSmooth }}
                    className="inline-flex"
                >
                    <ChevronDown className="w-3.5 h-3.5" />
                </motion.span>
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
                        className="absolute top-full mt-2 right-0 z-40 min-w-44 rounded-2xl border p-1.5 backdrop-blur-md"
                        style={{
                            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                            boxShadow: 'var(--card-shadow)',
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

function CreditCardFilterSheet({
    open,
    onClose,
    draftFilters,
    sort,
    onChange,
    onSortChange,
    onApply,
    onClear,
    cardOptions,
    categoryOptions,
}: {
    open: boolean
    onClose: () => void
    draftFilters: PageFilters
    sort: SortFilter
    onChange: (key: keyof PageFilters, value: string) => void
    onSortChange: (value: SortFilter) => void
    onApply: () => void
    onClear: () => void
    cardOptions: BasicOption[]
    categoryOptions: BasicOption[]
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
                        className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-3xl border-t shadow-2xl safe-area-pb"
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
                                        Ajusta la vista igual que en Transacciones.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-full p-2 transition-colors hover:bg-muted"
                                    aria-label="Cerrar filtros"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground">Tarjeta</p>
                                    <Select value={draftFilters.cardFilter} onValueChange={(value) => onChange('cardFilter', value)}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            {cardOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground">Categoría</p>
                                    <Select
                                        value={draftFilters.categoryFilter}
                                        onValueChange={(value) => onChange('categoryFilter', value)}
                                    >
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            {categoryOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-muted-foreground">Estado</p>
                                        <Select
                                            value={draftFilters.statusFilter}
                                            onValueChange={(value) => onChange('statusFilter', value)}
                                        >
                                            <SelectTrigger className="h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <p className="text-xs font-medium text-muted-foreground">Cuotas</p>
                                        <Select
                                            value={draftFilters.installmentFilter}
                                            onValueChange={(value) => onChange('installmentFilter', value)}
                                        >
                                            <SelectTrigger className="h-10">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {INSTALLMENT_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <p className="text-xs font-medium text-muted-foreground">Ordenar</p>
                                    <Select value={sort} onValueChange={(value) => onSortChange(value as SortFilter)}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SORT_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center gap-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClear}>
                                    Limpiar
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

async function postTransaction(body: TransactionFormData) {
    const data = await apiJson<{ transaction: ITransaction }>('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return data.transaction as ITransaction
}

async function patchTransaction(id: string, body: TransactionFormData) {
    const data = await apiJson<{ transaction: ITransaction }>(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    return data.transaction as ITransaction
}

export default function CreditCardExpensesPage() {
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
    const [filters, setFilters] = useState<PageFilters>(DEFAULT_FILTERS)
    const [draftFilters, setDraftFilters] = useState<PageFilters>(DEFAULT_FILTERS)
    const [sort, setSort] = useState<SortFilter>('date_desc')
    const [draftSort, setDraftSort] = useState<SortFilter>('date_desc')
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [sheetItem, setSheetItem] = useState<CCExpenseItem | null>(null)
    const [deleteItem, setDeleteItem] = useState<CCExpenseItem | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedTransaction, setSelectedTransaction] = useState<ITransaction | null>(null)
    const [installmentDialogOpen, setInstallmentDialogOpen] = useState(false)
    const [selectedPlan, setSelectedPlan] = useState<InstallmentPlanWithTransaction | null>(null)

    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const { rules } = useTransactionRules()
    const { preferences } = usePreferences()
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()
    const { createPlan, updatePlan } = useInstallments()
    const {
        allItems,
        loading,
        error,
        deletePlan,
        deleteTransaction,
    } = useCreditCardExpenses(selectedMonth, preferences.monthStartDay)

    usePageTitle('Gastos con TC')

    const creditCardAccounts = useMemo(
        () => accounts.filter((account) => account.type === 'credit_card'),
        [accounts]
    )

    const expenseCategories = useMemo(
        () => categories.filter((category) => category.type === 'expense'),
        [categories]
    )

    const cardOptions = useMemo(
        () => creditCardAccounts.map((account) => ({ value: account._id.toString(), label: account.name })),
        [creditCardAccounts]
    )

    const categoryOptions = useMemo(
        () => expenseCategories.map((category) => ({ value: category._id.toString(), label: category.name })),
        [expenseCategories]
    )

    const setFilter = (key: keyof PageFilters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const setDraftFilter = (key: keyof PageFilters, value: string) => {
        setDraftFilters((prev) => ({ ...prev, [key]: value as never }))
    }

    const activeFilterCount =
        (filters.cardFilter !== DEFAULT_FILTERS.cardFilter ? 1 : 0) +
        (filters.categoryFilter !== DEFAULT_FILTERS.categoryFilter ? 1 : 0) +
        (filters.statusFilter !== DEFAULT_FILTERS.statusFilter ? 1 : 0) +
        (filters.installmentFilter !== DEFAULT_FILTERS.installmentFilter ? 1 : 0)

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS)
        setDraftFilters(DEFAULT_FILTERS)
        setSort('date_desc')
        setDraftSort('date_desc')
    }

    const clearDraftFilters = () => {
        setDraftFilters(DEFAULT_FILTERS)
        setDraftSort('date_desc')
    }

    const openFilterSheet = () => {
        setDraftFilters(filters)
        setDraftSort(sort)
        setFilterSheetOpen(true)
    }

    const applyDraftFilters = () => {
        setFilters(draftFilters)
        setSort(draftSort)
        setFilterSheetOpen(false)
    }

    const summaryItems = useMemo(() => {
        return allItems.filter((item) => {
            const categoryRef = item.kind === 'plan' ? item.plan.categoryId : item.transaction.categoryId
            const matchesCategory =
                filters.categoryFilter === 'all' || getRefId(categoryRef) === filters.categoryFilter

            return (
                matchesCategory &&
                matchesItemStatus(item, selectedMonth, preferences.monthStartDay, filters.statusFilter) &&
                matchesInstallmentMode(item, filters.installmentFilter)
            )
        })
    }, [
        allItems,
        filters.categoryFilter,
        filters.installmentFilter,
        filters.statusFilter,
        preferences.monthStartDay,
        selectedMonth,
    ])

    const filteredItems = useMemo(() => {
        const filtered = summaryItems.filter((item) => {
            const accountRef = item.kind === 'plan' ? item.plan.accountId : item.transaction.sourceAccountId
            return filters.cardFilter === 'all' || getRefId(accountRef) === filters.cardFilter
        })

        return filtered.sort((a, b) => {
            const aAmount = a.kind === 'plan' ? a.plan.totalAmount : a.transaction.amount
            const bAmount = b.kind === 'plan' ? b.plan.totalAmount : b.transaction.amount
            const aDate = a.kind === 'plan' ? new Date(a.plan.purchaseDate).getTime() : new Date(a.transaction.date).getTime()
            const bDate = b.kind === 'plan' ? new Date(b.plan.purchaseDate).getTime() : new Date(b.transaction.date).getTime()

            if (sort === 'date_asc') return aDate - bDate
            if (sort === 'amount_desc') return bAmount - aAmount
            if (sort === 'amount_asc') return aAmount - bAmount
            return bDate - aDate
        })
    }, [filters.cardFilter, sort, summaryItems])

    const overviewTotals = useMemo(() => {
        const activeCards = new Set<string>()
        const totals = filteredItems.reduce<{
            monthlyDue: CurrencyTotals
            remainingDebt: CurrencyTotals
            activeCount: number
        }>(
            (acc, item) => {
                const currency = item.kind === 'plan' ? item.plan.currency : item.transaction.currency
                const monthlyImpact = getMonthlyImpact(item, selectedMonth, preferences.monthStartDay)
                const remainingDebt = getRemainingForItem(item, selectedMonth, preferences.monthStartDay)
                const status = getItemStatus(item, selectedMonth, preferences.monthStartDay)
                const cardRef = item.kind === 'plan' ? item.plan.accountId : item.transaction.sourceAccountId
                const cardId = getRefId(cardRef)

                if (currency === 'USD') {
                    acc.monthlyDue.usd += monthlyImpact
                    acc.remainingDebt.usd += remainingDebt
                } else {
                    acc.monthlyDue.ars += monthlyImpact
                    acc.remainingDebt.ars += remainingDebt
                }

                if (status.state !== 'finished') {
                    acc.activeCount += 1
                }

                if (cardId) {
                    activeCards.add(cardId)
                }

                return acc
            },
            {
                monthlyDue: { ars: 0, usd: 0 },
                remainingDebt: { ars: 0, usd: 0 },
                activeCount: 0,
            }
        )

        return {
            ...totals,
            activeCardsCount: activeCards.size,
        }
    }, [filteredItems, preferences.monthStartDay, selectedMonth])

    const activeCardsCount = overviewTotals.activeCardsCount
    const animatedMonthlyDue = useAnimatedTotals(overviewTotals.monthlyDue)
    const animatedRemainingDebt = useAnimatedTotals(overviewTotals.remainingDebt)

    const cardSummaries = useMemo(() => {
        const summaries = new Map<string, {
            cardId: string
            name: string
            color: string | null
            monthlyDue: { ars: number; usd: number }
            remainingDebt: { ars: number; usd: number }
            itemCount: number
        }>()

        summaryItems.forEach((item) => {
            const accountRef = item.kind === 'plan' ? item.plan.accountId : item.transaction.sourceAccountId
            const cardId = getRefId(accountRef)
            if (!cardId) return

            const existing = summaries.get(cardId) ?? {
                cardId,
                name: getRefName(accountRef) ?? 'Tarjeta',
                color: getRefColor(accountRef),
                monthlyDue: { ars: 0, usd: 0 },
                remainingDebt: { ars: 0, usd: 0 },
                itemCount: 0,
            }

            const currency = item.kind === 'plan' ? item.plan.currency : item.transaction.currency
            const monthlyImpact = getMonthlyImpact(item, selectedMonth, preferences.monthStartDay)
            const remainingDebt = getRemainingForItem(item, selectedMonth, preferences.monthStartDay)

            if (currency === 'USD') {
                existing.monthlyDue.usd += monthlyImpact
                existing.remainingDebt.usd += remainingDebt
            } else {
                existing.monthlyDue.ars += monthlyImpact
                existing.remainingDebt.ars += remainingDebt
            }
            existing.itemCount += 1
            summaries.set(cardId, existing)
        })

        return Array.from(summaries.values()).sort(
            (a, b) => (b.remainingDebt.ars + b.remainingDebt.usd) - (a.remainingDebt.ars + a.remainingDebt.usd)
        )
    }, [preferences.monthStartDay, selectedMonth, summaryItems])

    const handleEditItem = (item: CCExpenseItem | null) => {
        if (!item) return
        if (item.kind === 'plan') {
            setSelectedPlan(item.plan)
            setInstallmentDialogOpen(true)
            return
        }

        const transaction = item.transaction
        setSelectedTransaction(transaction)
        setDialogOpen(true)
    }

    const handleSubmitTransaction = async (data: TransactionFormData) => {
        try {
            if (selectedTransaction) {
                await patchTransaction(selectedTransaction._id.toString(), data)
                success('Gasto con TC actualizado correctamente')
            } else {
                await postTransaction(data)
                success('Gasto con TC creado correctamente')
            }

            setDialogOpen(false)
            setSelectedTransaction(null)
            invalidateData(TRANSACTION_INVALIDATION_TAGS)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar gasto con TC')
        }
    }

    const handleSubmitTransactionBatch = async (items: TransactionFormData[]) => {
        try {
            for (const item of items) {
                await postTransaction(item)
            }

            success(items.length === 2 ? 'Pago dual registrado correctamente' : 'Transacciones registradas correctamente')
            setDialogOpen(false)
            setSelectedTransaction(null)
            invalidateData(TRANSACTION_INVALIDATION_TAGS)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar transacciones')
        }
    }

    const handleSubmitInstallment = async (data: InstallmentFormData) => {
        try {
            if (selectedPlan) {
                await updatePlan(selectedPlan._id.toString(), data)
                success('Plan de cuotas actualizado correctamente')
            } else {
                await createPlan(data)
                success('Plan de cuotas creado correctamente')
            }

            setInstallmentDialogOpen(false)
            setSelectedPlan(null)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar plan de cuotas')
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteItem) return

        try {
            if (deleteItem.kind === 'plan') {
                await deletePlan(deleteItem.plan._id.toString())
                success('Plan eliminado correctamente')
            } else {
                await deleteTransaction(deleteItem.transaction._id.toString())
                success('Gasto con TC eliminado correctamente')
            }

            setDeleteItem(null)
            setSheetItem(null)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar gasto con TC')
        }
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-6xl space-y-4 p-4 md:space-y-5 md:p-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-8 w-32" />
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[...Array(4)].map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-2xl" />
                    ))}
                </div>
                <Skeleton className="h-32 rounded-2xl" />
                <div className="space-y-2">
                    {[...Array(4)].map((_, index) => (
                        <Skeleton key={index} className="h-28 rounded-2xl" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return <div className="p-8 text-center text-sm text-destructive">{error}</div>
    }

    return (
        <>
            <motion.div className="mx-auto max-w-6xl space-y-4 p-4 md:space-y-5 md:p-6" {...fadeIn}>
                <div className="flex flex-col gap-1.5">
                    <h1 className="text-xl font-semibold tracking-tight md:text-[2rem]">Gastos con TC</h1>
                    <p className="text-sm text-muted-foreground">
                        Seguimiento de consumos con tarjeta y su impacto mensual.
                    </p>
                </div>

                <MobileCardCarousel
                    hint="Deslizá para recorrer el overview"
                    ariaLabel="Resumen de gastos con tarjeta"
                >
                    <OverviewMetricCard
                        title="Resumen mensual"
                        totals={animatedMonthlyDue}
                        hidden={hidden}
                        accent="rgba(251, 191, 36, 0.7)"
                        primaryColor="#FBBF24"
                        secondaryColor="var(--muted-foreground)"
                        supporting={
                            <span>
                                {filteredItems.length} compra{filteredItems.length === 1 ? '' : 's'} en vista
                            </span>
                        }
                    />
                    <OverviewMetricCard
                        title="Deuda restante"
                        totals={animatedRemainingDebt}
                        hidden={hidden}
                        accent="rgba(96, 184, 224, 0.7)"
                        primaryColor="var(--sky-dark)"
                        secondaryColor="var(--muted-foreground)"
                        supporting={
                            <span>
                                {overviewTotals.activeCount} activa{overviewTotals.activeCount === 1 ? '' : 's'} este mes
                            </span>
                        }
                    />
                    <motion.div
                        variants={staggerItem}
                        className="relative rounded-2xl border p-4 md:p-5"
                        style={{
                            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                            boxShadow: 'var(--card-shadow)',
                        }}
                    >
                        <div className="absolute left-4 right-4 top-0 h-px overflow-hidden rounded-full opacity-80">
                            <div className="h-full w-full rounded-full bg-emerald-400/70" />
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:text-xs">
                            Tarjetas activas
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                            {activeCardsCount}
                        </p>
                        <p className="mt-3 border-t border-foreground/[0.07] pt-3 text-xs text-muted-foreground">
                            {filters.cardFilter === 'all' ? 'Con deuda o impacto en la vista actual' : 'Tarjeta filtrada'}
                        </p>
                    </motion.div>
                    <motion.div
                        variants={staggerItem}
                        className="relative rounded-2xl border p-4 md:p-5"
                        style={{
                            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                            boxShadow: 'var(--card-shadow)',
                        }}
                    >
                        <div className="absolute left-4 right-4 top-0 h-px overflow-hidden rounded-full opacity-80">
                            <div className="h-full w-full rounded-full bg-violet-400/70" />
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:text-xs">
                            Mix de cuotas
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                            {filteredItems.filter((item) => item.kind === 'plan').length}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            en cuotas
                        </p>
                        <p className="mt-3 border-t border-foreground/[0.07] pt-3 text-xs text-muted-foreground">
                            {filteredItems.filter((item) => item.kind === 'single').length} compra{filteredItems.filter((item) => item.kind === 'single').length === 1 ? '' : 's'} en 1 cuota
                        </p>
                    </motion.div>
                </MobileCardCarousel>

                <motion.section
                    className="hidden md:grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                >
                    <OverviewMetricCard
                        title="Resumen mensual"
                        totals={animatedMonthlyDue}
                        hidden={hidden}
                        accent="rgba(251, 191, 36, 0.7)"
                        primaryColor="#FBBF24"
                        secondaryColor="var(--muted-foreground)"
                        supporting={
                            <span>
                                {filteredItems.length} compra{filteredItems.length === 1 ? '' : 's'} en vista
                            </span>
                        }
                    />
                    <OverviewMetricCard
                        title="Deuda restante"
                        totals={animatedRemainingDebt}
                        hidden={hidden}
                        accent="rgba(96, 184, 224, 0.7)"
                        primaryColor="var(--sky-dark)"
                        secondaryColor="var(--muted-foreground)"
                        supporting={
                            <span>
                                {overviewTotals.activeCount} activa{overviewTotals.activeCount === 1 ? '' : 's'} este mes
                            </span>
                        }
                    />
                    <motion.div
                        variants={staggerItem}
                        className="relative rounded-2xl border p-4 md:p-5"
                        style={{
                            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                            boxShadow: 'var(--card-shadow)',
                        }}
                    >
                        <div className="absolute left-4 right-4 top-0 h-px overflow-hidden rounded-full opacity-80">
                            <div className="h-full w-full rounded-full bg-emerald-400/70" />
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:text-xs">
                            Tarjetas activas
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                            {activeCardsCount}
                        </p>
                        <p className="mt-3 border-t border-foreground/[0.07] pt-3 text-xs text-muted-foreground">
                            {filters.cardFilter === 'all' ? 'Con deuda o impacto en la vista actual' : 'Tarjeta filtrada'}
                        </p>
                    </motion.div>
                    <motion.div
                        variants={staggerItem}
                        className="relative rounded-2xl border p-4 md:p-5"
                        style={{
                            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                            boxShadow: 'var(--card-shadow)',
                        }}
                    >
                        <div className="absolute left-4 right-4 top-0 h-px overflow-hidden rounded-full opacity-80">
                            <div className="h-full w-full rounded-full bg-violet-400/70" />
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground md:text-xs">
                            Mix de cuotas
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                            {filteredItems.filter((item) => item.kind === 'plan').length}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            en cuotas
                        </p>
                        <p className="mt-3 border-t border-foreground/[0.07] pt-3 text-xs text-muted-foreground">
                            {filteredItems.filter((item) => item.kind === 'single').length} compra{filteredItems.filter((item) => item.kind === 'single').length === 1 ? '' : 's'} en 1 cuota
                        </p>
                    </motion.div>
                </motion.section>

                <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Resumen por tarjeta
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {cardSummaries.length} tarjeta{cardSummaries.length === 1 ? '' : 's'}
                        </p>
                    </div>

                    {cardSummaries.length === 0 ? (
                        <div
                            className="rounded-2xl px-4 py-3 text-sm text-muted-foreground"
                            style={{
                                background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                                border: '0.5px solid color-mix(in srgb, var(--foreground) 8%, transparent)',
                                boxShadow: 'var(--card-shadow)',
                            }}
                        >
                            No hay tarjetas con gastos para los filtros seleccionados.
                        </div>
                    ) : (
                        <>
                        <MobileCardCarousel
                            className="space-y-0"
                            hint="Deslizá para comparar tarjetas"
                            ariaLabel="Resumen por tarjeta"
                        >
                            {cardSummaries.map((card) => {
                                const selected = filters.cardFilter === card.cardId

                                return (
                                    <button
                                        key={card.cardId}
                                        type="button"
                                        onClick={() =>
                                            setFilter('cardFilter', selected ? DEFAULT_FILTERS.cardFilter : card.cardId)
                                        }
                                        className="min-w-[248px] rounded-2xl border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px"
                                        style={{
                                            background: card.color
                                                ? `linear-gradient(180deg, ${card.color}12 0%, color-mix(in srgb, var(--card) 94%, transparent) 34%)`
                                                : 'color-mix(in srgb, var(--card) 92%, transparent)',
                                            borderColor: selected ? (card.color ?? 'var(--sky)') : 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                                            boxShadow: selected
                                                ? `0 0 0 1px ${card.color ?? 'rgba(96,184,224,0.32)'}22 inset, var(--card-shadow)`
                                                : 'var(--card-shadow)',
                                        }}
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {card.color && (
                                                    <span
                                                        className="h-2.5 w-2.5 shrink-0 rounded-full opacity-90"
                                                        style={{ backgroundColor: card.color }}
                                                    />
                                                )}
                                                <p className="truncate text-sm font-medium">{card.name}</p>
                                            </div>
                                            {selected && (
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 text-sky-600"
                                                    style={{
                                                        borderColor: card.color ? `${card.color}55` : undefined,
                                                        color: card.color ?? undefined,
                                                    }}
                                                >
                                                    Filtrada
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 border-t border-foreground/[0.07] pt-3">
                                            <div className="min-w-0">
                                                <p className="text-[11px] text-muted-foreground">Deuda restante</p>
                                                <div className="mt-1">
                                                    <CurrencyBreakdownAmount
                                                        totals={card.remainingDebt}
                                                        hidden={hidden}
                                                        primaryColor="var(--foreground)"
                                                        secondaryColor="var(--muted-foreground)"
                                                        className="text-sm font-semibold"
                                                    />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] text-muted-foreground">Resumen mensual</p>
                                                <div className="mt-1">
                                                    <CurrencyBreakdownAmount
                                                        totals={card.monthlyDue}
                                                        hidden={hidden}
                                                        primaryColor="var(--foreground)"
                                                        secondaryColor="var(--muted-foreground)"
                                                        className="text-sm font-semibold"
                                                    />
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {(card.monthlyDue.ars > 0 || card.monthlyDue.usd > 0)
                                                        ? 'impacta este mes'
                                                        : 'sin impacto este mes'}
                                                </p>
                                            </div>
                                        </div>

                                        <p className="mt-3 text-[11px] text-muted-foreground">
                                            {card.itemCount} gasto{card.itemCount === 1 ? '' : 's'} en la vista actual
                                        </p>
                                    </button>
                                )
                            })}
                        </MobileCardCarousel>
                        <div className="hidden md:flex gap-2.5 overflow-x-auto pb-1">
                            {cardSummaries.map((card) => {
                                const selected = filters.cardFilter === card.cardId

                                return (
                                    <button
                                        key={card.cardId}
                                        type="button"
                                        onClick={() =>
                                            setFilter('cardFilter', selected ? DEFAULT_FILTERS.cardFilter : card.cardId)
                                        }
                                        className="min-w-[248px] rounded-2xl border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px"
                                        style={{
                                            background: card.color
                                                ? `linear-gradient(180deg, ${card.color}12 0%, color-mix(in srgb, var(--card) 94%, transparent) 34%)`
                                                : 'color-mix(in srgb, var(--card) 92%, transparent)',
                                            borderColor: selected ? (card.color ?? 'var(--sky)') : 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                                            boxShadow: selected
                                                ? `0 0 0 1px ${card.color ?? 'rgba(96,184,224,0.32)'}22 inset, var(--card-shadow)`
                                                : 'var(--card-shadow)',
                                        }}
                                    >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {card.color && (
                                                    <span
                                                        className="h-2.5 w-2.5 shrink-0 rounded-full opacity-90"
                                                        style={{ backgroundColor: card.color }}
                                                    />
                                                )}
                                                <p className="truncate text-sm font-medium">{card.name}</p>
                                            </div>
                                            {selected && (
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 text-sky-600"
                                                    style={{
                                                        borderColor: card.color ? `${card.color}55` : undefined,
                                                        color: card.color ?? undefined,
                                                    }}
                                                >
                                                    Filtrada
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 border-t border-foreground/[0.07] pt-3">
                                            <div className="min-w-0">
                                                <p className="text-[11px] text-muted-foreground">Deuda restante</p>
                                                <div className="mt-1">
                                                    <CurrencyBreakdownAmount
                                                        totals={card.remainingDebt}
                                                        hidden={hidden}
                                                        primaryColor="var(--foreground)"
                                                        secondaryColor="var(--muted-foreground)"
                                                        className="text-sm font-semibold"
                                                    />
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] text-muted-foreground">Resumen mensual</p>
                                                <div className="mt-1">
                                                    <CurrencyBreakdownAmount
                                                        totals={card.monthlyDue}
                                                        hidden={hidden}
                                                        primaryColor="var(--foreground)"
                                                        secondaryColor="var(--muted-foreground)"
                                                        className="text-sm font-semibold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                        </>
                    )}
                </section>

                <div className="flex items-center gap-3 px-1">
                    <div className="h-px flex-1 bg-border/70" />
                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Vista mensual
                    </p>
                    <div className="h-px flex-1 bg-border/70" />
                </div>

                <section
                    className="rounded-2xl border px-4 py-4 space-y-4"
                    style={{
                        background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                        boxShadow: 'var(--card-shadow)',
                    }}
                >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mes</p>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="h-8 w-full text-sm md:w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTHS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="hidden md:flex items-center gap-2.5 flex-wrap">
                            <FilterChip
                                label="Tarjeta"
                                active={filters.cardFilter !== DEFAULT_FILTERS.cardFilter}
                                options={cardOptions}
                                value={filters.cardFilter === 'all' ? '' : filters.cardFilter}
                                onChange={(value) => setFilter('cardFilter', value || 'all')}
                            />
                            <FilterChip
                                label="Categoría"
                                active={filters.categoryFilter !== DEFAULT_FILTERS.categoryFilter}
                                options={categoryOptions}
                                value={filters.categoryFilter === 'all' ? '' : filters.categoryFilter}
                                onChange={(value) => setFilter('categoryFilter', value || 'all')}
                            />
                            <FilterChip
                                label="Estado"
                                active={filters.statusFilter !== DEFAULT_FILTERS.statusFilter}
                                options={STATUS_OPTIONS}
                                value={filters.statusFilter}
                                onChange={(value) => setFilter('statusFilter', (value || DEFAULT_FILTERS.statusFilter) as StatusFilter)}
                            />
                            <FilterChip
                                label="Cuotas"
                                active={filters.installmentFilter !== DEFAULT_FILTERS.installmentFilter}
                                options={INSTALLMENT_OPTIONS}
                                value={filters.installmentFilter}
                                onChange={(value) =>
                                    setFilter('installmentFilter', (value || DEFAULT_FILTERS.installmentFilter) as InstallmentFilter)
                                }
                            />
                            <FilterChip
                                label="Ordenar"
                                active={sort !== 'date_desc'}
                                options={SORT_OPTIONS}
                                value={sort}
                                onChange={(value) => setSort((value || 'date_desc') as SortFilter)}
                            />

                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs font-medium"
                                    style={{
                                        color: 'var(--muted-foreground)',
                                        background: 'var(--secondary)',
                                        border: '0.5px solid var(--border)',
                                    }}
                                >
                                    <X size={12} /> Limpiar
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex md:hidden items-center gap-2 w-full">
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

                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                                style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}
                            >
                                <X size={12} /> Limpiar
                            </button>
                        )}
                    </div>

                    {summaryItems.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {filteredItems.length} de {summaryItems.length} gasto{summaryItems.length === 1 ? '' : 's'} con TC
                        </p>
                    )}
                </section>

                {filteredItems.length === 0 ? (
                    <div
                        className="rounded-2xl"
                        style={{
                            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                            border: '0.5px solid color-mix(in srgb, var(--foreground) 8%, transparent)',
                            boxShadow: 'var(--card-shadow)',
                        }}
                    >
                        <EmptyState
                            icon={CreditCard}
                            title="No hay gastos con TC para esos filtros"
                            description="Probá cambiando el mes, la tarjeta o mostrando finalizados."
                            actionLabel={activeFilterCount > 0 ? 'Limpiar filtros' : undefined}
                            onAction={activeFilterCount > 0 ? clearFilters : undefined}
                        />
                    </div>
                ) : (
                    <motion.div
                        className="space-y-2.5"
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        {filteredItems.map((item) => {
                            const isPlan = item.kind === 'plan'
                            const plan = isPlan ? item.plan : null
                            const singleTransaction = isPlan ? null : item.transaction
                            const transaction = isPlan ? plan?.parentTransaction ?? null : singleTransaction
                            const accountRef = isPlan ? plan?.accountId : singleTransaction?.sourceAccountId
                            const categoryRef = isPlan ? plan?.categoryId : singleTransaction?.categoryId
                            const accountName = getRefName(accountRef)
                            const accountColor = getRefColor(accountRef)
                            const categoryName = getRefName(categoryRef)
                            const categoryColor = getRefColor(categoryRef)
                            const totalAmount = isPlan && plan ? plan.totalAmount : (singleTransaction?.amount ?? 0)
                            const quotaAmount =
                                getMonthlyImpact(item, selectedMonth, preferences.monthStartDay) ||
                                (isPlan && plan ? plan.installmentAmount : singleTransaction?.amount ?? 0)
                            const statusLabel = getHumanStatusLabel(item, selectedMonth, preferences.monthStartDay)
                            const currency = isPlan && plan ? plan.currency : (singleTransaction?.currency ?? 'ARS')
                            const purchaseDate = isPlan && plan ? plan.purchaseDate : singleTransaction?.date
                            const purchaseDateLabel = purchaseDate
                                ? new Date(purchaseDate).toLocaleDateString('es-AR')
                                : '-'
                            const installmentMeta = isPlan && plan ? `${plan.installmentCount} cuotas` : '1 cuota'
                            const remainingDebt = getRemainingForItem(item, selectedMonth, preferences.monthStartDay)

                            return (
                                <motion.div
                                    key={`${item.kind}-${isPlan ? item.plan._id.toString() : item.transaction._id.toString()}`}
                                    variants={staggerItem}
                                    className="relative overflow-hidden rounded-2xl border"
                                    style={{
                                        background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                                        borderColor: 'color-mix(in srgb, var(--foreground) 8%, transparent)',
                                        boxShadow: 'var(--card-shadow)',
                                    }}
                                >
                                    <div
                                        className="absolute left-4 right-4 top-0 h-px overflow-hidden rounded-full opacity-55"
                                        style={{ background: accountColor ?? categoryColor ?? 'rgba(96, 184, 224, 0.28)' }}
                                    />
                                    <div className="flex items-start gap-3 px-4 py-3 md:px-5 md:py-3.5">
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 text-left"
                                            onClick={() => setSheetItem(item)}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium md:text-[15px]">
                                                        {transaction?.description ?? plan?.description}
                                                    </p>
                                                    <div className="mt-0.5 flex items-center gap-1 flex-wrap text-[11px] text-muted-foreground md:text-xs">
                                                        <span>{purchaseDateLabel}</span>
                                                        {(transaction?.merchant || plan?.merchant) && (
                                                            <span>· {transaction?.merchant ?? plan?.merchant}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="shrink-0 text-right">
                                                    <p className="text-sm font-semibold tabular-nums md:text-base">
                                                        <ResponsiveAmount amount={totalAmount} currency={currency} hidden={hidden} />
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">total</p>
                                                </div>
                                            </div>

                                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                <Badge variant="secondary" className="h-5 px-2 text-[10px] font-medium">
                                                    {installmentMeta}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className={`h-5 px-2 text-[10px] ${
                                                        statusLabel === 'Finalizado'
                                                            ? 'text-muted-foreground'
                                                            : statusLabel.startsWith('Primera cuota') || statusLabel.startsWith('Impacta en')
                                                                ? 'border-amber-200 text-amber-600'
                                                                : 'border-indigo-200 text-indigo-600'
                                                    }`}
                                                >
                                                    {statusLabel}
                                                </Badge>
                                            </div>

                                            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground md:text-xs">
                                                {accountName && (
                                                    <span className="flex items-center gap-1">
                                                        {accountColor && (
                                                            <span
                                                                className="w-2 h-2 rounded-full inline-block shrink-0"
                                                                style={{ backgroundColor: accountColor }}
                                                            />
                                                        )}
                                                        {accountName}
                                                    </span>
                                                )}
                                                {categoryName && (
                                                    <span className="flex items-center gap-1">
                                                        {categoryColor && (
                                                            <span
                                                                className="w-2 h-2 rounded-full inline-block shrink-0"
                                                                style={{ backgroundColor: categoryColor }}
                                                            />
                                                        )}
                                                        {categoryName}
                                                    </span>
                                                )}
                                                <span>
                                                    Cuota <ResponsiveAmount amount={quotaAmount} currency={currency} hidden={hidden} />
                                                </span>
                                                <span>
                                                    Pendiente <ResponsiveAmount amount={remainingDebt} currency={currency} hidden={hidden} />
                                                </span>
                                            </div>
                                        </button>

                                        <div className="flex shrink-0 items-center gap-1 border-l border-foreground/[0.06] pl-2 md:pl-3">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="opacity-80 hover:opacity-100"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    handleEditItem(item)
                                                }}
                                                aria-label="Editar"
                                            >
                                                <Pencil />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-destructive opacity-80 hover:text-destructive hover:opacity-100"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    setDeleteItem(item)
                                                }}
                                                aria-label="Eliminar"
                                            >
                                                <Trash2 />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </motion.div>
                )}
            </motion.div>

            <CreditCardExpenseSheet
                open={Boolean(sheetItem)}
                onOpenChange={(open) => !open && setSheetItem(null)}
                item={sheetItem}
                selectedMonth={selectedMonth}
                monthStartDay={preferences.monthStartDay}
                hidden={hidden}
                onEdit={() => handleEditItem(sheetItem)}
                onDelete={() => sheetItem && setDeleteItem(sheetItem)}
            />

            <TransactionDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setSelectedTransaction(null)
                }}
                transaction={selectedTransaction}
                accounts={accounts}
                categories={categories}
                onSubmit={handleSubmitTransaction}
                onBatchSubmit={handleSubmitTransactionBatch}
                onInstallmentSubmit={handleSubmitInstallment}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                monthStartDay={preferences.monthStartDay}
            />

            <InstallmentDialog
                open={installmentDialogOpen}
                onOpenChange={(open) => {
                    setInstallmentDialogOpen(open)
                    if (!open) setSelectedPlan(null)
                }}
                plan={selectedPlan}
                accounts={accounts}
                categories={categories}
                onSubmit={handleSubmitInstallment}
            />

            <CreditCardFilterSheet
                open={filterSheetOpen}
                onClose={() => setFilterSheetOpen(false)}
                draftFilters={draftFilters}
                sort={draftSort}
                onChange={setDraftFilter}
                onSortChange={setDraftSort}
                onApply={applyDraftFilters}
                onClear={clearDraftFilters}
                cardOptions={cardOptions}
                categoryOptions={categoryOptions}
            />

            <AlertDialog open={Boolean(deleteItem)} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <AlertDialogContent
                    className="border-foreground/[0.08] bg-background/95 backdrop-blur-sm shadow-2xl"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            ¿Eliminar este gasto con TC?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteItem?.kind === 'plan'
                                ? 'Se eliminará el plan de cuotas y su transacción madre asociada.'
                                : 'Esta acción no se puede deshacer.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
