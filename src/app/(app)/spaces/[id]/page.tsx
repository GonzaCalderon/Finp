'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useSpaceAction } from '@/contexts/SpaceActionContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSpace } from '@/hooks/useSpace'
import { useSpaceEntries } from '@/hooks/useSpaceEntries'
import { useSpaceParticipants } from '@/hooks/useSpaceParticipants'
import { useToast } from '@/hooks/useToast'
import {
    ConfirmSpaceEntryDialog,
    EditSpaceSettingsDialog,
    SpaceEntryDialog,
    SpaceParticipantDialog,
} from '@/components/spaces/SpaceDialogs'
import { SpaceBalanceSection } from '@/components/spaces/detail/SpaceBalanceSection'
import {
    SpaceCategoryBreakdown,
    SpaceEvolutionChart,
} from '@/components/spaces/detail/SpaceCharts'
import {
    SpaceClosurePanel,
    SpaceEntryFilter,
    SpaceMovementsPanel,
    SpaceParticipantsPanel,
    SpaceSettingsPanel,
} from '@/components/spaces/detail/SpaceDetailPanels'
import { SpaceHero } from '@/components/spaces/detail/SpaceHero'
import { SpaceDetailMobileHeader } from '@/components/spaces/detail/SpaceDetailMobileHeader'
import { SpaceKpiRow } from '@/components/spaces/detail/SpaceKpiRow'
import { SpaceSettlementPanel } from '@/components/spaces/detail/SpaceSettlementPanel'
import {
    RecentSpaceAttachmentsCard,
    RecentSpaceMovementsCard,
    SpacePendingConfirmationsCard,
} from '@/components/spaces/detail/SpaceSummaryPanels'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { extractId } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type {
    ISpaceEntry,
    ISpacePendingAction,
} from '@/types'
import type { SpaceFormData } from '@/lib/validations'

type SpaceTab = 'summary' | 'entries' | 'balance'

const SPACE_TABS: Array<{ value: SpaceTab; label: string; shortLabel: string }> = [
    { value: 'summary', label: 'Resumen', shortLabel: 'Resumen' },
    { value: 'entries', label: 'Movimientos', shortLabel: 'Mov.' },
    { value: 'balance', label: 'Balance', shortLabel: 'Balance' },
]

function DetailSkeleton() {
    return (
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
            <Skeleton className="h-12 w-48 rounded-full" />
            <Skeleton className="h-48 rounded-[28px]" />
            <Skeleton className="h-12 rounded-[22px]" />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-[22px]" />
                ))}
            </div>
            <Skeleton className="h-[460px] rounded-[32px]" />
        </div>
    )
}

