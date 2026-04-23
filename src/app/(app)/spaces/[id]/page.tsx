'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
    ArrowLeft,
    CheckCircle2,
    Home,
    Plane,
    Plus,
    Settings2,
    Sparkles,
    Users,
    UserPlus,
} from 'lucide-react'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
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
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import {
    extractId,
    formatSpaceDate,
    formatSpaceDateRange,
    resolveSpaceStatusTone,
    resolveSpaceTypeAccent,
    SPACE_ENTRY_TYPE_LABELS,
    SPACE_MODE_LABELS,
    SPACE_STATUS_LABELS,
    SPACE_TYPE_LABELS,
} from '@/lib/utils/spaces'
import type {
    ISpaceEntry,
    ISpacePendingAction,
    SpaceBalanceItem,
} from '@/types'
import type { SpaceFormData } from '@/lib/validations'

type EntryFilter = 'all' | ISpaceEntry['type']

const TYPE_META = {
    couple: { icon: Users },
    home: { icon: Home },
    travel: { icon: Plane },
    project: { icon: Sparkles },
    event: { icon: Sparkles },
    personal: { icon: Sparkles },
    other: { icon: Sparkles },
} as const

function AmountValue({
    amount,
    currency,
    hidden,
    className,
    color,
}: {
    amount: number
    currency: 'ARS' | 'USD'
    hidden: boolean
    className?: string
    color?: string
}) {
    return (
        <ResponsiveAmount
            amount={amount}
            currency={currency}
            hidden={hidden}
            className={className}
            color={color}
        />
    )
}

function SummaryMetric({
    label,
    amount,
    currency,
    hidden,
    accent,
}: {
    label: string
    amount: number
    currency: 'ARS' | 'USD'
    hidden: boolean
    accent?: string
}) {
    return (
        <div className="rounded-[26px] border bg-card/70 p-4" style={{ boxShadow: 'var(--card-shadow)' }}>
            <p className="text-sm text-muted-foreground">{label}</p>
            <AmountValue
                amount={amount}
                currency={currency}
                hidden={hidden}
                className="mt-2 text-[1.75rem] font-semibold tracking-tight"
                color={accent}
            />
        </div>
    )
}

function EntryStatusBadge({ status }: { status: ISpaceEntry['status'] }) {
    const tone =
        status === 'linked'
            ? { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
            : status === 'confirmed'
                ? { background: 'rgba(59,130,246,0.12)', color: '#2563EB' }
                : status === 'pending_confirmation'
                    ? { background: 'rgba(245,158,11,0.12)', color: '#D97706' }
                    : { background: 'rgba(239,68,68,0.12)', color: '#EF4444' }

    return (
        <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{
                background: tone.background,
                color: tone.color,
            }}
        >
            {status === 'linked'
                ? 'Vinculado'
                : status === 'confirmed'
                    ? 'Confirmado'
                    : status === 'pending_confirmation'
                        ? 'Pendiente'
                        : 'Rechazado'}
        </span>
    )
}

function MovementRow({
    entry,
    hidden,
    reportingCurrency,
}: {
    entry: ISpaceEntry
    hidden: boolean
    reportingCurrency: 'ARS' | 'USD'
}) {
    return (
        <div className="grid gap-3 rounded-[24px] border bg-card/80 p-4 md:grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr] md:items-center">
            <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                        {SPACE_ENTRY_TYPE_LABELS[entry.type]}
                    </span>
                    <EntryStatusBadge status={entry.status} />
                </div>
                <p className="text-base font-medium">{entry.title}</p>
                <p className="text-sm text-muted-foreground">
                    {formatSpaceDate(entry.date)}
                </p>
            </div>

            <div>
                <p className="text-xs text-muted-foreground">Monto original</p>
                <AmountValue
                    amount={entry.amount}
                    currency={entry.currency}
                    hidden={hidden}
                    className="mt-1 text-lg font-semibold tracking-tight"
                />
            </div>

            <div>
                <p className="text-xs text-muted-foreground">Reporte</p>
                <AmountValue
                    amount={entry.reportingAmount}
                    currency={reportingCurrency}
                    hidden={hidden}
                    className="mt-1 text-lg font-semibold tracking-tight"
                />
            </div>

            <div className="text-sm text-muted-foreground">
                {entry.notes ? (
                    <p className="line-clamp-2">{entry.notes}</p>
                ) : (
                    <p>Sin notas</p>
                )}
            </div>
        </div>
    )
}

