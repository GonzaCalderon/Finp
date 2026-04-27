'use client'

import { useEffect, useMemo, useState } from 'react'
import { Layers3, Sparkles } from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { useBreadcrumbAction } from '@/contexts/BreadcrumbActionContext'
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
import type { SpaceSortOption } from '@/components/spaces/index/SpacesFiltersBar'
import { SpacesPageTopBar, SpacesPendingBell } from '@/components/spaces/index/SpacesPageHeader'
import { SpacesPendingSheet } from '@/components/spaces/pending/SpacePendingViews'
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
    const { setAction: setBreadcrumbAction, clearAction: clearBreadcrumbAction } = useBreadcrumbAction()
    const { success, error: toastError } = useToast()
    const { spaces, loading, error, createSpace } = useSpaces()
    const pending = useSpacePendingActions()
    const [statusFilter, setStatusFilter] = useState<SpaceStatusFilter>('all')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<SpaceSortOption>('recent')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [pendingDialogOpen, setPendingDialogOpen] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)

    usePageTitle('Espacios')
    useAppStartupReady(!loading)

    useEffect(() => {
        setBreadcrumbAction(
            <SpacesPendingBell
                pendingCount={pending.counts.total}
                onShowPending={() => setPendingDialogOpen(true)}
            />
        )

        return () => clearBreadcrumbAction()
    }, [clearBreadcrumbAction, pending.counts.total, setBreadcrumbAction])

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
        return [...filtered].sort((a, b) => {
            if (sort === 'name') {
                return a.space.name.localeCompare(b.space.name, 'es')
            }
            if (sort === 'balance') {
                const aBalance = Math.max(
                    a.summary.pendingToCollectReporting,
                    a.summary.pendingToPayReporting
                )
                const bBalance = Math.max(
                    b.summary.pendingToCollectReporting,
                    b.summary.pendingToPayReporting
                )
                return bBalance - aBalance
            }
            // 'recent': sort by most recent activity
            const aDate = a.recentEntries[0]?.date
                ? new Date(a.recentEntries[0].date).getTime()
                : new Date(a.space.updatedAt ?? 0).getTime()
            const bDate = b.recentEntries[0]?.date
                ? new Date(b.recentEntries[0].date).getTime()
                : new Date(b.space.updatedAt ?? 0).getTime()
            return bDate - aDate
        })
    }, [search, spaces, statusFilter, sort])

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
            <div className="mx-auto max-w-[1600px] space-y-5 px-4 pb-28 pt-4 md:space-y-6 md:px-6 md:py-6">
                <SpacesPageTopBar
                    onCreate={() => setCreateDialogOpen(true)}
                />

                <SpacesFiltersBar
                    selected={statusFilter}
                    counts={filterCounts}
                    search={search}
                    onSearchChange={setSearch}
                    onChange={setStatusFilter}
                    sort={sort}
                    onSortChange={setSort}
                    onCreateSpace={() => setCreateDialogOpen(true)}
                />

                {/* Divider between filters and cards — desktop only */}
                <hr className="hidden border-foreground/[0.07] md:block" />

                {loading ? (
                    <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
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
                    <>
                        <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                            {filteredSpaces.map((item) => (
                                <SpaceOverviewCard
                                    key={extractId(item.space._id)}
                                    item={item}
                                    hidden={hidden}
                                />
                            ))}
                        </div>
                        <p className="py-2 text-left text-sm text-muted-foreground">
                            Mostrando {filteredSpaces.length} de {spaces.length} espacio{spaces.length === 1 ? '' : 's'}
                        </p>
                    </>
                )}
            </div>

            <CreateSpaceDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onSubmit={handleCreateSpace}
            />

            <SpacesPendingSheet
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
