'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { fadeIn } from '@/lib/utils/animations'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { apiJson } from '@/lib/client/auth-client'

type CurrencyTotals = {
    ars: number
    usd: number
}

type Mode = 'annual' | 'monthly'

interface InstallmentItem {
    description: string
    installmentAmount: number
    currency: string
    currentInstallment: number
    installmentCount: number
}

interface InstallmentByAccount {
    accountId: string
    accountName: string
    items: InstallmentItem[]
    total: CurrencyTotals
}

interface CommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
}

interface MonthProjection {
    month: string
    isCurrentMonth: boolean
    isPast: boolean
    commitments: CommitmentItem[]
    installmentsByAccount: InstallmentByAccount[]
    totalCommitments: CurrencyTotals
    totalInstallments: CurrencyTotals
    total: CurrencyTotals
}

const MONTH_NAMES: Record<string, string> = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
const MONTH_OPTIONS = [1, 3, 6, 9, 12]

function emptyTotals(): CurrencyTotals {
    return { ars: 0, usd: 0 }
}

function addTotals(base: CurrencyTotals, extra: CurrencyTotals): CurrencyTotals {
    return {
        ars: base.ars + extra.ars,
        usd: base.usd + extra.usd,
    }
}

function formatMonth(month: string, showYear = false) {
    const [y, m] = month.split('-')
    const name = MONTH_NAMES[m]
    return showYear ? `${name} '${y.slice(2)}` : name
}

function formatMonthCompact(month: string, showYear = false) {
    const [y, m] = month.split('-')
    const name = MONTH_NAMES[m].slice(0, 3)
    return showYear ? `${name} '${y.slice(2)}` : name
}

function fmt(amount: number, currency: 'ARS' | 'USD') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount)
}

function fmtCompact(amount: number, currency: 'ARS' | 'USD') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
        notation: 'compact',
    }).format(amount)
}

function totalForCurrency(totals: CurrencyTotals, currency: 'ARS' | 'USD') {
    return currency === 'ARS' ? totals.ars : totals.usd
}

const ProjectionTooltip = ({
    active,
    payload,
    label,
    currency,
}: {
    active?: boolean
    payload?: { value: number; name: string; color: string }[]
    label?: string
    currency: 'ARS' | 'USD'
}) => {
    if (!active || !payload?.length) return null
    const total = payload.reduce((sum, entry) => sum + entry.value, 0)

    return (
        <div
            className="rounded-lg p-3 text-sm space-y-1.5"
            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', minWidth: 160 }}
        >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
            {payload.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground">
                            {entry.name === 'commitments' ? 'Compromisos' : 'Cuotas'}
                        </span>
                    </div>
                    <span className="font-medium tabular-nums">{fmt(entry.value, currency)}</span>
                </div>
            ))}
            <div className="my-1" style={{ borderTop: '0.5px solid var(--border)' }} />
            <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold tabular-nums">{fmt(total, currency)}</span>
            </div>
        </div>
    )
}

function InlineTotals({ totals, align = 'right' }: { totals: CurrencyTotals; align?: 'left' | 'right' }) {
    return (
        <CurrencyBreakdownAmount
            totals={totals}
            hidden={false}
            align={align}
            className="text-sm font-medium tabular-nums"
        />
    )
}

