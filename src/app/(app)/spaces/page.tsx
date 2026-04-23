'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
    Bell,
    ChevronRight,
    Clock3,
    Home,
    Plane,
    Plus,
    Sparkles,
    Users,
} from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSpacePendingActions } from '@/hooks/useSpacePendingActions'
import { useSpaces } from '@/hooks/useSpaces'
import { useToast } from '@/hooks/useToast'
import {
    ConfirmSpaceEntryDialog,
    CreateSpaceDialog,
} from '@/components/spaces/SpaceDialogs'
import { cn } from '@/lib/utils'
import {
    formatSpaceDateRange,
    resolveSpaceStatusTone,
    resolveSpaceTypeAccent,
    SPACE_MODE_LABELS,
    SPACE_STATUS_LABELS,
    SPACE_TYPE_LABELS,
    extractId,
} from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceListItem, ISpacePendingAction } from '@/types'

type SpaceStatusFilter = 'all' | 'active' | 'paused' | 'closed' | 'archived'
type PendingFilter = 'all' | 'invite' | 'confirmation'

const STATUS_FILTERS: Array<{ value: SpaceStatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'paused', label: 'Pausados' },
    { value: 'closed', label: 'Cerrados' },
    { value: 'archived', label: 'Archivados' },
]

const TYPE_META = {
    couple: { icon: Users },
    home: { icon: Home },
    travel: { icon: Plane },
    project: { icon: Sparkles },
    event: { icon: Sparkles },
    personal: { icon: Sparkles },
    other: { icon: Sparkles },
} as const

function InitialAvatar({ name }: { name: string }) {
    const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')

    return (
        <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-background text-[11px] font-semibold"
            style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, white), color-mix(in srgb, var(--foreground) 6%, white))',
                color: 'var(--foreground)',
            }}
        >
            {initials}
        </div>
    )
}

function MiniTrend({ points }: { points: Array<{ amount: number }> }) {
    const max = Math.max(...points.map((point) => point.amount), 1)

    return (
        <div className="flex h-10 items-end gap-1.5">
            {points.length > 0 ? (
                points.map((point, index) => (
                    <div
                        key={`${point.amount}-${index}`}
                        className="flex-1 rounded-full bg-primary/15"
                        style={{
                            height: `${Math.max((point.amount / max) * 100, 14)}%`,
                            background:
                                'linear-gradient(180deg, color-mix(in srgb, var(--primary) 72%, white), color-mix(in srgb, var(--primary) 28%, white))',
                        }}
                    />
                ))
            ) : (
                <div className="w-full rounded-full border border-dashed border-border" />
            )}
        </div>
    )
}

