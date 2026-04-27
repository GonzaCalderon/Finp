'use client'

import { ArrowRight, HandCoins, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    SpaceAmountInline,
    SpaceEntryStatusBadge,
    SpaceInitialsAvatar,
    SpaceInviteStatusBadge,
    SpaceRoleBadge,
    SpaceSectionHeading,
    SpaceSurface,
} from '@/components/spaces/SpaceUi'
import { extractId, formatSpaceDate } from '@/lib/utils/spaces'
import type { ISpaceEntry, SpaceBalanceItem } from '@/types'

function buildRecommendedPayments(balances: SpaceBalanceItem[]) {
    const debtors = balances
        .filter((item) => item.balanceReporting < 0)
        .map((item) => ({ ...item, pending: Math.abs(item.balanceReporting) }))
        .sort((a, b) => b.pending - a.pending)
    const creditors = balances
        .filter((item) => item.balanceReporting > 0)
        .map((item) => ({ ...item, pending: item.balanceReporting }))
        .sort((a, b) => b.pending - a.pending)
    const payments: Array<{ from: SpaceBalanceItem; to: SpaceBalanceItem; amount: number }> = []

    let debtorIndex = 0
    let creditorIndex = 0
    while (debtors[debtorIndex] && creditors[creditorIndex]) {
        const debtor = debtors[debtorIndex]
        const creditor = creditors[creditorIndex]
        const amount = Math.min(debtor.pending, creditor.pending)

        if (amount > 0) payments.push({ from: debtor, to: creditor, amount })

        debtor.pending -= amount
        creditor.pending -= amount
        if (debtor.pending <= 0.01) debtorIndex += 1
        if (creditor.pending <= 0.01) creditorIndex += 1
    }

    return payments
}

function buildUserBalanceSummary(balances: SpaceBalanceItem[], currentUserId: string) {
    const current = balances.find((item) => item.userId === currentUserId)
    if (!current || Math.abs(current.balanceReporting) <= 0.01) {
        return {
            eyebrow: '',
            title: 'Estás al día',
            amount: 0,
            tone: 'neutral' as const,
            detail: 'No tenés saldo pendiente en este espacio.',
        }
    }

    const isDebt = current.balanceReporting < 0
    const counterpart = balances.find((item) =>
        isDebt ? item.balanceReporting > 0 : item.balanceReporting < 0
    )
    const amount = counterpart
        ? Math.min(Math.abs(current.balanceReporting), Math.abs(counterpart.balanceReporting))
        : Math.abs(current.balanceReporting)

    return {
        eyebrow: isDebt ? 'Por pagar' : 'Por cobrar',
        title: counterpart
            ? isDebt
                ? `Pago pendiente con ${counterpart.displayName}`
                : `Cobro pendiente con ${counterpart.displayName}`
            : isDebt
                ? 'Tenés un pago pendiente'
                : 'Tenés un cobro pendiente',
        amount,
        tone: isDebt ? ('negative' as const) : ('positive' as const),
        detail: isDebt
            ? 'Este es el pago más relevante para equilibrar tu saldo.'
            : 'Este es el cobro más relevante para equilibrar tu saldo.',
    }
}

