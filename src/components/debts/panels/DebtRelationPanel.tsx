'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ExternalLink, History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    DebtAmountInline,
    DebtDirectionBadge,
    DebtInitialsAvatar,
    DebtNetAmountDisplay,
    DebtStatusBadge,
    formatDebtAmount,
} from '@/components/debts/DebtsUi'
import { getDebtOriginBadges, type DebtRelationship } from '@/lib/utils/debts-ui'
import type { IDebt } from '@/types/debt'
import type { ISpaceEntryPersonalImpact } from '@/types'

type EnrichedPendingAction = ISpaceEntryPersonalImpact & {
    entrySnapshot?: {
        title?: string
        type?: string
        amount?: number
        currency?: string
    }
}

interface DebtRelationPanelProps {
    rel: DebtRelationship
    hidden?: boolean
    highlightedDebtId?: string | null
    onViewDebt: (debt: IDebt) => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
    onNewDebt: (prefillName: string) => void
}

function idToString(id: unknown) {
    if (!id) return ''
    return typeof id === 'string' ? id : id.toString()
}

function activeDebts(debts: IDebt[]) {
    return debts.filter((debt) => debt.status === 'active' || debt.status === 'partially_paid')
}

function spaceNameFor(rel: DebtRelationship, spaceId: string) {
    const index = rel.spaceIds.indexOf(spaceId)
    return index >= 0 ? rel.spaceNames[index] ?? 'Espacio' : 'Espacio'
}

function pendingCopy(action: EnrichedPendingAction) {
    const title = action.entrySnapshot?.title ?? 'Movimiento de espacio'
    if (action.status === 'needs_review') {
        return `Revisar en tu Finp: ${title}`
    }
    if (action.actionType === 'impact_space_payment') return `Pendiente de impactar: pagaste en ${title}`
    if (action.actionType === 'impact_space_collect') return `Pendiente de impactar: cobraste en ${title}`
    return `Pendiente de impactar: ${title}`
}

