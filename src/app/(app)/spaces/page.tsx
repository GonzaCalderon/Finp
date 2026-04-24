'use client'

import { useMemo, useState } from 'react'
import { Layers3, Sparkles } from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSpacePendingActions } from '@/hooks/useSpacePendingActions'
import { useSpaces } from '@/hooks/useSpaces'
import { useToast } from '@/hooks/useToast'
import {
    ConfirmSpaceEntryDialog,
    CreateSpaceDialog,
} from '@/components/spaces/SpaceDialogs'
import { SpaceOverviewCard } from '@/components/spaces/index/SpaceOverviewCard'
import { SpacesFiltersBar } from '@/components/spaces/index/SpacesFiltersBar'
import { SpacesPageHeader } from '@/components/spaces/index/SpacesPageHeader'
import {
    RecentPendingPanel,
    SpacesPendingDialog,
} from '@/components/spaces/pending/SpacePendingViews'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpacePendingAction } from '@/types'

type SpaceStatusFilter = 'all' | 'active' | 'paused' | 'closed' | 'archived'

function SpaceCardSkeleton() {
    return (
        <>
            <Skeleton className="h-[70px] rounded-[22px] md:hidden" />
            <Skeleton className="hidden h-[360px] rounded-[30px] md:block" />
        </>
    )
}

