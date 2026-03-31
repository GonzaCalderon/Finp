'use client'

import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'

type CurrencyTotals = {
    ars: number
    usd: number
}

interface CurrencyBreakdownAmountProps {
    totals: CurrencyTotals
    hidden: boolean
    primaryColor?: string
    secondaryColor?: string
    align?: 'left' | 'right'
    className?: string
    consolidated?: {
        amount: number
        currency: 'ARS' | 'USD'
        rateLabel: string
    } | null
}

export function CurrencyBreakdownAmount({
    totals,
    hidden,
    primaryColor = 'var(--foreground)',
    secondaryColor = 'var(--muted-foreground)',
    align = 'left',
    className,
    consolidated,
}: CurrencyBreakdownAmountProps) {
    return (
        <div className={className}>
            <div className={align === 'right' ? 'text-right' : 'text-left'}>
                <ResponsiveAmount
                    amount={totals.ars}
                    currency="ARS"
                    hidden={hidden}
                    color={primaryColor}
                />
            </div>
            <div
                className={`mt-1 text-[11px] md:text-xs ${align === 'right' ? 'text-right' : 'text-left'}`}
                style={{ color: secondaryColor }}
            >
                <ResponsiveAmount
                    amount={totals.usd}
                    currency="USD"
                    hidden={hidden}
                    color={secondaryColor}
                    compactMaximumFractionDigits={1}
                />
            </div>
            {consolidated && (
                <div
                    className={`mt-1.5 text-[10px] md:text-[11px] ${align === 'right' ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--muted-foreground)' }}
                >
                    <span className="mr-1">Consolidado</span>
                    <ResponsiveAmount
                        amount={consolidated.amount}
                        currency={consolidated.currency}
                        hidden={hidden}
                        color="var(--foreground)"
                        compactMaximumFractionDigits={1}
                    />
                    <span className="ml-1">· {consolidated.rateLabel}</span>
                </div>
            )}
        </div>
    )
}
