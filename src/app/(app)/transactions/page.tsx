'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeftRight,
    ChevronDown,
    CreditCard,
    ExternalLink,
    Pencil,
    RefreshCw,
    SlidersHorizontal,
    Sparkles,
    Trash2,
    Unlink,
    Upload,
    X,
} from 'lucide-react'
import Link from 'next/link'

import { useTransactions } from '@/hooks/useTransactions'
import { useInstallments } from '@/hooks/useInstallments'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useNotifications } from '@/contexts/NotificationsContext'
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
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { Spinner } from '@/components/shared/Spinner'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { PeriodSelector } from '@/components/shared/PeriodSelector'

import { DURATION, easeSmooth, fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { getCategoryTypeForTransactionType, isCategoryCompatible, normalizeFilters } from '@/lib/utils/transactions'
import { buildMonthOptions, getCurrentFinancialPeriod } from '@/lib/utils/period'
import { getOperationalStartFinancialPeriod } from '@/lib/utils/operational-start'
import { getTransactionAccountImpact } from '@/lib/utils/transaction-account-impact'
import { isSplitTransaction } from '@/lib/utils/operational-amount'
import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, NOTIFICATION_INVALIDATION_TAGS, TRANSACTION_INVALIDATION_TAGS } from '@/lib/client/data-sync'
import type { CategoryOption, Filters } from '@/lib/utils/transactions'
import type { TransactionFormData, InstallmentFormData } from '@/lib/validations'
import type { ICategory, ITransaction, IAccount } from '@/types'

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    credit_card_expense: 'Gasto con TC',
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de tarjeta',          // backwards compat
    adjustment: 'Ajuste',
    personal_debt_payment: 'Pago de deuda',
    personal_debt_collect: 'Cobro de deuda',
}

const TRANSACTION_TYPE_COLORS: Record<
    string,
    'default' | 'destructive' | 'secondary' | 'outline'
> = {
    income: 'default',
    expense: 'destructive',
    credit_card_expense: 'outline',
    transfer: 'secondary',
    exchange: 'secondary',
    credit_card_payment: 'outline',
    debt_payment: 'outline',
    adjustment: 'secondary',
    personal_debt_payment: 'secondary',
    personal_debt_collect: 'secondary',
}

// Types that cannot be edited or deleted through the transaction form.
const NON_EDITABLE_TYPES = new Set(['personal_debt_payment', 'personal_debt_collect'])

const SORT_OPTIONS = [
    { value: 'date_desc', label: 'Más reciente' },
    { value: 'date_asc', label: 'Más antigua' },
    { value: 'created_desc', label: 'Creación más reciente' },
    { value: 'created_asc', label: 'Creación más antigua' },
    { value: 'amount_desc', label: 'Mayor monto' },
    { value: 'amount_asc', label: 'Menor monto' },
    { value: 'description_asc', label: 'A → Z' },
] as const

const DEFAULT_SORT = 'date_desc'

const getCurrentMonth = (monthStartDay = 1) => getCurrentFinancialPeriod(new Date(), monthStartDay)

type BasicOption = {
    value: string
    label: string
}

