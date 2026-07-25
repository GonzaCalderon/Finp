'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { fadeIn } from '@/lib/utils/animations'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'
import { PeriodSelector } from '@/components/shared/PeriodSelector'
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

type AmountCertainty = 'confirmed' | 'calculated' | 'estimated' | 'pending_amount'

interface CommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
    recurrence?: string
    occurrences?: number
    certainty?: AmountCertainty
    isRegistered?: boolean
}

/**
 * Un monto proyectado no vale lo mismo si ya se registró que si es una
 * estimación de un compromiso variable. La UI tiene que poder distinguirlo.
 */
const CERTAINTY_LABELS: Record<AmountCertainty, string | null> = {
    confirmed: 'Registrado',
    calculated: null,
    estimated: 'Estimado',
    pending_amount: 'A confirmar',
}

/** Detalle del compromiso: día, repeticiones del período y certeza del monto. */
function CommitmentMeta({ commitment }: { commitment: CommitmentItem }) {
    const certaintyLabel = commitment.certainty ? CERTAINTY_LABELS[commitment.certainty] : null
    const showOccurrences = (commitment.occurrences ?? 1) > 1

    return (
        <>
            {commitment.dayOfMonth && (
                <span className="opacity-60 ml-1">· día {commitment.dayOfMonth}</span>
            )}
            {showOccurrences && (
                <span className="opacity-60 ml-1">· ×{commitment.occurrences}</span>
            )}
            {certaintyLabel && (
                <span
                    className={cn(
                        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        commitment.certainty === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    )}
                >
                    {certaintyLabel}
                </span>
            )}
        </>
    )
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
    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border bg-background/70 p-0.5">
                {([
                    ['annual', 'Anual'],
                    ['monthly', 'Mensual'],
                ] as const).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{
                            background: mode === value ? 'var(--sky)' : 'transparent',
                            color: mode === value ? '#FFFFFF' : 'var(--muted-foreground)',
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>
            {mode === 'annual' ? (
                <PeriodSelector
                    value={String(year)}
                    options={YEARS.map((value) => ({ value: String(value), label: String(value) }))}
                    onValueChange={(value) => setYear(Number(value))}
                    ariaLabel="Año de proyección"
                    className="w-28"
                />
            ) : (
                <PeriodSelector
                    value={String(months)}
                    options={MONTH_OPTIONS.map((value) => ({
                        value: String(value),
                        label: value === 1 ? '1 mes' : `${value} meses`,
                    }))}
                    onValueChange={(value) => setMonths(Number(value))}
                    ariaLabel="Horizonte de proyección"
                    className="w-36"
                />
            )}
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

    useAppStartupReady(!loading)

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
                            <CurrencyPillSelector
                                value={chartCurrency}
                                options={['ARS', 'USD']}
                                onValueChange={setChartCurrency}
                                compact
                                ariaLabel="Moneda del gráfico"
                            />
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
                                                            <CommitmentMeta commitment={commitment} />
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
                                                        <CommitmentMeta commitment={commitment} />
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
