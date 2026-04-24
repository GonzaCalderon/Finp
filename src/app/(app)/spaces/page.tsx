'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
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
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [pendingDialogOpen, setPendingDialogOpen] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)

    usePageTitle('Espacios')
    useAppStartupReady(!loading)

    const filteredSpaces = useMemo(() => {
        const filtered = spaces.filter((item) =>
            statusFilter === 'all' ? true : item.space.status === statusFilter
        )
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
    }, [spaces, statusFilter])

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
            <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
                <SpacesPageHeader
                    totalSpaces={spaces.length}
                    pendingCount={pending.counts.total}
                    pendingActions={pending.pendingActions}
                    onCreate={() => setCreateDialogOpen(true)}
                    onShowPending={() => setPendingDialogOpen(true)}
                />

                <SpacesFiltersBar
                    selected={statusFilter}
                    counts={filterCounts}
                    onChange={setStatusFilter}
                />

                {loading ? (
                    <div className="flex flex-col gap-2 md:grid md:gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <SpaceCardSkeleton key={index} />
                        ))}
                    </div>
                ) : error ? (
                    <div className="rounded-[28px] border border-destructive/15 bg-destructive/5 px-5 py-10 text-center text-sm text-destructive">
                        {error}
                    </div>
                ) : filteredSpaces.length === 0 ? (
                    <div className="rounded-[32px] border border-foreground/[0.08] bg-card/94">
                        <EmptyState
                            icon={Sparkles}
                            title="Todavía no tenés espacios cargados"
                            description="Creá tu primer espacio para separar viajes, hogar, pareja, proyectos o cualquier contexto compartido."
                            actionLabel="Crear espacio"
                            onAction={() => setCreateDialogOpen(true)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 md:grid md:gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {filteredSpaces.map((item) => (
                            <SpaceOverviewCard
                                key={extractId(item.space._id)}
                                item={item}
                                hidden={hidden}
                            />
                        ))}
                    </div>
                )}

                <RecentPendingPanel
                    actions={pending.pendingActions}
                    loading={pending.loading}
                    onShowAll={() => setPendingDialogOpen(true)}
                    onAcceptInvite={(action) => void handleInviteResponse(action, 'accepted')}
                    onRejectInvite={(action) => void handleInviteResponse(action, 'declined')}
                    onReviewConfirmation={handleReviewConfirmation}
                    onRejectConfirmation={(action) => void handleRejectConfirmation(action)}
                />
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
