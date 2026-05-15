'use client'

import { AlertCircle, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import { DebtAmountInline, formatDebtAmount } from '@/components/debts/DebtsUi'
import { cn } from '@/lib/utils'
import type { DebtSummary } from '@/lib/utils/debt'

interface DebtsSummaryCardsProps {
    summary: DebtSummary
    hidden?: boolean
    pendingCount?: number
    needsReviewCount?: number
}

function netByCurrency(summary: DebtSummary) {
    const currencies = new Set([
        ...Object.keys(summary.payable.byCurrency),
        ...Object.keys(summary.receivable.byCurrency),
    ])
    const net: Record<string, number> = {}
    for (const currency of currencies) {
        net[currency] = (summary.receivable.byCurrency[currency] ?? 0) - (summary.payable.byCurrency[currency] ?? 0)
    }
    return net
}

function primaryEntry(byCurrency: Record<string, number>) {
    return Object.entries(byCurrency)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
}

function AmountBlock({
    byCurrency,
    hidden,
    accent,
}: {
    byCurrency: Record<string, number>
    hidden?: boolean
    accent?: string
}) {
    const entries = Object.entries(byCurrency).filter(([, amount]) => Math.abs(amount) > 0.005)
    const primary = primaryEntry(byCurrency)

    if (!primary || entries.length === 0) {
        return <p className="mt-2 text-lg font-semibold text-muted-foreground">Sin saldo</p>
    }

    if (entries.length === 1) {
        return (
            <DebtAmountInline
                amount={Math.abs(primary[1])}
                currency={primary[0]}
                hidden={hidden}
                className="mt-2 block text-xl font-semibold md:text-2xl"
                style={{ color: accent }}
            />
        )
    }

    return (
        <div className="mt-2 space-y-1">
            {entries.map(([currency, amount]) => (
                <div key={currency} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-xs font-medium text-muted-foreground">{currency}</span>
                    <span className="font-medium tabular-nums" style={{ color: accent }}>
                        {hidden ? '••••' : formatDebtAmount(Math.abs(amount), currency)}
                    </span>
                </div>
            ))}
        </div>
    )
}

function SummaryCard({
    label,
    icon: Icon,
    byCurrency,
    hidden,
    accent,
    footer,
    tone,
}: {
    label: string
    icon: typeof Scale
    byCurrency?: Record<string, number>
    hidden?: boolean
    accent?: string
    footer: string
    tone?: 'positive' | 'negative' | 'neutral'
}) {
    return (
        <div
            className={cn(
                'rounded-xl border bg-card p-3.5 shadow-sm md:p-4',
                tone === 'positive' && 'border-emerald-500/20 bg-emerald-500/10',
                tone === 'negative' && 'border-amber-500/20 bg-amber-500/10'
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            {byCurrency ? (
                <AmountBlock byCurrency={byCurrency} hidden={hidden} accent={accent} />
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">{footer}</p>
        </div>
    )
}

export function DebtsSummaryCards({
    summary,
    hidden,
    pendingCount = 0,
    needsReviewCount = 0,
}: DebtsSummaryCardsProps) {
    const net = netByCurrency(summary)
    const totalNet = Object.values(net).reduce((sum, amount) => sum + amount, 0)
    const totalPending = pendingCount + needsReviewCount

    return (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard
                label="Posición neta"
                icon={Scale}
                byCurrency={net}
                hidden={hidden}
                accent={totalNet > 0 ? 'var(--chart-3)' : totalNet < 0 ? 'var(--chart-4)' : undefined}
                tone={totalNet > 0 ? 'positive' : totalNet < 0 ? 'negative' : 'neutral'}
                footer={totalNet > 0 ? 'A tu favor' : totalNet < 0 ? 'Por pagar' : 'En equilibrio'}
            />
            <SummaryCard
                label="Debo"
                icon={ArrowUpRight}
                byCurrency={summary.payable.byCurrency}
                hidden={hidden}
                accent="var(--chart-4)"
                footer="Saldo pendiente de pagar"
            />
            <SummaryCard
                label="Me deben"
                icon={ArrowDownLeft}
                byCurrency={summary.receivable.byCurrency}
                hidden={hidden}
                accent="var(--chart-3)"
                footer="Saldo pendiente de cobrar"
            />
            <div className="rounded-xl border bg-card p-3.5 shadow-sm md:p-4">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Pendientes</p>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xl font-semibold md:text-2xl">
                    {totalPending}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                    {pendingCount} pendientes · {needsReviewCount} revisión
                    {needsReviewCount === 1 ? '' : 'es'}
                </p>
            </div>
        </div>
    )
}
