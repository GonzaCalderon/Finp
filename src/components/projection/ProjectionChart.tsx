'use client'

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'
import type { ProjectionPeriod } from '@/types/projection'

function amountForCurrency(totals: { ars: number; usd: number }, currency: 'ARS' | 'USD') {
    return currency === 'ARS' ? totals.ars : totals.usd
}

function formatCompact(amount: number, currency: 'ARS' | 'USD') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
        notation: 'compact',
    }).format(amount)
}

function formatAmount(amount: number, currency: 'ARS' | 'USD') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount)
}

function monthLabel(period: string, includeYear: boolean) {
    const [year, month] = period.split('-').map(Number)
    const label = new Date(year, month - 1, 1)
        .toLocaleDateString('es-AR', { month: 'short' })
        .replace('.', '')
    return includeYear ? `${label} '${String(year).slice(2)}` : label
}

function ProjectionTooltip({
    active,
    payload,
    label,
    currency,
    hidden,
}: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string }>
    label?: string
    currency: 'ARS' | 'USD'
    hidden: boolean
}) {
    if (!active || !payload?.length) return null
    const total = payload.reduce((sum, entry) => sum + entry.value, 0)
    const labels: Record<string, string> = {
        commitments: 'Compromisos',
        cardSingle: 'TC · un pago',
        cardInstallments: 'TC · cuotas',
    }

    return (
        <div className="min-w-44 space-y-1.5 rounded-xl border border-border bg-card p-3 text-sm shadow-lg">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            {payload.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        {labels[entry.name]}
                    </span>
                    <span className="font-medium tabular-nums">
                        {hidden ? '•••' : formatAmount(entry.value, currency)}
                    </span>
                </div>
            ))}
            <div className="border-t border-border pt-1.5">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">
                        {hidden ? '•••' : formatAmount(total, currency)}
                    </span>
                </div>
            </div>
        </div>
    )
}

export function ProjectionChart({
    projection,
    currency,
    hidden,
    onCurrencyChange,
}: {
    projection: ProjectionPeriod[]
    currency: 'ARS' | 'USD'
    hidden: boolean
    onCurrencyChange: (currency: 'ARS' | 'USD') => void
}) {
    const includesMultipleYears = new Set(projection.map((period) => period.month.slice(0, 4))).size > 1
    const data = projection.map((period) => ({
        label: monthLabel(period.month, includesMultipleYears),
        commitments: amountForCurrency(period.totals.commitments, currency),
        cardSingle: amountForCurrency(period.totals.cardSingle, currency),
        cardInstallments: amountForCurrency(period.totals.cardInstallments, currency),
    }))

    return (
        <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="projection-chart-title">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 id="projection-chart-title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Gastos proyectados
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">Las monedas se leen por separado.</p>
                </div>
                <CurrencyPillSelector
                    value={currency}
                    options={['ARS', 'USD']}
                    onValueChange={onCurrencyChange}
                    compact
                    ariaLabel="Moneda del gráfico"
                />
            </div>

            <div className="[&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
                <ResponsiveContainer width="100%" height={190}>
                    <BarChart data={data} barCategoryGap="28%" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                        <YAxis
                            hide={hidden}
                            axisLine={false}
                            tickLine={false}
                            width={58}
                            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                            tickFormatter={(value) => formatCompact(value, currency)}
                        />
                        <Tooltip
                            content={<ProjectionTooltip currency={currency} hidden={hidden} />}
                            cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                        />
                        <Bar dataKey="commitments" stackId="projection" fill="var(--sky)" opacity={0.9} />
                        <Bar dataKey="cardSingle" stackId="projection" fill="#10B981" opacity={0.85} />
                        <Bar dataKey="cardInstallments" stackId="projection" fill="#F59E0B" radius={[3, 3, 0, 0]} opacity={0.85} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--sky)]" />Compromisos</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />TC · un pago</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />TC · cuotas</span>
            </div>
        </section>
    )
}
