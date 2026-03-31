'use client'

import { cn } from '@/lib/utils'

interface ResponsiveAmountProps {
    amount: number
    currency?: string
    hidden?: boolean
    color?: string
    className?: string
    compactClassName?: string
    fullClassName?: string
    compactMaximumFractionDigits?: number
    fullMaximumFractionDigits?: number
}

export function ResponsiveAmount({
    amount,
    currency = 'ARS',
    hidden = false,
    color,
    className,
    compactClassName = 'md:hidden',
    fullClassName = 'hidden md:inline',
    compactMaximumFractionDigits = 1,
    fullMaximumFractionDigits = 0,
}: ResponsiveAmountProps) {
    if (hidden) {
        return <span className={className} style={{ color }}>••••</span>
    }

    const compact = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: compactMaximumFractionDigits,
        minimumFractionDigits: 0,
        notation: 'compact',
    }).format(amount)

    const full = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: fullMaximumFractionDigits,
    }).format(amount)

    return (
        <>
            <span className={cn(className, compactClassName)} style={{ color }} title={full}>
                {compact}
            </span>
            <span className={cn(className, fullClassName)} style={{ color }}>
                {full}
            </span>
        </>
    )
}
