'use client'

import {
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { SpaceAmountInline, SpaceSectionHeading, SpaceSurface, getFallbackChartColor } from '@/components/spaces/SpaceUi'
import type { SpaceCategoryBreakdownItem, SpaceTrendPoint } from '@/types'

const compactCurrency = (amount: number, currency: string, hidden: boolean) => {
    if (hidden) return '••••'

    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 0,
    }).format(amount)
}

function EvolutionTooltip({
    active,
    payload,
    label,
    currency,
    hidden,
}: {
    active?: boolean
    payload?: Array<{ value: number }>
    label?: string
    currency: string
    hidden: boolean
}) {
    if (!active || !payload?.length) return null

    return (
        <div
            className="rounded-2xl border border-border bg-card/96 p-3 shadow-lg"
            style={{ boxShadow: 'var(--card-shadow)' }}
        >
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {label}
            </p>
            <SpaceAmountInline
                amount={payload[0]?.value ?? 0}
                currency={currency}
                hidden={hidden}
                className="mt-2 text-base font-semibold"
            />
        </div>
    )
}

function CategoryTooltip({
    active,
    payload,
    currency,
    hidden,
}: {
    active?: boolean
    payload?: Array<{ payload: SpaceCategoryBreakdownItem }>
    currency: string
    hidden: boolean
}) {
    const item = payload?.[0]?.payload
    if (!active || !item) return null

    return (
        <div
            className="rounded-2xl border border-border bg-card/96 p-3 shadow-lg"
            style={{ boxShadow: 'var(--card-shadow)' }}
        >
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{item.percentage}% del total</span>
                <SpaceAmountInline
                    amount={item.amount}
                    currency={currency}
                    hidden={hidden}
                    className="font-semibold"
                />
            </div>
        </div>
    )
}

export function SpaceEvolutionChart({
    points,
    currency,
    hidden,
}: {
    points: SpaceTrendPoint[]
    currency: string
    hidden: boolean
}) {
    return (
        <SpaceSurface accent="var(--chart-1)">
            <SpaceSectionHeading
                eyebrow="Resumen"
                title="Evolución mensual"
                description="Una lectura más clara de cómo se fue moviendo el espacio en los últimos meses."
            />

            <div className="mt-6 h-[280px]">
                {points.length > 0 ? (
                    <div className="h-full [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
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
                                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                                    tickFormatter={(value) => compactCurrency(value, currency, hidden)}
                                    width={70}
                                />
                                <Tooltip
                                    content={<EvolutionTooltip currency={currency} hidden={hidden} />}
                                    cursor={{ stroke: 'var(--chart-1)', strokeOpacity: 0.18 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="var(--chart-1)"
                                    strokeWidth={2.5}
                                    dot={{ r: 0 }}
                                    activeDot={{
                                        r: 5,
                                        fill: 'var(--chart-1)',
                                        stroke: 'var(--background)',
                                        strokeWidth: 2,
                                    }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex h-full items-center justify-center rounded-[26px] border border-dashed border-border bg-background/60 text-center text-sm text-muted-foreground">
                        Todavía no hay suficientes movimientos para mostrar evolución.
                    </div>
                )}
            </div>
        </SpaceSurface>
    )
}

export function SpaceCategoryBreakdown({
    items,
    currency,
    hidden,
}: {
    items: SpaceCategoryBreakdownItem[]
    currency: string
    hidden: boolean
}) {
    const topItems = items.slice(0, 5)
    const total = topItems.reduce((acc, item) => acc + item.amount, 0)

    return (
        <SpaceSurface accent="var(--chart-3)">
            <SpaceSectionHeading
                eyebrow="Distribución"
                title="Categorías"
                description="Qué rubros explican el total del espacio y cómo se reparte el gasto."
            />

            {topItems.length > 0 ? (
                <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                    <div className="relative mx-auto h-[250px] w-full max-w-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={topItems}
                                    dataKey="amount"
                                    nameKey="label"
                                    innerRadius={72}
                                    outerRadius={104}
                                    paddingAngle={3}
                                    stroke="transparent"
                                >
                                    {topItems.map((item, index) => (
                                        <Cell
                                            key={`${item.label}-${index}`}
                                            fill={item.color ?? getFallbackChartColor(index)}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CategoryTooltip currency={currency} hidden={hidden} />} />
                            </PieChart>
                        </ResponsiveContainer>

                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Total
                            </p>
                            <SpaceAmountInline
                                amount={total}
                                currency={currency}
                                hidden={hidden}
                                className="mt-2 text-lg font-semibold"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {topItems.map((item, index) => (
                            <div
                                key={`${item.categoryId ?? 'uncategorized'}-${item.label}`}
                                className="rounded-[22px] border border-foreground/[0.06] bg-background/72 p-3"
                            >
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{
                                                background: item.color ?? getFallbackChartColor(index),
                                            }}
                                        />
                                        <span className="font-medium text-foreground">{item.label}</span>
                                    </div>

                                    <div className="text-right">
                                        <SpaceAmountInline
                                            amount={item.amount}
                                            currency={currency}
                                            hidden={hidden}
                                            className="font-semibold"
                                        />
                                        <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="mt-6 rounded-[26px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground">
                    No hay categorías suficientes para resumir todavía.
                </div>
            )}
        </SpaceSurface>
    )
}
