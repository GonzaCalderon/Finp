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
