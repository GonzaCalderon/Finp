'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { SankeyChart } from '@/components/shared/SankeyChart'
import { DashboardCardVisual } from '@/components/dashboard/DashboardCardVisual'
import {
    DashboardAccountsList,
    DashboardCommitmentsList,
    DashboardInstallmentsList,
    DashboardMetricLinkCard,
    DashboardPanel,
    DashboardRecentTransactionsList,
    DashboardTopCategoriesList,
    TrendBadge,
} from '@/components/dashboard/DashboardShared'
import { getPeriodMonthLabel } from '@/components/dashboard/dashboard-utils'
import type { DashboardViewProps } from '@/components/dashboard/types'
import { fadeIn } from '@/lib/utils/animations'

function MetricSupportingRow({
    label,
    value,
    hidden,
    currency,
}: {
    label: string
    value: number
    hidden: boolean
    currency: 'ARS' | 'USD'
}) {
    return (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{label}</span>
            <span className="font-medium">
                {hidden
                    ? '••••'
                    : new Intl.NumberFormat('es-AR', {
                        style: 'currency',
                        currency,
                        maximumFractionDigits: 0,
                    }).format(value)}
            </span>
        </div>
    )
}

function DashboardCardCarousel({
    items,
    hidden,
    month,
}: {
    items: DashboardViewProps['data']['creditCards']
    hidden: boolean
    month: string
}) {
    const trackRef = useRef<HTMLDivElement | null>(null)
    const [canScrollPrev, setCanScrollPrev] = useState(false)
    const [canScrollNext, setCanScrollNext] = useState(items.length > 1)

    useEffect(() => {
        const node = trackRef.current
        if (!node) return

        const update = () => {
            setCanScrollPrev(node.scrollLeft > 12)
            setCanScrollNext(node.scrollLeft + node.clientWidth < node.scrollWidth - 12)
        }

        update()
        node.addEventListener('scroll', update, { passive: true })
        window.addEventListener('resize', update)

        return () => {
            node.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [items.length])

    const scrollByCard = (direction: 'prev' | 'next') => {
        const node = trackRef.current
        if (!node) return

        const firstCard = node.querySelector('[data-card-item]') as HTMLElement | null
        const cardWidth = firstCard?.offsetWidth ?? 360

        node.scrollBy({
            left: direction === 'next' ? cardWidth + 16 : -(cardWidth + 16),
            behavior: 'smooth',
        })
    }

    if (items.length === 0) {
        return (
            <div className="rounded-[28px] border border-dashed border-foreground/[0.1] bg-background/40 px-5 py-8 text-sm text-muted-foreground">
                No hay tarjetas de credito activas para este periodo.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    disabled={!canScrollPrev}
                    onClick={() => scrollByCard('prev')}
                    aria-label="Tarjeta anterior"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="rounded-full"
                    disabled={!canScrollNext}
                    onClick={() => scrollByCard('next')}
                    aria-label="Siguiente tarjeta"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div
                ref={trackRef}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pr-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {items.map((card) => (
                    <div
                        key={card.accountId}
                        data-card-item
                        className="min-w-[360px] max-w-[420px] flex-[0_0_360px] snap-start"
                    >
                        <DashboardCardVisual
                            card={card}
                            hidden={hidden}
                            href={`/transactions/credit-card?month=${month}&cardId=${card.accountId}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function DashboardDesktop({
    data,
    month,
    monthOptions,
    refreshing,
    hidden,
    onMonthChange,
    onApplyCommitment,
    appliedId,
    operationalStartConfigured,
}: DashboardViewProps) {
    const debtToIncomeRatio =
        data.summary.totalIncome.ars > 0
            ? Math.min((data.summary.totalCreditCardExpense.ars / data.summary.totalIncome.ars) * 100, 100)
            : 0

    const commitmentsToIncomeRatio =
        data.summary.totalIncome.ars > 0
            ? Math.min((data.summary.totalMonthlyCommitments.ars / data.summary.totalIncome.ars) * 100, 100)
            : 0

    const nonCreditAccounts = data.accounts.filter(
        (account) => account.type !== 'credit_card' && account.type !== 'debt'
    )
    const debtAccounts = data.accounts.filter((account) => account.type === 'debt')

    return (
        <motion.div {...fadeIn} className="space-y-6 md:space-y-7">
            {!operationalStartConfigured && (
                <DashboardPanel
                    title="Configura tu fecha de inicio"
                    actionLabel="Ir a preferencias"
                    actionHref="/settings?tab=preferencias"
                    className="bg-card/94"
                >
                    <p className="text-sm text-muted-foreground">
                        Mejora la precisión de balance, deuda y patrimonio sin perder historial.
                    </p>
                </DashboardPanel>
            )}

            <div className="grid gap-4 xl:grid-cols-[1.3fr_0.92fr]">
                <section
                    className="relative overflow-hidden rounded-[32px] border border-foreground/[0.08] p-6"
                    style={{
                        background:
                            'radial-gradient(circle at top left, color-mix(in srgb, var(--sky) 14%, transparent) 0%, transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, transparent) 0%, color-mix(in srgb, var(--card) 91%, transparent) 100%)',
                        boxShadow: 'var(--card-shadow)',
                    }}
                >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--sky)]/35 to-transparent" />

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Dashboard
                                </p>
                                <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">
                                    {getPeriodMonthLabel(month)}
                                </h1>
                                {refreshing && <p className="text-sm text-muted-foreground">Actualizando</p>}
                            </div>

                            <CurrencyBreakdownAmount
                                totals={data.summary.balance}
                                hidden={hidden}
                                primaryColor={data.summary.balance.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                secondaryColor={data.summary.balance.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                hideZeroSecondary
                                preserveSecondarySpace
                                className="text-[2.4rem] font-semibold tracking-tight"
                            />

                            <div className="flex flex-wrap gap-2">
                                <TrendBadge value={data.trends.income} />
                                <TrendBadge value={data.trends.expense} inverse />
                                <TrendBadge value={data.trends.balance} />
                                <TrendBadge value={data.trends.debt} inverse />
                            </div>

                            {debtToIncomeRatio >= 60 && (
                                <div
                                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
                                    style={{
                                        background: debtToIncomeRatio >= 80 ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                                        color: debtToIncomeRatio >= 80 ? 'var(--destructive)' : 'var(--amber)',
                                    }}
                                >
                                    Gastás el {Math.round(debtToIncomeRatio)}% de tu ingreso en tarjetas este mes
                                </div>
                            )}
                        </div>

                        <div className="rounded-[24px] border border-foreground/[0.07] bg-background/45 p-4">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Período
                            </p>
                            <Select value={month} onValueChange={onMonthChange}>
                                <SelectTrigger className="mt-3 h-10 rounded-2xl border-foreground/[0.08] bg-background/70">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {monthOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="mt-5 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Deuda / ingreso</span>
                                    <span
                                        className="font-semibold"
                                        style={{
                                            color:
                                                debtToIncomeRatio >= 80
                                                    ? 'var(--destructive)'
                                                    : debtToIncomeRatio >= 60
                                                        ? 'var(--amber)'
                                                        : 'var(--muted-foreground)',
                                        }}
                                    >
                                        {Math.round(debtToIncomeRatio)}%
                                    </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${debtToIncomeRatio}%`,
                                            background:
                                                debtToIncomeRatio >= 80
                                                    ? 'linear-gradient(90deg, var(--destructive) 0%, color-mix(in srgb, var(--destructive) 78%, white) 100%)'
                                                    : 'linear-gradient(90deg, var(--amber) 0%, color-mix(in srgb, var(--amber) 78%, white) 100%)',
                                        }}
                                    />
                                </div>
                                {debtToIncomeRatio >= 60 && (
                                    <p
                                        className="text-[11px]"
                                        style={{
                                            color: debtToIncomeRatio >= 80 ? 'var(--destructive)' : 'var(--amber)',
                                        }}
                                    >
                                        {debtToIncomeRatio >= 80 ? 'Nivel de deuda crítico' : 'Deuda elevada respecto al ingreso'}
                                    </p>
                                )}
                            </div>

                            {commitmentsToIncomeRatio > 0 && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">Compromisos / ingreso</span>
                                        <span className="font-semibold text-muted-foreground">
                                            {Math.round(commitmentsToIncomeRatio)}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${commitmentsToIncomeRatio}%`,
                                                background: 'linear-gradient(90deg, var(--sky) 0%, color-mix(in srgb, var(--sky) 70%, white) 100%)',
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="mt-5 space-y-2 text-xs text-muted-foreground">
                                <MetricSupportingRow
                                    label="Patrimonio"
                                    value={data.netWorth.total.ars}
                                    hidden={hidden}
                                    currency="ARS"
                                />
                                <MetricSupportingRow
                                    label="Deuda pendiente"
                                    value={data.summary.totalDebt.ars}
                                    hidden={hidden}
                                    currency="ARS"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <DashboardMetricLinkCard
                            title="Ingresos"
                            totals={data.summary.totalIncome}
                            hidden={hidden}
                            href={`/transactions?month=${month}&type=income`}
                            accent="#10B981"
                            primaryColor="#10B981"
                            secondaryColor="rgba(16,185,129,0.78)"
                            trend={<TrendBadge value={data.trends.income} />}
                        />
                        <DashboardMetricLinkCard
                            title="Gastos"
                            totals={data.summary.totalExpense}
                            hidden={hidden}
                            href={`/transactions?month=${month}&type=expense`}
                            accent="var(--destructive)"
                            primaryColor="var(--destructive)"
                            secondaryColor="rgba(239,68,68,0.78)"
                            supporting={
                                data.summary.totalExpense.ars > data.summary.totalIncome.ars
                                    ? <MetricSupportingRow
                                        label={`↑ ${Math.round(((data.summary.totalExpense.ars - data.summary.totalIncome.ars) / data.summary.totalIncome.ars) * 100)}% sobre el ingreso`}
                                        value={data.summary.totalExpense.ars - data.summary.totalIncome.ars}
                                        hidden={hidden}
                                        currency="ARS"
                                    />
                                    : undefined
                            }
                            trend={<TrendBadge value={data.trends.expense} inverse />}
                        />
                        <DashboardMetricLinkCard
                            title="Deuda mensual"
                            totals={data.summary.totalCreditCardExpense}
                            hidden={hidden}
                            href={`/transactions/credit-card?month=${month}&statusFilter=active`}
                            accent="var(--amber)"
                            primaryColor="var(--amber-dark)"
                            secondaryColor="rgba(234,179,8,0.78)"
                            supporting={
                                <MetricSupportingRow
                                    label="Restante"
                                    value={data.summary.totalDebt.ars}
                                    hidden={hidden}
                                    currency="ARS"
                                />
                            }
                            trend={<TrendBadge value={data.trends.debt} inverse />}
                        />
                        <DashboardMetricLinkCard
                            title="Compromisos del mes"
                            totals={data.summary.totalMonthlyCommitments}
                            hidden={hidden}
                            href="/commitments"
                            accent="var(--sky)"
                            primaryColor="var(--sky-dark)"
                            secondaryColor="rgba(96,184,224,0.78)"
                            supporting={
                                <span>
                                    {data.pendingCommitments.length === 0 ? 'Al día' : `${data.pendingCommitments.length} pendiente${data.pendingCommitments.length === 1 ? '' : 's'}`}
                                    {commitmentsToIncomeRatio > 0 && (
                                        <span className="ml-1 text-muted-foreground">
                                            · {Math.round(commitmentsToIncomeRatio)}% del ingreso
                                        </span>
                                    )}
                                </span>
                            }
                        />
                    </div>
                </section>

                <DashboardPanel
                    title="Transacciones recientes"
                    actionLabel="Ver todas"
                    actionHref={`/transactions?month=${month}`}
                    contentClassName="pt-5"
                >
                    <DashboardRecentTransactionsList
                        items={data.recentTransactions}
                        hidden={hidden}
                        month={month}
                        limit={6}
                    />
                </DashboardPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                <DashboardPanel
                    title="Tarjetas del mes"
                    actionLabel="Ir a gastos con TC"
                    actionHref={`/transactions/credit-card?month=${month}`}
                    contentClassName="pt-5"
                >
                    <DashboardCardCarousel items={data.creditCards} hidden={hidden} month={month} />
                </DashboardPanel>

                <DashboardPanel title="Top categorías">
                    <DashboardTopCategoriesList categories={data.expenseByCategory} hidden={hidden} month={month} />
                </DashboardPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
                <DashboardPanel
                    title="Flujo del mes"
                    actionLabel="Ver transacciones"
                    actionHref={`/transactions?month=${month}`}
                    contentClassName="pt-5"
                >
                    <SankeyChart month={month} />
                </DashboardPanel>

                <div className="grid gap-4">
                    <DashboardPanel
                        title="Patrimonio"
                        actionLabel="Ver cuentas"
                        actionHref="/accounts"
                    >
                        <div className="mb-4 rounded-[24px] border border-foreground/[0.06] bg-background/45 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Patrimonio</p>
                            <CurrencyBreakdownAmount
                                totals={data.netWorth.total}
                                hidden={hidden}
                                primaryColor={data.netWorth.total.ars >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                secondaryColor={data.netWorth.total.usd >= 0 ? 'var(--sky-dark)' : 'var(--destructive)'}
                                hideZeroSecondary
                                preserveSecondarySpace
                                className="mt-2 text-[1.5rem] font-semibold tracking-tight"
                            />
                        </div>

                        <DashboardAccountsList
                            accounts={nonCreditAccounts}
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
                    </DashboardPanel>
                </div>
            </div>

            <div className="grid items-start gap-4 xl:grid-cols-[0.82fr_1.18fr]">
                <DashboardPanel
                    title="Compromisos"
                    actionLabel="Gestionar"
                    actionHref="/commitments"
                >
                    <DashboardCommitmentsList
                        commitments={data.pendingCommitments}
                        appliedId={appliedId}
                        onApplyCommitment={onApplyCommitment}
                        hidden={hidden}
                    />
                </DashboardPanel>

                <DashboardPanel
                    title="Cuotas del mes"
                    actionLabel="Ver detalle"
                    actionHref={`/transactions/credit-card?month=${month}&installmentFilter=multi`}
                >
                    <div className="max-h-[760px] overflow-y-auto pr-1">
                        <DashboardInstallmentsList installments={data.installmentsThisMonth} hidden={hidden} />
                    </div>
                </DashboardPanel>
            </div>
        </motion.div>
    )
}