function SpaceCard({ item, hidden }: { item: ISpaceListItem; hidden: boolean }) {
    const typeAccent = resolveSpaceTypeAccent(item.space.type)
    const statusTone = resolveSpaceStatusTone(item.space.status)
    const Icon = TYPE_META[item.space.type].icon
    const topParticipants = item.participants.slice(0, 3)

    return (
        <Link
            href={`/spaces/${extractId(item.space._id)}`}
            className="group flex h-full flex-col rounded-[30px] border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/8"
            style={{ boxShadow: 'var(--card-shadow)' }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px]"
                        style={{
                            background: typeAccent.background,
                            color: typeAccent.color,
                        }}
                    >
                        <Icon className="h-6 w-6" />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-[22px] font-semibold tracking-tight text-foreground">
                                {item.space.name}
                            </h3>
                            <span
                                className="rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{
                                    background: statusTone.background,
                                    color: statusTone.color,
                                }}
                            >
                                {SPACE_STATUS_LABELS[item.space.status]}
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                                className="rounded-full px-2.5 py-1 font-medium"
                                style={{
                                    background: typeAccent.background,
                                    color: typeAccent.color,
                                }}
                            >
                                {SPACE_TYPE_LABELS[item.space.type]}
                            </span>
                            <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                                {SPACE_MODE_LABELS[item.space.mode]}
                            </span>
                        </div>
                    </div>
                </div>

                <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                        {topParticipants.map((participant) => (
                            <InitialAvatar
                                key={extractId(participant._id)}
                                name={participant.displayName}
                            />
                        ))}
                    </div>
                    <span>{item.summary.participantCount} participantes</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {item.space.currencies.map((currency) => (
                        <span
                            key={currency}
                            className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium"
                        >
                            {currency}
                        </span>
                    ))}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-border/70 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Gastado total</p>
                    <ResponsiveAmount
                        amount={item.summary.totalReporting}
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        className="mt-2 text-xl font-semibold tracking-tight"
                    />
                </div>

                <div className="rounded-[22px] border border-border/70 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">Tu parte</p>
                    <ResponsiveAmount
                        amount={item.summary.yourShareReporting}
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        className="mt-2 text-xl font-semibold tracking-tight"
                    />
                </div>

                <div className="rounded-[22px] border border-border/70 bg-background/60 p-3">
                    <p className="text-xs text-muted-foreground">
                        {item.summary.pendingToCollectReporting > 0 ? 'Saldo a favor' : 'Pendiente'}
                    </p>
                    <ResponsiveAmount
                        amount={
                            item.summary.pendingToCollectReporting > 0
                                ? item.summary.pendingToCollectReporting
                                : item.summary.pendingToPayReporting
                        }
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        className="mt-2 text-xl font-semibold tracking-tight"
                        color={
                            item.summary.pendingToCollectReporting > 0
                                ? '#10B981'
                                : undefined
                        }
                    />
                </div>
            </div>

            <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatSpaceDateRange(item.space.startDate, item.space.endDate)}</span>
                    <span>{item.summary.pendingEntryCount} pendientes</span>
                </div>
                <MiniTrend points={item.summary.monthlyTrend} />
            </div>
        </Link>
    )
}

function SpaceCardSkeleton() {
    return (
        <div className="rounded-[30px] border bg-card p-5" style={{ boxShadow: 'var(--card-shadow)' }}>
            <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-[22px]" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-7 w-40 rounded-full" />
                    <Skeleton className="h-4 w-28 rounded-full" />
                </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-24 rounded-[22px]" />
                <Skeleton className="h-24 rounded-[22px]" />
                <Skeleton className="h-24 rounded-[22px]" />
            </div>
        </div>
    )
}

