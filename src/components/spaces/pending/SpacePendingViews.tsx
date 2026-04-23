'use client'

import { useMemo, useState } from 'react'
import {
    Bell,
    CheckCircle2,
    FileText,
    HandCoins,
    Paperclip,
    ShieldCheck,
    UserPlus,
    Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
    SpaceAmountInline,
    SpaceEntryTypeBadge,
    SpaceMetaBadge,
    SpaceModeBadge,
    SpaceSectionHeading,
    SpaceSurface,
    SpaceTypeBadge,
} from '@/components/spaces/SpaceUi'
import {
    SPACE_ROLE_LABELS,
    extractId,
    formatSpaceDate,
} from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpacePendingAction } from '@/types'

export type PendingViewFilter = 'all' | 'invite' | 'confirmation' | 'settlement'

type PendingActionHandlers = {
    onAcceptInvite: (action: Extract<ISpacePendingAction, { kind: 'invite' }>) => void
    onRejectInvite: (action: Extract<ISpacePendingAction, { kind: 'invite' }>) => void
    onReviewConfirmation: (action: Extract<ISpacePendingAction, { kind: 'confirmation' }>) => void
    onRejectConfirmation: (action: Extract<ISpacePendingAction, { kind: 'confirmation' }>) => void
}

const PENDING_FILTER_LABELS: Record<PendingViewFilter, string> = {
    all: 'Todos',
    invite: 'Invitaciones',
    confirmation: 'Confirmaciones',
    settlement: 'Liquidaciones',
}

function isSettlementConfirmation(action: ISpacePendingAction) {
    return action.kind === 'confirmation' && action.entry.type === 'settlement'
}

function matchesFilter(action: ISpacePendingAction, filter: PendingViewFilter) {
    if (filter === 'all') return true
    if (filter === 'invite') return action.kind === 'invite'
    if (filter === 'settlement') return isSettlementConfirmation(action)
    return action.kind === 'confirmation' && action.entry.type !== 'settlement'
}

function pendingActionKey(action: ISpacePendingAction, prefix = 'pending') {
    return action.kind === 'invite'
        ? `${prefix}-invite-${extractId(action.invite._id)}`
        : `${prefix}-confirmation-${extractId(action.entry._id)}`
}

