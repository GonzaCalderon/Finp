'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ExternalLink } from 'lucide-react'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { cn } from '@/lib/utils'
import { buildProjectionGroups } from '@/lib/utils/projection'
import type {
    ProjectionGroup,
    ProjectionGrouping,
    ProjectionItem,
    ProjectionPeriod,
} from '@/types/projection'

function formatMonth(month: string, includeYear: boolean) {
    const [year, monthNumber] = month.split('-').map(Number)
    return new Date(year, monthNumber - 1, 1).toLocaleDateString('es-AR', {
        month: 'long',
        ...(includeYear ? { year: 'numeric' } : {}),
    })
}

function formatDate(value?: string) {
    if (!value) return null
    return new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function certaintyLabel(item: ProjectionItem, isPast: boolean) {
    if (isPast && item.kind === 'commitment' && !item.isRegistered) return 'No registrado'
    if (item.certainty === 'confirmed') return item.isRegistered ? 'Registrado' : 'Confirmado'
    if (item.certainty === 'calculated') return 'Calculado'
    if (item.certainty === 'estimated') return 'Estimado'
    return 'A confirmar'
}

function certaintyClass(item: ProjectionItem, isPast: boolean) {
    if (isPast && item.kind === 'commitment' && !item.isRegistered) {
        return 'bg-muted text-muted-foreground'
    }
    if (item.certainty === 'confirmed') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    if (item.certainty === 'calculated') return 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
}

function itemMeta(item: ProjectionItem) {
    const values: string[] = []
    if (item.installment) values.push(`${item.installment.current}/${item.installment.count}`)
    if ((item.occurrences ?? 1) > 1) values.push(`×${item.occurrences}`)
    if (item.card?.dueDay) values.push(`vence día ${item.card.dueDay}`)
    else if (item.dueDate) values.push(formatDate(item.dueDate) ?? '')
    if (item.account) values.push(item.account.name)
    return values.filter(Boolean).join(' · ')
}

function ProjectionItemRow({ item, hidden, isPast, level }: {
    item: ProjectionItem
    hidden: boolean
    isPast: boolean
    level: number
}) {
    const meta = itemMeta(item)
    return (
        <div
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-t border-border/60 py-2.5 pr-2 text-sm"
            style={{ paddingLeft: 16 + level * 16 }}
        >
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="break-words font-medium">{item.description}</span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', certaintyClass(item, isPast))}>
                        {certaintyLabel(item, isPast)}
                    </span>
                </div>
                {meta && <p className="mt-1 text-xs text-muted-foreground">{meta}</p>}
                <Link
                    href={item.link.href}
                    className="mt-1.5 inline-flex min-h-7 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                    {item.link.label}
                    <ExternalLink className="size-3" aria-hidden="true" />
                </Link>
            </div>
            <div className="pt-0.5 text-right font-medium tabular-nums">
                {item.certainty === 'pending_amount' ? (
                    <span className="text-xs text-amber-700 dark:text-amber-300">Monto a confirmar</span>
                ) : (
                    <ResponsiveAmount
                        amount={item.amount}
                        currency={item.currency}
                        hidden={hidden}
                        color="var(--foreground)"
                    />
                )}
            </div>
        </div>
    )
}

function ProjectionGroupRow({ group, hidden, isPast, level }: {
    group: ProjectionGroup
    hidden: boolean
    isPast: boolean
    level: number
}) {
    const [open, setOpen] = useState(false)
    const contentId = useId()
    const hasContent = group.children.length > 0 || group.items.length > 0 || Boolean(group.href)

    return (
        <div className={level === 0 ? 'border-t border-border' : ''}>
            <button
                type="button"
                disabled={!hasContent}
                aria-expanded={hasContent ? open : undefined}
                aria-controls={hasContent ? contentId : undefined}
                onClick={() => hasContent && setOpen((value) => !value)}
                className="grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg py-2 pr-2 text-left transition-colors hover:bg-muted/50 disabled:cursor-default disabled:hover:bg-transparent"
                style={{ paddingLeft: 8 + level * 16 }}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <ChevronRight
                        className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90', !hasContent && 'opacity-0')}
                        aria-hidden="true"
                    />
                    <span className={cn('truncate', level === 0 ? 'font-semibold' : 'text-sm text-muted-foreground')}>
                        {group.label}
                    </span>
                </span>
                <CurrencyBreakdownAmount
                    totals={group.totals}
                    hidden={hidden}
                    align="right"
                    hideZeroSecondary
                    className="text-sm font-medium tabular-nums"
                />
            </button>

            {open && hasContent && (
                <div id={contentId}>
                    {group.href && group.linkLabel && (
                        <div className="flex justify-end px-2 pb-1" style={{ paddingLeft: 24 + level * 16 }}>
                            <Link
                                href={group.href}
                                className="inline-flex min-h-7 items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                {group.linkLabel}
                                <ExternalLink className="size-3" aria-hidden="true" />
                            </Link>
                        </div>
                    )}
                    {group.children.map((child) => (
                        <ProjectionGroupRow
                            key={child.key}
                            group={child}
                            hidden={hidden}
                            isPast={isPast}
                            level={level + 1}
                        />
                    ))}
                    {group.items.map((item) => (
                        <ProjectionItemRow
                            key={item.id}
                            item={item}
                            hidden={hidden}
                            isPast={isPast}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function ProjectionPeriodCard({
    period,
    grouping,
    hidden,
    includeYear,
}: {
    period: ProjectionPeriod
    grouping: ProjectionGrouping
    hidden: boolean
    includeYear: boolean
}) {
    const groups = buildProjectionGroups(period.items, grouping)
    const hasEstimates = period.totals.estimated.ars > 0 || period.totals.estimated.usd > 0

    return (
        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold capitalize">{formatMonth(period.month, includeYear)}</h2>
                        {period.isCurrentMonth && (
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                                Período actual
                            </span>
                        )}
                        {period.isPast && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Pasado
                            </span>
                        )}
                    </div>
                    {(hasEstimates || period.totals.pendingAmountCount > 0) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {[
                                hasEstimates ? 'Incluye estimaciones' : null,
                                period.totals.pendingAmountCount > 0
                                    ? `${period.totals.pendingAmountCount} ${period.totals.pendingAmountCount === 1 ? 'monto a confirmar' : 'montos a confirmar'}`
                                    : null,
                            ].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>
                <div>
                    <p className="mb-1 text-right text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total proyectado</p>
                    <CurrencyBreakdownAmount
                        totals={period.totals.total}
                        hidden={hidden}
                        align="right"
                        hideZeroSecondary
                        className="text-sm font-semibold tabular-nums"
                    />
                </div>
            </header>

            {groups.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No hay gastos proyectados para este período.
                </div>
            ) : (
                <div className="px-2 pb-2">
                    {groups.map((group) => (
                        <ProjectionGroupRow
                            key={group.key}
                            group={group}
                            hidden={hidden}
                            isPast={period.isPast}
                            level={0}
                        />
                    ))}
                </div>
            )}
        </article>
    )
}