function ModeToggle({
    mode,
    setMode,
    year,
    setYear,
    months,
    setMonths,
}: {
    mode: Mode
    setMode: (m: Mode) => void
    year: number
    setYear: (y: number) => void
    months: number
    setMonths: (m: number) => void
}) {
    const [annualOpen, setAnnualOpen] = useState(false)
    const [monthlyOpen, setMonthlyOpen] = useState(false)
    const annualRef = useRef<HTMLDivElement>(null)
    const monthlyRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (annualRef.current && !annualRef.current.contains(event.target as Node)) setAnnualOpen(false)
            if (monthlyRef.current && !monthlyRef.current.contains(event.target as Node)) setMonthlyOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
        <div className="flex gap-2">
            <div className="relative" ref={annualRef}>
                <button
                    onClick={() => {
                        setMode('annual')
                        setAnnualOpen((prev) => !prev)
                        setMonthlyOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors"
                    style={{
                        background: mode === 'annual' ? 'var(--sky)' : 'transparent',
                        color: mode === 'annual' ? '#FFFFFF' : 'var(--muted-foreground)',
                        borderColor: mode === 'annual' ? 'var(--sky)' : 'var(--border)',
                    }}
                >
                    Vista anual
                    <ChevronDown size={14} className={annualOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {annualOpen && (
                    <div
                        className="absolute top-full mt-1 left-0 z-50 rounded-lg overflow-y-auto max-h-48 w-32 shadow-sm"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                    >
                        {YEARS.map((value) => (
                            <button
                                key={value}
                                onClick={() => {
                                    setYear(value)
                                    setAnnualOpen(false)
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                                style={{
                                    color: value === year ? 'var(--sky)' : 'var(--foreground)',
                                    fontWeight: value === year ? 500 : 400,
                                }}
                            >
                                {value}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="relative" ref={monthlyRef}>
                <button
                    onClick={() => {
                        setMode('monthly')
                        setMonthlyOpen((prev) => !prev)
                        setAnnualOpen(false)
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors"
                    style={{
                        background: mode === 'monthly' ? 'var(--sky)' : 'transparent',
                        color: mode === 'monthly' ? '#FFFFFF' : 'var(--muted-foreground)',
                        borderColor: mode === 'monthly' ? 'var(--sky)' : 'var(--border)',
                    }}
                >
                    Proyección mensual
                    <ChevronDown size={14} className={monthlyOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
                {monthlyOpen && (
                    <div
                        className="absolute top-full mt-1 left-0 z-50 rounded-lg w-40 shadow-sm"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                    >
                        {MONTH_OPTIONS.map((value) => (
                            <button
                                key={value}
                                onClick={() => {
                                    setMonths(value)
                                    setMonthlyOpen(false)
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                                style={{
                                    color: value === months ? 'var(--sky)' : 'var(--foreground)',
                                    fontWeight: value === months ? 500 : 400,
                                }}
                            >
                                {value === 1 ? '1 mes' : `${value} meses`}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function ExpandableRow({
    label,
    totals,
    children,
    level = 0,
}: {
    label: string
    totals: CurrencyTotals
    children?: React.ReactNode
    level?: number
}) {
    const [open, setOpen] = useState(false)
    const hasChildren = !!children

    return (
        <div>
            <button
                onClick={() => hasChildren && setOpen((prev) => !prev)}
                className="w-full flex items-center justify-between py-2 text-sm transition-colors rounded-md px-2"
                style={{
                    cursor: hasChildren ? 'pointer' : 'default',
                    paddingLeft: level === 1 ? 24 : level === 2 ? 40 : 8,
                }}
            >
                <span className="flex items-center gap-2">
                    <motion.span
                        animate={{ rotate: open && hasChildren ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: 'flex' }}
                    >
                        {hasChildren ? <ChevronRight size={12} /> : <span className="w-3" />}
                    </motion.span>
                    <span
                        style={{
                            color: level === 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                            fontWeight: level === 0 ? 500 : 400,
                            fontSize: 13,
                        }}
                    >
                        {label}
                    </span>
                </span>

                <div className="text-right">
                    <p className="text-sm tabular-nums">
                        {totals.ars > 0 ? fmt(totals.ars, 'ARS') : '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                        {totals.usd > 0 ? fmt(totals.usd, 'USD') : '—'}
                    </p>
                </div>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: [0.0, 0.0, 0.2, 1.0] }}
                        style={{ overflow: 'hidden' }}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default function ProjectionPage() {
    const [mode, setMode] = useState<Mode>('annual')
    const [year, setYear] = useState(currentYear)
    const [months, setMonths] = useState(3)
    const [chartCurrency, setChartCurrency] = useState<'ARS' | 'USD'>('ARS')
    const [projection, setProjection] = useState<MonthProjection[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    usePageTitle('Proyección')

    useEffect(() => {
        const fetchProjection = async () => {
            try {
                setLoading(true)
                const params = new URLSearchParams({ mode })
                if (mode === 'annual') params.set('year', year.toString())
                else params.set('months', months.toString())

                const data = await apiJson<{ projection: MonthProjection[] }>(`/api/projection?${params}`)
                setProjection(data.projection)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al cargar proyección')
            } finally {
                setLoading(false)
            }
        }

        void fetchProjection()
    }, [mode, months, year])

    useDataInvalidation(['projection'], () => {
        const params = new URLSearchParams({ mode })
        if (mode === 'annual') params.set('year', year.toString())
        else params.set('months', months.toString())

        void apiJson<{ projection: MonthProjection[] }>(`/api/projection?${params}`)
            .then((data) => {
                setProjection(data.projection)
                setError(null)
            })
            .catch((err) => {
                setError(err instanceof Error ? err.message : 'Error al cargar proyección')
            })
    })

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>

    const maxTotal = Math.max(...projection.map((item) => totalForCurrency(item.total, chartCurrency)), 1)
    const isMultiYear = new Set(projection.map((item) => item.month.split('-')[0])).size > 1
    const totals = projection.reduce(
        (acc, item) => ({
            commitments: addTotals(acc.commitments, item.totalCommitments),
            installments: addTotals(acc.installments, item.totalInstallments),
            total: addTotals(acc.total, item.total),
        }),
        { commitments: emptyTotals(), installments: emptyTotals(), total: emptyTotals() }
    )

    return (
        <motion.div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" {...fadeIn}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Proyección</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {mode === 'annual'
                            ? `Año ${year}`
                            : `Próximos ${months === 1 ? '1 mes' : `${months} meses`} desde hoy`}
                    </p>
                </div>
                <ModeToggle
                    mode={mode}
                    setMode={setMode}
                    year={year}
                    setYear={setYear}
                    months={months}
                    setMonths={setMonths}
                />
            </div>

            {loading ? (
                <div className="space-y-2">
                    <Skeleton className="h-44 rounded-xl" />
                    {[...Array(6)].map((_, index) => <Skeleton key={index} className="h-14 rounded-xl" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        <div
                            className="rounded-xl p-3 md:p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                        >
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Compromisos</p>
                            <InlineTotals totals={totals.commitments} align="left" />
                        </div>
                        <div
                            className="rounded-xl p-3 md:p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                        >
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Cuotas</p>
                            <InlineTotals totals={totals.installments} align="left" />
                        </div>
                        <div
                            className="col-span-2 rounded-xl p-3 md:col-span-1 md:p-4"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--amber)' }}
                        >
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
                            <InlineTotals totals={totals.total} align="left" />
                        </div>
                    </div>

                    <div
                        className="rounded-xl p-4"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                    >
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Gastos proyectados
                            </p>
                            <div
                                className="flex rounded-md overflow-hidden"
                                style={{ border: '0.5px solid var(--border)' }}
                            >
                                {(['ARS', 'USD'] as const).map((currency) => (
                                    <button
                                        key={currency}
                                        onClick={() => setChartCurrency(currency)}
                                        className="px-3 py-1 text-xs transition-colors"
                                        style={{
                                            background: chartCurrency === currency ? 'var(--sky)' : 'transparent',
                                            color: chartCurrency === currency ? '#FFFFFF' : 'var(--muted-foreground)',
                                            borderRight: currency === 'ARS' ? '0.5px solid var(--border)' : 'none',
                                        }}
                                    >
                                        {currency}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="[&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_*:focus]:outline-none">
                            <ResponsiveContainer width="100%" height={160}>
                                <BarChart
                                    data={projection.map((item) => ({
                                        label: formatMonthCompact(item.month, isMultiYear),
                                        commitments: totalForCurrency(item.totalCommitments, chartCurrency),
                                        installments: totalForCurrency(item.totalInstallments, chartCurrency),
                                    }))}
                                    barCategoryGap="30%"
                                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="label"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        width={56}
                                        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                        tickFormatter={(value) => fmtCompact(value, chartCurrency)}
                                    />
                                    <Tooltip
                                        content={<ProjectionTooltip currency={chartCurrency} />}
                                        cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                                    />
                                    <Bar dataKey="commitments" stackId="a" fill="var(--sky)" opacity={0.9} />
                                    <Bar dataKey="installments" stackId="a" fill="#F59E0B" radius={[3, 3, 0, 0]} opacity={0.85} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--sky)' }} />
                                <span className="text-xs text-muted-foreground">Compromisos</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-xs text-muted-foreground">Cuotas</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {projection.map((row) => (
                            <div
                                key={row.month}
                                className="rounded-xl overflow-hidden"
                                style={{ background: 'var(--card)', border: '0.5px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
                            >
                                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold">{formatMonth(row.month, isMultiYear)}</p>
                                                {row.isCurrentMonth && (
                                                    <span
                                                        className="text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: 'var(--sky-light)', color: 'var(--sky-dark)' }}
                                                    >
                                                        hoy
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] uppercase tracking-[0.12em]">Compromisos</span>
                                                    <InlineTotals totals={row.totalCommitments} align="left" />
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[10px] uppercase tracking-[0.12em]">Cuotas</span>
                                                    <InlineTotals totals={row.totalInstallments} align="left" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total</p>
                                            <InlineTotals totals={row.total} />
                                        </div>
                                    </div>
                                </div>

                                <div className="px-4 py-3">
                                    <div>
                                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--secondary)' }}>
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{
                                                    width: `${(totalForCurrency(row.total, chartCurrency) / maxTotal) * 100}%`,
                                                    background: 'var(--sky)',
                                                    opacity: row.isPast ? 0.4 : 1,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 space-y-0.5">
                                        {row.commitments.length > 0 && (
                                            <ExpandableRow label="Compromisos" totals={row.totalCommitments} level={0}>
                                                {row.commitments.map((commitment) => (
                                                    <div
                                                        key={commitment._id}
                                                        className="flex items-center justify-between py-1.5 text-xs"
                                                        style={{ paddingLeft: 32, paddingRight: 8, color: 'var(--muted-foreground)' }}
                                                    >
                                                        <span>
                                                            {commitment.description}
                                                            {commitment.dayOfMonth && (
                                                                <span className="opacity-60 ml-1">· día {commitment.dayOfMonth}</span>
                                                            )}
                                                        </span>
                                                        <span className="tabular-nums">
                                                            {fmt(commitment.amount, commitment.currency as 'ARS' | 'USD')}
                                                        </span>
                                                    </div>
                                                ))}
                                            </ExpandableRow>
                                        )}

                                        {row.installmentsByAccount.length > 0 && (
                                            <ExpandableRow label="Cuotas" totals={row.totalInstallments} level={0}>
                                                {row.installmentsByAccount.map((account) => (
                                                    <ExpandableRow
                                                        key={account.accountId}
                                                        label={account.accountName}
                                                        totals={account.total}
                                                        level={1}
                                                    >
                                                        {account.items.map((item, index) => (
                                                            <div
                                                                key={`${account.accountId}-${index}`}
                                                                className="flex items-center justify-between py-1.5 text-xs"
                                                                style={{ paddingLeft: 48, paddingRight: 8, color: 'var(--muted-foreground)' }}
                                                            >
                                                                <span>
                                                                    {item.description}
                                                                    <span className="opacity-60 ml-1">
                                                                        {item.currentInstallment}/{item.installmentCount}
                                                                    </span>
                                                                </span>
                                                                <span className="tabular-nums">
                                                                    {fmt(item.installmentAmount, item.currency as 'ARS' | 'USD')}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </ExpandableRow>
                                                ))}
                                            </ExpandableRow>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div
                        className="hidden md:block rounded-xl overflow-hidden"
                        style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                    >
                        <div
                            className="grid grid-cols-4 gap-2 px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider"
                            style={{ borderBottom: '0.5px solid var(--border)' }}
                        >
                            <span>Mes</span>
                            <span className="text-right">Compromisos</span>
                            <span className="text-right">Cuotas</span>
                            <span className="text-right font-semibold">Total</span>
                        </div>

                        {projection.map((row) => (
                            <div
                                key={row.month}
                                style={{
                                    borderBottom: '0.5px solid var(--border)',
                                    background: row.isCurrentMonth ? 'rgba(74,158,204,0.05)' : 'transparent',
                                }}
                            >
                                <div className="grid grid-cols-4 gap-2 px-4 py-3 text-sm">
                                    <span
                                        className="font-medium flex items-center gap-2"
                                        style={{ color: row.isPast ? 'var(--muted-foreground)' : 'var(--foreground)' }}
                                    >
                                        {formatMonth(row.month, isMultiYear)}
                                        {row.isCurrentMonth && (
                                            <span
                                                className="text-xs px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--sky-light)', color: 'var(--sky-dark)' }}
                                            >
                                                hoy
                                            </span>
                                        )}
                                    </span>
                                    <InlineTotals totals={row.totalCommitments} />
                                    <InlineTotals totals={row.totalInstallments} />
                                    <InlineTotals totals={row.total} />
                                </div>

                                <div className="px-4 pb-2">
                                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--secondary)' }}>
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${(totalForCurrency(row.total, chartCurrency) / maxTotal) * 100}%`,
                                                background: 'var(--sky)',
                                                opacity: row.isPast ? 0.4 : 1,
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="px-4 pb-3 space-y-0.5">
                                    {row.commitments.length > 0 && (
                                        <ExpandableRow label="Compromisos" totals={row.totalCommitments} level={0}>
                                            {row.commitments.map((commitment) => (
                                                <div
                                                    key={commitment._id}
                                                    className="flex items-center justify-between py-1.5 text-xs"
                                                    style={{ paddingLeft: 32, paddingRight: 8, color: 'var(--muted-foreground)' }}
                                                >
                                                    <span>
                                                        {commitment.description}
                                                        {commitment.dayOfMonth && (
                                                            <span className="opacity-60 ml-1">· día {commitment.dayOfMonth}</span>
                                                        )}
                                                    </span>
                                                    <span className="tabular-nums">
                                                        {fmt(commitment.amount, commitment.currency as 'ARS' | 'USD')}
                                                    </span>
                                                </div>
                                            ))}
                                        </ExpandableRow>
                                    )}

                                    {row.installmentsByAccount.length > 0 && (
                                        <ExpandableRow label="Cuotas" totals={row.totalInstallments} level={0}>
                                            {row.installmentsByAccount.map((account) => (
                                                <ExpandableRow
                                                    key={account.accountId}
                                                    label={account.accountName}
                                                    totals={account.total}
                                                    level={1}
                                                >
                                                    {account.items.map((item, index) => (
                                                        <div
                                                            key={`${account.accountId}-${index}`}
                                                            className="flex items-center justify-between py-1.5 text-xs"
                                                            style={{ paddingLeft: 48, paddingRight: 8, color: 'var(--muted-foreground)' }}
                                                        >
                                                            <span>
                                                                {item.description}
                                                                <span className="opacity-60 ml-1">
                                                                    {item.currentInstallment}/{item.installmentCount}
                                                                </span>
                                                            </span>
                                                            <span className="tabular-nums">
                                                                {fmt(item.installmentAmount, item.currency as 'ARS' | 'USD')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </ExpandableRow>
                                            ))}
                                        </ExpandableRow>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </motion.div>
    )
}
