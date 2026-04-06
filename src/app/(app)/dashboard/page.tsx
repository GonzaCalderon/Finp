'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApplyCommitmentDialog } from '@/components/shared/ApplyCommitmentDialog'
import { MobileCardCarousel } from '@/components/shared/MobileCardCarousel'
import { SankeyChart } from '@/components/shared/SankeyChart'
import { Spinner } from '@/components/shared/Spinner'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { useAccounts } from '@/hooks/useAccounts'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { usePreferences } from '@/hooks/usePreferences'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import { buildMonthOptions, getCurrentFinancialPeriod } from '@/lib/utils/period'
import { getOperationalStartFinancialPeriod } from '@/lib/utils/operational-start'
import { TrendingUp, TrendingDown, CheckCircle } from 'lucide-react'
import {
    getAccountBalancesByCurrency,
    getAccountCurrencyLabel,
    isDualCurrencyAccount,
} from '@/lib/utils/accounts'
import { apiJson } from '@/lib/client/auth-client'
import {
    COMMITMENT_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'

const getCurrentMonth = (monthStartDay = 1) => {
    const now = new Date()
    return getCurrentFinancialPeriod(now, monthStartDay)
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    bank: 'Banco',
    cash: 'Efectivo',
    wallet: 'Billetera',
    credit_card: 'Tarjeta',
    debt: 'Deuda',
    savings: 'Ahorro',
}

interface CommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
}

interface DashboardData {
    month: string
    summary: {
        totalIncome: { ars: number; usd: number }
        totalExpense: { ars: number; usd: number }
        balance: { ars: number; usd: number }
        totalDebt: { ars: number; usd: number }
        totalCreditCardExpense: { ars: number; usd: number }
        operationalStartDate?: string
    }
    trends: {
        income: number | null
        expense: number | null
        balance: number | null
        debt: number | null
    }
    expenseByCategory: { key: string; name: string; color?: string; ars: number; usd: number }[]
    accounts: {
        _id: string
        name: string
        type: string
        currency: string
        supportedCurrencies?: string[]
        includeInNetWorth: boolean
        balance: number
        balancesByCurrency: { ARS: number; USD: number }
        color?: string
    }[]
    netWorth: {
        assets: { ars: number; usd: number }
        liabilities: { ars: number; usd: number }
        total: { ars: number; usd: number }
    }
    pendingCommitments: CommitmentItem[]
    installmentsThisMonth: {
        _id: string
        description: string
        installmentAmount: number
        currency: string
        firstClosingMonth: string
        installmentCount: number
    }[]
}

function TrendBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
    if (value === null) return null

    const isNeutral = value === 0
    const isIncrease = value > 0
    const isGood = inverse ? value < 0 : value > 0
    const Icon = isIncrease ? TrendingUp : TrendingDown
    const formattedValue = `${value > 0 ? '+' : ''}${value}%`

    return (
        <span
            title="vs mes anterior"
            className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md font-medium"
            style={{
                background: isNeutral
                    ? 'var(--secondary)'
                    : isGood
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(239,68,68,0.1)',
                color: isNeutral
                    ? 'var(--muted-foreground)'
                    : isGood
                        ? '#10B981'
                        : '#EF4444',
            }}
        >
            {!isNeutral && <Icon size={10} />}
            {isNeutral ? '=' : formattedValue}
        </span>
    )
}

/** Anima suavemente entre valores numéricos cuando cambian (ej. al cambiar de mes) */
function useAnimatedTotals(totals: { ars: number; usd: number }) {
    const [current, setCurrent] = useState(totals)
    const prevRef = useRef(totals)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        const from = prevRef.current
        prevRef.current = totals
        if (from.ars === totals.ars && from.usd === totals.usd) return

        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        const start = performance.now()
        const duration = 550

        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1)
            const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
            setCurrent({
                ars: Math.round(from.ars + (totals.ars - from.ars) * ease),
                usd: from.usd + (totals.usd - from.usd) * ease,
            })
            if (t < 1) rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totals.ars, totals.usd])

    return current
}

const ZERO_TOTALS = { ars: 0, usd: 0 }

