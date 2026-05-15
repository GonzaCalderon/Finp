'use client'

import type React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { IDebt } from '@/types/debt'

export function DebtDirectionBadge({ direction, className }: { direction: IDebt['direction']; className?: string }) {
    if (direction === 'payable') {
        return (
            <Badge
                variant="outline"
                className={cn('text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30', className)}
            >
                Debo
            </Badge>
        )
    }
    return (
        <Badge
            variant="outline"
            className={cn('text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30', className)}
        >
            Me deben
        </Badge>
    )
}

export function DebtStatusBadge({ status, className }: { status: IDebt['status']; className?: string }) {
    const map: Record<IDebt['status'], { label: string; className: string }> = {
        active: { label: 'Activa', className: 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
        partially_paid: { label: 'Parcialmente pagada', className: 'border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30' },
        paid: { label: 'Saldada', className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
        ignored: { label: 'Ignorada', className: 'border-muted-foreground/40 text-muted-foreground bg-muted/50' },
        cancelled: { label: 'Cancelada', className: 'border-muted-foreground/40 text-muted-foreground bg-muted/50' },
    }
    const { label, className: cls } = map[status] ?? map.active
    return (
        <Badge variant="outline" className={cn('text-xs', cls, className)}>
            {label}
        </Badge>
    )
}

export function DebtSourceBadge({ sourceType, className }: { sourceType: IDebt['sourceType']; className?: string }) {
    if (sourceType === 'space') {
        return (
            <Badge
                variant="outline"
                className={cn('text-xs border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30', className)}
            >
                Espacio
            </Badge>
        )
    }
    return (
        <Badge
            variant="outline"
            className={cn('text-xs border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30', className)}
        >
            Manual
        </Badge>
    )
}

export function DebtAmountInline({
    amount,
    currency,
    hidden = false,
    className,
    style,
}: {
    amount: number
    currency: string
    hidden?: boolean
    className?: string
    style?: React.CSSProperties
}) {
    if (hidden) return <span className={cn('font-medium', className)} style={style}>••••</span>
    const formatted = new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount)
    return <span className={cn('font-medium tabular-nums', className)} style={style}>{formatted}</span>
}

export function DebtNetAmountDisplay({
    netByCurrency,
    hidden = false,
    mode = 'compact',
    className,
}: {
    netByCurrency: Record<string, number>
    hidden?: boolean
    mode?: 'compact' | 'stacked' | 'inline'
    className?: string
}) {
    const entries = Object.entries(netByCurrency)
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

    if (entries.length === 0) {
        return <span className={cn('text-sm text-muted-foreground', className)}>Sin saldo</span>
    }

    if (mode === 'inline') {
        return (
            <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
                {entries.map(({ currency, amount }) => (
                    <DebtAmountInline
                        key={currency}
                        amount={Math.abs(amount)}
                        currency={currency}
                        hidden={hidden}
                        className="text-sm"
                        style={{ color: amount > 0 ? 'var(--chart-3)' : amount < 0 ? 'var(--chart-4)' : undefined }}
                    />
                ))}
            </span>
        )
    }

    const [primary, ...others] = entries

    return (
        <div className={cn('min-w-0', mode === 'stacked' ? 'space-y-1.5' : 'space-y-0.5', className)}>
            <DebtAmountInline
                amount={Math.abs(primary.amount)}
                currency={primary.currency}
                hidden={hidden}
                className={cn(mode === 'stacked' ? 'text-2xl font-semibold' : 'text-base font-semibold')}
                style={{
                    color: primary.amount > 0 ? 'var(--chart-3)' : primary.amount < 0 ? 'var(--chart-4)' : undefined,
                }}
            />
            {others.length > 0 ? (
                <div className={cn('flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground', mode === 'stacked' && 'flex-col')}>
                    {others.map(({ currency, amount }) => (
                        <span key={currency} className="font-medium tabular-nums">
                            {amount > 0 ? '+' : amount < 0 ? '-' : ''}
                            {hidden ? '••••' : formatDebtAmount(Math.abs(amount), currency)}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

export function DebtInitialsAvatar({ name, className }: { name: string; className?: string }) {
    const initials = name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')

    return (
        <div
            className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                className
            )}
            style={{
                background: 'var(--sky-light)',
                color: 'var(--sky)',
            }}
        >
            {initials || '?'}
        </div>
    )
}

export function getContrapartyKey(debt: IDebt): string {
    return (
        debt.counterpartyUserId?.toString() ??
        debt.counterpartyParticipantId?.toString() ??
        debt.counterpartyNameSnapshot.toLowerCase().trim()
    )
}

export function formatDebtAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount)
}
