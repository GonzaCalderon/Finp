'use client'

import type React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Bell, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DebtAmountInline,
    DebtInitialsAvatar,
    DebtNetAmountDisplay,
    formatDebtAmount,
} from '@/components/debts/DebtsUi'
import { cn } from '@/lib/utils'
import { formatNetAmount, getDebtOriginBadges, type DebtRelationship } from '@/lib/utils/debts-ui'
import type { IDebt } from '@/types/debt'

interface DebtsRelationItemProps {
    rel: DebtRelationship
    hidden?: boolean
    variant: 'desktop' | 'mobile'
    selected?: boolean
    onViewDetail: () => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
}

function activeDebtFor(rel: DebtRelationship, direction: IDebt['direction']) {
    const active = rel.debts.filter(
        (debt) =>
            debt.direction === direction &&
            debt.currency === rel.primaryCurrency &&
            (debt.status === 'active' || debt.status === 'partially_paid')
    )
    return active.length === 1 ? active[0] : null
}

function netTone(amount: number) {
    if (amount > 0) return 'text-emerald-600 dark:text-emerald-400'
    if (amount < 0) return 'text-amber-600 dark:text-amber-400'
    return 'text-muted-foreground'
}

function statusCopy(rel: DebtRelationship) {
    if (rel.hasNeedsReview) return { label: 'Revisión', className: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: AlertTriangle }
    if (rel.hasPendingActions) return { label: 'Pendiente', className: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300', icon: Bell }
    if (rel.overallStatus === 'settled') return { label: 'Saldado', className: 'border-border bg-muted text-muted-foreground', icon: CheckCircle2 }
    return null
}

function totalsLine(rel: DebtRelationship, hidden?: boolean) {
    const payable = rel.payable[rel.primaryCurrency] ?? 0
    const receivable = rel.receivable[rel.primaryCurrency] ?? 0
    const parts = []
    if (payable > 0) parts.push(`Debo ${hidden ? '••••' : formatDebtAmount(payable, rel.primaryCurrency)}`)
    if (receivable > 0) parts.push(`Me deben ${hidden ? '••••' : formatDebtAmount(receivable, rel.primaryCurrency)}`)
    return parts.join(' · ') || 'Sin saldo pendiente'
}

export function DebtsRelationItem({
    rel,
    hidden,
    variant,
    selected,
    onViewDetail,
    onPay,
    onCollect,
}: DebtsRelationItemProps) {
    const { primary, others } = formatNetAmount(rel.netByCurrency)
    const status = statusCopy(rel)
    const originBadges = getDebtOriginBadges(rel)
    const payableDebt = activeDebtFor(rel, 'payable')
    const receivableDebt = activeDebtFor(rel, 'receivable')
    const canPayDirect = rel.primaryAction === 'pay' && payableDebt
    const canCollectDirect = rel.primaryAction === 'collect' && receivableDebt
    const StatusIcon = status?.icon

    function handlePrimary(event: React.MouseEvent) {
        event.stopPropagation()
        if (canPayDirect) {
            onPay(payableDebt)
            return
        }
        if (canCollectDirect) {
            onCollect(receivableDebt)
            return
        }
        onViewDetail()
    }

    function handleOpenKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onViewDetail()
        }
    }

    const primaryLabel = rel.primaryAction === 'pay' ? 'Pagar' : rel.primaryAction === 'collect' ? 'Cobrar' : 'Detalle'

    if (variant === 'desktop') {
        return (
            <motion.div
                layout
                role="button"
                tabIndex={0}
                onClick={onViewDetail}
                onKeyDown={handleOpenKeyDown}
                className={cn(
                    'relative grid w-full grid-cols-[minmax(0,1fr)_150px_170px_104px] items-center gap-4 overflow-hidden border-b px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-200 last:border-b-0 hover:bg-muted/45',
                    selected && 'bg-primary/5 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_22%,transparent)]'
                )}
                animate={{ scale: selected ? 1.006 : 1 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
                {selected ? (
                    <motion.span
                        layoutId="debt-relation-active-bar"
                        className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary"
                        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    />
                ) : null}
                <div className="flex min-w-0 items-center gap-3">
                    <DebtInitialsAvatar name={rel.name} />
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-semibold">{rel.name}</p>
                            {status ? (
                                <Badge variant="outline" className={cn('shrink-0 gap-1 rounded-full px-2 py-0 text-[11px]', status.className)}>
                                    {StatusIcon ? <StatusIcon className="h-3 w-3" /> : null}
                                    {status.label}
                                </Badge>
                            ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {originBadges.map((badge) => (
                                <Badge key={badge} variant="outline" className="rounded-full border-border bg-background/80 px-2 py-0 text-[11px] text-muted-foreground">
                                    {badge}
                                </Badge>
                            ))}
                            <span className="text-xs text-muted-foreground">
                                {rel.debts.length} deuda{rel.debts.length === 1 ? '' : 's'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-right">
                    <DebtNetAmountDisplay netByCurrency={rel.netByCurrency} hidden={hidden} mode="compact" />
                </div>

                <div className="text-xs text-muted-foreground">
                    <p>{totalsLine(rel, hidden)}</p>
                    {others.length > 0 ? <p className="mt-1">{others.length} moneda{others.length === 1 ? '' : 's'} más</p> : null}
                </div>

                <Button size="sm" variant={rel.primaryAction === 'detail' ? 'outline' : 'default'} onClick={handlePrimary} className="justify-center">
                    {primaryLabel}
                </Button>
            </motion.div>
        )
    }

    return (
        <motion.div
            layout
            role="button"
            tabIndex={0}
            onClick={onViewDetail}
            onKeyDown={handleOpenKeyDown}
            className={cn(
                'relative w-full overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-[background-color,border-color,box-shadow] duration-200 hover:bg-muted/35',
                selected && 'border-primary/35 bg-primary/5 shadow-md'
            )}
            animate={{ y: selected ? -1 : 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
            {selected ? (
                <motion.span
                    layoutId="mobile-debt-relation-active-bar"
                    className="absolute inset-x-4 top-0 h-1 rounded-b-full bg-primary"
                    transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                />
            ) : null}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{rel.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                        {originBadges.map((badge) => (
                            <Badge key={badge} variant="outline" className="rounded-full border-border bg-background/80 px-2 py-0 text-[11px] text-muted-foreground">
                                {badge}
                            </Badge>
                        ))}
                    </div>
                </div>
                {status ? (
                    <Badge variant="outline" className={cn('shrink-0 gap-1 rounded-full px-2 py-0.5 text-[11px]', status.className)}>
                        {StatusIcon ? <StatusIcon className="h-3 w-3" /> : null}
                        {status.label}
                    </Badge>
                ) : null}
            </div>

            <div className="mt-4">
                <DebtAmountInline
                    amount={Math.abs(primary.amount)}
                    currency={primary.currency}
                    hidden={hidden}
                    className={cn('text-2xl font-semibold', netTone(primary.amount))}
                />
                <p className="mt-1 text-xs text-muted-foreground">{totalsLine(rel, hidden)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {originBadges.join(' + ')} · {rel.debts.length} deuda{rel.debts.length === 1 ? '' : 's'}
                </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={(event) => {
                        event.stopPropagation()
                        onViewDetail()
                    }}
                >
                    Detalle
                    <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                {rel.primaryAction !== 'detail' ? (
                    <Button size="sm" onClick={handlePrimary}>
                        {primaryLabel}
                    </Button>
                ) : null}
            </div>
        </motion.div>
    )
}