function BalanceCard({
    balance,
    hidden,
    reportingCurrency,
}: {
    balance: SpaceBalanceItem
    hidden: boolean
    reportingCurrency: 'ARS' | 'USD'
}) {
    const initials = balance.displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')

    return (
        <div className="rounded-[26px] border bg-card/80 p-4">
            <div className="flex items-center gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                        background:
                            'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, white), color-mix(in srgb, var(--foreground) 6%, white))',
                    }}
                >
                    {initials}
                </div>
                <div>
                    <p className="font-medium">{balance.displayName}</p>
                    <p className="text-xs text-muted-foreground">{balance.role}</p>
                </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                    <p className="text-xs text-muted-foreground">Pagó</p>
                    <AmountValue
                        amount={balance.paidReporting}
                        currency={reportingCurrency}
                        hidden={hidden}
                        className="mt-1 text-base font-semibold"
                    />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Le corresponde</p>
                    <AmountValue
                        amount={balance.shareReporting}
                        currency={reportingCurrency}
                        hidden={hidden}
                        className="mt-1 text-base font-semibold"
                    />
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <AmountValue
                        amount={Math.abs(balance.balanceReporting)}
                        currency={reportingCurrency}
                        hidden={hidden}
                        className="mt-1 text-base font-semibold"
                        color={balance.balanceReporting >= 0 ? '#10B981' : '#EF4444'}
                    />
                </div>
            </div>
        </div>
    )
}

function DetailSkeleton() {
    return (
        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
            <Skeleton className="h-44 rounded-[34px]" />
            <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-[26px]" />
                ))}
            </div>
            <Skeleton className="h-96 rounded-[32px]" />
        </div>
    )
}

