'use client'

import { DebtAmountInline } from '@/components/debts/DebtsUi'
import type { DebtSummary } from '@/lib/utils/debt'

interface DebtsSummaryCardsProps {
    summary: DebtSummary
    hidden?: boolean
}

function CurrencyRows({ byCurrency, hidden }: { byCurrency: Record<string, number>; hidden?: boolean }) {
    const entries = Object.entries(byCurrency)
    if (entries.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>
    }
    return (
        <div className="flex flex-col gap-0.5">
            {entries.map(([currency, amount]) => (
                <DebtAmountInline key={currency} amount={amount} currency={currency} hidden={hidden} className="text-base" />
            ))}
        </div>
    )
}

function NetoRows({ payable, receivable, hidden }: { payable: Record<string, number>; receivable: Record<string, number>; hidden?: boolean }) {
    const currencies = new Set([...Object.keys(payable), ...Object.keys(receivable)])
    if (currencies.size === 0) {
        return <span className="text-sm text-muted-foreground">—</span>
    }
    return (
        <div className="flex flex-col gap-0.5">
            {Array.from(currencies).map((currency) => {
                const neto = (receivable[currency] ?? 0) - (payable[currency] ?? 0)
                const color = neto > 0 ? 'var(--chart-3)' : neto < 0 ? 'var(--chart-4)' : undefined
                return (
                    <DebtAmountInline
                        key={currency}
                        amount={Math.abs(neto)}
                        currency={currency}
                        hidden={hidden}
                        className="text-base"
                        style={{ color } as React.CSSProperties}
                    />
                )
            })}
        </div>
    )
}

export function DebtsSummaryCards({ summary, hidden }: DebtsSummaryCardsProps) {
    return (
        <div className="grid grid-cols-3 gap-3">
            <div
                className="rounded-xl border p-4 flex flex-col gap-1"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Debo</span>
                <CurrencyRows byCurrency={summary.payable.byCurrency} hidden={hidden} />
            </div>

            <div
                className="rounded-xl border p-4 flex flex-col gap-1"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Me deben</span>
                <CurrencyRows byCurrency={summary.receivable.byCurrency} hidden={hidden} />
            </div>

            <div
                className="rounded-xl border p-4 flex flex-col gap-1"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Neto</span>
                <NetoRows
                    payable={summary.payable.byCurrency}
                    receivable={summary.receivable.byCurrency}
                    hidden={hidden}
                />
            </div>
        </div>
    )
}
