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
    if (!settlement) return null

    const accent = settlement.isDebt ? 'var(--destructive)' : 'var(--chart-3)'

    return (
        <section
            className="rounded-[28px] border px-5 py-5 md:px-6"
            style={{
                background: settlement.isDebt
                    ? 'color-mix(in srgb, var(--destructive) 7%, var(--card))'
                    : 'color-mix(in srgb, var(--chart-3) 7%, var(--card))',
                borderColor: settlement.isDebt
                    ? 'color-mix(in srgb, var(--destructive) 24%, transparent)'
                    : 'color-mix(in srgb, var(--chart-3) 24%, transparent)',
            }}
        >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
                        {settlement.isDebt ? 'DEUDA PENDIENTE' : 'SALDO A COBRAR'}
                    </p>
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold tracking-tight text-foreground">
                            {settlement.isDebt
                                ? `Le debes a ${settlement.counterpart.displayName}`
                                : `${settlement.counterpart.displayName} te debe`}
                        </h2>
                        <SpaceAmountInline
                            amount={settlement.amount}
                            currency={currency}
                            hidden={hidden}
                            color={accent}
                            className="text-3xl font-semibold tracking-tight"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                    <Button variant="outline" className="rounded-full" onClick={onCreateEntry}>
                        <HandCoins className="h-4 w-4" />
                        Pago parcial
                    </Button>
                    <Button
                        className="rounded-full bg-[var(--chart-3)] text-white hover:bg-[var(--chart-3)]/90"
                        onClick={onCreateEntry}
                    >
                        <Check className="h-4 w-4" />
                        Saldar total
                    </Button>
                </div>
            </div>
        </section>
    )
}
