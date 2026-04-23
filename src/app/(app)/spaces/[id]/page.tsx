'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSpace } from '@/hooks/useSpace'
import { useSpaceEntries } from '@/hooks/useSpaceEntries'
import { useSpaceParticipants } from '@/hooks/useSpaceParticipants'
import { useToast } from '@/hooks/useToast'
import {
    CreateSpaceDialog,
    ConfirmSpaceEntryDialog,
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
import { SpaceKpiRow } from '@/components/spaces/detail/SpaceKpiRow'
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
import type {
    ISpaceEntry,
    ISpacePendingAction,
} from '@/types'
import type { SpaceFormData } from '@/lib/validations'

type SpaceTab = 'summary' | 'entries' | 'balance' | 'participants' | 'settings' | 'closure'

function DetailSkeleton() {
    return (
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
            <Skeleton className="h-12 w-48 rounded-full" />
            <Skeleton className="h-64 rounded-[34px]" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-32 rounded-[28px]" />
                ))}
            </div>
            <Skeleton className="h-[460px] rounded-[32px]" />
        </div>
    )
}

export default function SpaceDetailPage() {
    const params = useParams<{ id: string }>()
    const spaceId = params?.id
    const { data: session } = useSession()
    const currentUserId = session?.user?.id ?? ''
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
            <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
                <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" className="rounded-full" asChild>
                        <Link href="/spaces">
                            <ArrowLeft className="h-4 w-4" />
                            Volver a espacios
                        </Link>
                    </Button>
                </div>

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

                <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as SpaceTab)}
                    className="space-y-5"
                >
                    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-[22px] border border-foreground/[0.08] bg-card/94 p-2">
                        {[
                            { value: 'summary', label: 'Resumen' },
                            { value: 'entries', label: 'Movimientos' },
                            { value: 'balance', label: 'Balance' },
                            { value: 'participants', label: 'Participantes' },
                            { value: 'settings', label: 'Configuración' },
                            { value: 'closure', label: 'Cierre' },
                        ].map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className="rounded-[18px] px-4 py-2 data-active:bg-background"
                            >
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    <TabsContent value="summary" className="space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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

                        <SpaceBalanceSection
                            balances={data.summary.balances}
                            currency={data.space.reportingCurrency}
                            hidden={hidden}
                            currentUserId={currentUserId}
                        />

                        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                            <RecentSpaceMovementsCard
                                entries={data.entries}
                                participants={data.participants}
                                reportingCurrency={data.space.reportingCurrency}
                                hidden={hidden}
                                onViewAll={() => setActiveTab('entries')}
                            />
                            <RecentSpaceAttachmentsCard entries={data.entries} />
                        </div>

                        <SpacePendingConfirmationsCard
                            actions={pendingConfirmations}
                            onReview={handleReviewPending}
                        />
                    </TabsContent>

                    <TabsContent value="entries" className="space-y-4">
                        <SpaceMovementsPanel
                            entries={data.entries}
                            participants={data.participants}
                            entryFilter={entryFilter}
                            onFilterChange={setEntryFilter}
                            reportingCurrency={data.space.reportingCurrency}
                            hidden={hidden}
                            onCreate={() => setEntryDialogOpen(true)}
                        />
                    </TabsContent>

                    <TabsContent value="balance" className="space-y-4">
                        <SpaceBalanceSection
                            balances={data.summary.balances}
                            currency={data.space.reportingCurrency}
                            hidden={hidden}
                            currentUserId={currentUserId}
                        />
                    </TabsContent>

                    <TabsContent value="participants" className="space-y-4">
                        <SpaceParticipantsPanel
                            participants={data.participants}
                            canManage={canManage}
                            onAdd={() => setParticipantDialogOpen(true)}
                        />
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                        <SpaceSettingsPanel
                            space={data.space}
                            summary={data.summary}
                            canManage={canManage}
                            onEdit={() => setEditDialogOpen(true)}
                        />
                    </TabsContent>

                    <TabsContent value="closure" className="space-y-4">
                        <SpaceClosurePanel
                            space={data.space}
                            summary={data.summary}
                            canManage={canManage}
                            onToggleClosed={handleToggleClosed}
                        />
                    </TabsContent>
                </Tabs>
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
                <CreateSpaceDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    onSubmit={handleUpdateSpace}
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
                    title="Editar espacio"
                    description="Ajustá el perfil visual y operativo del espacio sin tocar su historial ni su lógica."
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