export default function SpacesPage() {
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()
    const { spaces, loading, error, createSpace } = useSpaces()
    const pending = useSpacePendingActions()
    const [statusFilter, setStatusFilter] = useState<SpaceStatusFilter>('all')
    const [search, setSearch] = useState('')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [pendingDialogOpen, setPendingDialogOpen] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)

    usePageTitle('Espacios')
    useAppStartupReady(!loading)

    const filteredSpaces = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase()
        const filtered = spaces.filter((item) =>
            statusFilter === 'all' ? true : item.space.status === statusFilter
        ).filter((item) => {
            if (!normalizedSearch) return true

            const haystack = [
                item.space.name,
                item.space.description,
                item.space.type,
                item.space.mode,
                item.space.reportingCurrency,
                item.space.currencies.join(' '),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return haystack.includes(normalizedSearch)
        })
        // Sort by most recent activity (most recently updated entry first)
        return [...filtered].sort((a, b) => {
            const aDate = a.recentEntries[0]?.date
                ? new Date(a.recentEntries[0].date).getTime()
                : new Date(a.space.updatedAt ?? 0).getTime()
            const bDate = b.recentEntries[0]?.date
                ? new Date(b.recentEntries[0].date).getTime()
                : new Date(b.space.updatedAt ?? 0).getTime()
            return bDate - aDate
        })
    }, [search, spaces, statusFilter])

    const filterCounts = useMemo(
        () => ({
            all: spaces.length,
            active: spaces.filter((item) => item.space.status === 'active').length,
            paused: spaces.filter((item) => item.space.status === 'paused').length,
            closed: spaces.filter((item) => item.space.status === 'closed').length,
            archived: spaces.filter((item) => item.space.status === 'archived').length,
        }),
        [spaces]
    )

    const activeSpaces = useMemo(
        () => spaces.filter((item) => item.space.status === 'active').length,
        [spaces]
    )

    const totalMovements = useMemo(
        () => spaces.reduce((sum, item) => sum + item.summary.totalEntryCount, 0),
        [spaces]
    )

    const handleCreateSpace = async (data: Parameters<typeof createSpace>[0]) => {
        const space = await createSpace(data)
        success('Espacio creado correctamente')
        return space
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
            toastError(
                err instanceof Error ? err.message : 'No pudimos procesar la invitación.'
            )
        }
    }

    const handleRejectConfirmation = async (
        action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    ) => {
        try {
            await pending.rejectEntry(extractId(action.entry._id) ?? '')
            success('Movimiento rechazado')
        } catch (err) {
            toastError(
                err instanceof Error ? err.message : 'No pudimos rechazar el movimiento.'
            )
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
            <div className="mx-auto max-w-[1440px] space-y-5 px-4 pb-28 pt-4 md:space-y-6 md:px-6 md:py-6">
                <SpacesPageHeader
                    totalSpaces={spaces.length}
                    activeSpaces={activeSpaces}
                    totalMovements={totalMovements}
                    pendingCount={pending.counts.total}
                    pendingActions={pending.pendingActions}
                    onCreate={() => setCreateDialogOpen(true)}
                    onShowPending={() => setPendingDialogOpen(true)}
                />

                <SpacesFiltersBar
                    selected={statusFilter}
                    counts={filterCounts}
                    search={search}
                    onSearchChange={setSearch}
                    onChange={setStatusFilter}
                />

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="min-w-0">
                        {loading ? (
                            <div className="flex flex-col gap-2 md:grid md:gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <SpaceCardSkeleton key={index} />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="rounded-[28px] border border-destructive/15 bg-destructive/5 px-5 py-10 text-center text-sm text-destructive">
                                {error}
                            </div>
                        ) : filteredSpaces.length === 0 ? (
                            <div className="rounded-[30px] border border-foreground/[0.08] bg-card/94 px-4 py-6">
                                <EmptyState
                                    icon={search ? Layers3 : Sparkles}
                                    title={search ? 'No encontramos espacios' : 'Todavía no tenés espacios cargados'}
                                    description={
                                        search
                                            ? 'Probá con otro nombre, estado, tipo o moneda del espacio.'
                                            : 'Creá tu primer espacio para separar viajes, hogar, pareja, proyectos o cualquier contexto compartido.'
                                    }
                                    actionLabel={search ? undefined : 'Crear espacio'}
                                    onAction={search ? undefined : () => setCreateDialogOpen(true)}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 md:grid md:gap-4 md:grid-cols-2 2xl:grid-cols-3">
                                {filteredSpaces.map((item) => (
                                    <SpaceOverviewCard
                                        key={extractId(item.space._id)}
                                        item={item}
                                        hidden={hidden}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                        <RecentPendingPanel
                            actions={pending.pendingActions}
                            loading={pending.loading}
                            onShowAll={() => setPendingDialogOpen(true)}
                            onAcceptInvite={(action) => void handleInviteResponse(action, 'accepted')}
                            onRejectInvite={(action) => void handleInviteResponse(action, 'declined')}
                            onReviewConfirmation={handleReviewConfirmation}
                            onRejectConfirmation={(action) => void handleRejectConfirmation(action)}
                            compact
                        />

                        {(search || statusFilter !== 'all' || spaces.length > 0) ? (
                            <div className="rounded-[26px] border border-foreground/[0.08] bg-card/95 p-4 shadow-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Vista actual
                                </p>
                                <div className="mt-3 space-y-2.5 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-muted-foreground">Resultado</span>
                                        <span className="font-semibold text-foreground">
                                            {filteredSpaces.length} de {spaces.length}
                                        </span>
                                    </div>
                                    {statusFilter !== 'all' && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Filtro</span>
                                            <span className="rounded-full border border-border/80 bg-background/80 px-2.5 py-0.5 text-[11px] font-medium capitalize text-foreground">
                                                {statusFilter}
                                            </span>
                                        </div>
                                    )}
                                    {search && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Búsqueda</span>
                                            <span className="max-w-[120px] truncate text-right font-medium text-foreground">
                                                &ldquo;{search}&rdquo;
                                            </span>
                                        </div>
                                    )}
                                    {pending.counts.invitations > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Invitaciones</span>
                                            <span className="font-semibold" style={{ color: 'var(--warning-foreground)' }}>
                                                {pending.counts.invitations}
                                            </span>
                                        </div>
                                    )}
                                    {pending.counts.confirmations > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-muted-foreground">Confirmaciones</span>
                                            <span className="font-semibold" style={{ color: 'var(--warning-foreground)' }}>
                                                {pending.counts.confirmations}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {spaces.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setCreateDialogOpen(true)}
                                        className="mt-3 w-full rounded-full border border-foreground/10 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                                    >
                                        Crear primer espacio
                                    </button>
                                )}
                            </div>
                        ) : null}
                    </aside>
                </div>
            </div>

            <CreateSpaceDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={handleCreateSpace}
            />

            <SpacesPendingDialog
                open={pendingDialogOpen}
                onOpenChange={setPendingDialogOpen}
                actions={pending.pendingActions}
                loading={pending.loading}
                onAcceptInvite={(action) => void handleInviteResponse(action, 'accepted')}
                onRejectInvite={(action) => void handleInviteResponse(action, 'declined')}
                onReviewConfirmation={handleReviewConfirmation}
                onRejectConfirmation={(action) => void handleRejectConfirmation(action)}
            />

            <ConfirmSpaceEntryDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                entry={selectedPendingEntry}
                onSubmit={handleConfirmPendingEntry}
            />
        </>
    )
}
