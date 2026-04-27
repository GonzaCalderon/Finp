'use client'

import { Check, HandCoins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceAmountInline } from '@/components/spaces/SpaceUi'
import type { SpaceBalanceItem } from '@/types'

function buildSettlementPreview(balances: SpaceBalanceItem[], currentUserId: string) {
    const current = balances.find((balance) => balance.userId === currentUserId)
    if (!current || current.balanceReporting === 0) return null

    const isDebt = current.balanceReporting < 0
    const counterpart = balances.find((balance) =>
        isDebt ? balance.balanceReporting > 0 : balance.balanceReporting < 0
    )
    if (!counterpart) return null

    return {
        isDebt,
        counterpart,
        amount: Math.min(Math.abs(current.balanceReporting), Math.abs(counterpart.balanceReporting)),
    }
}

export function SpaceSettlementPanel({
    balances,
    currency,
    currentUserId,
    hidden,
    onCreateEntry,
}: {
    balances: SpaceBalanceItem[]
    currency: string
    currentUserId: string
    hidden: boolean
    onCreateEntry: () => void
}) {
    const settlement = buildSettlementPreview(balances, currentUserId)
    if (!settlement) {
        return (
            <section className="rounded-2xl border border-foreground/[0.06] bg-card/55 px-4 py-3">
                <div className="flex items-center gap-3">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ background: 'color-mix(in srgb, var(--chart-3) 13%, transparent)' }}
                    >
                        <Check className="h-4 w-4" style={{ color: 'var(--chart-3)' }} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">Todo saldado</p>
                        <p className="text-xs text-muted-foreground">No tenés pagos pendientes en este espacio.</p>
                    </div>
                </div>
            </section>
        )
    }

    const accent = settlement.isDebt ? 'var(--destructive)' : 'var(--chart-3)'

    return (
        <section
            className="rounded-2xl border px-4 py-3"
            style={{
                background: settlement.isDebt
                    ? 'color-mix(in srgb, var(--destructive) 6%, var(--card))'
                    : 'color-mix(in srgb, var(--chart-3) 6%, var(--card))',
                borderColor: settlement.isDebt
                    ? 'color-mix(in srgb, var(--destructive) 18%, transparent)'
                    : 'color-mix(in srgb, var(--chart-3) 18%, transparent)',
            }}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{ background: `color-mix(in srgb, ${accent} 13%, transparent)` }}
                    >
                        <HandCoins className="h-4 w-4" style={{ color: accent }} />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                            {settlement.isDebt
                                ? `Debés a ${settlement.counterpart.displayName}`
                                : `${settlement.counterpart.displayName} te debe`}
                        </p>
                        <SpaceAmountInline
                            amount={settlement.amount}
                            currency={currency}
                            hidden={hidden}
                            color={accent}
                            className="mt-0.5 block text-xl font-semibold tracking-tight"
                        />
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={onCreateEntry}>
                        <HandCoins className="h-4 w-4" />
                        Registrar pago
                    </Button>
                </div>
            </div>
        </section>
    )
}
