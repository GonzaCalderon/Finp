'use client'

import Link from 'next/link'
import { Suspense, useMemo, useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Coins, Plus, Users } from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { useSpaceAction } from '@/contexts/SpaceActionContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSpace } from '@/hooks/useSpace'
import { useSpaceActivity } from '@/hooks/useSpaceActivity'
import { useSpaceEntries } from '@/hooks/useSpaceEntries'
import { useSpaceParticipants } from '@/hooks/useSpaceParticipants'
import { useToast } from '@/hooks/useToast'
import {
    ConfirmSpaceEntryDialog,
    EditSpaceSettingsDialog,
    SpaceEntryDialog,
    SpaceParticipantDialog,
} from '@/components/spaces/SpaceDialogs'
import {
    SpaceSettlementDialog,
    type SettlementPrefill,
} from '@/components/spaces/dialogs/SpaceSettlementDialog'
import {
    SpaceCurrencyStack,
    SpaceMetaBadge,
    SpaceAmountInline,
    SpaceModeBadge,
    SpaceStatusBadge,
    SpaceTypeBadge,
} from '@/components/spaces/SpaceUi'
import { SpaceBalanceSection, buildRecommendedPayments } from '@/components/spaces/detail/SpaceBalanceSection'
import {
    SpaceCategoryBreakdown,
    SpaceEvolutionChart,
} from '@/components/spaces/detail/SpaceCharts'
import {
    SpaceEntryFilter,
    SpaceMovementsPanel,
    SpaceSettingsPanel,
} from '@/components/spaces/detail/SpaceDetailPanels'
import { SpaceHero } from '@/components/spaces/detail/SpaceHero'
import { SpaceDetailMobileHeader } from '@/components/spaces/detail/SpaceDetailMobileHeader'
import { SpaceKpiRow } from '@/components/spaces/detail/SpaceKpiRow'
import { SpaceMobileSettingsSheet } from '@/components/spaces/detail/SpaceMobileSettingsSheet'
import { SpaceEntryDetailSheet } from '@/components/spaces/detail/SpaceEntryDetailSheet'
import { VoidEntryDialog } from '@/components/spaces/dialogs/VoidEntryDialog'
import { SpaceSettlementPanel } from '@/components/spaces/detail/SpaceSettlementPanel'
import {
    RecentSpaceActivityCard,
    SpacePendingConfirmationsCard,
} from '@/components/spaces/detail/SpaceSummaryPanels'
import { SpacesPendingSheet } from '@/components/spaces/pending/SpacePendingViews'
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
    SpaceSummarySnapshot,
} from '@/types'
import type { SpaceFormData } from '@/lib/validations'

type SpaceTab = 'summary' | 'entries' | 'balance' | 'settings'
type PendingSheetTab = 'pending' | 'activity'

const MOBILE_TABS: Array<{ value: SpaceTab; label: string }> = [
    { value: 'summary', label: 'Resumen' },
    { value: 'entries', label: 'Movimientos' },
    { value: 'balance', label: 'Balance' },
]

