'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Ban,
    Bell,
    CheckCircle2,
    FileText,
    HandCoins,
    Paperclip,
    Pencil,
    Settings,
    Shield,
    ShieldCheck,
    Tag,
    Trash2,
    UserCheck,
    UserMinus,
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useSpaceActivity } from '@/hooks/useSpaceActivity'
import { fadeInFast, springButton, staggerContainer, staggerItem } from '@/lib/utils/animations'
import {
    SpaceAmountInline,
    SpaceCurrencyStack,
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
import type { ISpaceActivityEvent, ISpaceEntry, ISpacePendingAction } from '@/types'
import type { SpaceActivityEventType } from '@/lib/constants'

export type PendingViewFilter = 'all' | 'invite' | 'confirmation' | 'settlement'

type PendingActionHandlers = {
    onAcceptInvite: (action: Extract<ISpacePendingAction, { kind: 'invite' }>) => void
    onRejectInvite: (action: Extract<ISpacePendingAction, { kind: 'invite' }>) => void
    onReviewConfirmation: (action: Extract<ISpacePendingAction, { kind: 'confirmation' }>) => void
    onRejectConfirmation: (action: Extract<ISpacePendingAction, { kind: 'confirmation' }>) => void
}

type SheetTab = 'pending' | 'activity'

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
        <div className={compact ? 'rounded-[20px] border border-foreground/[0.07] bg-background/72 p-3' : 'rounded-[28px] border border-foreground/[0.07] bg-background/72 p-4 backdrop-blur-sm'}>
            <div className={compact ? 'space-y-3' : 'flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'}>
                <div className={compact ? 'space-y-2' : 'space-y-3'}>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                            <UserPlus className="h-3.5 w-3.5" />
                            Invitación
                        </div>
                        <SpaceTypeBadge type={action.space.type} />
                        <SpaceModeBadge mode={action.space.mode} />
                    </div>

                    <div className="space-y-1.5">
                        <p className={compact ? 'text-sm font-semibold tracking-tight' : 'text-lg font-semibold tracking-tight'}>
                            Sumarte a {action.space.name}
                        </p>
                        <p className={compact ? 'line-clamp-2 text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
                            {action.invitedByName} te invitó a participar como{' '}
                            {SPACE_ROLE_LABELS[action.participant.role].toLowerCase()}.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SpaceMetaBadge icon={ShieldCheck}>
                            {SPACE_ROLE_LABELS[action.participant.role]}
                        </SpaceMetaBadge>
                        <SpaceMetaBadge icon={Wallet}>
                            <SpaceCurrencyStack currencies={action.space.currencies} />
                        </SpaceMetaBadge>
                    </div>
                </div>

                <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2 sm:flex-row lg:min-w-[220px] lg:justify-end'}>
                    <Button variant="outline" size={compact ? 'sm' : 'default'} className="rounded-full" onClick={() => onRejectInvite(action)}>
                        Rechazar
                    </Button>
                    <Button size={compact ? 'sm' : 'default'} className="rounded-full" onClick={() => onAcceptInvite(action)}>
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
        <div className={compact ? 'rounded-[20px] border border-foreground/[0.07] bg-background/72 p-3' : 'rounded-[28px] border border-foreground/[0.07] bg-background/72 p-4 backdrop-blur-sm'}>
            <div className={compact ? 'space-y-3' : 'flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'}>
                <div className={compact ? 'space-y-2' : 'space-y-3'}>
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
                        <p className={compact ? 'text-sm font-semibold tracking-tight' : 'text-lg font-semibold tracking-tight'}>
                            Revisá “{action.entry.title}”
                        </p>
                        <p className={compact ? 'line-clamp-2 text-xs text-muted-foreground' : 'text-sm text-muted-foreground'}>
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

                <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2 sm:flex-row lg:min-w-[220px] lg:justify-end'}>
                    <Button variant="outline" size={compact ? 'sm' : 'default'} className="rounded-full" onClick={() => onRejectConfirmation(action)}>
                        Rechazar
                    </Button>
                    <Button size={compact ? 'sm' : 'default'} className="rounded-full" onClick={() => onReviewConfirmation(action)}>
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

const ACTIVITY_ICON_BY_TYPE: Record<SpaceActivityEventType, typeof FileText> = {
    entry_created: FileText,
    entry_edited: Pencil,
    entry_voided: Ban,
    settlement_created: HandCoins,
    attachment_uploaded: Paperclip,
    attachment_deleted: Trash2,
    category_created: Tag,
    category_archived: Tag,
    category_restored: Tag,
    participant_invited: UserPlus,
    participant_joined: UserCheck,
    participant_removed: UserMinus,
    role_changed: Shield,
    space_updated: Settings,
    migration_imported: FileText,
}

function ActivityEventCard({
    event,
    currentUserId,
}: {
    event: ISpaceActivityEvent
    currentUserId?: string
}) {
    const Icon = ACTIVITY_ICON_BY_TYPE[event.type] ?? FileText
    const isUnread = Boolean(
        currentUserId &&
        !event.readByUserIds.some((userId) => extractId(userId) === currentUserId)
    )
    const metadata = event.metadata ?? {}
    const amount = typeof metadata.amount === 'number' ? metadata.amount : undefined
    const currency = typeof metadata.currency === 'string' ? metadata.currency : undefined
    const fileName = typeof metadata.fileName === 'string' ? metadata.fileName : undefined

    return (
        <motion.div
            layout
            variants={staggerItem}
            whileHover={{ y: -1, transition: { duration: 0.15 } }}
            className="rounded-[20px] border border-foreground/[0.07] bg-background/72 p-3 transition-colors hover:border-primary/20 hover:bg-primary/[0.03]"
        >
            <div className="flex items-start gap-3">
                <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                    <AnimatePresence>
                        {isUnread ? (
                            <motion.span
                                key="unread"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                transition={springButton}
                                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-background"
                            />
                        ) : null}
                    </AnimatePresence>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold tracking-tight text-foreground">
                        {event.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {formatSpaceDate(event.createdAt)}
                    </p>
                    {event.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {event.description}
                        </p>
                    ) : null}
                    {amount !== undefined && currency ? (
                        <p className="mt-2 text-xs font-medium text-foreground">
                            <SpaceAmountInline amount={amount} currency={currency} hidden={false} />
                        </p>
                    ) : fileName ? (
                        <p className="mt-2 truncate text-xs text-muted-foreground">{fileName}</p>
                    ) : null}
                </div>
            </div>
        </motion.div>
    )
}

function ActivityList({
    spaceId,
    currentUserId,
}: {
    spaceId?: string
    currentUserId?: string
}) {
    const activity = useSpaceActivity(spaceId)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                    {activity.unreadCount > 0 ? `${activity.unreadCount} sin leer` : 'Todo leído'}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={activity.unreadCount === 0}
                    onClick={() => void activity.markRead()}
                >
                    Marcar todo como leído
                </Button>
            </div>

            {activity.loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 rounded-[20px]" />
                    <Skeleton className="h-24 rounded-[20px]" />
                </div>
            ) : activity.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-semibold tracking-tight">Sin actividad</p>
                        <p className="text-sm text-muted-foreground">
                            Los cambios relevantes de tus espacios van a aparecer acá.
                        </p>
                    </div>
                </div>
            ) : (
                <motion.div
                    className="space-y-3"
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                >
                    {activity.events.map((event) => (
                        <ActivityEventCard
                            key={extractId(event._id)}
                            event={event}
                            currentUserId={currentUserId}
                        />
                    ))}
                </motion.div>
            )}
        </div>
    )
}

