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
    loading?: boolean
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
    loading = false,
}: ResponsiveAmountProps) {
    if (loading) {
        return (
            <span
                className={cn(
                    'inline-block h-[1em] w-[7.5ch] animate-pulse rounded-md align-[-0.12em]',
                    className
                )}
                style={{ background: 'color-mix(in srgb, currentColor 16%, transparent)', color }}
                aria-label="Cargando importe"
            />
        )
    }

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