function SpaceOptionsBar({
    activeTab,
    pendingCount,
    onChange,
}: {
    activeTab: SpaceTab
    pendingCount: number
    onChange: (tab: SpaceTab) => void
}) {
    return (
        <div className="rounded-[22px] border border-foreground/[0.08] bg-card/82 p-1">
            <div className="grid grid-cols-3 gap-1">
                {SPACE_TABS.map((tab) => {
                    const active = activeTab === tab.value
                    const showPending = tab.value === 'entries' && pendingCount > 0

                    return (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => onChange(tab.value)}
                            className={cn(
                                'inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:text-sm',
                                active
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <span className="truncate md:hidden">{tab.shortLabel}</span>
                            <span className="hidden truncate md:inline">{tab.label}</span>
                            {showPending ? (
                                <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
                                    {pendingCount}
                                </span>
                            ) : null}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}


export default function SpaceDetailPage() {
    const params = useParams<{ id: string }>()
    const spaceId = params?.id
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()
    const { data, loading, error, updateSpace } = useSpace(spaceId)
    const entriesApi = useSpaceEntries(spaceId)
    const participantsApi = useSpaceParticipants(spaceId)
    const [activeTab, setActiveTab] = useState<SpaceTab>('summary')
    const [entryFilter, setEntryFilter] = useState<SpaceEntryFilter>('all')
    const [entryDialogOpen, setEntryDialogOpen] = useState(false)
    const [participantDialogOpen, setParticipantDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)

    const currentUserId = data?.currentUserId ?? ''
    const { setAction, clearAction } = useSpaceAction()

    useEffect(() => {
        setAction({
            label: 'Movimiento',
            icon: <Plus size={18} color="#fff" />,
            onPress: () => setEntryDialogOpen(true),
        })
        return () => clearAction()
    }, [setAction, clearAction])

    usePageTitle(data?.space.name ? `${data.space.name} · Espacios` : 'Espacios')
    useAppStartupReady(!loading)

    const currentParticipant = useMemo(
        () =>
            data?.participants.find(
                (participant) => extractId(participant.userId) === currentUserId
            ) ?? null,
        [currentUserId, data?.participants]
    )

    const canManage =
        currentParticipant?.role === 'owner' ||
        currentParticipant?.role === 'admin'

    const pendingConfirmations = useMemo(
        () =>
            data?.pendingActions.filter(
                (action): action is Extract<ISpacePendingAction, { kind: 'confirmation' }> =>
                    action.kind === 'confirmation'
            ) ?? [],
        [data?.pendingActions]
    )

    const handleCreateEntry = async (payload: Parameters<typeof entriesApi.createEntry>[0]) => {
        await entriesApi.createEntry(payload)
        success('Movimiento guardado')
    }

    const handleAddParticipant = async (
        payload: Parameters<typeof participantsApi.addParticipant>[0]
    ) => {
        await participantsApi.addParticipant(payload)
        success('Participante agregado')
    }

    const handleUpdateSpace = async (payload: SpaceFormData) => {
        await updateSpace(payload)
        success('Espacio actualizado')
    }

    const handleToggleClosed = async () => {
        if (!data) return

        try {
            await updateSpace({
                name: data.space.name,
                description: data.space.description,
                type: data.space.type,
                mode: data.space.mode,
                status: data.space.status === 'closed' ? 'active' : 'closed',
                startDate: data.space.startDate,
                endDate: data.space.endDate,
                currencies: data.space.currencies,
                reportingCurrency: data.space.reportingCurrency,
                defaultSplitMode: data.space.defaultSplitMode,
            })
            success(
                data.space.status === 'closed'
                    ? 'Espacio reabierto'
                    : 'Espacio cerrado'
            )
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos actualizar el estado.')
        }
    }

    const handleReviewPending = (
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

        await apiJson(`/api/space-entries/${extractId(selectedPendingEntry._id)}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
        success('Movimiento confirmado')
    }

    if (loading) {
        return <DetailSkeleton />
    }

    if (error || !data) {
        return (
            <div className="mx-auto max-w-[920px] px-4 py-8 md:px-6">
                <div className="rounded-[28px] border border-destructive/15 bg-destructive/5 px-5 py-10 text-center text-sm text-destructive">
                    {error ?? 'No pudimos cargar el espacio.'}
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="mx-auto max-w-[1440px] space-y-5 px-4 pb-28 pt-4 md:space-y-6 md:px-6 md:py-6">
                <SpaceDetailMobileHeader
                    space={data.space}
                    onSettings={() => setEditDialogOpen(true)}
                />

                <div className="hidden flex-wrap items-center gap-3 md:flex">
                    <Button variant="outline" className="rounded-full" asChild>
                        <Link href="/spaces">
                            <ArrowLeft className="h-4 w-4" />
                            Volver a espacios
                        </Link>
                    </Button>
                </div>

                <div className="space-y-4">
                    <SpaceHero
                        space={data.space}
                        summary={data.summary}
                        canManage={canManage}
                        onInvite={() => setParticipantDialogOpen(true)}
                        onCreateEntry={() => setEntryDialogOpen(true)}
                    />

                    <SpaceKpiRow
                        summary={data.summary}
                        reportingCurrency={data.space.reportingCurrency}
                        hidden={hidden}
                    />
                </div>

                <SpaceOptionsBar
                    activeTab={activeTab}
                    pendingCount={data.summary.pendingEntryCount}
                    onChange={setActiveTab}
                />

                {activeTab === 'summary' ? (
                    <div className="space-y-4">
                        <SpaceSettlementPanel
                            balances={data.summary.balances}
                            currency={data.space.reportingCurrency}
                            hidden={hidden}
                            currentUserId={currentUserId}
                            onCreateEntry={() => setEntryDialogOpen(true)}
                        />

                        <div className="hidden gap-4 md:grid xl:grid-cols-[1.15fr_0.85fr]">
                            <SpaceEvolutionChart
                                points={data.summary.monthlyTrend}
                                currency={data.space.reportingCurrency}
                                hidden={hidden}
                            />
                            <SpaceCategoryBreakdown
                                items={data.summary.categoryBreakdown}
                                currency={data.space.reportingCurrency}
                                hidden={hidden}
                            />
                        </div>

                        <div className="hidden md:block">
                            <SpaceBalanceSection
                                balances={data.summary.balances}
                                currency={data.space.reportingCurrency}
                                hidden={hidden}
                                currentUserId={currentUserId}
                            />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <RecentSpaceMovementsCard
                                entries={data.entries}
                                participants={data.participants}
                                reportingCurrency={data.space.reportingCurrency}
                                hidden={hidden}
                                onViewAll={() => setActiveTab('entries')}
                            />
                            <div className="hidden md:block">
                                <RecentSpaceAttachmentsCard entries={data.entries} />
                            </div>
                        </div>

                        {pendingConfirmations.length > 0 ? (
                            <SpacePendingConfirmationsCard
                                actions={pendingConfirmations}
                                onReview={handleReviewPending}
                            />
                        ) : null}
                    </div>
                ) : null}

                {activeTab === 'entries' ? (
                    <SpaceMovementsPanel
                        entries={data.entries}
                        participants={data.participants}
                        entryFilter={entryFilter}
                        onFilterChange={setEntryFilter}
                        reportingCurrency={data.space.reportingCurrency}
                        hidden={hidden}
                        onCreate={() => setEntryDialogOpen(true)}
                    />
                ) : null}

                {activeTab === 'balance' ? (
                    <SpaceBalanceSection
                        balances={data.summary.balances}
                        currency={data.space.reportingCurrency}
                        hidden={hidden}
                        currentUserId={currentUserId}
                    />
                ) : null}

                <div className="hidden space-y-4 md:block">
                    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                        <SpaceParticipantsPanel
                            participants={data.participants}
                            canManage={canManage}
                            onAdd={() => setParticipantDialogOpen(true)}
                        />
                        <SpaceSettingsPanel
                            space={data.space}
                            summary={data.summary}
                            canManage={canManage}
                            onEdit={() => setEditDialogOpen(true)}
                        />
                    </div>

                    <SpaceClosurePanel
                        space={data.space}
                        summary={data.summary}
                        canManage={canManage}
                        onToggleClosed={handleToggleClosed}
                    />
                </div>
            </div>

            <SpaceEntryDialog
                open={entryDialogOpen}
                onOpenChange={setEntryDialogOpen}
                onSubmit={handleCreateEntry}
                participants={data.participants}
                currentUserId={currentUserId}
                defaultCurrency={data.space.reportingCurrency}
                reportingCurrency={data.space.reportingCurrency}
                defaultSplitMode={data.space.defaultSplitMode}
                spaceMode={data.space.mode}
                draftKey={spaceId}
            />

            <SpaceParticipantDialog
                open={participantDialogOpen}
                onOpenChange={setParticipantDialogOpen}
                onSubmit={handleAddParticipant}
            />

            {canManage ? (
                <EditSpaceSettingsDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    onSubmit={handleUpdateSpace}
                    participants={data.participants}
                    onInvite={() => setParticipantDialogOpen(true)}
                    initialValues={{
                        name: data.space.name,
                        description: data.space.description,
                        type: data.space.type,
                        mode: data.space.mode,
                        status: data.space.status,
                        startDate: data.space.startDate,
                        endDate: data.space.endDate,
                        currencies: data.space.currencies,
                        reportingCurrency: data.space.reportingCurrency,
                        defaultSplitMode: data.space.defaultSplitMode,
                    }}
                />
            ) : null}

            <ConfirmSpaceEntryDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                entry={selectedPendingEntry}
                onSubmit={handleConfirmPendingEntry}
            />
        </>
    )
}