export function SpaceBalanceSection({
    balances,
    entries = [],
    currency,
    hidden,
    currentUserId,
}: {
    balances: SpaceBalanceItem[]
    entries?: ISpaceEntry[]
    currency: string
    hidden: boolean
    currentUserId: string
}) {
    const recommendedPayments = buildRecommendedPayments(balances)
    const settlementEntries = entries.filter((entry) => entry.type === 'settlement').slice(0, 5)
    const userSummary = buildUserBalanceSummary(balances, currentUserId)

    return (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <div className="space-y-5">
                <SpaceSurface>
                    <SpaceSectionHeading
                        eyebrow="Pagos recomendados"
                        title="Cómo saldar el espacio"
                        description="Pagos mínimos sugeridos para equilibrar lo que cada participante tiene pendiente o por cobrar."
                    />
                    <div className="mt-4 space-y-2">
                        {recommendedPayments.length > 0 ? (
                            recommendedPayments.map((payment) => (
                                <div
                                    key={`${payment.from.participantId}-${payment.to.participantId}`}
                                    className="flex flex-col gap-3 border-b border-border/70 pb-3 last:border-b-0 md:flex-row md:items-center md:justify-between"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <SpaceInitialsAvatar name={payment.from.displayName} className="h-9 w-9" />
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {payment.from.displayName}
                                        </span>
                                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <SpaceInitialsAvatar name={payment.to.displayName} className="h-9 w-9" />
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {payment.to.displayName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 md:justify-end">
                                        <SpaceAmountInline
                                            amount={payment.amount}
                                            currency={currency}
                                            hidden={hidden}
                                            className="text-sm font-semibold"
                                        />
                                        <Button size="sm" variant="outline" className="rounded-full">
                                            Registrar
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                                No hay pagos recomendados por ahora.
                            </div>
                        )}
                    </div>
                </SpaceSurface>

                <SpaceSurface>
                    <SpaceSectionHeading eyebrow="Participantes" title="Balance por persona" />
                    <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                        {balances.length > 0 ? balances.map((balance) => {
                            const isCurrent = balance.userId === currentUserId
                            const netAmount = Math.abs(balance.balanceReporting)
                            const isSettled = netAmount <= 0.01
                            const positive = balance.balanceReporting > 0
                            const netColor = isSettled
                                ? 'var(--muted-foreground)'
                                : positive
                                    ? 'var(--chart-3)'
                                    : 'var(--destructive)'
                            const netLabel = isSettled ? 'Sin pendiente' : positive ? 'Por cobrar' : 'Por pagar'
                            const netDescription = isSettled
                                ? 'Sin movimientos pendientes'
                                : positive
                                    ? 'Monto pendiente de cobro'
                                    : 'Monto pendiente de pago'

                            return (
                                <div
                                    key={balance.participantId}
                                    className="rounded-2xl border border-foreground/[0.08] bg-background/58 p-4 transition-colors hover:border-foreground/[0.14]"
                                    style={{
                                        background: 'color-mix(in srgb, var(--background) 72%, var(--card))',
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <SpaceInitialsAvatar name={balance.displayName} className="h-11 w-11 text-sm" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="truncate text-base font-semibold text-foreground">{balance.displayName}</p>
                                                    {isCurrent ? (
                                                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                                            Vos
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1 flex flex-wrap gap-1.5">
                                                    <SpaceRoleBadge role={balance.role} />
                                                    <SpaceInviteStatusBadge status={balance.inviteStatus} />
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                                            style={{
                                                background: isSettled
                                                    ? 'color-mix(in srgb, var(--muted) 70%, transparent)'
                                                    : positive
                                                        ? 'color-mix(in srgb, var(--chart-3) 14%, transparent)'
                                                        : 'color-mix(in srgb, var(--destructive) 12%, transparent)',
                                                color: netColor,
                                            }}
                                        >
                                            {netLabel}
                                        </div>
                                    </div>

                                    <div className="mt-4 border-t border-border/70 pt-3">
                                        <div className="flex items-end justify-between gap-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Balance</p>
                                                <p className="mt-1 text-xs text-muted-foreground">{netDescription}</p>
                                            </div>
                                            <SpaceAmountInline
                                                amount={netAmount}
                                                currency={currency}
                                                hidden={hidden}
                                                color={netColor}
                                                className="text-right text-xl font-semibold tracking-tight"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 divide-x divide-border/70 border-t border-border/70 pt-3 text-sm">
                                        <div className="pr-3">
                                            <p className="text-xs text-muted-foreground">Pagó</p>
                                            <SpaceAmountInline amount={balance.paidReporting} currency={currency} hidden={hidden} className="mt-1 block font-semibold" />
                                        </div>
                                        <div className="pl-3">
                                            <p className="text-xs text-muted-foreground">Parte</p>
                                            <SpaceAmountInline amount={balance.shareReporting} currency={currency} hidden={hidden} className="mt-1 block font-semibold" />
                                        </div>
                                    </div>
                                </div>
                            )
                        }) : (
                            <div className="rounded-[24px] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground lg:col-span-2 2xl:col-span-3">
                                <Users className="mx-auto mb-3 h-5 w-5" />
                                Todavía no hay participantes con saldo para mostrar.
                            </div>
                        )}
                    </div>
                </SpaceSurface>
            </div>

            <aside className="space-y-5">
                <SpaceSurface>
                    <SpaceSectionHeading eyebrow="Balance" title="Resumen" />
                    <div className="mt-4 space-y-4">
                        <div>
                            {userSummary.eyebrow ? (
                                <p
                                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                    style={{
                                        color: userSummary.tone === 'negative'
                                            ? 'var(--destructive)'
                                            : userSummary.tone === 'positive'
                                                ? 'var(--chart-3)'
                                                : 'var(--muted-foreground)',
                                    }}
                                >
                                    {userSummary.eyebrow}
                                </p>
                            ) : null}
                            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                                {userSummary.title}
                            </p>
                            <SpaceAmountInline
                                amount={userSummary.amount}
                                currency={currency}
                                hidden={hidden}
                                color={userSummary.tone === 'negative' ? 'var(--destructive)' : userSummary.tone === 'positive' ? 'var(--chart-3)' : undefined}
                                className="mt-2 block text-3xl font-semibold tracking-tight"
                            />
                            <p className="mt-2 text-sm text-muted-foreground">{userSummary.detail}</p>
                        </div>
                    </div>
                </SpaceSurface>

                <SpaceSurface>
                    <SpaceSectionHeading eyebrow="Pagos" title="Últimos registrados" />
                    <div className="mt-4 space-y-3">
                        {settlementEntries.length > 0 ? settlementEntries.map((entry) => (
                            <div key={extractId(entry._id)} className="border-b border-border/70 pb-3 last:border-b-0">
                                <div className="flex items-center gap-2">
                                    <HandCoins className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <span className="text-xs text-muted-foreground">{formatSpaceDate(entry.date)}</span>
                                    <SpaceAmountInline amount={entry.reportingAmount} currency={currency} hidden={hidden} className="text-sm font-semibold" />
                                </div>
                                <div className="mt-2">
                                    <SpaceEntryStatusBadge status={entry.status} />
                                </div>
                            </div>
                        )) : (
                            <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                                Todavía no hay pagos registrados.
                            </div>
                        )}
                    </div>
                </SpaceSurface>
            </aside>
        </div>
    )
}