function PendingActionCard({
    action,
    rel,
    hidden,
}: {
    action: EnrichedPendingAction
    rel: DebtRelationship
    hidden?: boolean
}) {
    const spaceId = idToString(action.spaceId)
    const entryId = idToString(action.entryId)
    const href = spaceId ? `/spaces/${spaceId}${entryId ? `?entryId=${entryId}` : ''}` : undefined
    const isReview = action.status === 'needs_review'
    const amount = action.amount ?? action.entrySnapshot?.amount ?? 0
    const currency = action.currency ?? action.entrySnapshot?.currency ?? 'ARS'

    return (
        <div className="rounded-xl border bg-background/70 p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <Badge
                        variant="outline"
                        className={isReview ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'}
                    >
                        {isReview ? 'Requiere revisión' : 'Pendiente'}
                    </Badge>
                    <p className="mt-2 text-sm font-medium">{pendingCopy(action)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{spaceId ? spaceNameFor(rel, spaceId) : 'Espacio'}</p>
                </div>
                <DebtAmountInline amount={amount} currency={currency} hidden={hidden} className="text-sm" />
            </div>
            {href ? (
                <Button asChild variant="ghost" size="sm" className="mt-2 h-7 px-2 text-xs">
                    <Link href={href}>
                        Ver en espacio
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </Button>
            ) : null}
        </div>
    )
}

function DebtLine({
    debt,
    hidden,
    highlighted,
    onViewDebt,
    onPay,
    onCollect,
}: {
    debt: IDebt
    hidden?: boolean
    highlighted?: boolean
    onViewDebt: (debt: IDebt) => void
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
}) {
    const isActionable = debt.status === 'active' || debt.status === 'partially_paid'

    return (
        <div className={highlighted ? 'rounded-xl border border-primary/30 bg-primary/5 p-3' : 'rounded-xl border bg-background/70 p-3'}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                        <DebtDirectionBadge direction={debt.direction} />
                        <DebtStatusBadge status={debt.status} />
                    </div>
                    <p className="mt-2 truncate text-sm font-medium">
                        {debt.notes || (debt.sourceType === 'space' ? 'Deuda de espacio' : 'Deuda manual')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {debt.direction === 'payable' ? 'Debo' : 'Me deben'}{' '}
                        {hidden ? '••••' : formatDebtAmount(debt.remainingAmount, debt.currency)}
                    </p>
                </div>
                <DebtAmountInline amount={debt.remainingAmount} currency={debt.currency} hidden={hidden} className="text-sm" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                {isActionable && debt.direction === 'payable' ? (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onPay(debt)}>
                        Pagar
                    </Button>
                ) : null}
                {isActionable && debt.direction === 'receivable' ? (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onCollect(debt)}>
                        Cobrar
                    </Button>
                ) : null}
                <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={() => onViewDebt(debt)}>
                    Ver detalle
                    <ArrowRight className="h-3 w-3" />
                </Button>
            </div>
        </div>
    )
}

export function DebtRelationPanel({
    rel,
    hidden,
    highlightedDebtId,
    onViewDebt,
    onPay,
    onCollect,
    onNewDebt,
}: DebtRelationPanelProps) {
    const [showHistory, setShowHistory] = useState(false)
    const originBadges = getDebtOriginBadges(rel)
    const actionables = activeDebts(rel.debts)
    const history = rel.debts.filter((debt) => !actionables.includes(debt))
    const spaceDebts = actionables.filter((debt) => debt.sourceType === 'space')
    const manualDebts = actionables.filter((debt) => debt.sourceType === 'manual')
    const allActions = [...rel.pendingActions, ...rel.needsReviewActions] as EnrichedPendingAction[]

    const firstPayable = actionables.find((debt) => debt.direction === 'payable')
    const firstReceivable = actionables.find((debt) => debt.direction === 'receivable')

    const groupedSpaceDebts = spaceDebts.reduce<Record<string, IDebt[]>>((acc, debt) => {
        const spaceId = idToString(debt.spaceId) || 'space'
        acc[spaceId] = [...(acc[spaceId] ?? []), debt]
        return acc
    }, {})

    return (
        <div className="flex h-full min-h-0 flex-col bg-card">
            <div className="border-b p-4 md:p-5">
                <div className="flex items-start gap-3">
                    <DebtInitialsAvatar name={rel.name} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-semibold">{rel.name}</h2>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {originBadges.map((badge) => (
                                <Badge key={badge} variant="outline" className="rounded-full border-border bg-background/80 px-2 py-0 text-[11px] text-muted-foreground">
                                    {badge}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border bg-background/70 p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Estado neto</p>
                    <DebtNetAmountDisplay netByCurrency={rel.netByCurrency} hidden={hidden} mode="stacked" className="mt-2" />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button size="sm" variant="outline" disabled={!firstPayable} onClick={() => firstPayable && onPay(firstPayable)}>
                        Pagar
                    </Button>
                    <Button size="sm" variant="outline" disabled={!firstReceivable} onClick={() => firstReceivable && onCollect(firstReceivable)}>
                        Cobrar
                    </Button>
                    <Button size="sm" onClick={() => onNewDebt(rel.name)}>
                        <Plus className="h-3.5 w-3.5" />
                        Nueva
                    </Button>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
                <div className="space-y-5">
                    {allActions.length > 0 ? (
                        <section>
                            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Pendientes / Requieren revisión</p>
                            <div className="space-y-2">
                                {allActions.map((action) => (
                                    <PendingActionCard key={idToString(action._id)} action={action} rel={rel} hidden={hidden} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {Object.entries(groupedSpaceDebts).map(([spaceId, debts]) => (
                        <section key={spaceId}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">{spaceNameFor(rel, spaceId)}</p>
                                {spaceId !== 'space' ? (
                                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                        <Link href={`/spaces/${spaceId}`}>
                                            Ver en espacio
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    </Button>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                {debts.map((debt) => (
                                    <DebtLine
                                        key={idToString(debt._id)}
                                        debt={debt}
                                        hidden={hidden}
                                        highlighted={highlightedDebtId === idToString(debt._id)}
                                        onViewDebt={onViewDebt}
                                        onPay={onPay}
                                        onCollect={onCollect}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}

                    {manualDebts.length > 0 ? (
                        <section>
                            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Manuales</p>
                            <div className="space-y-2">
                                {manualDebts.map((debt) => (
                                    <DebtLine
                                        key={idToString(debt._id)}
                                        debt={debt}
                                        hidden={hidden}
                                        highlighted={highlightedDebtId === idToString(debt._id)}
                                        onViewDebt={onViewDebt}
                                        onPay={onPay}
                                        onCollect={onCollect}
                                    />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {actionables.length === 0 && allActions.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">Sin saldo pendiente con esta persona.</p>
                    ) : null}

                    {history.length > 0 ? (
                        <section>
                            <Separator className="mb-3" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => setShowHistory((value) => !value)}
                            >
                                <History className="h-3.5 w-3.5" />
                                {showHistory ? 'Ocultar historial' : 'Expandir historial'}
                            </Button>
                            {showHistory ? (
                                <div className="mt-2 space-y-2">
                                    {history.map((debt) => (
                                        <DebtLine
                                            key={idToString(debt._id)}
                                            debt={debt}
                                            hidden={hidden}
                                            highlighted={highlightedDebtId === idToString(debt._id)}
                                            onViewDebt={onViewDebt}
                                            onPay={onPay}
                                            onCollect={onCollect}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
