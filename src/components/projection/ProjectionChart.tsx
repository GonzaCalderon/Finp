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

type ChartRow = {
    month: string
    label: string
    base?: number
    scenario: number
    commitments: number
    cardSingle: number
    cardInstallments: number
    hypothetical: number
}

function ProjectionTooltip({
    active,
    payload,
    currency,
    hidden,
    comparing,
}: {
    active?: boolean
    payload?: Array<{ payload: ChartRow }>
    currency: 'ARS' | 'USD'
    hidden: boolean
    comparing: boolean
}) {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const display = (amount: number) => hidden ? '••••' : formatAmount(amount, currency)

    return (
        <div className="min-w-52 space-y-1.5 rounded-xl border border-border bg-card p-3 text-sm shadow-lg">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{row.label}</p>
            {comparing && (
                <>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Base real</span><span className="font-medium tabular-nums">{display(row.base ?? 0)}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-muted-foreground">Con gastos</span><span className="font-semibold tabular-nums">{display(row.scenario)}</span></div>
                    <div className="flex justify-between gap-4 border-b border-border pb-1.5"><span className="text-muted-foreground">Diferencia</span><span className="font-medium tabular-nums">{display(row.scenario - (row.base ?? 0))}</span></div>
                </>
            )}
            {[
                ['Compromisos', row.commitments],
                ['TC · un pago', row.cardSingle],
                ['TC · cuotas', row.cardInstallments],
                ['Otros simulados', row.hypothetical],
            ].filter(([, amount]) => Number(amount) !== 0).map(([label, amount]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium tabular-nums">{display(Number(amount))}</span>
                </div>
            ))}
            {!comparing && (
                <div className="flex justify-between gap-4 border-t border-border pt-1.5">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold tabular-nums">{display(row.scenario)}</span>
                </div>
            )}
        </div>
    )
}

export function ProjectionChart({
    projection,
    baseProjection,
    currency,
    hidden,
    onCurrencyChange,
}: {
    projection: ProjectionPeriod[]
    baseProjection?: ProjectionPeriod[]
    currency: 'ARS' | 'USD'
    hidden: boolean
    onCurrencyChange: (currency: 'ARS' | 'USD') => void
}) {
    const comparing = Boolean(baseProjection)
    const includesMultipleYears = new Set(projection.map((period) => period.month.slice(0, 4))).size > 1
    const baseByMonth = new Map(baseProjection?.map((period) => [period.month, period]))
    const data: ChartRow[] = projection.map((period) => ({
        month: period.month,
        label: monthLabel(period.month, includesMultipleYears),
        base: baseByMonth.has(period.month)
            ? amountForCurrency(baseByMonth.get(period.month)!.totals.total, currency)
            : undefined,
        scenario: amountForCurrency(period.totals.total, currency),
        commitments: amountForCurrency(period.totals.commitments, currency),
        cardSingle: amountForCurrency(period.totals.cardSingle, currency),
        cardInstallments: amountForCurrency(period.totals.cardInstallments, currency),
        hypothetical: amountForCurrency(period.totals.hypothetical, currency),
    }))
    const hasOtherSimulated = data.some((row) => row.hypothetical !== 0)

    return (
        <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="projection-chart-title">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 id="projection-chart-title" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {comparing ? 'Base real y gastos simulados' : 'Gastos proyectados'}
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

            <div className="[&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none" aria-hidden="true">
                <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={data} barCategoryGap="24%" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
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
                            content={<ProjectionTooltip currency={currency} hidden={hidden} comparing={comparing} />}
                            cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                        />
                        {comparing && <Bar dataKey="base" fill="var(--muted-foreground)" opacity={0.35} radius={[3, 3, 0, 0]} />}
                        <Bar dataKey="commitments" stackId="scenario" fill="var(--sky)" opacity={0.9} />
                        <Bar dataKey="cardSingle" stackId="scenario" fill="#10B981" opacity={0.85} />
                        <Bar dataKey="cardInstallments" stackId="scenario" fill="#F59E0B" opacity={0.85} />
                        <Bar dataKey="hypothetical" stackId="scenario" fill="#8B5CF6" radius={[3, 3, 0, 0]} opacity={0.88} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {comparing && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground/40" />Base real</span>}
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--sky)]" />Compromisos</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" />TC · un pago</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />TC · cuotas</span>
                {hasOtherSimulated && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet-500" />Otros simulados</span>}
            </div>

            <table className="sr-only">
                <caption>Alternativa textual del gráfico de proyección en {currency}</caption>
                <thead><tr><th>Período</th>{comparing && <th>Base real</th>}<th>{comparing ? 'Con gastos' : 'Total'}</th>{comparing && <th>Diferencia</th>}</tr></thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.month}>
                            <th>{row.label}</th>
                            {comparing && <td>{hidden ? 'Monto oculto' : formatAmount(row.base ?? 0, currency)}</td>}
                            <td>{hidden ? 'Monto oculto' : formatAmount(row.scenario, currency)}</td>
                            {comparing && <td>{hidden ? 'Monto oculto' : formatAmount(row.scenario - (row.base ?? 0), currency)}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    )
}
