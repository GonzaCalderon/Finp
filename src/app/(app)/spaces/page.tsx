'use client'

import { useEffect, useMemo, useState } from 'react'
import { Layers3, Plus, Sparkles } from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useBreadcrumbAction } from '@/contexts/BreadcrumbActionContext'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useSpaceAction } from '@/contexts/SpaceActionContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSpaceEntries } from '@/hooks/useSpaceEntries'
import { useSpacePendingActions } from '@/hooks/useSpacePendingActions'
import { useSpaces } from '@/hooks/useSpaces'
import { useToast } from '@/hooks/useToast'
import {
    ConfirmSpaceEntryDialog,
    CreateSpaceDialog,
    SpaceEntryDialog,
} from '@/components/spaces/SpaceDialogs'
import {
    SpaceCurrencyBadge,
    SpaceInitialsAvatar,
    SpaceTypeBadge,
} from '@/components/spaces/SpaceUi'
import { SpaceOverviewCard } from '@/components/spaces/index/SpaceOverviewCard'
import { SpacesFiltersBar } from '@/components/spaces/index/SpacesFiltersBar'
import type { SpaceSortOption } from '@/components/spaces/index/SpacesFiltersBar'
import { SpacesPageTopBar, SpacesPendingBell } from '@/components/spaces/index/SpacesPageHeader'
import { SpacesPendingSheet } from '@/components/spaces/pending/SpacePendingViews'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceListItem, ISpacePendingAction } from '@/types'
import type { SpaceEntryFormData } from '@/lib/validations'

type SpaceStatusFilter = 'all' | 'active' | 'paused' | 'closed' | 'archived'

function SpaceCardSkeleton() {
    return (
        <>
            <Skeleton className="h-[70px] rounded-[22px] md:hidden" />
            <Skeleton className="hidden h-[360px] rounded-[30px] md:block" />
        </>
    )
}