function PendingFilterBar({
    actions,
    value,
    onChange,
}: {
    actions: ISpacePendingAction[]
    value: PendingViewFilter
    onChange: (value: PendingViewFilter) => void
}) {
    const counts = useMemo(
        () => ({
            all: actions.length,
            invite: actions.filter((item) => item.kind === 'invite').length,
            confirmation: actions.filter(
                (item) => item.kind === 'confirmation' && item.entry.type !== 'settlement'
            ).length,
            settlement: actions.filter((item) => isSettlementConfirmation(item)).length,
        }),
        [actions]
    )

    return (
        <div className="flex flex-wrap gap-2">
            {(Object.keys(PENDING_FILTER_LABELS) as PendingViewFilter[]).map((filter) => (
                <button
                    key={filter}
                    type="button"
                    onClick={() => onChange(filter)}
                    className={[
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                        value === filter
                            ? 'border-primary/20 bg-primary/10 text-primary'
                            : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                >
                    <span>{PENDING_FILTER_LABELS[filter]}</span>
                    <span
                        className={[
                            'rounded-full px-2 py-0.5 text-[11px]',
                            value === filter ? 'bg-primary/12 text-primary' : 'bg-secondary text-secondary-foreground',
                        ].join(' ')}
                    >
                        {counts[filter]}
                    </span>
                </button>
            ))}
        </div>
    )
}

function PendingInviteCard({
    action,
    compact = false,
    onAcceptInvite,
    onRejectInvite,
}: {
    action: Extract<ISpacePendingAction, { kind: 'invite' }>
    compact?: boolean
} & Pick<PendingActionHandlers, 'onAcceptInvite' | 'onRejectInvite'>) {
    return (
        <div className="rounded-[28px] border border-foreground/[0.07] bg-background/72 p-4 backdrop-blur-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                            <UserPlus className="h-3.5 w-3.5" />
                            Invitación
                        </div>
                        <SpaceTypeBadge type={action.space.type} />
                        <SpaceModeBadge mode={action.space.mode} />
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-lg font-semibold tracking-tight">
                            Sumarte a {action.space.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {action.invitedByName} te invitó a participar como{' '}
                            {SPACE_ROLE_LABELS[action.participant.role].toLowerCase()}.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SpaceMetaBadge icon={ShieldCheck}>
                            {SPACE_ROLE_LABELS[action.participant.role]}
                        </SpaceMetaBadge>
                        <SpaceMetaBadge icon={Wallet}>
                            {action.space.currencies.join(' / ')}
                        </SpaceMetaBadge>
                    </div>
                </div>

                <div className={compact ? 'flex gap-2' : 'flex flex-col gap-2 sm:flex-row lg:min-w-[220px] lg:justify-end'}>
                    <Button variant="outline" className="rounded-full" onClick={() => onRejectInvite(action)}>
                        Rechazar
                    </Button>
                    <Button className="rounded-full" onClick={() => onAcceptInvite(action)}>
                        Aceptar
                    </Button>
                </div>
            </div>
        </div>
    )
}

function PendingConfirmationCard({
    action,
    compact = false,
    onReviewConfirmation,
    onRejectConfirmation,
}: {
    action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    compact?: boolean
} & Pick<PendingActionHandlers, 'onReviewConfirmation' | 'onRejectConfirmation'>) {
    const attachmentCount = action.entry.attachments?.length ?? 0
    const label = action.entry.type === 'settlement' ? 'Liquidación' : 'Confirmación'

    return (
        <div className="rounded-[28px] border border-foreground/[0.07] bg-background/72 p-4 backdrop-blur-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
                            style={{
                                background:
                                    action.entry.type === 'settlement'
                                        ? 'rgba(74,158,204,0.14)'
                                        : 'rgba(212,160,23,0.14)',
                                color: action.entry.type === 'settlement' ? 'var(--sky)' : '#A67C00',
                            }}
                        >
                            {action.entry.type === 'settlement' ? (
                                <HandCoins className="h-3.5 w-3.5" />
                            ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            {label}
                        </div>
                        <SpaceEntryTypeBadge type={action.entry.type} />
                        <SpaceTypeBadge type={action.space.type} />
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-lg font-semibold tracking-tight">
                            Revisá “{action.entry.title}”
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {action.requestedByParticipant?.displayName ?? 'Un participante'} te marcó como pagador dentro de {action.space.name}.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SpaceMetaBadge icon={Wallet}>
                            <SpaceAmountInline
                                amount={action.entry.amount}
                                currency={action.entry.currency}
                                hidden={false}
                                className="font-semibold"
                            />
                        </SpaceMetaBadge>
                        <SpaceMetaBadge icon={FileText}>{formatSpaceDate(action.entry.date)}</SpaceMetaBadge>
                        {attachmentCount > 0 ? (
                            <SpaceMetaBadge icon={Paperclip}>
                                {attachmentCount} comprobante{attachmentCount > 1 ? 's' : ''}
                            </SpaceMetaBadge>
                        ) : null}
                    </div>
                </div>

                <div className={compact ? 'flex gap-2' : 'flex flex-col gap-2 sm:flex-row lg:min-w-[220px] lg:justify-end'}>
                    <Button variant="outline" className="rounded-full" onClick={() => onRejectConfirmation(action)}>
                        Rechazar
                    </Button>
                    <Button className="rounded-full" onClick={() => onReviewConfirmation(action)}>
                        Revisar
                    </Button>
                </div>
            </div>
        </div>
    )
}

function PendingActionCard(props: { action: ISpacePendingAction; compact?: boolean } & PendingActionHandlers) {
    if (props.action.kind === 'invite') {
        return (
            <PendingInviteCard
                action={props.action}
                compact={props.compact}
                onAcceptInvite={props.onAcceptInvite}
                onRejectInvite={props.onRejectInvite}
            />
        )
    }

    return (
        <PendingConfirmationCard
            action={props.action}
            compact={props.compact}
            onReviewConfirmation={props.onReviewConfirmation}
            onRejectConfirmation={props.onRejectConfirmation}
        />
    )
}

export function RecentPendingPanel({
    actions,
    loading,
    onShowAll,
    ...handlers
}: {
    actions: ISpacePendingAction[]
    loading: boolean
    onShowAll: () => void
} & PendingActionHandlers) {
    const recentActions = actions.slice(0, 4)

    return (
        <SpaceSurface accent="var(--chart-2)">
            <SpaceSectionHeading
                eyebrow="Pendientes"
                title="Pendientes recientes"
                description="Invitaciones, confirmaciones y liquidaciones que hoy requieren una acción tuya."
                action={
                    <Button variant="ghost" className="rounded-full" onClick={onShowAll}>
                        Ver todos
                    </Button>
                }
            />

            <div className="mt-5 space-y-3">
                {loading ? (
                    <>
                        <Skeleton className="h-32 rounded-[28px]" />
                        <Skeleton className="h-32 rounded-[28px]" />
                    </>
                ) : recentActions.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground">
                        No hay pendientes por resolver ahora mismo.
                    </div>
                ) : (
                    recentActions.map((action) => (
                        <PendingActionCard
                            key={pendingActionKey(action)}
                            action={action}
                            compact
                            {...handlers}
                        />
                    ))
                )}
            </div>
        </SpaceSurface>
    )
}

export function SpacesPendingDialog({
    open,
    onOpenChange,
    actions,
    loading,
    ...handlers
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    actions: ISpacePendingAction[]
    loading: boolean
} & PendingActionHandlers) {
    const [filter, setFilter] = useState<PendingViewFilter>('all')
    const filteredActions = useMemo(
        () => actions.filter((action) => matchesFilter(action, filter)),
        [actions, filter]
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[960px] gap-0 overflow-hidden p-0 sm:max-h-[92vh] sm:max-w-[960px]"
            >
                <div className="flex h-full flex-col">
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl tracking-tight">Pendientes</DialogTitle>
                            <DialogDescription>
                                Revisá invitaciones, confirmaciones y liquidaciones pendientes dentro de tus espacios.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="mt-4">
                            <PendingFilterBar actions={actions} value={filter} onChange={setFilter} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        {loading ? (
                            <div className="space-y-3">
                                <Skeleton className="h-36 rounded-[28px]" />
                                <Skeleton className="h-36 rounded-[28px]" />
                            </div>
                        ) : filteredActions.length === 0 ? (
                            <SpaceSurface accent="var(--chart-2)" padding="p-6">
                                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                        <Bell className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-lg font-semibold tracking-tight">
                                            Nada pendiente en {PENDING_FILTER_LABELS[filter].toLowerCase()}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Cuando aparezcan acciones nuevas dentro de tus espacios, las vas a ver acá.
                                        </p>
                                    </div>
                                </div>
                            </SpaceSurface>
                        ) : (
                            <div className="space-y-3">
                                {filteredActions.map((action) => (
                                    <PendingActionCard
                                        key={pendingActionKey(action, 'dialog')}
                                        action={action}
                                        {...handlers}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function isPendingSettlementEntry(entry: ISpaceEntry) {
    return entry.type === 'settlement'
}
