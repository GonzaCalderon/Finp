'use client'

import Link from 'next/link'
import { CheckCircle2, ChevronRight, Clock3 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import {
    selectableCardIconMotion,
    selectableCardMotion,
} from '@/components/shared/selectable-card-motion'
import {
    ACCOUNT_TYPE_LABELS,
    formatDayOfMonth,
    getCategoryHref,
    getCompactDateLabel,
    getInstallmentProgress,
    getRecentTransactionHref,
    getTransactionAccentColor,
    getTransactionAmountPrefix,
    getTransactionPrimaryMeta,
    getTopExpenseCategories,
    TRANSACTION_TYPE_LABELS,
    getEffectiveTransactionLabel,
} from '@/components/dashboard/dashboard-utils'
import type {
    CommitmentItem,
    DashboardAccount,
    DashboardCurrencyTotals,
    DashboardExpenseCategory,
    DashboardInstallmentItem,
    DashboardRecentTransaction,
} from '@/components/dashboard/types'
import { getAccountBalancesByCurrency, getAccountCurrencyLabel, isDualCurrencyAccount } from '@/lib/utils/accounts'
import { cn } from '@/lib/utils'

function TransactionTypeBadge({ type, spaceId }: { type: string; spaceId?: string }) {
    const isSpaceExpenseOrIncome = Boolean(spaceId) && (type === 'expense' || type === 'income')
    const variant =
        type === 'income'
            ? 'default'
            : type === 'expense'
                ? isSpaceExpenseOrIncome ? 'secondary' : 'destructive'
                : type === 'credit_card_expense' || type === 'credit_card_payment' || type === 'debt_payment'
                    ? 'outline'
                    : 'secondary'

    return (
        <Badge variant={variant} className="rounded-full px-2.5 py-0 text-[10px] font-medium">
            {getEffectiveTransactionLabel(type, spaceId)}
        </Badge>
    )
}

export function TrendBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
    if (value === null) return null

    const neutral = value === 0
    const improving = inverse ? value < 0 : value > 0

    return (
        <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium"
            style={{
                background: neutral
                    ? 'var(--secondary)'
                    : improving
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(239,68,68,0.1)',
                color: neutral
                    ? 'var(--muted-foreground)'
                    : improving
                        ? '#10B981'
                        : '#EF4444',
            }}
        >
            {neutral ? '=' : `${value > 0 ? '+' : ''}${value}%`}
        </span>
    )
}