export default function DashboardPage() {
    const [month, setMonth] = useState(() => getCurrentMonth())
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [applyDialogOpen, setApplyDialogOpen] = useState(false)
    const [selectedCommitment, setSelectedCommitment] = useState<CommitmentItem | null>(null)
    const [appliedId, setAppliedId] = useState<string | null>(null)
    const hasLoadedOnce = useRef(false)

    const { accounts } = useAccounts()
    const { success, error: toastError } = useToast()
    const { hidden } = useHideAmounts()
    const { preferences } = usePreferences()

    usePageTitle('Dashboard')

    // Count-up hooks — se llaman antes de los early returns (regla de hooks)
    const animatedIncome = useAnimatedTotals(data?.summary.totalIncome ?? ZERO_TOTALS)
    const animatedExpense = useAnimatedTotals(data?.summary.totalExpense ?? ZERO_TOTALS)
    const animatedBalance = useAnimatedTotals(data?.summary.balance ?? ZERO_TOTALS)
    const animatedDebt = useAnimatedTotals(data?.summary.totalCreditCardExpense ?? ZERO_TOTALS)
    const animatedAssets = useAnimatedTotals(data?.netWorth.assets ?? ZERO_TOTALS)
    const animatedLiabilities = useAnimatedTotals(data?.netWorth.liabilities ?? ZERO_TOTALS)
    const animatedNetWorth = useAnimatedTotals(data?.netWorth.total ?? ZERO_TOTALS)

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

    const fetchDashboard = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true)
            else setLoading(true)
            const json = await apiJson<DashboardData>(`/api/dashboard?month=${month}`)
            setData(json)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar dashboard')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [month])

    useEffect(() => {
        fetchDashboard(hasLoadedOnce.current)
        hasLoadedOnce.current = true
    }, [fetchDashboard])

    useDataInvalidation(['dashboard'], () => {
        void fetchDashboard(true)
    })

    const handleApplyCommitment = (commitment: CommitmentItem) => {
        setSelectedCommitment(commitment)
        setApplyDialogOpen(true)
    }

    const handleApplySubmit = async (commitmentId: string, applyData: Record<string, unknown>) => {
        try {
            await apiJson(`/api/commitments/${commitmentId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(applyData),
            })
            success('Compromiso aplicado correctamente')
            setApplyDialogOpen(false)
            setAppliedId(commitmentId)
            invalidateData(COMMITMENT_INVALIDATION_TAGS)
            window.setTimeout(() => {
                setAppliedId(null)
            }, 1400)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al aplicar compromiso')
        }
    }

    const fmt = (amount: number, currency = 'ARS') =>
        hidden
            ? '••••'
            : new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(amount)

    if (loading)
        return (
            <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-9 w-48" />
                </div>
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-80 w-full rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-48 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-24 w-full rounded-xl" />
            </div>
        )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>
    if (!data) return null

    const totalCategoryExpenseArs = data.expenseByCategory.reduce((sum, category) => sum + category.ars, 0)
    const totalCategoryExpenseUsd = data.expenseByCategory.reduce((sum, category) => sum + category.usd, 0)

    // Ratio deuda mensual / ingreso para la barra de progreso
    const debtToIncomeRatio = data.summary.totalIncome.ars > 0
        ? Math.min((data.summary.totalCreditCardExpense.ars / data.summary.totalIncome.ars) * 100, 100)
        : 0

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                    {refreshing && <Spinner className="text-muted-foreground" />}
                </div>
                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-32 sm:w-40 h-8 text-xs sm:text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                        {monthOptions.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                                {m.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={month}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-4"
                >
                    {!preferences.operationalStartDate && (
                        <motion.div
                            className="rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                            style={{
                                background: 'var(--card)',
                                borderColor: 'rgba(56,189,248,0.18)',
                            }}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                        >
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Definí tu fecha de inicio en Finp</p>
                                <p className="text-xs text-muted-foreground">
                                    Mejora la precisión de balances, métricas y cálculos de tarjeta sin ocultar tu historial.
                                </p>
                            </div>
                            <Button asChild variant="outline" size="sm" className="shrink-0">
                                <Link href="/settings?tab=preferencias">Ir a configuración</Link>
                            </Button>
                        </motion.div>
                    )}

                    {/* Grupo 1 — Mensual */}
                    <MobileCardCarousel
                        hint="Deslizá para recorrer el resumen mensual"
                        ariaLabel="Resumen mensual del dashboard"
                    >
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(16,185,129,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Ingresos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedIncome}
                                    hidden={hidden}
                                    primaryColor="#10B981"
                                    secondaryColor="rgba(16,185,129,0.78)"
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-xl font-semibold tracking-tight text-green-500"
                                />
                                <div className="mt-2">
                                    <TrendBadge value={data.trends.income} />
                                </div>
                            </div>
                        </div>
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(239,68,68,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Gastos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedExpense}
                                    hidden={hidden}
                                    primaryColor="var(--destructive)"
                                    secondaryColor="rgba(239,68,68,0.78)"
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-xl font-semibold tracking-tight text-destructive"
                                />
                                <div className="mt-2">
                                    <TrendBadge value={data.trends.expense} inverse />
                                </div>
                            </div>
                        </div>
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(74,158,204,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Balance
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedBalance}
                                    hidden={hidden}
                                    primaryColor={data.summary.balance.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    secondaryColor={data.summary.balance.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-xl font-semibold tracking-tight"
                                />
                                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: 'rgba(148,163,184,0.14)' }}>
                                    <div className="text-[10px] text-muted-foreground">
                                        <span className="mr-1">General</span>
                                        <ResponsiveAmount
                                            amount={data.netWorth.total.ars}
                                            currency="ARS"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            className="font-medium"
                                        />
                                    </div>
                                    <div
                                        className="text-[10px] text-muted-foreground"
                                        style={{ visibility: data.netWorth.total.usd !== 0 ? 'visible' : 'hidden' }}
                                    >
                                        <ResponsiveAmount
                                            amount={data.netWorth.total.usd}
                                            currency="USD"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            compactMaximumFractionDigits={1}
                                        />
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <TrendBadge value={data.trends.balance} />
                                </div>
                            </div>
                        </div>
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(212,160,23,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Deuda mensual
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedDebt}
                                    hidden={hidden}
                                    primaryColor="var(--amber-dark)"
                                    secondaryColor="rgba(217,119,6,0.78)"
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-xl font-semibold tracking-tight"
                                />
                                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: 'rgba(148,163,184,0.14)' }}>
                                    <div className="text-[10px] text-muted-foreground">
                                        <span className="mr-1">Restante</span>
                                        <ResponsiveAmount
                                            amount={data.summary.totalDebt.ars}
                                            currency="ARS"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            className="font-medium"
                                        />
                                    </div>
                                    <div
                                        className="text-[10px] text-muted-foreground"
                                        style={{ visibility: data.summary.totalDebt.usd !== 0 ? 'visible' : 'hidden' }}
                                    >
                                        <ResponsiveAmount
                                            amount={data.summary.totalDebt.usd}
                                            currency="USD"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            compactMaximumFractionDigits={1}
                                        />
                                    </div>
                                </div>
                                {data.summary.totalIncome.ars > 0 && (
                                    <div className="mt-2.5 space-y-1">
                                        <div
                                            className="h-1 rounded-full overflow-hidden"
                                            style={{ background: 'var(--secondary)' }}
                                        >
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${debtToIncomeRatio}%`, backgroundColor: 'var(--amber)' }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {Math.round(debtToIncomeRatio)}% del ingreso
                                        </p>
                                    </div>
                                )}
                                <div className="mt-2">
                                    <TrendBadge value={data.trends.debt} inverse />
                                </div>
                            </div>
                        </div>
                    </MobileCardCarousel>
                    <motion.div
                        className="hidden md:block rounded-xl overflow-hidden"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        <div className="px-4 py-2.5 flex items-baseline gap-2" style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Mensual
                            </p>
                            <p className="text-[10px] text-muted-foreground">Comparativa vs mes anterior</p>
                        </div>
                        <div className="grid grid-cols-2" style={{ borderColor: 'var(--border)' }}>
                            {/* Ingresos */}
                            <motion.div
                                variants={staggerItem}
                                className="p-3 md:p-4"
                                style={{ borderTop: '1px solid rgba(16,185,129,0.25)', borderRight: '0.5px solid var(--border)', borderBottom: '0.5px solid var(--border)' }}
                            >
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Ingresos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedIncome}
                                    hidden={hidden}
                                    primaryColor="#10B981"
                                    secondaryColor="rgba(16,185,129,0.78)"
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-base md:text-2xl font-semibold tracking-tight text-green-500"
                                />
                                <div className="mt-1">
                                    <TrendBadge value={data.trends.income} />
                                </div>
                            </motion.div>

                            {/* Gastos */}
                            <motion.div
                                variants={staggerItem}
                                className="p-3 md:p-4"
                                style={{ borderTop: '1px solid rgba(239,68,68,0.25)', borderBottom: '0.5px solid var(--border)' }}
                            >
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Gastos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedExpense}
                                    hidden={hidden}
                                    primaryColor="var(--destructive)"
                                    secondaryColor="rgba(239,68,68,0.78)"
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-base md:text-2xl font-semibold tracking-tight text-destructive"
                                />
                                <div className="mt-1">
                                    <TrendBadge value={data.trends.expense} inverse />
                                </div>
                            </motion.div>

                            {/* Balance */}
                            <motion.div
                                variants={staggerItem}
                                className="p-3 md:p-4"
                                style={{ borderTop: '1px solid rgba(74,158,204,0.25)', borderRight: '0.5px solid var(--border)' }}
                            >
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Balance
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedBalance}
                                    hidden={hidden}
                                    primaryColor={data.summary.balance.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    secondaryColor={data.summary.balance.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-base md:text-2xl font-semibold tracking-tight"
                                />
                                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: 'rgba(148,163,184,0.14)' }}>
                                    <div className="text-[10px] md:text-xs text-muted-foreground">
                                        <span className="mr-1">General</span>
                                        <ResponsiveAmount
                                            amount={data.netWorth.total.ars}
                                            currency="ARS"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            className="font-medium"
                                        />
                                    </div>
                                    <div
                                        className="text-[10px] md:text-xs text-muted-foreground"
                                        style={{ visibility: data.netWorth.total.usd !== 0 ? 'visible' : 'hidden' }}
                                    >
                                        <ResponsiveAmount
                                            amount={data.netWorth.total.usd}
                                            currency="USD"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            compactMaximumFractionDigits={1}
                                        />
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <TrendBadge value={data.trends.balance} />
                                </div>
                            </motion.div>

                            {/* Deuda mensual */}
                            <motion.div
                                variants={staggerItem}
                                className="p-3 md:p-4"
                                style={{ borderTop: '1px solid rgba(212,160,23,0.25)' }}
                            >
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Deuda mensual
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedDebt}
                                    hidden={hidden}
                                    primaryColor="var(--amber-dark)"
                                    secondaryColor="rgba(217,119,6,0.78)"
                                    hideZeroSecondary
                                    preserveSecondarySpace
                                    className="text-base md:text-2xl font-semibold tracking-tight"
                                />
                                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: 'rgba(148,163,184,0.14)' }}>
                                    <div className="text-[10px] md:text-xs text-muted-foreground">
                                        <span className="mr-1">Restante</span>
                                        <ResponsiveAmount
                                            amount={data.summary.totalDebt.ars}
                                            currency="ARS"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            className="font-medium"
                                        />
                                    </div>
                                    <div
                                        className="text-[10px] md:text-xs text-muted-foreground"
                                        style={{ visibility: data.summary.totalDebt.usd !== 0 ? 'visible' : 'hidden' }}
                                    >
                                        <ResponsiveAmount
                                            amount={data.summary.totalDebt.usd}
                                            currency="USD"
                                            hidden={hidden}
                                            color="var(--muted-foreground)"
                                            compactMaximumFractionDigits={1}
                                        />
                                    </div>
                                </div>
                                {/* Barra de progreso: deuda mensual vs ingreso */}
                                {data.summary.totalIncome.ars > 0 && (
                                    <div className="mt-2.5 space-y-1">
                                        <div
                                            className="h-1 rounded-full overflow-hidden"
                                            style={{ background: 'var(--secondary)' }}
                                        >
                                            <motion.div
                                                className="h-full rounded-full"
                                                style={{ backgroundColor: 'var(--amber)' }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${debtToIncomeRatio}%` }}
                                                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {Math.round(debtToIncomeRatio)}% del ingreso
                                        </p>
                                    </div>
                                )}
                                <div className="mt-1">
                                    <TrendBadge value={data.trends.debt} inverse />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Sankey */}
                    <SankeyChart month={month} />

                    {/* Grid principal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Saldos por cuenta */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Saldos por cuenta
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 pt-0">
                                {data.accounts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin cuentas</p>
                                ) : (
                                    data.accounts.map((account) => (
                                        <div
                                            key={account._id}
                                            className="flex items-center justify-between py-2 border-b last:border-0"
                                            style={{ borderColor: 'var(--border)' }}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {account.color && (
                                                    <div
                                                        className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: account.color }}
                                                    />
                                                )}
                                                <span className="text-sm truncate">{account.name}</span>
                                                <span
                                                    className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                                    style={{
                                                        background: 'var(--secondary)',
                                                        color: 'var(--muted-foreground)',
                                                    }}
                                                >
                                                    {ACCOUNT_TYPE_LABELS[account.type]}
                                                </span>
                                                <span
                                                    className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                                    style={{
                                                        background: 'var(--secondary)',
                                                        color: 'var(--muted-foreground)',
                                                    }}
                                                >
                                                    {getAccountCurrencyLabel(account)}
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                {isDualCurrencyAccount(account) ? (
                                                    <>
                                                        <p className="text-sm font-medium tabular-nums">
                                                            {fmt(getAccountBalancesByCurrency(account).ARS, 'ARS')}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {fmt(getAccountBalancesByCurrency(account).USD, 'USD')}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <span
                                                        className="text-sm font-medium tabular-nums"
                                                        style={{
                                                            color:
                                                                account.balance < 0
                                                                    ? 'var(--destructive)'
                                                                    : 'var(--foreground)',
                                                        }}
                                                    >
                                                        {fmt(account.balance, account.currency)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Gastos por categoría */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Gastos por categoría
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 pt-0">
                                {data.expenseByCategory.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin gastos este mes</p>
                                ) : (
                                    data.expenseByCategory.map((cat) => {
                                        const pctOfTotal =
                                            totalCategoryExpenseArs > 0
                                                ? (cat.ars / totalCategoryExpenseArs) * 100
                                                : totalCategoryExpenseUsd > 0
                                                    ? (cat.usd / totalCategoryExpenseUsd) * 100
                                                    : 0
                                        const pctOfIncome =
                                            data.summary.totalIncome.ars > 0
                                                ? Math.round((cat.ars / data.summary.totalIncome.ars) * 100)
                                                : data.summary.totalIncome.usd > 0
                                                    ? Math.round((cat.usd / data.summary.totalIncome.usd) * 100)
                                                    : null

                                        return (
                                            <div
                                                key={cat.key}
                                                className="py-2 border-b last:border-0"
                                                style={{ borderColor: 'var(--border)' }}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div
                                                            className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ backgroundColor: cat.color ?? '#9CA3AF' }}
                                                        />
                                                        <span className="text-sm truncate">{cat.name}</span>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-2">
                                                        <span className="text-sm font-medium tabular-nums text-destructive">
                                                            {fmt(cat.ars)}
                                                        </span>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {fmt(cat.usd, 'USD')}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="flex-1 h-1 rounded-full overflow-hidden"
                                                        style={{ background: 'var(--secondary)' }}
                                                    >
                                                        <div
                                                            className="h-full rounded-full transition-all"
                                                            style={{
                                                                width: `${pctOfTotal}%`,
                                                                backgroundColor: cat.color ?? '#EF4444',
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span
                                                            className="text-xs tabular-nums"
                                                            style={{ color: 'var(--muted-foreground)' }}
                                                        >
                                                            {Math.round(pctOfTotal)}% gasto
                                                        </span>
                                                        {pctOfIncome !== null && (
                                                            <>
                                                                <span
                                                                    className="text-xs"
                                                                    style={{ color: 'var(--border)' }}
                                                                >
                                                                    ·
                                                                </span>
                                                                <span
                                                                    className="text-xs tabular-nums"
                                                                    style={{ color: 'var(--muted-foreground)' }}
                                                                >
                                                                    {pctOfIncome}% ing
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </CardContent>
                        </Card>

                        {/* Compromisos pendientes */}
                        <Card className="flex min-h-[420px] flex-col">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Compromisos pendientes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-1 overflow-y-auto pt-0">
                                {data.pendingCommitments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin compromisos pendientes</p>
                                ) : (
                                    data.pendingCommitments.map((c) => (
                                        <div
                                            key={c._id}
                                            className="flex items-center justify-between py-2 border-b last:border-0"
                                            style={{ borderColor: 'var(--border)' }}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-sm truncate">{c.description}</span>
                                                {c.dayOfMonth && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                                        style={{
                                                            background: 'var(--sky-light)',
                                                            color: 'var(--sky-dark)',
                                                        }}
                                                    >
                                                        día {c.dayOfMonth}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                <span className="text-sm font-medium tabular-nums">
                                                    {fmt(c.amount, c.currency)}
                                                </span>
                                                <motion.div
                                                    key={c._id}
                                                    animate={appliedId === c._id ? { scale: [1, 1.1, 1] } : {}}
                                                    transition={{ duration: 0.3 }}
                                                >
                                                    {appliedId === c._id ? (
                                                        <span
                                                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium"
                                                            style={{
                                                                background: 'rgba(16,185,129,0.1)',
                                                                color: '#10B981',
                                                            }}
                                                        >
                                                            <CheckCircle size={12} /> Aplicado
                                                        </span>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-xs px-2"
                                                            style={{
                                                                borderColor: 'var(--sky)',
                                                                color: 'var(--sky)',
                                                            }}
                                                            onClick={() => handleApplyCommitment(c)}
                                                        >
                                                            Aplicar
                                                        </Button>
                                                    )}
                                                </motion.div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Cuotas del mes */}
                        <Card className="flex min-h-[420px] flex-col">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Cuotas del mes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 space-y-1 overflow-y-auto pt-0">
                                {data.installmentsThisMonth.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin cuotas este mes</p>
                                ) : (
                                    data.installmentsThisMonth.map((plan) => {
                                        const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                                        const [my, mm] = data.month.split('-').map(Number)
                                        const currentInstallment = (my - fy) * 12 + (mm - fm) + 1

                                        return (
                                            <div
                                                key={plan._id}
                                                className="flex items-center justify-between py-2 border-b last:border-0"
                                                style={{ borderColor: 'var(--border)' }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-sm truncate">{plan.description}</span>
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded shrink-0 tabular-nums"
                                                        style={{
                                                            background: 'var(--amber-light)',
                                                            color: 'var(--amber-dark)',
                                                        }}
                                                    >
                                                        {currentInstallment}/{plan.installmentCount}
                                                    </span>
                                                </div>
                                                <span className="text-sm font-medium tabular-nums shrink-0 ml-2">
                                                    {fmt(plan.installmentAmount, plan.currency)}
                                                </span>
                                            </div>
                                        )
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Grupo 3 — Activos / Pasivos / Neto */}
                    <MobileCardCarousel
                        hint="Deslizá para ver el patrimonio"
                        ariaLabel="Patrimonio"
                    >
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(16,185,129,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Activos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedAssets}
                                    hidden={hidden}
                                    primaryColor="#10B981"
                                    secondaryColor="rgba(16,185,129,0.78)"
                                    className="text-xl font-semibold tracking-tight text-green-500"
                                />
                            </div>
                        </div>
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(239,68,68,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Pasivos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedLiabilities}
                                    hidden={hidden}
                                    primaryColor="var(--destructive)"
                                    secondaryColor="rgba(239,68,68,0.78)"
                                    className="text-xl font-semibold tracking-tight text-destructive"
                                />
                            </div>
                        </div>
                        <div
                            className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                        >
                            <div className="p-4" style={{ borderTop: '1px solid rgba(74,158,204,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                                    Neto
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedNetWorth}
                                    hidden={hidden}
                                    primaryColor={data.netWorth.total.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    secondaryColor={data.netWorth.total.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    className="text-xl font-semibold tracking-tight"
                                />
                            </div>
                        </div>
                    </MobileCardCarousel>
                    <div
                        className="hidden md:block rounded-xl overflow-hidden"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                    >
                        <div className="px-4 py-2.5" style={{ borderBottom: '0.5px solid var(--border)' }}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Patrimonio
                            </p>
                        </div>
                        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
                            <div className="p-3 md:p-4" style={{ borderTop: '1px solid rgba(16,185,129,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Activos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedAssets}
                                    hidden={hidden}
                                    primaryColor="#10B981"
                                    secondaryColor="rgba(16,185,129,0.78)"
                                    className="text-base md:text-xl font-semibold tracking-tight text-green-500"
                                />
                            </div>
                            <div className="p-3 md:p-4" style={{ borderTop: '1px solid rgba(239,68,68,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Pasivos
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedLiabilities}
                                    hidden={hidden}
                                    primaryColor="var(--destructive)"
                                    secondaryColor="rgba(239,68,68,0.78)"
                                    className="text-base md:text-xl font-semibold tracking-tight text-destructive"
                                />
                            </div>
                            <div className="p-3 md:p-4" style={{ borderTop: '1px solid rgba(74,158,204,0.25)' }}>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 md:mb-2">
                                    Neto
                                </p>
                                <CurrencyBreakdownAmount
                                    totals={animatedNetWorth}
                                    hidden={hidden}
                                    primaryColor={data.netWorth.total.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    secondaryColor={data.netWorth.total.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                    className="text-base md:text-xl font-semibold tracking-tight"
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            <ApplyCommitmentDialog
                open={applyDialogOpen}
                onOpenChange={setApplyDialogOpen}
                commitment={selectedCommitment}
                accounts={accounts}
                period={month}
                onSubmit={handleApplySubmit}
            />
        </div>
    )
}
