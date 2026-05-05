'use client'

import { useState } from 'react'
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

function buildDirectPayments(balances: SpaceBalanceItem[]) {
    const debtors = balances.filter((b) => b.balanceReporting < -0.01)
    const creditors = balances.filter((b) => b.balanceReporting > 0.01)
    const totalCredit = creditors.reduce((sum, c) => sum + c.balanceReporting, 0)
    const payments: Array<{ from: SpaceBalanceItem; to: SpaceBalanceItem; amount: number }> = []
    if (totalCredit <= 0) return payments
    for (const debtor of debtors) {
        const debt = Math.abs(debtor.balanceReporting)
        for (const creditor of creditors) {
            const proportion = creditor.balanceReporting / totalCredit
            const amount = Math.round(debt * proportion * 100) / 100
            if (amount > 0.01) payments.push({ from: debtor, to: creditor, amount })
        }
    }
    return payments
}

export function buildRecommendedPayments(balances: SpaceBalanceItem[]) {
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
            title: 'Todo saldado',
            amount: 0,
            tone: 'neutral' as const,
            detail: 'No hay deudas pendientes en este espacio.',
        }
    }

    const isDebt = current.balanceReporting < 0
    const counterpart = balances.find((item) =>
        isDebt ? item.balanceReporting > 0 : item.balanceReporting < 0
    )
    const amount = Math.abs(current.balanceReporting)

    return {
        eyebrow: isDebt ? 'Por pagar' : 'Por cobrar',
        title: isDebt ? 'Debés' : 'Te deben',
        amount,
        tone: isDebt ? ('negative' as const) : ('positive' as const),
        detail: isDebt
            ? counterpart
                ? `Debés $${amount.toLocaleString()} ARS. Podés registrar un pago parcial o total.`
                : 'Podés registrar un pago parcial o total.'
            : counterpart
                ? `${counterpart.displayName} tiene un saldo pendiente con vos.`
                : 'Tenés saldo pendiente en este espacio.',
    }
}

