'use client'

import { useState, useEffect } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

interface CashflowData {
    month: string
    label: string
    income: number
    expense: number
    balance: number
}

const MONTH_OPTIONS = [
    { value: 1, label: '1M' },
    { value: 3, label: '3M' },
    { value: 6, label: '6M' },
    { value: 12, label: '12M' },
]

const fmt = (amount: number) =>
    new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
        notation: 'compact',
    }).format(amount)

const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: { value: number; name: string; color: string }[]
    label?: string
}) => {
    if (!active || !payload?.length) return null

    return (
        <div
            className="rounded-lg p-3 text-sm space-y-1.5"
            style={{
                background: 'var(--card)',
                border: '0.5px solid var(--border)',
                minWidth: 160,
            }}
        >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
            {payload.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-muted-foreground capitalize">{entry.name}</span>
                    </div>
                    <span className="font-medium tabular-nums">
            {new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: 'ARS',
                maximumFractionDigits: 0,
            }).format(entry.value)}
          </span>
                </div>
            ))}
            {payload.length === 2 && (
                <>
                    <div
                        className="my-1"
                        style={{ borderTop: '0.5px solid var(--border)' }}
                    />
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Balance</span>
                        <span
                            className="font-medium tabular-nums"
                            style={{
                                color: payload[0].value - payload[1].value >= 0
                                    ? 'var(--sky-dark)'
                                    : 'var(--destructive)',
                            }}
                        >
              {new Intl.NumberFormat('es-AR', {
                  style: 'currency',
                  currency: 'ARS',
                  maximumFractionDigits: 0,
              }).format(payload[0].value - payload[1].value)}
            </span>
                    </div>
                </>
            )}
        </div>
    )
}

export function CashflowChart() {
    const [months, setMonths] = useState(6)
    const [data, setData] = useState<CashflowData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetch_ = async () => {
            try {
                setLoading(true)
                const res = await fetch(`/api/cashflow?months=${months}`)
                const json = await res.json()
                if (res.ok) setData(json.cashflow)
            } finally {
                setLoading(false)
            }
        }
        fetch_()
    }, [months])

    return (
        <div
            className="rounded-xl p-5"
            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cashflow
                </p>
                <div
                    className="flex rounded-md overflow-hidden"
                    style={{ border: '0.5px solid var(--border)' }}
                >
                    {MONTH_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => setMonths(opt.value)}
                            className="px-3 py-1 text-xs transition-colors"
                            style={{
                                background: months === opt.value ? 'var(--sky)' : 'transparent',
                                color: months === opt.value ? '#FFFFFF' : 'var(--muted-foreground)',
                                borderRight: opt.value !== 12 ? '0.5px solid var(--border)' : 'none',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Gráfico */}
            {loading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
            ) : (
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                        data={data}
                        barGap={4}
                        barCategoryGap="30%"
                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--border)"
                            strokeDasharray="3 3"
                        />
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
                            tickFormatter={fmt}
                            width={60}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                        />
                        <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)', paddingTop: 12 }}
                            formatter={(value) => value === 'income' ? 'Ingresos' : 'Gastos'}
                        />
                        <Bar
                            dataKey="income"
                            fill="var(--sky)"
                            radius={[3, 3, 0, 0]}
                        />
                        <Bar
                            dataKey="expense"
                            fill="#EF4444"
                            radius={[3, 3, 0, 0]}
                            opacity={0.8}
                        />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}