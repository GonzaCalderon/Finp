'use client'

import { DebtInitialsAvatar, DebtSourceBadge, DebtAmountInline, formatDebtAmount } from '@/components/debts/DebtsUi'
import { Button } from '@/components/ui/button'
import type { IDebt } from '@/types/debt'
import type { ConsolidatedDebtByPerson } from '@/lib/utils/debt'

interface DebtPersonCardProps {
    person: ConsolidatedDebtByPerson
    debts: IDebt[]
    hidden?: boolean
    onViewDetail: () => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
}

export function DebtPersonCard({ person, debts, hidden, onViewDetail, onPay, onCollect }: DebtPersonCardProps) {
    const actionablePayable = debts.filter(
        (d) => d.direction === 'payable' && (d.status === 'active' || d.status === 'partially_paid')
    )
    const actionableReceivable = debts.filter(
        (d) => d.direction === 'receivable' && (d.status === 'active' || d.status === 'partially_paid')
    )

    const hasMultiplePayable = actionablePayable.length > 1
    const hasMultipleReceivable = actionableReceivable.length > 1

    const currencies = new Set([
        ...Object.keys(person.payable),
        ...Object.keys(person.receivable),
    ])

    const hasMixedCurrencies = currencies.size > 1

    const sourcesUsed = new Set(debts.map((d) => d.sourceType))

    function handlePrimaryAction() {
        const hasPayable = Object.keys(person.payable).some((c) => (person.payable[c] ?? 0) > 0)

        if (hasPayable) {
            if (!hasMultiplePayable && actionablePayable.length === 1 && !hasMixedCurrencies) {
                onPay(actionablePayable[0])
            } else {
                onViewDetail()
            }
        } else {
            if (!hasMultipleReceivable && actionableReceivable.length === 1 && !hasMixedCurrencies) {
                onCollect(actionableReceivable[0])
            } else {
                onViewDetail()
            }
        }
    }

    const totalActionable = actionablePayable.length + actionableReceivable.length
    const hasSingleAction = totalActionable === 1 && !hasMixedCurrencies
    const hasPayableNeto = Object.keys(person.payable).some((c) => (person.payable[c] ?? 0) > 0)

    return (
        <div
            className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-4"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <DebtInitialsAvatar name={person.counterpartyNameSnapshot} />
                <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{person.counterpartyNameSnapshot}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        {Array.from(sourcesUsed).map((s) => (
                            <DebtSourceBadge key={s} sourceType={s} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-1 md:items-end">
                {Array.from(currencies).map((currency) => {
                    const p = person.payable[currency] ?? 0
                    const r = person.receivable[currency] ?? 0
                    const neto = r - p
                    return (
                        <div key={currency} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{currency}</span>
                            <DebtAmountInline
                                amount={Math.abs(neto)}
                                currency={currency}
                                hidden={hidden}
                                className="text-sm"
                                style={{ color: neto > 0 ? 'var(--chart-3)' : 'var(--chart-4)' } as React.CSSProperties}
                            />
                        </div>
                    )
                })}
                {Array.from(currencies).map((currency) => {
                    const p = person.payable[currency]
                    const r = person.receivable[currency]
                    if (!p && !r) return null
                    return (
                        <div key={currency} className="text-xs text-muted-foreground">
                            {p ? `Debo ${hidden ? '••••' : formatDebtAmount(p, currency)}` : ''}
                            {p && r ? ' · ' : ''}
                            {r ? `Me deben ${hidden ? '••••' : formatDebtAmount(r, currency)}` : ''}
                        </div>
                    )
                })}
            </div>

            <div className="flex items-center gap-2 md:flex-col md:items-stretch md:gap-1.5">
                {hasSingleAction && hasPayableNeto && (
                    <Button size="sm" variant="outline" onClick={handlePrimaryAction} className="text-xs">
                        Pagar
                    </Button>
                )}
                {hasSingleAction && !hasPayableNeto && (
                    <Button size="sm" variant="outline" onClick={handlePrimaryAction} className="text-xs">
                        Registrar cobro
                    </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onViewDetail} className="text-xs">
                    Ver detalle
                </Button>
            </div>
        </div>
    )
}