function SpacePickerDialog({
    open,
    spaces,
    onOpenChange,
    onSelectSpace,
    onCreateSpace,
}: {
    open: boolean
    spaces: ISpaceListItem[]
    onOpenChange: (open: boolean) => void
    onSelectSpace: (spaceId: string) => void
    onCreateSpace: () => void
}) {
    const sortedSpaces = useMemo(
        () =>
            [...spaces].sort((left, right) => {
                const leftActive = left.space.status === 'active' ? 0 : 1
                const rightActive = right.space.status === 'active' ? 0 : 1
                if (leftActive !== rightActive) return leftActive - rightActive
                return left.space.name.localeCompare(right.space.name, 'es')
            }),
        [spaces]
    )

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>Elegir espacio</DialogTitle>
                    <DialogDescription>
                        Seleccioná dónde querés registrar el nuevo gasto.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {sortedSpaces.map((item) => {
                        const spaceId = extractId(item.space._id) ?? ''
                        const topParticipants = item.participants.slice(0, 4)

                        return (
                            <button
                                key={spaceId}
                                type="button"
                                onClick={() => onSelectSpace(spaceId)}
                                className="w-full rounded-[22px] border border-foreground/[0.08] bg-background/74 p-4 text-left transition-colors hover:border-primary/20 hover:bg-accent/20"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 space-y-2">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <h3 className="truncate font-semibold text-foreground">
                                                {item.space.name}
                                            </h3>
                                            <SpaceTypeBadge type={item.space.type} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-1.5">
                                                {topParticipants.map((participant) => (
                                                    <SpaceInitialsAvatar
                                                        key={extractId(participant._id)}
                                                        name={participant.displayName}
                                                        className="h-7 w-7 border-card text-[10px]"
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {item.summary.participantCount} participante{item.summary.participantCount === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                    </div>
                                    <SpaceCurrencyBadge currency={item.space.reportingCurrency} />
                                </div>
                            </button>
                        )
                    })}

                    <Button variant="outline" className="w-full rounded-full" onClick={onCreateSpace}>
                        Crear nuevo espacio
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function SpacesQuickEntryFlow({
    item,
    currentUserId,
    open,
    onOpenChange,
    onSaved,
}: {
    item: ISpaceListItem | null
    currentUserId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}) {
    const spaceId = item ? extractId(item.space._id) : undefined
    const entriesApi = useSpaceEntries(spaceId)

    if (!item || !spaceId) return null

    const handleCreateEntry = async (payload: SpaceEntryFormData) => {
        await entriesApi.createEntry(payload)
        onSaved()
    }

    return (
        <SpaceEntryDialog
            open={open}
            onOpenChange={onOpenChange}
            onSubmit={handleCreateEntry}
            participants={item.participants}
            currentUserId={currentUserId}
            defaultCurrency={item.space.reportingCurrency}
            reportingCurrency={item.space.reportingCurrency}
            defaultSplitMode={item.space.defaultSplitMode}
            spaceMode={item.space.mode}
            draftKey={`spaces-home-${spaceId}`}
        />
    )
}

export default function SpacesPage() {
    const { hidden } = useHideAmounts()
    const { setAction: setBreadcrumbAction, clearAction: clearBreadcrumbAction } = useBreadcrumbAction()
    const { setAction: setSpaceAction, clearAction: clearSpaceAction } = useSpaceAction()
    const { success, error: toastError } = useToast()
    const { spaces, loading, error, createSpace, currentUserId } = useSpaces()
    const pending = useSpacePendingActions()
    const [statusFilter, setStatusFilter] = useState<SpaceStatusFilter>('all')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<SpaceSortOption>('recent')
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [spacePickerOpen, setSpacePickerOpen] = useState(false)
    const [entryDialogOpen, setEntryDialogOpen] = useState(false)
    const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)
    const [pendingDialogOpen, setPendingDialogOpen] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)

    usePageTitle('Espacios')
    useAppStartupReady(!loading)

    useEffect(() => {
        setSpaceAction({
            label: 'Nuevo gasto',
            icon: <Plus size={18} color="#fff" />,
            onPress: () => {
                if (spaces.length === 0) {
                    setCreateDialogOpen(true)
                    return
                }

                setSpacePickerOpen(true)
            },
        })

        return () => clearSpaceAction()
    }, [clearSpaceAction, setSpaceAction, spaces.length])

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

    const selectedSpaceItem = useMemo(
        () => spaces.find((item) => extractId(item.space._id) === selectedSpaceId) ?? null,
        [selectedSpaceId, spaces]
    )

    const handleCreateSpace = async (data: Parameters<typeof createSpace>[0]) => {
        const space = await createSpace(data)
        success('Espacio creado correctamente')
        return space
    }

    const handleSelectSpaceForEntry = (spaceId: string) => {
        setSelectedSpaceId(spaceId)
        setSpacePickerOpen(false)
        setEntryDialogOpen(true)
    }

    const handleCreateSpaceFromPicker = () => {
        setSpacePickerOpen(false)
        setCreateDialogOpen(true)
    }

    const handleQuickEntrySaved = () => {
        success('Gasto guardado')
        setEntryDialogOpen(false)
        setSelectedSpaceId(null)
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
                    <div className="px-2 py-8 md:py-12">
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

            <SpacePickerDialog
                open={spacePickerOpen}
                spaces={spaces}
                onOpenChange={setSpacePickerOpen}
                onSelectSpace={handleSelectSpaceForEntry}
                onCreateSpace={handleCreateSpaceFromPicker}
            />

            <SpacesQuickEntryFlow
                item={selectedSpaceItem}
                currentUserId={currentUserId}
                open={entryDialogOpen}
                onOpenChange={(open) => {
                    setEntryDialogOpen(open)
                    if (!open) setSelectedSpaceId(null)
                }}
                onSaved={handleQuickEntrySaved}
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
