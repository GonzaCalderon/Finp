'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { PeriodSelector } from '@/components/shared/PeriodSelector'
import { MobileCardCarousel } from '@/components/shared/MobileCardCarousel'
import { SankeyChart } from '@/components/shared/SankeyChart'
import { DashboardCardVisual } from '@/components/dashboard/DashboardCardVisual'
import {
    DashboardAccountsList,
    DashboardInstallmentsList,
    DashboardPanel,
    DashboardRecentTransactionsList,
    DashboardSectionHeader,
} from '@/components/dashboard/DashboardShared'
import { getPeriodMonthLabel, getTopExpenseCategories } from '@/components/dashboard/dashboard-utils'
import { cn } from '@/lib/utils'
import type { DashboardViewProps } from '@/components/dashboard/types'

function InsightTile({
    label,
    value,
    caption,
    tone = 'default',
    loading = false,
}: {
    label: string
    value: string
    caption: string
    tone?: 'default' | 'positive' | 'warning' | 'negative'
    loading?: boolean
}) {
    const color =
        tone === 'positive'
            ? '#10B981'
            : tone === 'warning'
                ? 'var(--amber)'
                : tone === 'negative'
                    ? 'var(--destructive)'
                    : 'var(--sky)'

    return (
        <div className="rounded-[22px] border border-foreground/[0.06] bg-background/45 p-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-semibold tracking-tight" style={{ color }}>
                {loading ? (
                    <span
                        className="inline-block h-[1em] w-[7ch] animate-pulse rounded-md align-[-0.12em]"
                        style={{ background: 'color-mix(in srgb, currentColor 16%, transparent)' }}
                        aria-label="Cargando valor"
                    />
                ) : value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
    )
}

function MobileSummaryCard({
    href,
    hidden,
    totals,
    debtRatio,
    loading = false,
}: {
    href: string
    hidden: boolean
    totals: { ars: number; usd: number }
    debtRatio: number
    loading?: boolean
}) {
    return (
        <Link
            href={href}
            className="block overflow-hidden rounded-[28px] border border-foreground/[0.08] p-4"
            style={{
                background:
                    'radial-gradient(circle at top left, color-mix(in srgb, var(--sky) 16%, transparent) 0%, transparent 36%), linear-gradient(180deg, color-mix(in srgb, var(--card) 97%, transparent) 0%, color-mix(in srgb, var(--card) 93%, transparent) 100%)',
                boxShadow: 'var(--card-shadow)',
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Saldo disponible</p>
                    <CurrencyBreakdownAmount
                        totals={totals}
                        hidden={hidden}
                        primaryColor={totals.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        secondaryColor={totals.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        hideZeroSecondary
                        preserveSecondarySpace
                        className="text-[1.85rem] font-semibold tracking-tight"
                        loading={loading}
                    />
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/[0.08] bg-background/55">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </span>
            </div>

            <div
                className="mt-4 flex items-center justify-between gap-3 rounded-[20px] px-3 py-2.5 text-xs"
                style={{
                    border: `1px solid ${
                        debtRatio >= 60
                            ? debtRatio >= 80
                                ? 'color-mix(in srgb, var(--destructive) 28%, transparent)'
                                : 'color-mix(in srgb, var(--amber) 28%, transparent)'
                            : 'color-mix(in srgb, var(--foreground) 6%, transparent)'
                    }`,
                    background:
                        debtRatio >= 60
                            ? debtRatio >= 80
                                ? 'color-mix(in srgb, var(--destructive) 8%, transparent)'
                                : 'color-mix(in srgb, var(--amber) 8%, transparent)'
                            : 'color-mix(in srgb, var(--background) 45%, transparent)',
                }}
            >
                <span className="text-muted-foreground">Deuda / ingreso</span>
                <span
                    className="font-semibold"
                    style={{
                        color:
                            debtRatio >= 80
                                ? 'var(--destructive)'
                                : debtRatio >= 60
                                    ? 'var(--amber)'
                                    : 'var(--foreground)',
                    }}
                >
                    {loading ? (
                        <span
                            className="inline-block h-[1em] w-[4ch] animate-pulse rounded-md align-[-0.12em]"
                            style={{ background: 'color-mix(in srgb, currentColor 16%, transparent)' }}
                            aria-label="Cargando porcentaje"
                        />
                    ) : `${Math.round(debtRatio)}%`}
                </span>
            </div>
        </Link>
    )
}

function MobileMetricTile({
    title,
    href,
    hidden,
    totals,
    primaryColor,
    secondaryColor,
    className,
    loading = false,
}: {
    title: string
    href: string
    hidden: boolean
    totals: { ars: number; usd: number }
    primaryColor: string
    secondaryColor: string
    className?: string
    loading?: boolean
}) {
    return (
        <Link
            href={href}
            className={cn('block rounded-[24px] border border-foreground/[0.08] bg-card/92 p-4', className)}
            style={{
                boxShadow: 'var(--card-shadow)',
            }}
        >
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
            <CurrencyBreakdownAmount
                totals={totals}
                hidden={hidden}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                hideZeroSecondary
                preserveSecondarySpace
                className="mt-2 text-[1.05rem] font-semibold tracking-tight"
                loading={loading}
            />
        </Link>
    )
}

export function DashboardMobile({
    data,
    month,
    monthOptions,
    refreshing,
    hidden,
    onMonthChange,
    operationalStartConfigured,
}: DashboardViewProps) {
    const topCategory = getTopExpenseCategories(data.expenseByCategory, 1)[0]
    const nonCreditAccounts = data.accounts.filter(
        (account) => account.type !== 'credit_card' && account.type !== 'debt'
    )
    const visibleAccounts = nonCreditAccounts.slice(0, 4)
    const hiddenAccountsCount = Math.max(nonCreditAccounts.length - visibleAccounts.length, 0)
    const debtAccounts = data.accounts.filter((account) => account.type === 'debt')
    const debtToIncomeRatio =
        data.summary.totalIncome.ars > 0
            ? Math.min((data.summary.totalCreditCardExpense.ars / data.summary.totalIncome.ars) * 100, 100)
            : 0
    const commitmentsToIncomeRatio =
        data.summary.totalIncome.ars > 0
            ? Math.min((data.summary.totalMonthlyCommitments.ars / data.summary.totalIncome.ars) * 100, 100)
            : 0

    return (
        <div className="space-y-4 pb-2">
            <section className="space-y-4 rounded-[30px] border border-foreground/[0.08] bg-card/92 p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <h1 className="text-[1.7rem] font-semibold tracking-tight">Dashboard</h1>
                        <p className="text-sm text-muted-foreground">{getPeriodMonthLabel(month)}</p>
                    </div>
                    <PeriodSelector
                        value={month}
                        options={monthOptions}
                        onValueChange={onMonthChange}
                        className="h-10 w-[148px] rounded-2xl border-foreground/[0.08] bg-background/60 text-xs"
                    />
                </div>

                {!operationalStartConfigured && (
                    <div className="rounded-[22px] border border-foreground/[0.08] bg-background/50 px-4 py-3">
                        <p className="text-sm font-medium">Configura tu fecha de inicio</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Mejora la lectura de deuda, patrimonio y comparativas del dashboard.
                        </p>
                        <Button asChild variant="ghost" size="sm" className="mt-2 h-7 rounded-full px-0 text-xs">
                            <Link href="/settings?tab=preferencias">Ir a preferencias</Link>
                        </Button>
                    </div>
                )}

                <MobileSummaryCard
                    href={`/transactions?month=${month}`}
                    hidden={hidden}
                    totals={data.summary.availableBalance}
                    debtRatio={debtToIncomeRatio}
                    loading={refreshing}
                />

                <div className="grid grid-cols-2 gap-3">
                    <MobileMetricTile
                        title="Ingresos"
                        href={`/transactions?month=${month}&type=income`}
                        hidden={hidden}
                        totals={data.summary.totalIncome}
                        primaryColor="#10B981"
                        secondaryColor="rgba(16,185,129,0.78)"
                        loading={refreshing}
                    />
                    <MobileMetricTile
                        title="Gastos"
                        href={`/transactions?month=${month}&type=expense`}
                        hidden={hidden}
                        totals={data.summary.totalExpense}
                        primaryColor="var(--destructive)"
                        secondaryColor="rgba(239,68,68,0.78)"
                        loading={refreshing}
                    />
                    <MobileMetricTile
                        title="Deuda mensual"
                        href={`/transactions/credit-card?month=${month}&statusFilter=active`}
                        hidden={hidden}
                        totals={data.summary.totalCreditCardExpense}
                        primaryColor="var(--amber-dark)"
                        secondaryColor="rgba(234,179,8,0.78)"
                        loading={refreshing}
                    />
                    <MobileMetricTile
                        title="Pendiente TC"
                        href={`/transactions/credit-card?month=${month}`}
                        hidden={hidden}
                        totals={data.summary.totalDebt}
                        primaryColor={data.summary.totalDebt.ars > 0 ? 'var(--foreground)' : 'var(--sky-dark)'}
                        secondaryColor="var(--muted-foreground)"
                        loading={refreshing}
                    />
                    <MobileMetricTile
                        title="Resultado del período"
                        href={`/transactions?month=${month}`}
                        hidden={hidden}
                        totals={data.summary.balance}
                        primaryColor={data.summary.balance.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        secondaryColor={data.summary.balance.usd >= 0 ? 'rgba(96,184,224,0.78)' : 'var(--destructive)'}
                        loading={refreshing}
                    />
                    <MobileMetricTile
                        title="Compromisos del mes"
                        href="/commitments"
                        hidden={hidden}
                        totals={data.summary.totalMonthlyCommitments}
                        primaryColor="var(--sky-dark)"
                        secondaryColor="rgba(96,184,224,0.78)"
                        loading={refreshing}
                    />
                </div>
            </section>

            {data.creditCards.length > 0 && (
                <section className="space-y-3">
                    <DashboardSectionHeader
                        title="Tarjetas del mes"
                        actionHref={`/transactions/credit-card?month=${month}`}
                        actionLabel="Ver todas"
                        compact
                    />
                    <MobileCardCarousel
                        className="space-y-0"
                        showHeader={false}
                        itemClassName="basis-[calc(100%-1.2rem)]"
                        viewportClassName="gap-3 px-0 pb-0"
                    >
                        {data.creditCards.map((card) => (
                            <DashboardCardVisual
                                key={card.accountId}
                                card={card}
                                hidden={hidden}
                                href={`/transactions/credit-card?month=${month}&cardId=${card.accountId}`}
                                variant="compact"
                            />
                        ))}
                    </MobileCardCarousel>
                </section>
            )}

            <DashboardPanel title="Transacciones recientes" actionLabel="Ver todas" actionHref={`/transactions?month=${month}`}>
                <DashboardRecentTransactionsList
                    items={data.recentTransactions}
                    hidden={hidden}
                    month={month}
                    compact
                    limit={4}
                />
            </DashboardPanel>

            <DashboardPanel title="Resumen del mes">
                <div className="grid grid-cols-2 gap-3">
                    <InsightTile
                        label="Top categoría"
                        value={topCategory?.name ?? 'Sin datos'}
                        caption={topCategory ? 'Mayor concentración de gasto' : 'Aún no hay categoría líder'}
                        loading={refreshing}
                    />
                    <InsightTile
                        label="Cuotas"
                        value={String(data.installmentsThisMonth.length)}
                        caption="Compromisos pendientes"
                        tone="default"
                        loading={refreshing}
                    />
                    <InsightTile
                        label="TC / ingreso"
                        value={`${Math.round(debtToIncomeRatio)}%`}
                        caption="Presión mensual de tarjetas"
                        tone={debtToIncomeRatio >= 60 ? 'warning' : 'default'}
                        loading={refreshing}
                    />
                    <InsightTile
                        label="Compromisos / ingreso"
                        value={commitmentsToIncomeRatio > 0 ? `${Math.round(commitmentsToIncomeRatio)}%` : 'Sin datos'}
                        caption={commitmentsToIncomeRatio > 0 ? 'Obligaciones fijas del mes' : 'Sin compromisos activos'}
                        tone="default"
                        loading={refreshing}
                    />
                </div>
            </DashboardPanel>

            <DashboardPanel title="Cuotas del mes" actionLabel="Abrir tarjetas" actionHref={`/transactions/credit-card?month=${month}&installmentFilter=multi`}>
                <DashboardInstallmentsList installments={data.installmentsThisMonth.slice(0, 4)} hidden={hidden} />
            </DashboardPanel>

            <DashboardPanel title="Patrimonio" actionLabel="Ver cuentas" actionHref="/accounts">
                <div className="mb-4 rounded-[24px] border border-foreground/[0.06] bg-background/45 p-4">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Patrimonio neto</p>
                    <CurrencyBreakdownAmount
                        totals={data.netWorth.total}
                        hidden={hidden}
                        primaryColor={data.netWorth.total.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        secondaryColor={data.netWorth.total.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                        hideZeroSecondary
                        preserveSecondarySpace
                        className="mt-2 text-[1.45rem] font-semibold tracking-tight"
                        loading={refreshing}
                    />
                </div>

                <DashboardAccountsList
                    accounts={visibleAccounts}
                    hidden={hidden}
                />

                {debtAccounts.length > 0 && (
                    <>
                        <p className="mb-2 mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            Deudas
                        </p>
                        <DashboardAccountsList
                            accounts={debtAccounts}
                            hidden={hidden}
                        />
                    </>
                )}

                {hiddenAccountsCount > 0 && (
                    <Button asChild variant="ghost" size="sm" className="mt-3 h-8 rounded-full px-3 text-xs">
                        <Link href="/accounts">
                            Ver {hiddenAccountsCount} cuenta{hiddenAccountsCount === 1 ? '' : 's'} más
                        </Link>
                    </Button>
                )}
            </DashboardPanel>

            <DashboardPanel title="Flujo del mes" actionLabel="Ver transacciones" actionHref={`/transactions?month=${month}`}>
                <SankeyChart month={month} />
            </DashboardPanel>
        </div>
    )
}