const DESKTOP_TABS: Array<{ value: SpaceTab; label: string }> = [
    { value: 'summary', label: 'Resumen' },
    { value: 'entries', label: 'Movimientos' },
    { value: 'balance', label: 'Balance' },
    { value: 'settings', label: 'Configuración' },
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

function MobileTabBar({
    activeTab,
    pendingCount,
    onChange,
}: {
    activeTab: SpaceTab
    pendingCount: number
    onChange: (tab: SpaceTab) => void
}) {
    const activeMobile = MOBILE_TABS.some((t) => t.value === activeTab) ? activeTab : 'summary'

    return (
        <div className="rounded-[22px] border border-foreground/[0.08] bg-card/82 p-1 md:hidden">
            <div className="grid grid-cols-3 gap-1">
                {MOBILE_TABS.map((tab) => {
                    const active = activeMobile === tab.value
                    const showPending = tab.value === 'entries' && pendingCount > 0

                    return (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => onChange(tab.value)}
                            className={cn('relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2 text-sm font-medium transition-colors', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {active ? <motion.span layoutId="space-mobile-tab" className="absolute inset-0 rounded-[16px] bg-background shadow-sm" /> : null}
                            <span className="relative truncate">{tab.label}</span>
                            {showPending ? (
                                <span className="relative shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
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

function DesktopTabBar({
    activeTab,
    pendingCount,
    onChange,
}: {
    activeTab: SpaceTab
    pendingCount: number
    onChange: (tab: SpaceTab) => void
}) {
    return (
        <div className="hidden rounded-[22px] border border-foreground/[0.08] bg-card/82 p-1 md:block">
            <div className="grid grid-cols-4 gap-1">
                {DESKTOP_TABS.map((tab) => {
                    const active = activeTab === tab.value
                    const showPending = tab.value === 'entries' && pendingCount > 0

                    return (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => onChange(tab.value)}
                            className={cn('relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 py-2 text-sm font-medium transition-colors', active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                            {active ? <motion.span layoutId="space-desktop-tab" className="absolute inset-0 rounded-[16px] bg-background shadow-sm" /> : null}
                            <span className="relative truncate">{tab.label}</span>
                            {showPending ? (
                                <span className="relative shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
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

function SpaceMovementsKpiRow({
    summary,
    currency,
    hidden,
}: {
    summary: SpaceSummarySnapshot
    currency: string
    hidden: boolean
}) {
    const items = [
        ['Total gastado', summary.totalReporting, `${summary.totalEntryCount} movimientos`, undefined],
        ['Tu parte', summary.yourShareReporting, 'Correspondiente', 'var(--chart-1)'],
        ['Confirmados', Math.max(0, summary.totalEntryCount - summary.pendingEntryCount), 'Movimientos cerrados', 'var(--chart-3)'],
        ['Pendientes', summary.pendingEntryCount, 'Por confirmar', 'var(--destructive)'],
    ] as const

    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {items.map(([label, value, footer, accent], index) => (
                <div
                    key={label}
                    className="rounded-[22px] border border-foreground/[0.07] bg-background/78 p-3.5 backdrop-blur-sm"
                >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                    {index < 2 ? (
                        <SpaceAmountInline amount={value} currency={currency} hidden={hidden} color={accent} className="mt-2 block text-[1.35rem] font-semibold tracking-tight" />
                    ) : (
                        <p className="mt-2 text-[1.35rem] font-semibold tracking-tight" style={{ color: accent }}>{value}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">{footer}</p>
                </div>
            ))}
        </div>
    )
}


function SpaceDetailPageInner() {
    const params = useParams<{ id: string }>()
    const searchParams = useSearchParams()
    const focusEntryId = searchParams?.get('entryId') ?? null
    const spaceId = params?.id
    const { hidden } = useHideAmounts()
    const { success, error: toastError } = useToast()
    const { data, loading, error, updateSpace } = useSpace(spaceId)
    const spaceActivity = useSpaceActivity(spaceId)
    const entriesApi = useSpaceEntries(spaceId)
    const participantsApi = useSpaceParticipants(spaceId)
    const [activeTab, setActiveTab] = useState<SpaceTab>(() => focusEntryId ? 'entries' : 'summary')
    const [entryFilter, setEntryFilter] = useState<SpaceEntryFilter>('all')
    const [entryDialogOpen, setEntryDialogOpen] = useState(false)
    const [participantDialogOpen, setParticipantDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
    const [pendingSheetOpen, setPendingSheetOpen] = useState(false)
    const [pendingSheetTab, setPendingSheetTab] = useState<PendingSheetTab>('pending')
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
    const [selectedPendingEntry, setSelectedPendingEntry] = useState<ISpaceEntry | null>(null)
    const [focusedEntryId, setFocusedEntryId] = useState<string | null>(focusEntryId)
    const [detailEntry, setDetailEntry] = useState<ISpaceEntry | null>(null)
    const [editEntryDialogOpen, setEditEntryDialogOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<ISpaceEntry | null>(null)
    const [editEntryHasSubsequentSettlement, setEditEntryHasSubsequentSettlement] = useState(false)
    const [voidingEntry, setVoidingEntry] = useState<ISpaceEntry | null>(null)
    const [voidEntryDialogOpen, setVoidEntryDialogOpen] = useState(false)
    const [voidContext, setVoidContext] = useState({ hasLinkedTransaction: false, hasSubsequentSettlement: false })
    const [settlementDialogOpen, setSettlementDialogOpen] = useState(false)
    const [settlementPrefill, setSettlementPrefill] = useState<SettlementPrefill | undefined>()

    const currentUserId = data?.currentUserId ?? ''
    const { setAction, clearAction } = useSpaceAction()

    useEffect(() => {
        setAction({
            label: 'Agregar movimiento',
            icon: <Plus size={18} color="#fff" />,
            onPress: () => {
                setFocusedEntryId(null)
                setEntryDialogOpen(true)
            },
        })
        return () => clearAction()
    }, [setAction, clearAction])

    useEffect(() => {
        if (!focusEntryId) return
        queueMicrotask(() => {
            setFocusedEntryId((prev) => prev === focusEntryId ? prev : focusEntryId)
            setActiveTab((prev) => prev === 'entries' ? prev : 'entries')
        })
    }, [focusEntryId])

    useEffect(() => {
        if (activeTab !== 'entries' || !focusedEntryId) return
        const el = document.querySelector(`[data-entry-id="${focusedEntryId}"]`)
        if (el) {
            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
        }
    }, [activeTab, focusedEntryId, data?.entries])

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

    const suggestedPayments = data?.summary.balances ? buildRecommendedPayments(data.summary.balances) : []

    const handleCreateEntry = async (payload: Parameters<typeof entriesApi.createEntry>[0]) => {
        setFocusedEntryId(null)
        const entry = await entriesApi.createEntry(payload)
        success('Movimiento guardado')
        return entry
    }

    function handleRegisterSettlement(prefill?: SettlementPrefill) {
        setFocusedEntryId(null)
        setSettlementPrefill(prefill)
        setSettlementDialogOpen(true)
    }

    async function handleCreateSettlementDirect(payerId: string, receiverId: string, amount: number) {
        const payerParticipant = data?.participants.find((p) => extractId(p._id) === payerId)
        const receiverParticipant = data?.participants.find((p) => extractId(p._id) === receiverId)
        await handleCreateEntry({
            type: 'settlement',
            title: `Pago de ${payerParticipant?.displayName ?? 'participante'} a ${receiverParticipant?.displayName ?? 'participante'}`,
            amount,
            currency: data?.space.reportingCurrency ?? '',
            date: new Date(),
            paidByParticipantId: payerId,
            sharedWithParticipantIds: [receiverId],
            splitMode: 'none',
        })
    }

    const handleAddParticipant = async (
        payload: Parameters<typeof participantsApi.addParticipant>[0]
    ) => {
        await participantsApi.addParticipant(payload)
        success('Participante agregado')
    }

    const handleUpdateParticipantRole = async (participantId: string, role: 'admin' | 'participant') => {
        await participantsApi.updateParticipantRole(participantId, role)
        success('Rol actualizado')
    }

    const handleRemoveParticipant = async (participantId: string) => {
        await participantsApi.removeParticipant(participantId)
        success('Participante quitado')
    }

    const handleInviteResponse = async (
        action: Extract<ISpacePendingAction, { kind: 'invite' }>,
        inviteStatus: 'accepted' | 'declined'
    ) => {
        await participantsApi.respondToInvite(
            extractId(action.participant._id) ?? '',
            inviteStatus
        )
        success(inviteStatus === 'accepted' ? 'Invitación aceptada' : 'Invitación rechazada')
    }

    const handleUpdateSpace = async (payload: SpaceFormData) => {
        await updateSpace(payload)
        success('Espacio actualizado')
    }

    const handlePatchSpace = async (patch: Partial<SpaceFormData>) => {
        if (!data) return

        await updateSpace({
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
            ...patch,
        })
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

    const handleRejectConfirmation = async (
        action: Extract<ISpacePendingAction, { kind: 'confirmation' }>
    ) => {
        await apiJson(`/api/space-entries/${extractId(action.entry._id)}/reject`, {
            method: 'POST',
        })
        invalidateData(SPACE_INVALIDATION_TAGS)
        success('Movimiento rechazado')
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

    async function handleQuickVoid(entry: ISpaceEntry) {
        setFocusedEntryId(null)
        const entryId = extractId(entry._id)
        setVoidingEntry(entry)
        let hasLinkedTransaction = false
        let hasSubsequentSettlement = false
        const payer = data?.participants.find(
            (participant) => extractId(participant._id) === extractId(entry.paidByParticipantId)
        )
        const impactsCurrentUser = Boolean(
            data?.personalImpactsByEntryId[entryId ?? '']?.linkedImpact?.status === 'linked' ||
            (
                entry.linkedTransactionId &&
                currentUserId &&
                payer &&
                (extractId(entry.confirmedByUserId) === currentUserId || extractId(payer.userId) === currentUserId)
            )
        )
        try {
            const res = await fetch(`/api/spaces/${spaceId}/entries/${entryId}`)
            if (res.ok) {
                const json = await res.json() as { hasLinkedTransaction: boolean; hasSubsequentSettlement: boolean }
                hasLinkedTransaction = json.hasLinkedTransaction && impactsCurrentUser
                hasSubsequentSettlement = json.hasSubsequentSettlement
            }
        } catch {
            // proceed without warning
        }
        setVoidContext({ hasLinkedTransaction, hasSubsequentSettlement })
        setVoidEntryDialogOpen(true)
    }

    async function handleStandaloneVoidConfirm(voidReason?: string) {
        const entryId = extractId(voidingEntry?._id)
        if (!entryId) return
        const response = await fetch(`/api/spaces/${spaceId}/entries/${entryId}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voidReason }),
        })
        const json = await response.json() as { entry?: ISpaceEntry; error?: string }
        if (!response.ok) throw new Error(json.error ?? 'No se pudo anular el movimiento.')
        invalidateData(SPACE_INVALIDATION_TAGS)
        success('Movimiento anulado')
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
                {/* Mobile header: ← | selector | ⚙ | ⋯ */}
                <SpaceDetailMobileHeader
                    space={data.space}
                    onSettings={() => setSettingsSheetOpen(true)}
                />

                {/* Desktop back button */}
                <div className="hidden flex-wrap items-center gap-3 md:flex">
                    <Button variant="outline" className="rounded-full" asChild>
                        <Link href="/spaces">
                            <ArrowLeft className="h-4 w-4" />
                            Volver a espacios
                        </Link>
                    </Button>
                </div>

                {/* Mobile compact title + pills */}
                <div className="space-y-2 md:hidden">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground leading-tight">
                        {data.space.name}
                    </h1>
                    {data.space.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                            {data.space.description}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <SpaceTypeBadge type={data.space.type} />
                        <SpaceModeBadge mode={data.space.mode} />
                        <SpaceStatusBadge status={data.space.status} />
                        <SpaceMetaBadge icon={Users}>
                            {data.summary.participantCount} part.
                        </SpaceMetaBadge>
                        <SpaceMetaBadge icon={Coins}>
                            <SpaceCurrencyStack currencies={data.space.currencies} />
                        </SpaceMetaBadge>
                    </div>
                </div>

                {/* Desktop hero */}
                <div className="hidden md:block">
                    <div className="space-y-4">
                        <SpaceHero
                            space={data.space}
                            summary={data.summary}
                            canManage={canManage}
                            onInvite={() => setParticipantDialogOpen(true)}
                            onCreateEntry={() => setEntryDialogOpen(true)}
                        />
                    </div>
                </div>
                <div className="hidden border-t border-border/70 md:block" />

                {/* Mobile tab bar (3 tabs) */}
                <MobileTabBar
                    activeTab={activeTab}
                    pendingCount={data.summary.pendingEntryCount}
                    onChange={(tab) => {
                        setFocusedEntryId(null)
                        setActiveTab(tab)
                    }}
                />

                {/* Desktop tab bar (6 tabs) */}
                <DesktopTabBar
                    activeTab={activeTab}
                    pendingCount={data.summary.pendingEntryCount}
                    onChange={(tab) => {
                        setFocusedEntryId(null)
                        setActiveTab(tab)
                    }}
                />

                {/* Summary tab */}
                {activeTab === 'summary' ? (
                    <div className="space-y-4">
                        <SpaceKpiRow
                            summary={data.summary}
                            reportingCurrency={data.space.reportingCurrency}
                            hidden={hidden}
                        />

                        <SpaceSettlementPanel
                            balances={data.summary.balances}
                            currency={data.space.reportingCurrency}
                            hidden={hidden}
                            currentUserId={currentUserId}
                            onGoToBalance={() => {
                                setFocusedEntryId(null)
                                setActiveTab('balance')
                            }}
                        />

                        {/* Charts: visible on mobile and desktop */}
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_0.85fr]">
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

                        <RecentSpaceActivityCard
                            events={spaceActivity.events}
                            participants={data.participants}
                            onViewAll={() => {
                                setPendingSheetTab('activity')
                                setPendingSheetOpen(true)
                            }}
                        />

                        {pendingConfirmations.length > 0 ? (
                            <SpacePendingConfirmationsCard
                                actions={pendingConfirmations}
                                onReview={handleReviewPending}
                            />
                        ) : null}
                    </div>
                ) : null}

                {activeTab === 'entries' ? (
                    <div className="space-y-4">
                        <SpaceMovementsKpiRow
                            summary={data.summary}
                            currency={data.space.reportingCurrency}
                            hidden={hidden}
                        />
                        <SpaceMovementsPanel
                            entries={data.entries}
                            participants={data.participants}
                            currentUserId={currentUserId}
                            personalImpactsByEntryId={data.personalImpactsByEntryId}
                            canManage={canManage}
                            entryFilter={entryFilter}
                            onFilterChange={(filter) => {
                                setFocusedEntryId(null)
                                setEntryFilter(filter)
                            }}
                            reportingCurrency={data.space.reportingCurrency}
                            hidden={hidden}
                            focusEntryId={focusedEntryId}
                            onCreate={() => {
                                setFocusedEntryId(null)
                                setEntryDialogOpen(true)
                            }}
                            onEntryClick={(entry) => {
                                setFocusedEntryId(null)
                                setDetailEntry(entry)
                            }}
                            onEdit={(entry) => {
                                setFocusedEntryId(null)
                                setEditingEntry(entry)
                                setEditEntryHasSubsequentSettlement(false)
                                setEditEntryDialogOpen(true)
                            }}
                            onVoid={handleQuickVoid}
                        />
                    </div>
                ) : null}

                {activeTab === 'balance' ? (
                    <SpaceBalanceSection
                        balances={data.summary.balances}
                        entries={data.entries}
                        currency={data.space.reportingCurrency}
                        hidden={hidden}
                        currentUserId={currentUserId}
                        simplifyDebts={data.space.simplifyDebts ?? undefined}
                        debtMode={data.space.debtMode ?? undefined}
                        onRegisterSettlement={handleRegisterSettlement}
                        onCreateSettlementDirect={handleCreateSettlementDirect}
                        onViewAllSettlements={() => {
                            setFocusedEntryId(null)
                            setActiveTab('entries')
                            setEntryFilter('settlement')
                        }}
                    />
                ) : null}

                {activeTab === 'settings' ? (
                    <SpaceSettingsPanel
                        space={data.space}
                        spaceId={spaceId}
                        participants={data.participants}
                        canManage={canManage}
                        currentParticipantRole={currentParticipant?.role ?? 'participant'}
                        currentUserId={currentUserId}
                        onAddParticipant={() => setParticipantDialogOpen(true)}
                        onToggleClosed={handleToggleClosed}
                        onUpdateSettings={handlePatchSpace}
                        onUpdateParticipantRole={handleUpdateParticipantRole}
                        onRemoveParticipant={handleRemoveParticipant}
                    />
                ) : null}
            </div>

            <SpaceEntryDialog
                open={entryDialogOpen}
                onOpenChange={setEntryDialogOpen}
                onSubmit={handleCreateEntry}
                spaceId={spaceId}
                participants={data.participants}
                currentUserId={currentUserId}
                defaultCurrency={data.space.reportingCurrency}
                reportingCurrency={data.space.reportingCurrency}
                spaceCurrencies={data.space.currencies}
                defaultSplitMode={data.space.defaultSplitMode}
                spaceMode={data.space.mode}
                draftKey={spaceId}
            />

            <SpaceParticipantDialog
                open={participantDialogOpen}
                onOpenChange={setParticipantDialogOpen}
                onSubmit={handleAddParticipant}
            />

            <SpaceSettlementDialog
                open={settlementDialogOpen}
                onOpenChange={setSettlementDialogOpen}
                onSubmit={handleCreateEntry}
                participants={data.participants}
                defaultCurrency={data.space.reportingCurrency}
                reportingCurrency={data.space.reportingCurrency}
                prefill={settlementPrefill}
                suggestedPayments={suggestedPayments}
            />

            <SpacesPendingSheet
                key={pendingSheetTab}
                open={pendingSheetOpen}
                onOpenChange={setPendingSheetOpen}
                actions={data.pendingActions}
                loading={false}
                spaceId={spaceId}
                currentUserId={currentUserId}
                initialTab={pendingSheetTab}
                onAcceptInvite={(action) => void handleInviteResponse(action, 'accepted')}
                onRejectInvite={(action) => void handleInviteResponse(action, 'declined')}
                onReviewConfirmation={handleReviewPending}
                onRejectConfirmation={(action) => void handleRejectConfirmation(action)}
            />

            {canManage ? (
                <EditSpaceSettingsDialog
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                    onSubmit={handleUpdateSpace}
                    spaceId={spaceId}
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
                        simplifyDebts: data.space.simplifyDebts,
                    }}
                />
            ) : null}

            <ConfirmSpaceEntryDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                entry={selectedPendingEntry}
                onSubmit={handleConfirmPendingEntry}
            />

            <SpaceEntryDetailSheet
                open={detailEntry !== null}
                onOpenChange={(open) => {
                    if (!open) setDetailEntry(null)
                }}
                entry={detailEntry}
                participants={data.participants}
                spaceId={spaceId}
                currency={data.space.reportingCurrency}
                currentUserId={currentUserId}
                personalImpact={detailEntry ? data.personalImpactsByEntryId[extractId(detailEntry._id) ?? '']?.linkedImpact : undefined}
                activityEvents={spaceActivity.events}
                canEdit={Boolean(
                    detailEntry && (
                        extractId(detailEntry.createdByUserId) === currentUserId ||
                        currentParticipant?.role === 'owner' ||
                        currentParticipant?.role === 'admin'
                    )
                )}
                canVoid={Boolean(
                    detailEntry && !detailEntry.isVoided && (
                        extractId(detailEntry.createdByUserId) === currentUserId ||
                        currentParticipant?.role === 'owner' ||
                        currentParticipant?.role === 'admin'
                    )
                )}
                onEdit={(entry, hasSubsequentSettlement) => {
                    setEditingEntry(entry)
                    setEditEntryHasSubsequentSettlement(hasSubsequentSettlement)
                    setEditEntryDialogOpen(true)
                }}
                onVoided={(voidedEntry) => {
                    setDetailEntry(voidedEntry)
                    invalidateData(SPACE_INVALIDATION_TAGS)
                    success('Movimiento anulado')
                }}
                onPersonalImpactCreated={() => {
                    invalidateData(SPACE_INVALIDATION_TAGS)
                    success('Registrado en tu Finp')
                }}
            />

            {/* Dialog edición de movimiento */}
            <SpaceEntryDialog
                open={editEntryDialogOpen}
                onOpenChange={setEditEntryDialogOpen}
                onSubmit={handleCreateEntry}
                onEditComplete={(updatedEntry) => {
                    setDetailEntry(updatedEntry)
                    invalidateData(SPACE_INVALIDATION_TAGS)
                    success('Movimiento actualizado')
                }}
                spaceId={spaceId}
                participants={data.participants}
                currentUserId={currentUserId}
                defaultCurrency={data.space.reportingCurrency}
                reportingCurrency={data.space.reportingCurrency}
                spaceCurrencies={data.space.currencies}
                defaultSplitMode={data.space.defaultSplitMode}
                spaceMode={data.space.mode}
                mode="edit"
                initialData={editingEntry ?? undefined}
                initialHasSubsequentSettlement={editEntryHasSubsequentSettlement}
            />

            {/* Dialog anulación rápida desde MovementCard */}
            {voidingEntry ? (
                <VoidEntryDialog
                    open={voidEntryDialogOpen}
                    onOpenChange={setVoidEntryDialogOpen}
                    entry={voidingEntry}
                    hasLinkedTransaction={voidContext.hasLinkedTransaction}
                    hasSubsequentSettlement={voidContext.hasSubsequentSettlement}
                    onConfirm={handleStandaloneVoidConfirm}
                />
            ) : null}

            {/* Mobile settings sheet: gear button → participantes + configuración + cierre */}
            <SpaceMobileSettingsSheet
                open={settingsSheetOpen}
                onClose={() => setSettingsSheetOpen(false)}
                space={data.space}
                participants={data.participants}
                canManage={canManage}
                currentParticipantRole={currentParticipant?.role ?? 'participant'}
                currentUserId={currentUserId}
                onEdit={() => setEditDialogOpen(true)}
                onAddParticipant={() => setParticipantDialogOpen(true)}
                onToggleClosed={handleToggleClosed}
                onUpdateParticipantRole={handleUpdateParticipantRole}
                onRemoveParticipant={handleRemoveParticipant}
            />
        </>
    )
}

export default function SpaceDetailPage() {
    return (
        <Suspense fallback={null}>
            <SpaceDetailPageInner />
        </Suspense>
    )
}