function spaceToFormData(space: SpaceFormData) {
    return {
        ...space,
    }
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
    const [entryFilter, setEntryFilter] = useState<EntryFilter>('all')
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

    const filteredEntries = useMemo(() => {
        if (!data) return []
        return data.entries.filter((entry) =>
            entryFilter === 'all' ? true : entry.type === entryFilter
        )
    }, [data, entryFilter])

    const pendingConfirmations = useMemo(
        () =>
            data?.pendingActions.filter(
                (action): action is Extract<ISpacePendingAction, { kind: 'confirmation' }> =>
                    action.kind === 'confirmation'
            ) ?? [],
        [data?.pendingActions]
    )

    const handleCreateEntry = async (payload: Parameters<typeof entriesApi.createEntry>[0]) => {
        try {
            await entriesApi.createEntry(payload)
            success('Movimiento guardado')
        } catch (err) {
            throw err
        }
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
                ...spaceToFormData({
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
                }),
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

    const typeAccent = resolveSpaceTypeAccent(data.space.type)
    const statusTone = resolveSpaceStatusTone(data.space.status)
    const Icon = TYPE_META[data.space.type].icon

    return (
        <>
            <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-4 md:px-6 md:py-6">
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Link
                        href="/spaces"
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Volver a espacios
                    </Link>
                </div>

                <div className="rounded-[34px] border bg-card px-5 py-5 md:px-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div
                                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px]"
                                style={{
                                    background: typeAccent.background,
                                    color: typeAccent.color,
                                }}
                            >
                                <Icon className="h-7 w-7" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-4xl font-semibold tracking-tight">
                                        {data.space.name}
                                    </h1>
                                    <span
                                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                                        style={{
                                            background: statusTone.background,
                                            color: statusTone.color,
                                        }}
                                    >
                                        {SPACE_STATUS_LABELS[data.space.status]}
                                    </span>
                                </div>

                                <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
                                    {data.space.description || 'Este espacio todavía no tiene una descripción cargada.'}
                                </p>

                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span
                                        className="rounded-full px-2.5 py-1 font-medium"
                                        style={{
                                            background: typeAccent.background,
                                            color: typeAccent.color,
                                        }}
                                    >
                                        {SPACE_TYPE_LABELS[data.space.type]}
                                    </span>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                                        {SPACE_MODE_LABELS[data.space.mode]}
                                    </span>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                                        {data.summary.participantCount} participantes
                                    </span>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                                        {data.space.currencies.join(' / ')}
                                    </span>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                                        {formatSpaceDateRange(data.space.startDate, data.space.endDate)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {canManage && (
                                <Button variant="outline" className="rounded-full" onClick={() => setParticipantDialogOpen(true)}>
                                    <UserPlus className="h-4 w-4" />
                                    Invitar
                                </Button>
                            )}
                            <Button className="rounded-full" onClick={() => setEntryDialogOpen(true)}>
                                <Plus className="h-4 w-4" />
                                Nuevo movimiento
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
                    <SummaryMetric
                        label="Gastado total"
                        amount={data.summary.totalReporting}
                        currency={data.space.reportingCurrency}
                        hidden={hidden}
                    />
                    <SummaryMetric
                        label="Tu parte"
                        amount={data.summary.yourShareReporting}
                        currency={data.space.reportingCurrency}
                        hidden={hidden}
                    />
                    <SummaryMetric
                        label="Pendiente"
                        amount={data.summary.pendingToPayReporting}
                        currency={data.space.reportingCurrency}
                        hidden={hidden}
                    />
                    <SummaryMetric
                        label="Saldo a favor"
                        amount={data.summary.pendingToCollectReporting}
                        currency={data.space.reportingCurrency}
                        hidden={hidden}
                        accent="#10B981"
                    />
                </div>

                <Tabs defaultValue="summary" className="space-y-5">
                    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-[22px] bg-card p-2">
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
                        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                            <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                                <div className="mb-4">
                                    <h2 className="text-xl font-semibold tracking-tight">
                                        Evolución mensual
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Cómo se fue moviendo el espacio en los últimos meses.
                                    </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-6">
                                    {data.summary.monthlyTrend.length > 0 ? (
                                        data.summary.monthlyTrend.map((point) => (
                                            <div
                                                key={point.month}
                                                className="rounded-[22px] border bg-background/80 p-3"
                                            >
                                                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                                    {point.label}
                                                </p>
                                                <AmountValue
                                                    amount={point.amount}
                                                    currency={data.space.reportingCurrency}
                                                    hidden={hidden}
                                                    className="mt-2 text-sm font-semibold"
                                                />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-full rounded-[22px] border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                                            Todavía no hay suficientes movimientos para mostrar evolución.
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                                <div className="mb-4">
                                    <h2 className="text-xl font-semibold tracking-tight">
                                        Distribución por categoría
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Qué categorías explican el gasto total del espacio.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {data.summary.categoryBreakdown.length > 0 ? (
                                        data.summary.categoryBreakdown.map((item) => (
                                            <div key={`${item.categoryId ?? 'uncategorized'}-${item.label}`} className="space-y-1.5">
                                                <div className="flex items-center justify-between gap-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="h-2.5 w-2.5 rounded-full"
                                                            style={{
                                                                background: item.color ?? 'var(--primary)',
                                                            }}
                                                        />
                                                        <span>{item.label}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <AmountValue
                                                            amount={item.amount}
                                                            currency={data.space.reportingCurrency}
                                                            hidden={hidden}
                                                            className="font-semibold"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="h-2 rounded-full bg-muted">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${Math.min(item.percentage, 100)}%`,
                                                            background: item.color ?? 'var(--primary)',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-[22px] border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                                            No hay categorías suficientes para resumir todavía.
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>

                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight">Balance entre participantes</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Quién adelantó de más y quién todavía tiene saldo pendiente.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-2">
                                {data.summary.balances.map((balance) => (
                                    <BalanceCard
                                        key={balance.participantId}
                                        balance={balance}
                                        hidden={hidden}
                                        reportingCurrency={data.space.reportingCurrency}
                                    />
                                ))}
                            </div>
                        </section>

                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight">
                                        Pendientes dentro del espacio
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Confirmaciones que todavía esperan una acción del pagador.
                                    </p>
                                </div>
                            </div>

                            {pendingConfirmations.length === 0 ? (
                                <div className="rounded-[24px] border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                                    No hay confirmaciones pendientes dentro de este espacio.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pendingConfirmations.map((action) => (
                                        <div
                                            key={extractId(action.entry._id)}
                                            className="flex flex-col gap-4 rounded-[24px] border bg-card/80 p-4 md:flex-row md:items-center md:justify-between"
                                        >
                                            <div className="space-y-1">
                                                <p className="text-base font-medium">{action.entry.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {action.requestedByParticipant?.displayName ?? 'Un participante'} te marcó como pagador.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={() => handleReviewPending(action)}>
                                                    Revisar
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </TabsContent>

                    <TabsContent value="entries" className="space-y-4">
                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight">Movimientos</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Historial completo de gastos, ingresos, ajustes y liquidaciones.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {(['all', 'expense', 'income', 'adjustment', 'settlement'] as EntryFilter[]).map((filter) => (
                                        <button
                                            key={filter}
                                            type="button"
                                            onClick={() => setEntryFilter(filter)}
                                            className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                                entryFilter === filter
                                                    ? 'border-primary/20 bg-primary/10 text-primary'
                                                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {filter === 'all'
                                                ? 'Todos'
                                                : SPACE_ENTRY_TYPE_LABELS[filter]}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {filteredEntries.length === 0 ? (
                                <EmptyState
                                    icon={Sparkles}
                                    title="Todavía no hay movimientos"
                                    description="Registrá el primero para empezar a ver balances y distribución."
                                    actionLabel="Nuevo movimiento"
                                    onAction={() => setEntryDialogOpen(true)}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {filteredEntries.map((entry) => (
                                        <MovementRow
                                            key={extractId(entry._id)}
                                            entry={entry}
                                            hidden={hidden}
                                            reportingCurrency={data.space.reportingCurrency}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    </TabsContent>

                    <TabsContent value="balance" className="space-y-4">
                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold tracking-tight">Balance</h2>
                                <p className="text-sm text-muted-foreground">
                                    Vista detallada de cuánto aportó y cuánto le corresponde a cada participante.
                                </p>
                            </div>

                            <div className="grid gap-3 lg:grid-cols-2">
                                {data.summary.balances.map((balance) => (
                                    <BalanceCard
                                        key={balance.participantId}
                                        balance={balance}
                                        hidden={hidden}
                                        reportingCurrency={data.space.reportingCurrency}
                                    />
                                ))}
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="participants" className="space-y-4">
                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight">Participantes</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Personas que participan del espacio y su estado actual.
                                    </p>
                                </div>
                                {canManage && (
                                    <Button onClick={() => setParticipantDialogOpen(true)}>
                                        <UserPlus className="h-4 w-4" />
                                        Agregar
                                    </Button>
                                )}
                            </div>

                            <div className="grid gap-3 lg:grid-cols-2">
                                {data.participants.map((participant) => (
                                    <div
                                        key={extractId(participant._id)}
                                        className="rounded-[24px] border bg-card/80 p-4"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-medium">{participant.displayName}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {participant.email || 'Participante externo'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                                                    {participant.role}
                                                </span>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {participant.inviteStatus}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4">
                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold tracking-tight">Configuración</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Ajustes generales del espacio, monedas y modo de trabajo.
                                    </p>
                                </div>
                                {canManage && (
                                    <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
                                        <Settings2 className="h-4 w-4" />
                                        Editar
                                    </Button>
                                )}
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                <SummaryMetric
                                    label="Moneda de reporte"
                                    amount={data.summary.totalReporting}
                                    currency={data.space.reportingCurrency}
                                    hidden={hidden}
                                />
                                <div className="rounded-[26px] border bg-card/70 p-4">
                                    <p className="text-sm text-muted-foreground">Modo</p>
                                    <p className="mt-2 text-xl font-semibold tracking-tight">
                                        {SPACE_MODE_LABELS[data.space.mode]}
                                    </p>
                                </div>
                                <div className="rounded-[26px] border bg-card/70 p-4">
                                    <p className="text-sm text-muted-foreground">Split por defecto</p>
                                    <p className="mt-2 text-xl font-semibold tracking-tight">
                                        {data.space.defaultSplitMode}
                                    </p>
                                </div>
                            </div>
                        </section>
                    </TabsContent>

                    <TabsContent value="closure" className="space-y-4">
                        <section className="rounded-[32px] border bg-card px-4 py-4 md:px-5">
                            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold tracking-tight">Cierre y recap</h2>
                                    <p className="max-w-2xl text-sm text-muted-foreground">
                                        Cuando cierres el espacio, va a quedar congelado para nuevos movimientos hasta reabrirlo explícitamente.
                                    </p>
                                </div>

                                {canManage && (
                                    <Button onClick={handleToggleClosed}>
                                        <CheckCircle2 className="h-4 w-4" />
                                        {data.space.status === 'closed' ? 'Reabrir espacio' : 'Cerrar espacio'}
                                    </Button>
                                )}
                            </div>
                        </section>
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
            />

            <SpaceParticipantDialog
                open={participantDialogOpen}
                onOpenChange={setParticipantDialogOpen}
                onSubmit={handleAddParticipant}
            />

            {canManage && (
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
                    description="Ajustá tipo, modo, monedas y metadatos generales del espacio."
                />
            )}

            <ConfirmSpaceEntryDialog
                open={confirmDialogOpen}
                onOpenChange={setConfirmDialogOpen}
                entry={selectedPendingEntry}
                onSubmit={handleConfirmPendingEntry}
            />
        </>
    )
}