export function SpaceBalanceSection({
    balances,
    entries = [],
    currency,
    hidden,
    currentUserId,
    simplifyDebts,
    onRegisterSettlement,
    onViewAllSettlements,
    onCreateSettlementDirect,
}: {
    balances: SpaceBalanceItem[]
    entries?: ISpaceEntry[]
    currency: string
    hidden: boolean
    currentUserId: string
    simplifyDebts?: boolean
    onRegisterSettlement?: (prefill?: { payerId: string; receiverId: string; amount: number }) => void
    onViewAllSettlements?: () => void
    onCreateSettlementDirect?: (payerId: string, receiverId: string, amount: number) => Promise<void>
}) {
    const activeParticipantCount = balances.length
    const defaultSimplified = simplifyDebts === true || (simplifyDebts === undefined && activeParticipantCount >= 3)
    const [showSimplified, setShowSimplified] = useState(defaultSimplified)
    const [confirmingPayment, setConfirmingPayment] = useState<{
        from: SpaceBalanceItem
        to: SpaceBalanceItem
        amount: number
    } | null>(null)
    const [confirmingBusy, setConfirmingBusy] = useState(false)
    const recommendedPayments = buildRecommendedPayments(balances)
    const directPayments = buildDirectPayments(balances)
    const settlementEntries = entries.filter((entry) => entry.type === 'settlement').slice(0, 5)
    const userSummary = buildUserBalanceSummary(balances, currentUserId)


    async function handleConfirmDirect() {
        if (!confirmingPayment || !onCreateSettlementDirect) return
        setConfirmingBusy(true)
        try {
            await onCreateSettlementDirect(
                confirmingPayment.from.participantId,
                confirmingPayment.to.participantId,
                confirmingPayment.amount,
            )
            setConfirmingPayment(null)
        } finally {
            setConfirmingBusy(false)
        }
    }

    return (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <div className="order-2 space-y-5 xl:order-1">
                <SpaceSurface>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <SpaceSectionHeading
                            eyebrow="Pagos recomendados"
                            title="Cómo saldar el espacio"
                            description="Pagos sugeridos para saldar el espacio."
                        />
                        {activeParticipantCount >= 3 ? (
                            <div className="flex shrink-0 overflow-hidden rounded-full border border-border bg-background/80 text-xs font-medium">
                                <button
                                    type="button"
                                    onClick={() => setShowSimplified(true)}
                                    className={showSimplified ? 'bg-primary/10 px-3 py-1.5 text-primary' : 'px-3 py-1.5 text-muted-foreground hover:text-foreground'}
                                >
                                    Simplificada
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSimplified(false)}
                                    className={!showSimplified ? 'bg-primary/10 px-3 py-1.5 text-primary' : 'px-3 py-1.5 text-muted-foreground hover:text-foreground'}
                                >
                                    Directa
                                </button>
                            </div>
                        ) : null}
                    </div>
                    {activeParticipantCount >= 3 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                            Finp minimiza pagos cuando la simplificación está activada.
                        </p>
                    ) : null}
                    <div className={`mt-4 space-y-1 ${recommendedPayments.length >= 4 ? 'max-h-60 overflow-y-auto pr-1' : ''}`}>
                        {!showSimplified ? directPayments.length > 0 ? (
                            <>
                                {directPayments.map((payment) => (
                                    <div
                                        key={`d-${payment.from.participantId}-${payment.to.participantId}`}
                                        className="flex items-center gap-2 rounded-xl px-2 py-2"
                                    >
                                        <SpaceInitialsAvatar name={payment.from.displayName} className="h-7 w-7 shrink-0 text-[10px]" />
                                        <span className="min-w-0 max-w-[5rem] truncate text-sm font-medium text-foreground">
                                            {payment.from.displayName}
                                        </span>
                                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <SpaceInitialsAvatar name={payment.to.displayName} className="h-7 w-7 shrink-0 text-[10px]" />
                                        <span className="min-w-0 max-w-[5rem] truncate text-sm font-medium text-foreground">
                                            {payment.to.displayName}
                                        </span>
                                        <div className="ml-auto shrink-0">
                                            <SpaceAmountInline
                                                amount={payment.amount}
                                                currency={currency}
                                                hidden={hidden}
                                                className="text-sm font-semibold"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="rounded-[24px] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                                No hay deudas directas para mostrar.
                            </div>
                        ) : recommendedPayments.length > 0 ? (
                            <>
                                {recommendedPayments.map((payment) => {
                                    const isConfirming =
                                        confirmingPayment?.from.participantId === payment.from.participantId &&
                                        confirmingPayment?.to.participantId === payment.to.participantId
                                    return (
                                        <div
                                            key={`${payment.from.participantId}-${payment.to.participantId}`}
                                            className={`flex items-center gap-2 rounded-xl px-2 py-2 transition-colors ${isConfirming ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                                        >
                                            <SpaceInitialsAvatar name={payment.from.displayName} className="h-7 w-7 shrink-0 text-[10px]" />
                                            <span className="min-w-0 max-w-[5rem] truncate text-sm font-medium text-foreground">
                                                {payment.from.displayName}
                                            </span>
                                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <SpaceInitialsAvatar name={payment.to.displayName} className="h-7 w-7 shrink-0 text-[10px]" />
                                            <span className="min-w-0 max-w-[5rem] truncate text-sm font-medium text-foreground">
                                                {payment.to.displayName}
                                            </span>
                                            <div className="ml-auto flex shrink-0 items-center gap-2">
                                                <SpaceAmountInline
                                                    amount={payment.amount}
                                                    currency={currency}
                                                    hidden={hidden}
                                                    className="text-sm font-semibold"
                                                />
                                                {onCreateSettlementDirect ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 rounded-full px-3 text-xs"
                                                        disabled={confirmingBusy}
                                                        onClick={() => setConfirmingPayment(isConfirming ? null : payment)}
                                                    >
                                                        {isConfirming ? 'Cancelar' : 'Pagar'}
                                                    </Button>
                                                ) : onRegisterSettlement ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 rounded-full px-3 text-xs"
                                                        onClick={() => onRegisterSettlement({
                                                            payerId: payment.from.participantId,
                                                            receiverId: payment.to.participantId,
                                                            amount: payment.amount,
                                                        })}
                                                    >
                                                        Registrar
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>
                                    )
                                })}
                                {confirmingPayment ? (
                                    <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                        <p className="text-sm font-semibold text-foreground">Confirmar pago</p>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                            <span className="font-medium text-foreground">{confirmingPayment.from.displayName}</span>
                                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="font-medium text-foreground">{confirmingPayment.to.displayName}</span>
                                            <span className="ml-auto">
                                                <SpaceAmountInline
                                                    amount={confirmingPayment.amount}
                                                    currency={currency}
                                                    hidden={hidden}
                                                    className="text-sm font-semibold"
                                                />
                                            </span>
                                        </div>
                                        <div className="mt-3 flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="rounded-full"
                                                onClick={() => setConfirmingPayment(null)}
                                                disabled={confirmingBusy}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="rounded-full"
                                                onClick={handleConfirmDirect}
                                                disabled={confirmingBusy}
                                            >
                                                {confirmingBusy ? 'Registrando…' : 'Confirmar pago'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </>
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
                                            <p className="text-xs text-muted-foreground">
                                                {isSettled ? 'Equilibrado' : positive ? 'Le deben' : 'Debe'}
                                            </p>
                                            <SpaceAmountInline
                                                amount={netAmount}
                                                currency={currency}
                                                hidden={hidden}
                                                color={netColor}
                                                className="mt-1 block font-semibold"
                                            />
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

            <aside className="order-1 space-y-5 xl:order-2">
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
                        {onRegisterSettlement ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3 w-full rounded-full"
                                onClick={() => onRegisterSettlement()}
                            >
                                Registrar pago
                            </Button>
                        ) : null}
                    </div>
                </SpaceSurface>

                <SpaceSurface>
                    <div className="flex items-start justify-between gap-3">
                        <SpaceSectionHeading eyebrow="Pagos" title="Últimos registrados" />
                        {settlementEntries.length > 0 && onViewAllSettlements ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                                onClick={onViewAllSettlements}
                            >
                                Ver todos
                            </Button>
                        ) : null}
                    </div>
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