const DEFAULT_FILTERS: Filters = {
    type: '',
    categoryId: '',
    accountId: '',
    currency: '',
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

function easeOutCubic(value: number) {
    return 1 - Math.pow(1 - value, 3)
}

function useAnimatedTotals(totals: { ars: number; usd: number }) {
    const [animated, setAnimated] = useState(totals)

    useEffect(() => {
        let frame = 0
        const startedAt = performance.now()
        const previous = animated
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

function SummaryMetricCard({
    title,
    totals,
    hidden,
    accent,
    primaryColor,
    secondaryColor,
    align = 'left',
    children,
}: {
    title: string
    totals: { ars: number; usd: number }
    hidden: boolean
    accent: string
    primaryColor: string
    secondaryColor: string
    align?: 'left' | 'center'
    children?: React.ReactNode
}) {
    return (
        <motion.div
            variants={staggerItem}
            className={`relative p-3.5 md:p-4 ${align === 'center' ? 'text-center' : ''}`}
            style={{
                borderTop: `1px solid ${accent}`,
            }}
        >
            <div
                className="absolute inset-x-0 top-0 h-px opacity-70"
                style={{ background: accent }}
            />
            <p className="mb-1.5 text-[11px] text-muted-foreground uppercase tracking-[0.16em] md:text-xs">
                {title}
            </p>
            <CurrencyBreakdownAmount
                totals={totals}
                hidden={hidden}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                align={align === 'center' ? 'center' : 'left'}
                hideZeroSecondary
                preserveSecondarySpace
                className="text-lg font-semibold tracking-tight md:text-[1.7rem]"
            />
            {children}
        </motion.div>
    )
}

function BasicFilterChip({
                             label,
                             active,
                             options,
                             value,
                             onChange,
                             showCurrencyFlags = false,
                         }: {
    label: string
    active: boolean
    options: BasicOption[]
    value: string
    onChange: (v: string) => void
    showCurrencyFlags?: boolean
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
                {active && showCurrencyFlags ? <CurrencyFlagIcon currency={value} size="xs" /> : null}
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
                        className="absolute top-full mt-2 right-0 z-40 min-w-48 rounded-2xl border p-1.5 backdrop-blur-md"
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
                                <span className="flex items-center gap-2">
                                    {showCurrencyFlags ? (
                                        <CurrencyFlagIcon currency={option.value} size="xs" />
                                    ) : null}
                                    {option.label}
                                </span>
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
        { value: 'credit_card_expense', label: 'Gasto con TC' },
        { value: 'transfer', label: 'Transferencia' },
        { value: 'exchange', label: 'Cambio' },
        { value: 'credit_card_payment', label: 'Pago de tarjeta' },
        { value: 'adjustment', label: 'Ajuste' },
        { value: 'personal_debt_payment', label: 'Pago de deuda' },
        { value: 'personal_debt_collect', label: 'Cobro de deuda' },
    ]

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px"
                style={{
                    background: value ? 'rgba(96,184,224,0.16)' : 'var(--secondary)',
                    color: value ? 'var(--sky-dark)' : 'var(--muted-foreground)',
                    border: `0.5px solid ${open || value ? 'rgba(96,184,224,0.32)' : 'var(--border)'}`,
                    boxShadow: open ? '0 10px 24px rgba(0,0,0,0.12)' : undefined,
                }}
            >
                {value ? selectedLabel : 'Tipo'}
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
                        className="absolute top-full mt-2 right-0 z-40 min-w-48 rounded-2xl border p-1.5 backdrop-blur-md"
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
                            Todos
                        </button>

                        {typeOptions.map((option) => {
                            const isSuggestedConflict =
                                activeCategoryType &&
                                activeCategoryType !== getCategoryTypeForTransactionType(option.value)

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
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 hover:-translate-y-px"
                style={{
                    background: value ? 'rgba(96,184,224,0.16)' : 'var(--secondary)',
                    color: value ? 'var(--sky-dark)' : 'var(--muted-foreground)',
                    border: `0.5px solid ${open || value ? 'rgba(96,184,224,0.32)' : 'var(--border)'}`,
                    boxShadow: open ? '0 10px 24px rgba(0,0,0,0.12)' : undefined,
                }}
            >
                {value ? selectedCategory?.label : 'Categoría'}
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
                        className="absolute top-full mt-2 right-0 z-40 min-w-64 max-w-80 rounded-2xl border p-1.5 backdrop-blur-md"
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

                        <div className="mt-1 max-h-64 overflow-y-auto space-y-1">
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
                         sort,
                         onChange,
                         onSortChange,
                         onApply,
                         onClear,
                         typeOptions,
                         categoryOptions,
                         accountOptions,
                         currencyOptions,
                         activeCount,
                     }: {
    open: boolean
    onClose: () => void
    filters: Filters
    sort: string
    onChange: (key: keyof Filters, value: string) => void
    onSortChange: (value: string) => void
    onApply: () => void
    onClear: () => void
    typeOptions: BasicOption[]
    categoryOptions: CategoryOption[]
    accountOptions: BasicOption[]
    currencyOptions: BasicOption[]
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

                                <div>
                                    <p className="text-xs font-medium mb-2">Moneda</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ value: '', label: 'Todas' }, ...currencyOptions].map((option) => (
                                            <button
                                                key={option.value || 'all-currency'}
                                                type="button"
                                                onClick={() => onChange('currency', option.value)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background:
                                                        filters.currency === option.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.currency === option.value ? '#fff' : 'var(--foreground)',
                                                }}
                                            >
                                                {option.value ? (
                                                    <CurrencyFlagIcon currency={option.value} size="xs" />
                                                ) : null}
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-medium">Ordenar</p>
                                    <Select value={sort} onValueChange={onSortChange}>
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

function TransactionsPageInner() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const initialMonth = searchParams.get('month') ?? getCurrentMonth()
    const initialFilters: Filters = {
        type: searchParams.get('type') ?? DEFAULT_FILTERS.type,
        categoryId: searchParams.get('categoryId') ?? DEFAULT_FILTERS.categoryId,
        accountId: searchParams.get('accountId') ?? DEFAULT_FILTERS.accountId,
        currency: searchParams.get('currency') ?? DEFAULT_FILTERS.currency,
    }
    const initialSort = SORT_OPTIONS.some((option) => option.value === searchParams.get('sort'))
        ? (searchParams.get('sort') as typeof SORT_OPTIONS[number]['value'])
        : DEFAULT_SORT

    const deepLinkTransactionId = searchParams.get('transactionId')
    const deepLinkHint = searchParams.get('hint')
    const [highlightedId, setHighlightedId] = useState<string | null>(() =>
        deepLinkHint === 'review' && deepLinkTransactionId ? deepLinkTransactionId : null
    )
    const highlightHandledRef = useRef(false)

    const [month, setMonth] = useState(() => initialMonth)
    const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters)
    const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters)
    const [sort, setSort] = useState(initialSort)
    const [draftSort, setDraftSort] = useState(initialSort)
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(searchParams.get('new') === '1')
    const [selectedTransaction, setSelectedTransaction] = useState<ITransaction | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [removeFromFinpTarget, setRemoveFromFinpTarget] = useState<{
        transactionId: string
        spaceId: string
        spaceEntryId?: string
    } | null>(null)
    const [removingFromFinp, setRemovingFromFinp] = useState(false)

    const { accounts, loading: accountsLoading } = useAccounts()
    const { categories, loading: categoriesLoading } = useCategories()
    const { rules, createRule } = useTransactionRules()
    const { preferences } = usePreferences()
    const { transactionReviewIds } = useNotifications()

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
        summary,
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
        currency: appliedFilters.currency || undefined,
        sort,
    })

    const { createPlan } = useInstallments()
    const { success, error: toastError } = useToast()
    const { hidden } = useHideAmounts()

    usePageTitle('Transacciones')

    // Switch to the target transaction's month when deep-linking
    useEffect(() => {
        if (!highlightedId) return
        void apiJson<{ transaction: ITransaction }>(`/api/transactions/${highlightedId}`)
            .then(({ transaction }) => {
                const targetMonth = getCurrentFinancialPeriod(
                    new Date(transaction.date),
                    preferences.monthStartDay
                )
                setMonth(targetMonth)
            })
            .catch(() => { /* stay on current month */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightedId])

    // Scroll + toast once the target transaction appears in the loaded list
    useEffect(() => {
        if (!highlightedId || loading || highlightHandledRef.current) return
        const found = transactions.find((t) => t._id.toString() === highlightedId)
        if (!found) return
        highlightHandledRef.current = true
        success('Revisá el movimiento vinculado al espacio')
        router.replace('/transactions', { scroll: false })
        setTimeout(() => {
            document.querySelector(`[data-transaction-id="${highlightedId}"]`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            })
        }, 100)
    }, [highlightedId, transactions, loading, success, router])

    const firstOperationalMonth = useMemo(
        () => getOperationalStartFinancialPeriod(preferences.operationalStartDate, preferences.monthStartDay),
        [preferences.operationalStartDate, preferences.monthStartDay]
    )

    const monthOptions = useMemo(() => {
        const options = buildMonthOptions({ pastMonths: 8, futureMonths: 1, from: new Date() })
        if (!firstOperationalMonth) return options
        return options.filter((option) => option.value >= firstOperationalMonth)
    }, [firstOperationalMonth])

    useEffect(() => {
        const currentMonth = getCurrentMonth(preferences.monthStartDay)
        const minimumMonth =
            firstOperationalMonth && firstOperationalMonth > currentMonth
                ? firstOperationalMonth
                : currentMonth

        setMonth((prev) =>
            prev >= minimumMonth && (!firstOperationalMonth || prev >= firstOperationalMonth)
                ? prev
                : minimumMonth
        )
    }, [firstOperationalMonth, preferences.monthStartDay])

    const handleNewTransaction = useCallback(() => {
        setSelectedTransaction(null)
        setTransactionDialogOpen(true)
    }, [])

    useKeyboardShortcuts([{ key: 'n', handler: handleNewTransaction }])

    const handleSyncImpact = async (transaction: ITransaction) => {
        if (!transaction.spaceId || !transaction.spaceEntryId) return
        try {
            await apiJson(
                `/api/spaces/${transaction.spaceId.toString()}/entries/${transaction.spaceEntryId.toString()}/personal-impact/sync`,
                { method: 'POST' }
            )
            setHighlightedId(null)
            success('Transacción actualizada')
            invalidateData([...NOTIFICATION_INVALIDATION_TAGS, ...TRANSACTION_INVALIDATION_TAGS])
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No se pudo sincronizar la transacción')
        }
    }

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

    const handleRemoveFromFinpConfirm = async () => {
        if (!removeFromFinpTarget) return
        setRemovingFromFinp(true)
        try {
            const { transactionId, spaceId, spaceEntryId } = removeFromFinpTarget
            if (spaceEntryId) {
                await apiJson(`/api/spaces/${spaceId}/entries/${spaceEntryId}/personal-impact`, { method: 'DELETE' })
            }
            await deleteTransaction(transactionId)
            await Promise.all([
                invalidateData(TRANSACTION_INVALIDATION_TAGS),
                invalidateData(NOTIFICATION_INVALIDATION_TAGS),
            ])
            success('Movimiento quitado de tu Finp')
            setRemoveFromFinpTarget(null)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al quitar de tu Finp')
        } finally {
            setRemovingFromFinp(false)
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

    const handleTransactionBatchSubmit = async (items: TransactionFormData[]) => {
        try {
            for (const item of items) {
                await createTransaction(item)
            }
            success(
                items.length === 2
                    ? 'Pago dual registrado correctamente'
                    : `${items.length} transacciones registradas correctamente`
            )
            setTransactionDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar las transacciones')
        }
    }

    const handleInstallmentSubmit = async (data: InstallmentFormData) => {
        try {
            await createPlan(data as never)
            success('Compra en cuotas registrada correctamente')
            setTransactionDialogOpen(false)
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
        setSort(DEFAULT_SORT)
        setDraftSort(DEFAULT_SORT)
    }

    const clearDraftFilters = () => {
        setDraftFilters(DEFAULT_FILTERS)
        setDraftSort(DEFAULT_SORT)
    }

    const openFilterSheet = () => {
        setDraftFilters(appliedFilters)
        setDraftSort(sort)
        setFilterSheetOpen(true)
    }

    const applyDraftFilters = () => {
        setAppliedFilters(normalizeFilters(draftFilters, categoryOptions))
        setSort(draftSort)
        setFilterSheetOpen(false)
    }

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (appliedFilters.type) count++
        if (appliedFilters.categoryId) count++
        if (appliedFilters.accountId) count++
        if (appliedFilters.currency) count++
        return count
    }, [appliedFilters])

    const typeOptions = useMemo<BasicOption[]>(
        () => [
            { value: 'income', label: 'Ingreso' },
            { value: 'expense', label: 'Gasto' },
            { value: 'credit_card_expense', label: 'Gasto con TC' },
            { value: 'transfer', label: 'Transferencia' },
            { value: 'exchange', label: 'Cambio' },
            { value: 'credit_card_payment', label: 'Pago de tarjeta' },
            { value: 'adjustment', label: 'Ajuste' },
            { value: 'personal_debt_payment', label: 'Pago de deuda' },
            { value: 'personal_debt_collect', label: 'Cobro de deuda' },
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

    // KPIs come from the API summary (full month, unfiltered by type/category/account)
    const totalIncome = summary.income
    const totalExpense = summary.expense
    const totalCreditCardExpense = summary.creditCardExpense
    const periodResult = summary.balance
    const availableBalance = summary.availableBalance
    const animatedIncome = useAnimatedTotals(totalIncome)
    const animatedExpense = useAnimatedTotals(totalExpense)
    const animatedCreditCardExpense = useAnimatedTotals(totalCreditCardExpense)
    const animatedPeriodResult = useAnimatedTotals(periodResult)
    const animatedAvailableBalance = useAnimatedTotals(availableBalance)

    useAppStartupReady(!loading && !accountsLoading && !categoriesLoading)

    if (loading) {
        return (
            <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
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
        <motion.div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-5" {...fadeIn}>
            <div className="flex flex-col gap-1.5">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Transacciones</h1>
                        {refreshing && <Spinner className="text-muted-foreground" />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Movimientos del mes con filtros rápidos y edición directa.
                    </p>
                </div>
            </div>

            <motion.div
                className="rounded-2xl overflow-hidden"
                style={{
                    background: 'var(--card)',
                    border: '0.5px solid var(--border)',
                    boxShadow: 'var(--card-shadow)',
                }}
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                <div className="flex items-center justify-between gap-3 px-4 py-2" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <div>
                        <p className="text-sm font-medium md:hidden">Resumen del período</p>
                        <div className="hidden md:flex items-baseline gap-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensual</p>
                            <p className="text-[10px] text-muted-foreground">Resultado del período y saldo acumulado</p>
                        </div>
                    </div>
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                            {activeFilterCount} filtros
                        </Badge>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <SummaryMetricCard
                        title="Ingresos"
                        totals={animatedIncome}
                        hidden={hidden}
                        accent="rgba(16,185,129,0.30)"
                        primaryColor="#10B981"
                        secondaryColor="rgba(16,185,129,0.78)"
                    />
                    <SummaryMetricCard
                        title="Gastos"
                        totals={animatedExpense}
                        hidden={hidden}
                        accent="rgba(239,68,68,0.30)"
                        primaryColor="var(--destructive)"
                        secondaryColor="rgba(239,68,68,0.78)"
                    >
                        <AnimatePresence>
                            {(totalCreditCardExpense.ars > 0 || totalCreditCardExpense.usd > 0) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    transition={{ duration: DURATION.fast, ease: easeSmooth }}
                                    className="mt-2.5 inline-flex items-start gap-2 rounded-xl border px-2.5 py-1.5 text-xs"
                                    style={{
                                        color: '#6366F1',
                                        borderColor: 'rgba(99,102,241,0.18)',
                                        background: 'rgba(99,102,241,0.07)',
                                    }}
                                >
                                    <CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-medium">
                                            <ResponsiveAmount amount={animatedCreditCardExpense.ars} currency="ARS" hidden={hidden} color="#6366F1" />
                                            <span className="ml-1">con TC</span>
                                        </div>
                                        <div className="text-[11px]" style={{ color: 'rgba(99,102,241,0.78)' }}>
                                            <ResponsiveAmount amount={animatedCreditCardExpense.usd} currency="USD" hidden={hidden} color="rgba(99,102,241,0.78)" compactMaximumFractionDigits={1} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </SummaryMetricCard>
                    <SummaryMetricCard
                        title="Resultado"
                        totals={animatedPeriodResult}
                        hidden={hidden}
                        accent="rgba(74,158,204,0.30)"
                        primaryColor={periodResult.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        secondaryColor={periodResult.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        align="center"
                    />
                    <SummaryMetricCard
                        title="Saldo disponible"
                        totals={animatedAvailableBalance}
                        hidden={hidden}
                        accent="rgba(16,185,129,0.24)"
                        primaryColor={availableBalance.ars >= 0 ? 'var(--foreground)' : 'var(--destructive)'}
                        secondaryColor={availableBalance.usd >= 0 ? 'var(--foreground)' : 'var(--destructive)'}
                        align="center"
                    />
                </div>
            </motion.div>

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
                        <PeriodSelector
                            value={month}
                            options={monthOptions}
                            onValueChange={setMonth}
                            className="h-8 w-full text-sm md:w-48"
                        />
                    </div>

                    <div className="hidden md:flex items-center gap-2.5 flex-wrap">
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
                            label="Moneda"
                            active={Boolean(appliedFilters.currency)}
                            options={[
                                { value: 'ARS', label: 'ARS' },
                                { value: 'USD', label: 'USD' },
                            ]}
                            value={appliedFilters.currency ?? ''}
                            onChange={(value) => setAppliedFilter('currency', value)}
                            showCurrencyFlags
                        />

                        <BasicFilterChip
                            label="Ordenar"
                            active={sort !== DEFAULT_SORT}
                            options={SORT_OPTIONS.map((option) => ({
                                value: option.value,
                                label: option.label,
                            }))}
                            value={sort}
                            onChange={(value) => setSort((value || DEFAULT_SORT) as typeof SORT_OPTIONS[number]['value'])}
                        />

                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={clearAppliedFilters}
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

                        <Button variant="outline" size="sm" className="h-8 rounded-xl bg-background/60" asChild>
                            <Link href="/transactions/import">
                                <Upload className="mr-1.5 h-3.5 w-3.5" />
                                Importar
                            </Link>
                        </Button>
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
                            onClick={clearAppliedFilters}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                            style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}
                        >
                            <X size={12} /> Limpiar
                        </button>
                    )}
                </div>

                <Link
                    href="/transactions/import"
                    className="flex md:hidden items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium"
                    style={{
                        background: 'var(--secondary)',
                        color: 'var(--muted-foreground)',
                        border: '0.5px solid var(--border)',
                    }}
                >
                    <Upload size={13} />
                    Importar
                </Link>

                <p className="text-xs text-muted-foreground">
                    {total > 0 ? `${transactions.length} de ${total} transacciones` : 'Sin movimientos'}
                </p>
            </section>

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
                                className="space-y-3"
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

                                    const isHighlighted = transaction._id.toString() === highlightedId
                                    const needsReview = transactionReviewIds.includes(transaction._id.toString())
                                    const isAmbered = isHighlighted || needsReview
                                    return (
                                        <motion.div
                                            key={transaction._id.toString()}
                                            variants={staggerItem}
                                            className="group relative overflow-hidden rounded-2xl"
                                            data-testid="transaction-item"
                                            data-transaction-id={transaction._id.toString()}
                                            style={{
                                                background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                                                border: isAmbered
                                                    ? '1.5px solid color-mix(in srgb, var(--amber-base, #f59e0b) 60%, transparent)'
                                                    : '0.5px solid var(--border)',
                                                boxShadow: isAmbered
                                                    ? '0 0 0 3px color-mix(in srgb, var(--amber-base, #f59e0b) 20%, transparent)'
                                                    : 'var(--card-shadow)',
                                            }}
                                        >
                                            <div
                                                className="absolute inset-y-0 left-0 w-px opacity-85"
                                                style={{ background: getTransactionAccentColor(transaction) }}
                                            />
                                            <div className="px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                                                <div className="flex items-center justify-between sm:hidden">
                                                    <div className="flex items-center gap-1.5">
                                                        <Badge variant={getTransactionTypeBadgeVariant(transaction)} className="shrink-0 rounded-full px-2.5">
                                                            {getTransactionTypeLabel(transaction)}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p
                                                            className="font-semibold tabular-nums text-sm"
                                                            style={{ color: getTransactionAmountColor(transaction) }}
                                                        >
                                                            {getTransactionDisplayPrefix(transaction)}
                                                            <ResponsiveAmount
                                                                amount={getTransactionDisplayAmount(transaction)}
                                                                currency={transaction.currency}
                                                                hidden={hidden}
                                                                color={getTransactionAmountColor(transaction)}
                                                            />
                                                        </p>
                                                        {(isHighlighted || needsReview) && transaction.spaceEntryId && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                                                onClick={() => void handleSyncImpact(transaction)}
                                                                aria-label="Resolver"
                                                            >
                                                                <RefreshCw />
                                                            </Button>
                                                        )}
                                                        {!NON_EDITABLE_TYPES.has(transaction.type) && (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="rounded-xl"
                                                                    onClick={() => handleEdit(transaction)}
                                                                    aria-label="Editar"
                                                                    data-testid="btn-editar-transaccion"
                                                                >
                                                                    <Pencil />
                                                                </Button>
                                                                {!transaction.spaceId && (
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="icon-sm"
                                                                        className="rounded-xl"
                                                                        onClick={() => handleDelete(transaction._id.toString())}
                                                                        aria-label="Eliminar"
                                                                        data-testid="btn-eliminar-transaccion"
                                                                    >
                                                                        <Trash2 />
                                                                    </Button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <div className="hidden sm:flex flex-col items-start gap-1 mt-0.5 shrink-0">
                                                        <Badge
                                                            variant={getTransactionTypeBadgeVariant(transaction)}
                                                            className="rounded-full px-2.5"
                                                        >
                                                            {getTransactionTypeLabel(transaction)}
                                                        </Badge>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[15px] font-semibold tracking-tight leading-tight">
                                                            {transaction.description}
                                                        </p>
                                                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                            <p className="text-xs text-muted-foreground/90">
                                                                {new Date(transaction.date).toLocaleDateString('es-AR')}
                                                                {transaction.merchant && ` · ${transaction.merchant}`}
                                                            </p>

                                                            {category?.name && (
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground/90">
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

                                                            {transaction.appliedRuleNameSnapshot && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/8 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300"
                                                                    title={`Finp completó este movimiento con la regla “${transaction.appliedRuleNameSnapshot}”`}
                                                                >
                                                                    <Sparkles className="size-2.5" />
                                                                    {transaction.appliedRuleNameSnapshot}
                                                                </span>
                                                            )}

                                                            {transaction.spaceId && (
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground/90">
                                                                    ·
                                                                    <Link
                                                                        href={`/spaces/${transaction.spaceId.toString()}${transaction.spaceEntryId ? `?entryId=${transaction.spaceEntryId.toString()}` : ''}`}
                                                                        aria-label={`Ver espacio${transaction.spaceNameSnapshot ? ` ${transaction.spaceNameSnapshot}` : ''}`}
                                                                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/15 transition-colors"
                                                                    >
                                                                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                                                                        {transaction.spaceNameSnapshot ?? 'Espacio'}
                                                                    </Link>
                                                                </span>
                                                            )}

                                                            {transaction.spaceId && !NON_EDITABLE_TYPES.has(transaction.type) && (
                                                                <span className="flex items-center sm:hidden">
                                                                    ·
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setRemoveFromFinpTarget({
                                                                            transactionId: transaction._id.toString(),
                                                                            spaceId: transaction.spaceId!.toString(),
                                                                            spaceEntryId: transaction.spaceEntryId?.toString(),
                                                                        })}
                                                                        className="ml-1 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                                                                    >
                                                                        Quitar de mi Finp
                                                                    </button>
                                                                </span>
                                                            )}

                                                            {sourceAccount?.name && (
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground/90">
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
                                                                <span className="flex items-center gap-1 text-xs text-muted-foreground/90">
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

                                                            {transaction.type === 'credit_card_expense' && transaction.installmentPlanId && (
                                                                <span className="text-xs font-medium" style={{ color: '#6366F1' }}>
                                                                    · {((transaction.installmentPlanId as { installmentCount?: number } | null)?.installmentCount ?? 'N')} cuotas
                                                                </span>
                                                            )}

                                                            {transaction.type === 'adjustment' && (
                                                                <span
                                                                    className="text-xs font-medium"
                                                                    style={{ color: getTransactionAmountColor(transaction) }}
                                                                >
                                                                    · {isPositiveAdjustment(transaction) ? 'suma saldo' : 'descuenta saldo'}
                                                                </span>
                                                            )}

                                                            {transaction.type === 'exchange' && transaction.destinationAmount && transaction.destinationCurrency && (
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    · recibís {new Intl.NumberFormat('es-AR', {
                                                                        style: 'currency',
                                                                        currency: transaction.destinationCurrency,
                                                                        maximumFractionDigits: 2,
                                                                    }).format(transaction.destinationAmount)}
                                                                </span>
                                                            )}

                                                            {transaction.type === 'exchange' && transaction.exchangeRate && (
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    · TC {new Intl.NumberFormat('es-AR', {
                                                                        minimumFractionDigits: 2,
                                                                        maximumFractionDigits: 4,
                                                                    }).format(transaction.exchangeRate)}
                                                                </span>
                                                            )}

                                                            {transaction.type === 'credit_card_payment' && transaction.paymentGroupId && (
                                                                <span className="text-xs font-medium text-muted-foreground">
                                                                    · pago dual
                                                                </span>
                                                            )}

                                                            {isSplitTransaction(transaction) && (
                                                                <span className="text-xs text-muted-foreground/80">
                                                                    · Total pagado: {hidden ? '•••' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: transaction.currency, maximumFractionDigits: 2 }).format(transaction.amount)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    className="hidden sm:flex items-center gap-3 shrink-0 pl-4"
                                                    style={{ borderLeft: '0.5px solid var(--border)' }}
                                                >
                                                    <div className="min-w-[136px] text-right">
                                                        <p
                                                            className="font-semibold tabular-nums text-sm md:text-base"
                                                            style={{ color: getTransactionAmountColor(transaction) }}
                                                        >
                                                            {getTransactionDisplayPrefix(transaction)}
                                                            <ResponsiveAmount
                                                                amount={getTransactionDisplayAmount(transaction)}
                                                                currency={transaction.currency}
                                                                hidden={hidden}
                                                                color={getTransactionAmountColor(transaction)}
                                                            />
                                                        </p>
                                                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                                            {transaction.currency}
                                                        </p>
                                                        {isSplitTransaction(transaction) && (
                                                            <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                                                Total pagado: {hidden ? '•••' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: transaction.currency, maximumFractionDigits: 2 }).format(transaction.amount)}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {!NON_EDITABLE_TYPES.has(transaction.type) && !transaction.spaceId && (
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                aria-label="Editar transacción"
                                                                title="Editar"
                                                                onClick={() => handleEdit(transaction)}
                                                                data-testid="btn-editar-transaccion"
                                                            >
                                                                <Pencil size={15} />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                aria-label="Eliminar transacción"
                                                                title="Eliminar"
                                                                onClick={() => handleDelete(transaction._id.toString())}
                                                                data-testid="btn-eliminar-transaccion"
                                                            >
                                                                <Trash2 size={15} />
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {transaction.spaceId && !NON_EDITABLE_TYPES.has(transaction.type) && (
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                aria-label="Editar transacción"
                                                                title="Editar"
                                                                onClick={() => handleEdit(transaction)}
                                                            >
                                                                <Pencil size={15} />
                                                            </Button>
                                                            {(isHighlighted || needsReview) && transaction.spaceEntryId && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                                                                    aria-label="Resolver"
                                                                    title="Resolver"
                                                                    onClick={() => void handleSyncImpact(transaction)}
                                                                >
                                                                    <RefreshCw size={15} />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                aria-label="Quitar de mi Finp"
                                                                title="Quitar de mi Finp"
                                                                onClick={() => setRemoveFromFinpTarget({
                                                                    transactionId: transaction._id.toString(),
                                                                    spaceId: transaction.spaceId!.toString(),
                                                                    spaceEntryId: transaction.spaceEntryId?.toString(),
                                                                })}
                                                            >
                                                                <Unlink size={15} />
                                                            </Button>
                                                        </div>
                                                    )}
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
                sort={draftSort}
                onChange={setDraftFilter}
                onSortChange={(value) => setDraftSort((value || DEFAULT_SORT) as typeof SORT_OPTIONS[number]['value'])}
                onApply={applyDraftFilters}
                onClear={clearDraftFilters}
                typeOptions={typeOptions}
                categoryOptions={categoryOptions}
                accountOptions={accountOptions}
                currencyOptions={[
                    { value: 'ARS', label: 'ARS' },
                    { value: 'USD', label: 'USD' },
                ]}
                activeCount={activeFilterCount}
            />

            <TransactionDialog
                open={transactionDialogOpen}
                onOpenChange={setTransactionDialogOpen}
                transaction={selectedTransaction}
                accounts={accounts}
                categories={categories}
                onSubmit={handleTransactionSubmit}
                onBatchSubmit={handleTransactionBatchSubmit}
                onInstallmentSubmit={handleInstallmentSubmit}
                onCreateRule={createRule}
                rules={rules}
                defaultAccountId={preferences.defaultAccountId}
                monthStartDay={preferences.monthStartDay}
            />

            <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent
                    className="border-foreground/[0.08] bg-background/95 backdrop-blur-sm shadow-2xl"
                >
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

            <AlertDialog open={Boolean(removeFromFinpTarget)} onOpenChange={(open) => !open && setRemoveFromFinpTarget(null)}>
                <AlertDialogContent
                    className="border-foreground/[0.08] bg-background/95 backdrop-blur-sm shadow-2xl"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar de tu Finp?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esto solo quitará el movimiento de tus finanzas personales. El movimiento seguirá vigente en el espacio y el balance del grupo no cambia.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removingFromFinp}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveFromFinpConfirm} disabled={removingFromFinp}>
                            {removingFromFinp ? 'Quitando…' : 'Quitar de mi Finp'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    )
}

export default function TransactionsPage() {
    return (
        <Suspense>
            <TransactionsPageInner />
        </Suspense>
    )
}

function isPositiveAdjustment(transaction: ITransaction) {
    return transaction.type === 'adjustment' && getTransactionAccountImpact(transaction)?.direction === 'increase'
}

function getTransactionAmountColor(transaction: ITransaction) {
    if (transaction.type === 'credit_card_expense') return '#6366F1'
    const impact = getTransactionAccountImpact(transaction)
    if (impact?.direction === 'increase') return '#10B981'
    if (impact?.direction === 'decrease') return 'var(--destructive)'
    if (transaction.type === 'exchange') return 'var(--sky-dark)'
    return 'var(--foreground)'
}

function getTransactionAccentColor(transaction: ITransaction) {
    if (transaction.type === 'credit_card_expense') return 'rgba(99,102,241,0.42)'
    const impact = getTransactionAccountImpact(transaction)
    if (impact?.direction === 'increase') return 'rgba(16,185,129,0.42)'
    if (impact?.direction === 'decrease') return 'rgba(239,68,68,0.42)'
    if (transaction.type === 'exchange') return 'rgba(74,158,204,0.42)'
    return 'rgba(148,163,184,0.28)'
}

function getTransactionDisplayAmount(transaction: ITransaction) {
    if (transaction.operationalAmount !== undefined) return transaction.operationalAmount
    const impact = getTransactionAccountImpact(transaction)
    return Math.abs(impact?.delta ?? transaction.amount)
}

function getTransactionTypeLabel(transaction: ITransaction): string {
    if (transaction.spaceId && transaction.type === 'expense') return 'Gasto de espacio'
    if (transaction.spaceId && transaction.type === 'income') return 'Ingreso de espacio'
    return TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type
}

function getTransactionTypeBadgeVariant(transaction: ITransaction): 'default' | 'destructive' | 'secondary' | 'outline' {
    if (transaction.spaceId && (transaction.type === 'expense' || transaction.type === 'income')) return 'secondary'
    return TRANSACTION_TYPE_COLORS[transaction.type] ?? 'secondary'
}

function getTransactionDisplayPrefix(transaction: ITransaction) {
    const impact = getTransactionAccountImpact(transaction)
    if (impact?.direction === 'increase') return '+'
    if (impact?.direction === 'decrease') return '-'
    return ''
}