export function RecentPendingPanel({
    actions,
    loading,
    compact = false,
    onShowAll,
    ...handlers
}: {
    actions: ISpacePendingAction[]
    loading: boolean
    compact?: boolean
    onShowAll: () => void
} & PendingActionHandlers) {
    const recentActions = actions.slice(0, compact ? 3 : 4)

    return (
        <SpaceSurface padding={compact ? 'p-4' : 'p-5 md:p-6'}>
            <SpaceSectionHeading
                eyebrow="Pendientes"
                title="Pendientes recientes"
                description={compact ? undefined : 'Invitaciones, confirmaciones y liquidaciones que hoy requieren una acción tuya.'}
                action={
                    <Button variant="ghost" size="sm" className="rounded-full" onClick={onShowAll}>
                        Ver todos
                    </Button>
                }
            />

            <div className={compact ? 'mt-4 space-y-2.5' : 'mt-5 space-y-3'}>
                {loading ? (
                    <>
                        <Skeleton className={compact ? 'h-24 rounded-[20px]' : 'h-32 rounded-[28px]'} />
                        <Skeleton className={compact ? 'h-24 rounded-[20px]' : 'h-32 rounded-[28px]'} />
                    </>
                ) : recentActions.length === 0 ? (
                    <div className={compact ? 'rounded-[20px] border border-dashed border-border bg-background/60 px-4 py-5 text-center text-sm text-muted-foreground' : 'rounded-[28px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground'}>
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
                            <SpaceSurface padding="p-6">
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

export function SpacesPendingSheet({
    open,
    onOpenChange,
    actions,
    loading,
    spaceId,
    currentUserId,
    initialTab = 'pending',
    ...handlers
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    actions: ISpacePendingAction[]
    loading: boolean
    spaceId?: string
    currentUserId?: string
    initialTab?: SheetTab
} & PendingActionHandlers) {
    const [filter, setFilter] = useState<PendingViewFilter>('all')
    const [tab, setTab] = useState<SheetTab>(initialTab)
    const filteredActions = useMemo(
        () => actions.filter((action) => matchesFilter(action, filter)),
        [actions, filter]
    )

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[440px]">
                <SheetHeader className="border-b border-border/70 px-5 pb-4 pt-5">
                    <SheetTitle className="text-xl tracking-tight">Notificaciones</SheetTitle>
                    <SheetDescription>
                        Pendientes que requieren acción y actividad informativa de tus espacios.
                    </SheetDescription>
                    <div className="pt-2">
                        <div className="mb-3 grid grid-cols-2 gap-1 rounded-[16px] border border-border bg-background/80 p-1">
                            {(['pending', 'activity'] as SheetTab[]).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setTab(item)}
                                    className={[
                                        'relative rounded-[12px] px-3 py-2 text-sm font-medium transition-colors',
                                        tab === item
                                            ? 'text-primary'
                                            : 'text-muted-foreground hover:text-foreground',
                                    ].join(' ')}
                                >
                                    {tab === item ? (
                                        <motion.span
                                            layoutId="spaces-pending-sheet-tab"
                                            className="absolute inset-0 rounded-[12px] bg-primary/10"
                                            transition={springButton}
                                        />
                                    ) : null}
                                    <span className="relative">
                                        {item === 'pending' ? 'Pendientes' : 'Actividad'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <AnimatePresence mode="wait">
                            {tab === 'pending' ? (
                                <motion.div key="filters" {...fadeInFast}>
                                    <PendingFilterBar actions={actions} value={filter} onChange={setFilter} />
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    <AnimatePresence mode="wait">
                    {tab === 'activity' ? (
                        <motion.div key="activity" {...fadeInFast}>
                            <ActivityList spaceId={spaceId} currentUserId={currentUserId} />
                        </motion.div>
                    ) : loading ? (
                        <motion.div key="loading" className="space-y-3" {...fadeInFast}>
                            <Skeleton className="h-28 rounded-[20px]" />
                            <Skeleton className="h-28 rounded-[20px]" />
                        </motion.div>
                    ) : filteredActions.length === 0 ? (
                        <motion.div key="empty" className="flex flex-col items-center justify-center gap-3 py-12 text-center" {...fadeInFast}>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <Bell className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-semibold tracking-tight">
                                    Nada pendiente
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Cuando aparezcan acciones nuevas dentro de tus espacios, las vas a ver acá.
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pending"
                            className="space-y-3"
                            variants={staggerContainer}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                        >
                            {filteredActions.map((action) => (
                                <motion.div key={pendingActionKey(action, 'sheet')} variants={staggerItem}>
                                    <PendingActionCard
                                    key={pendingActionKey(action, 'sheet')}
                                    action={action}
                                    compact
                                    {...handlers}
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>
            </SheetContent>
        </Sheet>
    )
}

export function isPendingSettlementEntry(entry: ISpaceEntry) {
    return entry.type === 'settlement'
}
