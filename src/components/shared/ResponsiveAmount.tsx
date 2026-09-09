'use client'

import { cn } from '@/lib/utils'
import { getCurrencyScale } from '@/lib/constants/iso-currencies'

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
    abbreviateOnMobile?: boolean
    loading?: boolean
}

export function ResponsiveAmount({
    amount,
    currency,
    hidden = false,
    color,
    className,
    compactClassName = 'md:hidden',
    fullClassName = 'hidden md:inline',
    compactMaximumFractionDigits,
    fullMaximumFractionDigits,
    abbreviateOnMobile = true,
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

    let safeCurrency = currency?.trim().toUpperCase()
    if (!safeCurrency) {
        console.warn('[ResponsiveAmount] Moneda ausente. Se usará ARS.')
        safeCurrency = 'ARS'
    } else try {
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: safeCurrency })
    } catch {
        console.warn(`[ResponsiveAmount] Moneda inválida "${currency ?? ''}". Se usará ARS.`)
        safeCurrency = 'ARS'
    }

    const currencyScale = getCurrencyScale(safeCurrency) ?? 2
    const compact = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: safeCurrency,
        maximumFractionDigits: compactMaximumFractionDigits ?? Math.min(currencyScale, 1),
        minimumFractionDigits: 0,
        notation: 'compact',
    }).format(amount)

    const full = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: safeCurrency,
        maximumFractionDigits: fullMaximumFractionDigits ?? currencyScale,
        minimumFractionDigits: abbreviateOnMobile ? 0 : currencyScale,
    }).format(amount)

    if (!abbreviateOnMobile) {
        return <span className={className} style={{ color }}>{full}</span>
    }

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
