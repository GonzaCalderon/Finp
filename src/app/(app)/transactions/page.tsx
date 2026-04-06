'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ArrowLeftRight,
    ChevronDown,
    CreditCard,
    Pencil,
    SlidersHorizontal,
    Trash2,
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
import { EmptyState } from '@/components/shared/EmptyState'
import { MobileCardCarousel } from '@/components/shared/MobileCardCarousel'
import { Spinner } from '@/components/shared/Spinner'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'

import { DURATION, easeSmooth, fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { getCategoryTypeForTransactionType, isCategoryCompatible, normalizeFilters } from '@/lib/utils/transactions'
import { buildMonthOptions } from '@/lib/utils/period'
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
    debt_payment: 'Pago de tarjeta',      // backwards compat
    adjustment: 'Ajuste',
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

const MONTHS = buildMonthOptions({ pastMonths: 8, futureMonths: 1 })

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
    children,
}: {
    title: string
    totals: { ars: number; usd: number }
    hidden: boolean
    accent: string
    primaryColor: string
    secondaryColor: string
    children?: React.ReactNode
}) {
    return (
        <motion.div
            variants={staggerItem}
            className="relative p-3.5 md:p-4"
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
        { value: 'credit_card_expense', label: 'Gasto con TC' },
        { value: 'transfer', label: 'Transferencia' },
        { value: 'exchange', label: 'Cambio' },
        { value: 'credit_card_payment', label: 'Pago de tarjeta' },
        { value: 'adjustment', label: 'Ajuste' },
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
                                                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                                style={{
                                                    background:
                                                        filters.currency === option.value ? 'var(--sky)' : 'var(--secondary)',
                                                    color: filters.currency === option.value ? '#fff' : 'var(--foreground)',
                                                }}
                                            >
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

export default function TransactionsPage() {
    const [month, setMonth] = useState(getCurrentMonth())
    const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS)
    const [sort, setSort] = useState(DEFAULT_SORT)
    const [draftSort, setDraftSort] = useState(DEFAULT_SORT)
    const [filterSheetOpen, setFilterSheetOpen] = useState(false)
    const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
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
    const totalBalance = {
        ars: totalIncome.ars - totalExpense.ars,
        usd: totalIncome.usd - totalExpense.usd,
    }
    const animatedIncome = useAnimatedTotals(totalIncome)
    const animatedExpense = useAnimatedTotals(totalExpense)
    const animatedCreditCardExpense = useAnimatedTotals(totalCreditCardExpense)
    const animatedBalance = useAnimatedTotals(totalBalance)

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
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Transacciones</h1>
                        {refreshing && <Spinner className="text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground md:text-sm">
                        Movimientos del mes con filtros rápidos y edición directa.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-40 sm:w-44 h-9 text-sm rounded-xl bg-card/75 backdrop-blur-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                            {MONTHS.map((monthOption) => (
                                <SelectItem key={monthOption.value} value={monthOption.value}>
                                    {monthOption.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="hidden sm:flex h-9 rounded-xl bg-card/70 backdrop-blur-sm" asChild>
                        <Link href="/transactions/import">
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Importar
                        </Link>
                    </Button>
                </div>
            </div>

            <MobileCardCarousel
                hint="Deslizá para recorrer los KPIs"
                ariaLabel="Resumen de transacciones"
            >
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
                    title="Balance"
                    totals={animatedBalance}
                    hidden={hidden}
                    accent="rgba(74,158,204,0.30)"
                    primaryColor={totalBalance.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                    secondaryColor={totalBalance.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                />
            </MobileCardCarousel>

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
                    <div className="flex items-baseline gap-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mensual</p>
                        <p className="text-[10px] text-muted-foreground">Resumen operativo del período</p>
                    </div>
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
                            {activeFilterCount} filtros
                        </Badge>
                    )}
                </div>
                <div className="hidden md:grid md:grid-cols-3">
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
                        title="Balance"
                        totals={animatedBalance}
                        hidden={hidden}
                        accent="rgba(74,158,204,0.30)"
                        primaryColor={totalBalance.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        secondaryColor={totalBalance.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                    />
                </div>
            </motion.div>

            <div
                className="hidden md:flex items-center justify-between gap-3 rounded-2xl border px-3 py-3"
                style={{
                    background: 'color-mix(in srgb, var(--card) 88%, transparent)',
                    borderColor: 'var(--border)',
                    boxShadow: 'var(--card-shadow)',
                }}
            >
                <div className="flex items-center gap-2 flex-wrap">
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
                <p className="text-xs text-muted-foreground shrink-0">
                    {total > 0 ? `${transactions.length} de ${total} transacciones` : 'Sin movimientos'}
                </p>
            </div>

            <div
                className="flex md:hidden items-center gap-2 w-full rounded-2xl border px-3 py-3 overflow-x-auto"
                style={{
                    background: 'color-mix(in srgb, var(--card) 88%, transparent)',
                    borderColor: 'var(--border)',
                    boxShadow: 'var(--card-shadow)',
                }}
            >
                <button
                    type="button"
                    onClick={openFilterSheet}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shrink-0"
                    style={{
                        background: activeFilterCount > 0 ? 'rgba(96,184,224,0.16)' : 'var(--secondary)',
                        color: activeFilterCount > 0 ? 'var(--sky-dark)' : 'var(--muted-foreground)',
                        border: `0.5px solid ${activeFilterCount > 0 ? 'rgba(96,184,224,0.32)' : 'var(--border)'}`,
                    }}
                >
                    <SlidersHorizontal size={13} />
                    Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>

                {activeFilterCount > 0 && (
                    <button
                    type="button"
                    onClick={clearAppliedFilters}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs shrink-0"
                    style={{ color: 'var(--muted-foreground)', background: 'var(--secondary)' }}
                >
                    <X size={12} /> Limpiar
                </button>
                )}

                <Link
                    href="/transactions/import"
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
                    style={{
                        background: 'var(--secondary)',
                        color: 'var(--muted-foreground)',
                        border: '0.5px solid var(--border)',
                    }}
                >
                    <Upload size={13} />
                    Importar
                </Link>
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

                                    return (
                                        <motion.div
                                            key={transaction._id.toString()}
                                            variants={staggerItem}
                                            className="group relative overflow-hidden rounded-2xl"
                                            data-testid="transaction-item"
                                            style={{
                                                background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                                                border: '0.5px solid var(--border)',
                                                boxShadow: 'var(--card-shadow)',
                                            }}
                                        >
                                            <div
                                                className="absolute inset-y-0 left-0 w-px opacity-85"
                                                style={{ background: getTransactionAccentColor(transaction) }}
                                            />
                                            <div className="px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
                                                <div className="flex items-center justify-between sm:hidden">
                                                    <Badge variant={TRANSACTION_TYPE_COLORS[transaction.type]} className="shrink-0 rounded-full px-2.5">
                                                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                    </Badge>
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
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    <Badge
                                                        variant={TRANSACTION_TYPE_COLORS[transaction.type]}
                                                        className="shrink-0 hidden sm:flex rounded-full px-2.5 mt-0.5"
                                                    >
                                                        {TRANSACTION_TYPE_LABELS[transaction.type]}
                                                    </Badge>
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
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 rounded-xl text-xs bg-background/60"
                                                            onClick={() => handleEdit(transaction)}
                                                            data-testid="btn-editar-transaccion"
                                                        >
                                                            Editar
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 rounded-xl text-xs"
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
                sort={draftSort}
                onChange={setDraftFilter}
                onSortChange={(value) => setDraftSort(value || DEFAULT_SORT)}
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
        </motion.div>
    )
}

function isPositiveAdjustment(transaction: ITransaction) {
    return transaction.type === 'adjustment' && transaction.amount < 0
}

function getTransactionAmountColor(transaction: ITransaction) {
    if (transaction.type === 'income') return '#10B981'
    if (transaction.type === 'expense') return 'var(--destructive)'
    if (transaction.type === 'credit_card_expense') return '#6366F1'
    if (transaction.type === 'exchange') return 'var(--sky-dark)'
    if (transaction.type === 'adjustment') {
        return isPositiveAdjustment(transaction) ? '#10B981' : 'var(--destructive)'
    }
    return 'var(--foreground)'
}

function getTransactionAccentColor(transaction: ITransaction) {
    if (transaction.type === 'income') return 'rgba(16,185,129,0.42)'
    if (transaction.type === 'expense') return 'rgba(239,68,68,0.42)'
    if (transaction.type === 'credit_card_expense') return 'rgba(99,102,241,0.42)'
    if (transaction.type === 'exchange') return 'rgba(74,158,204,0.42)'
    if (transaction.type === 'transfer') return 'rgba(148,163,184,0.28)'
    if (transaction.type === 'credit_card_payment') return 'rgba(217,119,6,0.42)'
    if (transaction.type === 'adjustment') {
        return isPositiveAdjustment(transaction) ? 'rgba(16,185,129,0.42)' : 'rgba(239,68,68,0.42)'
    }
    return 'rgba(148,163,184,0.28)'
}

function getTransactionDisplayAmount(transaction: ITransaction) {
    return transaction.type === 'adjustment' ? Math.abs(transaction.amount) : transaction.amount
}

function getTransactionDisplayPrefix(transaction: ITransaction) {
    if (transaction.type === 'exchange') return '↔ '
    if (transaction.type !== 'adjustment') return ''
    return isPositiveAdjustment(transaction) ? '+' : '-'
}