export function DashboardSectionHeader({
    eyebrow,
    title,
    description,
    actionLabel,
    actionHref,
    compact = false,
}: {
    eyebrow?: string
    title: string
    description?: string
    actionLabel?: string
    actionHref?: string
    compact?: boolean
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
                {eyebrow && (
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        {eyebrow}
                    </p>
                )}
                <div className="space-y-1">
                    <h2 className={cn('font-semibold tracking-tight', compact ? 'text-base' : 'text-lg md:text-xl')}>
                        {title}
                    </h2>
                    {description && (
                        <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {actionLabel && actionHref && (
                <Button asChild variant="ghost" size="sm" className="shrink-0 rounded-full">
                    <Link href={actionHref}>
                        {actionLabel}
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            )}
        </div>
    )
}

export function DashboardMetricLinkCard({
    title,
    totals,
    hidden,
    href,
    accent,
    primaryColor,
    secondaryColor,
    supporting,
    trend,
    subtitle,
    className,
}: {
    title: string
    totals: DashboardCurrencyTotals
    hidden: boolean
    href: string
    accent: string
    primaryColor: string
    secondaryColor: string
    supporting?: React.ReactNode
    trend?: React.ReactNode
    subtitle?: string
    className?: string
}) {
    return (
        <Link href={href} className={cn('group block', className)}>
            <Card
                className={cn(
                    'h-full gap-3 rounded-[28px] border-foreground/[0.08] bg-card/90 group-hover:border-foreground/[0.14]',
                    selectableCardMotion
                )}
                style={{
                    background:
                        'linear-gradient(180deg, color-mix(in srgb, var(--card) 94%, transparent) 0%, color-mix(in srgb, var(--card) 88%, transparent) 100%)',
                }}
            >
                <CardHeader className="px-5 pb-0 pt-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {title}
                            </p>
                            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                        </div>
                        <span
                            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full"
                            style={{
                                background: 'color-mix(in srgb, var(--foreground) 4%, transparent)',
                                color: 'var(--muted-foreground)',
                            }}
                        >
                            <ChevronRight className={cn('h-4 w-4', selectableCardIconMotion)} />
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0">
                    <div
                        className="mb-4 h-px rounded-full"
                        style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)` }}
                    />
                    <CurrencyBreakdownAmount
                        totals={totals}
                        hidden={hidden}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        hideZeroSecondary
                        preserveSecondarySpace
                        className="text-[1.35rem] font-semibold tracking-tight"
                    />
                    {(supporting || trend) && (
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-foreground/[0.07] pt-3 text-xs text-muted-foreground">
                            <div className="min-w-0 flex-1">{supporting}</div>
                            {trend}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    )
}

export function DashboardPanel({
    title,
    description,
    actionLabel,
    actionHref,
    children,
    className,
    contentClassName,
    eyebrow,
}: {
    title: string
    description?: string
    actionLabel?: string
    actionHref?: string
    children: React.ReactNode
    className?: string
    contentClassName?: string
    eyebrow?: string
}) {
    return (
        <Card className={cn('rounded-[28px] border-foreground/[0.08] bg-card/92', className)}>
            <CardHeader className="pb-0 pt-5">
                <DashboardSectionHeader
                    eyebrow={eyebrow}
                    title={title}
                    description={description}
                    actionHref={actionHref}
                    actionLabel={actionLabel}
                    compact
                />
            </CardHeader>
            <CardContent className={cn('pt-4', contentClassName)}>{children}</CardContent>
        </Card>
    )
}

export function DashboardRecentTransactionsList({
    items,
    hidden,
    month,
    compact = false,
    limit = 5,
}: {
    items: DashboardRecentTransaction[]
    hidden: boolean
    month: string
    compact?: boolean
    limit?: number
}) {
    const visibleItems = items.slice(0, limit)

    if (visibleItems.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay movimientos en este período.</p>
    }

    return (
        <div className="space-y-2">
            {visibleItems.map((transaction) => {
                const meta = getTransactionPrimaryMeta(transaction)

                return (
                    <Link
                        key={transaction._id}
                        href={getRecentTransactionHref(transaction, month)}
                        className="group block rounded-2xl border border-foreground/[0.06] bg-background/45 px-3 py-3 transition-colors hover:bg-background/70"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ background: getTransactionAccentColor(transaction) }}
                                    />
                                    <p className={cn('min-w-0 truncate font-medium tracking-tight', compact ? 'text-sm' : 'text-[0.95rem]')}>
                                        {transaction.description}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <TransactionTypeBadge type={transaction.type} spaceId={transaction.spaceId} />
                                    <span>{getCompactDateLabel(transaction.date)}</span>
                                    {transaction.category?.name && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5">
                                            <span
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{ backgroundColor: transaction.category.color ?? '#94A3B8' }}
                                            />
                                            {transaction.category.name}
                                        </span>
                                    )}
                                    {meta && <span>{meta}</span>}
                                    {transaction.installmentCount && transaction.installmentCount > 1 && (
                                        <span>{transaction.installmentCount} cuotas</span>
                                    )}
                                    {transaction.spaceId && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                            Espacio{transaction.spaceNameSnapshot ? `: ${transaction.spaceNameSnapshot}` : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div
                                    className={cn('font-semibold tabular-nums tracking-tight', compact ? 'text-sm' : 'text-base')}
                                    style={{ color: getTransactionAccentColor(transaction) }}
                                >
                                    {getTransactionAmountPrefix(transaction)}
                                    <ResponsiveAmount
                                        amount={transaction.amount}
                                        currency={transaction.currency}
                                        hidden={hidden}
                                        color={getTransactionAccentColor(transaction)}
                                    />
                                </div>
                                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                    {transaction.currency}
                                </p>
                                {transaction.totalAmount != null && (
                                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                                        total {hidden ? '•••' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: transaction.currency, maximumFractionDigits: 2 }).format(transaction.totalAmount)}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}

export function DashboardTopCategoriesList({
    categories,
    hidden,
    month,
    limit = 5,
}: {
    categories: DashboardExpenseCategory[]
    hidden: boolean
    month: string
    limit?: number
}) {
    const topCategories = getTopExpenseCategories(categories, limit)
    const total = topCategories.reduce((sum, category) => sum + category.ars + category.usd, 0)

    if (topCategories.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay gastos categorizados este mes.</p>
    }

    return (
        <div className="space-y-3">
            {topCategories.map((category, index) => {
                const value = category.ars + category.usd
                const ratio = total > 0 ? Math.max((value / total) * 100, 8) : 0

                return (
                    <Link
                        key={category.key}
                        href={getCategoryHref(category.key, month)}
                        className="group block rounded-2xl border border-foreground/[0.06] bg-background/45 px-3 py-3 transition-colors hover:bg-background/70"
                    >
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                                <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: category.color ?? '#94A3B8' }}
                                />
                                <p className="truncate text-sm font-medium">{category.name}</p>
                            </div>
                            <div className="text-right">
                                <ResponsiveAmount
                                    amount={category.ars}
                                    currency="ARS"
                                    hidden={hidden}
                                    color="var(--destructive)"
                                    className="text-sm font-semibold"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    <ResponsiveAmount
                                        amount={category.usd}
                                        currency="USD"
                                        hidden={hidden}
                                        color="var(--muted-foreground)"
                                    />
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                                <div
                                    className="h-full rounded-full transition-[width]"
                                    style={{
                                        width: `${ratio}%`,
                                        background: category.color ?? 'var(--destructive)',
                                    }}
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{Math.round(ratio)}%</span>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}

export function DashboardAccountsList({
    accounts,
    hidden,
    limit,
    excludeTypes,
}: {
    accounts: DashboardAccount[]
    hidden: boolean
    limit?: number
    excludeTypes?: string[]
}) {
    const filteredAccounts = excludeTypes?.length
        ? accounts.filter((account) => !excludeTypes.includes(account.type))
        : accounts
    const visibleAccounts = typeof limit === 'number' ? filteredAccounts.slice(0, limit) : filteredAccounts

    if (visibleAccounts.length === 0) {
        return <p className="text-sm text-muted-foreground">Todavía no hay cuentas activas.</p>
    }

    return (
        <div className="space-y-2">
            {visibleAccounts.map((account) => (
                <div
                    key={account._id}
                    className="rounded-2xl border border-foreground/[0.06] bg-background/45 px-3 py-3"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: account.color ?? 'var(--sky)' }}
                                />
                                <p className="truncate text-sm font-medium">{account.name}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="rounded-full bg-secondary/70 px-2 py-0.5">
                                    {ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                                </span>
                                <span className="rounded-full bg-secondary/70 px-2 py-0.5">
                                    {getAccountCurrencyLabel(account)}
                                </span>
                                {account.institution && <span>{account.institution}</span>}
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            {isDualCurrencyAccount(account) ? (
                                <div className="space-y-0.5">
                                    <ResponsiveAmount
                                        amount={getAccountBalancesByCurrency(account).ARS}
                                        currency="ARS"
                                        hidden={hidden}
                                        color={getAccountBalancesByCurrency(account).ARS >= 0 ? 'var(--foreground)' : 'var(--destructive)'}
                                        className="text-sm font-semibold"
                                    />
                                    <ResponsiveAmount
                                        amount={getAccountBalancesByCurrency(account).USD}
                                        currency="USD"
                                        hidden={hidden}
                                        color={getAccountBalancesByCurrency(account).USD >= 0 ? 'var(--muted-foreground)' : 'var(--destructive)'}
                                        className="text-xs"
                                    />
                                </div>
                            ) : (
                                <ResponsiveAmount
                                    amount={account.balance}
                                    currency={account.currency}
                                    hidden={hidden}
                                    color={account.balance >= 0 ? 'var(--foreground)' : 'var(--destructive)'}
                                    className="text-sm font-semibold"
                                />
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

export function DashboardCommitmentsList({
    commitments,
    appliedId,
    onApplyCommitment,
    hidden,
    compact = false,
}: {
    commitments: CommitmentItem[]
    appliedId: string | null
    onApplyCommitment: (commitment: CommitmentItem) => void
    hidden: boolean
    compact?: boolean
}) {
    const emptyMessage = compact
        ? 'Sin compromisos pendientes.'
        : 'No hay compromisos pendientes en este período.'

    if (commitments.length === 0) {
        return (
            <div className="rounded-[24px] border border-dashed border-foreground/[0.08] bg-background/35 px-4 py-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Al día
                </div>
                <p className="mt-3 text-sm font-medium tracking-tight">{emptyMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Este mes no hay vencimientos manuales pendientes para aplicar.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {commitments.map((commitment) => {
                const applied = appliedId === commitment._id

                return (
                    <div
                        key={commitment._id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-foreground/[0.06] bg-background/45 px-3 py-3"
                    >
                        <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{commitment.description}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                {commitment.dayOfMonth && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5">
                                        <Clock3 className="h-3 w-3" />
                                        {formatDayOfMonth(commitment.dayOfMonth)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <ResponsiveAmount
                                amount={commitment.amount}
                                currency={commitment.currency}
                                hidden={hidden}
                                color="var(--foreground)"
                                className="text-sm font-semibold"
                            />
                            <div className="mt-2 flex justify-end">
                                {applied ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-500">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Aplicado
                                    </span>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="xs"
                                        className="rounded-full"
                                        onClick={() => onApplyCommitment(commitment)}
                                    >
                                        Aplicar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export function DashboardInstallmentsList({
    installments,
    hidden,
}: {
    installments: DashboardInstallmentItem[]
    hidden: boolean
}) {
    if (installments.length === 0) {
        return <p className="text-sm text-muted-foreground">No hay cuotas activas este mes.</p>
    }

    return (
        <div className="space-y-2">
            {installments.map((installment) => (
                <div
                    key={installment._id}
                    className="rounded-2xl border border-foreground/[0.06] bg-background/45 px-3 py-3"
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-medium">{installment.description}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center rounded-full bg-secondary/70 px-2 py-0.5">
                                    {getInstallmentProgress(installment)}
                                </span>
                            </div>
                        </div>
                        <ResponsiveAmount
                            amount={installment.installmentAmount}
                            currency={installment.currency}
                            hidden={hidden}
                            color="var(--foreground)"
                            className="shrink-0 text-sm font-semibold"
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}