function PendingActionRow({
    action,
    onAcceptInvite,
    onRejectInvite,
    onReviewConfirmation,
    onRejectConfirmation,
}: {
    action: ISpacePendingAction
    onAcceptInvite: (action: Extract<ISpacePendingAction, { kind: 'invite' }>) => void
    onRejectInvite: (action: Extract<ISpacePendingAction, { kind: 'invite' }>) => void
    onReviewConfirmation: (
        action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    ) => void
    onRejectConfirmation: (
        action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    ) => void
}) {
    if (action.kind === 'invite') {
        return (
            <div className="flex flex-col gap-4 rounded-[26px] border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            Invitación
                        </span>
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                            {SPACE_TYPE_LABELS[action.space.type]}
                        </span>
                    </div>
                    <p className="text-base font-medium">
                        {action.invitedByName} te invitó a unirte a {action.space.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Vas a participar como {action.participant.role === 'admin' ? 'administrador' : 'participante'}.
                    </p>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onRejectInvite(action)}>
                        Rechazar
                    </Button>
                    <Button onClick={() => onAcceptInvite(action)}>Aceptar</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 rounded-[26px] border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                        Confirmación
                    </span>
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                        {SPACE_TYPE_LABELS[action.space.type]}
                    </span>
                </div>
                <p className="text-base font-medium">
                    {action.requestedByParticipant?.displayName ?? 'Un participante'} registró un movimiento y te marcó como pagador.
                </p>
                <p className="text-sm text-muted-foreground">
                    {action.entry.title} · {action.space.name}
                </p>
                <ResponsiveAmount
                    amount={action.entry.amount}
                    currency={action.entry.currency}
                    hidden={false}
                    className="text-lg font-semibold tracking-tight"
                />
            </div>

            <div className="flex gap-2">
                <Button variant="outline" onClick={() => onRejectConfirmation(action)}>
                    Rechazar
                </Button>
                <Button onClick={() => onReviewConfirmation(action)}>Revisar</Button>
            </div>
        </div>
    )
}

export default function SpacesPage() {
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()
    const { spaces, loading, error, createSpace } = useSpaces()
    const pending = useSpacePendingActions()
    const [statusFilter, setStatusFilter] = useState<SpaceStatusFilter>('all')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [pendingDialogOpen, setPendingDialogOpen] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)

    usePageTitle('Espacios')
    useAppStartupReady(!loading)

    const filteredSpaces = useMemo(() => {
        return spaces.filter((item) =>
            statusFilter === 'all' ? true : item.space.status === statusFilter
        )
    }, [spaces, statusFilter])

    const pendingActions = pending.pendingActions
    const filteredPendingActions = useMemo(() => pendingActions.slice(0, 4), [pendingActions])

    const handleCreateSpace = async (data: Parameters<typeof createSpace>[0]) => {
        await createSpace(data)
        success('Espacio creado correctamente')
    }

    const handleInviteResponse = async (
        action: Extract<ISpacePendingAction, { kind: 'invite' }>,
        inviteStatus: 'accepted' | 'declined'
    ) => {
        try {
            await pending.respondToInvite(
                extractId(action.space._id) ?? '',
                extractId(action.participant._id) ?? '',
                inviteStatus
            )
            success(
                inviteStatus === 'accepted'
                    ? 'Invitación aceptada'
                    : 'Invitación rechazada'
            )
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos procesar la invitación.')
        }
    }

    const handleRejectConfirmation = async (
        action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    ) => {
        try {
            await pending.rejectEntry(extractId(action.entry._id) ?? '')
            success('Movimiento rechazado')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos rechazar el movimiento.')
        }
    }

    const handleReviewConfirmation = (
        action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    ) => {
        setSelectedPendingEntry(action.entry)
        setConfirmDialogOpen(true)
    }

    const handleConfirmPendingEntry = async (payload: {
        mode: 'create' | 'link'
        description?: string
        categoryId?: string
        accountId?: string
        linkedTransactionId?: string
    }) => {
        if (!selectedPendingEntry) return

        await pending.confirmEntry(extractId(selectedPendingEntry._id) ?? '', payload)
        success('Movimiento confirmado')
    }

    return (
        <>
            <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
                <div className="flex flex-col gap-4 rounded-[34px] border bg-card px-5 py-5 md:flex-row md:items-start md:justify-between md:px-6">
                    <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Colaboración financiera
                        </p>
                        <div className="space-y-1">
                            <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                                Espacios
                            </h1>
                            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                                Agrupá y analizá contextos financieros individuales o compartidos sin mezclar la contabilidad personal de cada participante.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => setPendingDialogOpen(true)}
                        >
                            <Bell className="h-4 w-4" />
                            Pendientes: {pending.counts.total}
                        </Button>
                        <Button className="rounded-full px-4" onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Nuevo espacio
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 rounded-[30px] border bg-card px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
                    <div className="flex flex-wrap gap-2">
                        {STATUS_FILTERS.map((filter) => (
                            <button
                                key={filter.value}
                                type="button"
                                onClick={() => setStatusFilter(filter.value)}
                                className={cn(
                                    'rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                                    statusFilter === filter.value
                                        ? 'border-primary/20 bg-primary/10 text-primary'
                                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        {spaces.length} espacios activos en tu radar
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <SpaceCardSkeleton key={index} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="rounded-[28px] border border-destructive/15 bg-destructive/5 px-5 py-10 text-center text-sm text-destructive">
                        {error}
                    </div>
                ) : filteredSpaces.length === 0 ? (
                    <div className="rounded-[32px] border bg-card">
                        <EmptyState
                            icon={Sparkles}
                            title="Todavía no tenés espacios cargados"
                            description="Creá tu primer espacio para separar viajes, hogar, pareja, proyectos o cualquier contexto compartido."
                            actionLabel="Crear espacio"
                            onAction={() => setCreateDialogOpen(true)}
                        />
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
                        {filteredSpaces.map((item) => (
                            <SpaceCard
                                key={extractId(item.space._id)}
                                item={item}
                                hidden={hidden}
                            />
                        ))}
                    </div>
                )}

                <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">Pendientes recientes</h2>
                            <p className="text-sm text-muted-foreground">
                                Confirmaciones e invitaciones que requieren una acción tuya.
                            </p>
                        </div>

                        <Button variant="ghost" onClick={() => setPendingDialogOpen(true)}>
                            Ver todos
                        </Button>
                    </div>

                    {pending.loading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-28 rounded-[26px]" />
                            <Skeleton className="h-28 rounded-[26px]" />
                        </div>
                    ) : filteredPendingActions.length === 0 ? (
                        <div className="rounded-[26px] border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                            No hay pendientes por resolver ahora mismo.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredPendingActions.map((action) => (
                                <PendingActionRow
                                    key={
                                        action.kind === 'invite'
                                            ? `invite-${extractId(action.invite._id)}`
                                            : `confirmation-${extractId(action.entry._id)}`
                                    }
                                    action={action}
                                    onAcceptInvite={(item) => void handleInviteResponse(item, 'accepted')}
                                    onRejectInvite={(item) => void handleInviteResponse(item, 'declined')}
                                    onReviewConfirmation={handleReviewConfirmation}
                                    onRejectConfirmation={(item) => void handleRejectConfirmation(item)}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <CreateSpaceDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={handleCreateSpace}
            />

            <Dialog open={pendingDialogOpen} onOpenChange={setPendingDialogOpen}>
                <DialogContent className="max-h-[92vh] max-w-[920px] overflow-hidden p-0 sm:max-w-[920px]">
                    <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-2xl tracking-tight">Pendientes</DialogTitle>
                            <DialogDescription>
                                Acciones pendientes dentro de tus espacios: invitaciones y confirmaciones.
                            </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="all">
                            <TabsList className="h-auto rounded-[20px] bg-transparent p-0">
                                {([
                                    { value: 'all', label: 'Todos' },
                                    { value: 'invite', label: 'Invitaciones' },
                                    { value: 'confirmation', label: 'Confirmaciones' },
                                ] as Array<{ value: PendingFilter; label: string }>).map((tab) => (
                                    <TabsTrigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="rounded-[18px] border border-border px-4 py-2.5 data-active:border-primary/20 data-active:bg-primary/8"
                                    >
                                        {tab.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            {(['all', 'invite', 'confirmation'] as PendingFilter[]).map((filter) => {
                                const actions = pendingActions.filter((action) =>
                                    filter === 'all' ? true : action.kind === filter
                                )

                                return (
                                    <TabsContent key={filter} value={filter} className="mt-5 space-y-3">
                                        {actions.length === 0 ? (
                                            <div className="rounded-[26px] border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                                                No hay acciones pendientes en esta categoría.
                                            </div>
                                        ) : (
                                            actions.map((action) => (
                                                <PendingActionRow
                                                    key={
                                                        action.kind === 'invite'
                                                            ? `dialog-invite-${extractId(action.invite._id)}`
                                                            : `dialog-confirmation-${extractId(action.entry._id)}`
                                                    }
                                                    action={action}
                                                    onAcceptInvite={(item) =>
                                                        void handleInviteResponse(item, 'accepted')
                                                    }
                                                    onRejectInvite={(item) =>
                                                        void handleInviteResponse(item, 'declined')
                                                    }
                                                    onReviewConfirmation={handleReviewConfirmation}
                                                    onRejectConfirmation={(item) =>
                                                        void handleRejectConfirmation(item)
                                                    }
                                                />
                                            ))
                                        )}
                                    </TabsContent>
                                )
                            })}
                        </Tabs>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmSpaceEntryDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                entry={selectedPendingEntry}
                onSubmit={handleConfirmPendingEntry}
            />
        </>
    )
}
