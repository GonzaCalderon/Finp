'use client'

import { Fragment, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { ArrowRight, CalendarRange, Coins, FileBadge2, Pencil, Plus, Sparkles, Trash2, UserPlus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SpaceCategoryManager } from '@/components/spaces/dialogs/SpaceCategoryManager'
import { SpaceAmountInline, SpaceCurrencyBadge, SpaceCurrencyIcon, SpaceCurrencyStack, SpaceEntryStatusBadge, SpaceInviteStatusBadge, SpaceMetaBadge, SpaceRoleBadge, SpaceSectionHeading, SpaceStatusBadge, SpaceSurface, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { SPACE_SPLIT_MODE_LABELS, SPACE_TYPE_LABELS, extractId, formatSpaceDate, formatSpaceDateRange } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { ISpace, ISpaceEntry, ISpaceParticipant, SpaceSummarySnapshot } from '@/types'
import type { SpaceFormData } from '@/lib/validations'
import type { SpaceParticipantRole } from '@/lib/constants'

export type SpaceEntryFilter = 'all' | ISpaceEntry['type']
type SpaceEntrySort = 'recent' | 'amount' | 'status'

function resolveCategoryInfo(entry: ISpaceEntry) {
    if (
        entry.spaceCategoryId &&
        typeof entry.spaceCategoryId === 'object' &&
        'name' in entry.spaceCategoryId &&
        typeof entry.spaceCategoryId.name === 'string'
    ) {
        return {
            name: entry.spaceCategoryId.name,
            color: typeof entry.spaceCategoryId.color === 'string' ? entry.spaceCategoryId.color : undefined,
            isArchived: entry.spaceCategoryId.isArchived === true,
        }
    }

    if (
        entry.categoryId &&
        typeof entry.categoryId === 'object' &&
        'name' in entry.categoryId &&
        typeof entry.categoryId.name === 'string'
    ) {
        return {
            name: entry.categoryId.name,
            color: typeof entry.categoryId.color === 'string' ? entry.categoryId.color : undefined,
            isArchived: false,
        }
    }

    return { name: 'Sin categoría', color: undefined, isArchived: false }
}

function MetaSeparator() {
    return <span className="select-none text-[10px] leading-none text-muted-foreground/30">·</span>
}

function MovementCard({
    entry,
    hidden,
    participants,
    currentUserId,
    onEntryClick,
}: {
    entry: ISpaceEntry
    reportingCurrency: string
    hidden: boolean
    participants: ISpaceParticipant[]
    currentUserId?: string
    onEntryClick?: (entry: ISpaceEntry) => void
}) {
    const payer = participants.find(
        (participant) => extractId(participant._id) === extractId(entry.paidByParticipantId)
    )
    const attachments = entry.attachments?.length ?? 0
    const category = resolveCategoryInfo(entry)
    const clickable = Boolean(onEntryClick)
    const includedCount = entry.sharedWithParticipantIds?.length ?? 0
    const impactsCurrentUser = Boolean(
        entry.linkedTransactionId &&
        currentUserId &&
        payer &&
        extractId(payer.userId) === currentUserId
    )
    const settlementReceiverId = entry.type === 'settlement'
        ? extractId(entry.sharedWithParticipantIds?.[0])
        : null
    const settlementReceiver = settlementReceiverId
        ? participants.find((p) => extractId(p._id) === settlementReceiverId)
        : null

    // Build metadata as a typed array so each part renders as an independent element
    type MetaPart = { key: string; label: string; accent?: boolean }
    const metaParts: MetaPart[] = []

    if (entry.type === 'settlement') {
        metaParts.push({ key: 'date', label: formatSpaceDate(entry.date) })
    } else {
        metaParts.push({ key: 'date', label: formatSpaceDate(entry.date) })
        if (payer) metaParts.push({ key: 'payer', label: `Pagó ${payer.displayName}` })
        if (includedCount > 0) {
            metaParts.push({ key: 'participants', label: `${includedCount} participante${includedCount === 1 ? '' : 's'}` })
        }
        metaParts.push({ key: 'category', label: category.name })
        if (attachments > 0) {
            metaParts.push({ key: 'attachments', label: `${attachments} adjunto${attachments === 1 ? '' : 's'}` })
        }
        if (impactsCurrentUser) {
            metaParts.push({ key: 'finp', label: 'En tu Finp', accent: true })
        }
    }

    return (
        <div
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={() => onEntryClick?.(entry)}
            onKeyDown={(event) => {
                if (!clickable) return
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onEntryClick?.(entry)
                }
            }}
            className={cn(
                'flex items-start justify-between gap-4 rounded-2xl border border-foreground/[0.07] bg-background/74 px-4 py-4 transition-colors',
                clickable ? 'cursor-pointer hover:border-primary/25 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''
            )}
        >
            {/* Left: color dot + title + metadata */}
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                    className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color ?? 'var(--muted-foreground)' }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Title / settlement direction */}
                    {entry.type === 'settlement' && payer ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">{payer.displayName}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                            <span className="text-sm font-semibold text-foreground">
                                {settlementReceiver?.displayName ?? 'Receptor'}
                            </span>
                        </div>
                    ) : (
                        <p className="truncate text-sm font-semibold leading-snug text-foreground">{entry.title}</p>
                    )}
                    {/* Metadata row — each part is an independent element, not a joined string */}
                    {metaParts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            {metaParts.map((part, i) => (
                                <Fragment key={part.key}>
                                    {i > 0 && <MetaSeparator />}
                                    <span
                                        className={cn(
                                            'text-xs leading-snug',
                                            part.accent
                                                ? 'font-medium text-primary'
                                                : 'text-muted-foreground'
                                        )}
                                    >
                                        {part.label}
                                    </span>
                                </Fragment>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Right: amount + status */}
            <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                <SpaceAmountInline
                    amount={entry.amount}
                    currency={entry.currency}
                    hidden={hidden}
                    className="text-sm font-semibold tabular-nums"
                />
                <SpaceEntryStatusBadge status={entry.status} />
            </div>
        </div>
    )
}

export function SpaceMovementsPanel({
    entries,
    participants,
    currentUserId,
    entryFilter,
    onFilterChange,
    reportingCurrency,
    hidden,
    onCreate,
    onEntryClick,
}: {
    entries: ISpaceEntry[]
    participants: ISpaceParticipant[]
    currentUserId?: string
    entryFilter: SpaceEntryFilter
    onFilterChange: (filter: SpaceEntryFilter) => void
    reportingCurrency: string
    hidden: boolean
    onCreate: () => void
    onEntryClick?: (entry: ISpaceEntry) => void
}) {
    const [sort, setSort] = useState<SpaceEntrySort>('recent')
    const filters: SpaceEntryFilter[] = ['all', 'expense', 'settlement']
    const counts = {
        all: entries.length,
        expense: entries.filter((entry) => entry.type === 'expense').length,
        income: entries.filter((entry) => entry.type === 'income').length,
        adjustment: entries.filter((entry) => entry.type === 'adjustment').length,
        settlement: entries.filter((entry) => entry.type === 'settlement').length,
    }
    const filteredEntries = entries.filter((entry) =>
        entryFilter === 'all' ? true : entry.type === entryFilter
    )
    const sortedEntries = [...filteredEntries].sort((a, b) => {
        if (sort === 'amount') {
            return (b.reportingAmount ?? b.amount) - (a.reportingAmount ?? a.amount)
        }
        if (sort === 'status') {
            const order = ['pending_confirmation', 'confirmed', 'linked', 'rejected']
            return order.indexOf(a.status) - order.indexOf(b.status)
        }

        return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return (
        <SpaceSurface>
            <SpaceSectionHeading
                eyebrow="Historial"
                title="Movimientos"
                description="Gastos y liquidaciones con una lectura más clara de montos, estado y contexto."
            />

            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                    {filters.map((filter) => (
                        <button
                            key={filter}
                            type="button"
                            onClick={() => onFilterChange(filter)}
                            className={[
                                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                                entryFilter === filter
                                    ? 'border-primary/20 bg-primary/10 text-primary'
                                    : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                            ].join(' ')}
                        >
                            <span>{filter === 'all' ? 'Todos' : filter === 'expense' ? 'Gastos' : 'Pagos'}</span>
                            <span
                                className={[
                                    'rounded-full px-2 py-0.5 text-[11px]',
                                    entryFilter === filter ? 'bg-primary/12 text-primary' : 'bg-secondary text-secondary-foreground',
                                ].join(' ')}
                            >
                                {counts[filter]}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground lg:justify-end">
                    <span className="shrink-0">Ordenar por:</span>
                    <Select value={sort} onValueChange={(value) => setSort(value as SpaceEntrySort)}>
                        <SelectTrigger size="sm" className="h-8 w-[150px] rounded-full border-border/70 bg-background/80 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" align="end">
                            <SelectItem value="recent">Reciente</SelectItem>
                            <SelectItem value="amount">Monto</SelectItem>
                            <SelectItem value="status">Estado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="mt-5 space-y-2">
                {sortedEntries.length === 0 ? (
                    <EmptyState
                        icon={Sparkles}
                        title="Todavía no hay movimientos"
                        description="Registrá el primero para empezar a ver balances, evolución y distribución."
                        actionLabel="Nuevo movimiento"
                        onAction={onCreate}
                    />
                ) : (
                    sortedEntries.map((entry) => (
                        <MovementCard
                            key={extractId(entry._id)}
                            entry={entry}
                            reportingCurrency={reportingCurrency}
                            hidden={hidden}
                            participants={participants}
                            currentUserId={currentUserId}
                            onEntryClick={onEntryClick}
                        />
                    ))
                )}
            </div>
        </SpaceSurface>
    )
}

export function SpaceParticipantsPanel({
    participants,
    canManage,
    onAdd,
}: {
    participants: ISpaceParticipant[]
    canManage: boolean
    onAdd: () => void
}) {
    return (
        <SpaceSurface accent="var(--chart-3)">
            <SpaceSectionHeading
                eyebrow="Participantes"
                title="Personas dentro del espacio"
                description="Roles, tipo de participante y estado de invitación con mejor lectura en desktop y mobile."
                action={
                    canManage ? (
                        <Button className="rounded-full" onClick={onAdd}>
                            <UserPlus className="h-4 w-4" />
                            Agregar
                        </Button>
                    ) : null
                }
            />

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {participants.map((participant) => (
                    <div
                        key={extractId(participant._id)}
                        className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-lg font-semibold tracking-tight text-foreground">
                                        {participant.displayName}
                                    </p>
                                    <SpaceRoleBadge role={participant.role} />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {participant.email || 'Participante externo'}
                                </p>
                            </div>

                            <SpaceInviteStatusBadge status={participant.inviteStatus} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <SpaceMetaBadge icon={Users}>
                                {participant.kind === 'finp_user' ? 'Usuario Finp' : 'Externo'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={FileBadge2}>
                                {participant.isActive ? 'Activo' : 'Inactivo'}
                            </SpaceMetaBadge>
                        </div>
                    </div>
                ))}
            </div>
        </SpaceSurface>
    )
}

export function SpaceSettingsPanel({
    space,
    spaceId,
    participants,
    canManage,
    currentParticipantRole,
    currentUserId,
    onAddParticipant,
    onToggleClosed,
    onUpdateSettings,
    onUpdateParticipantRole,
    onRemoveParticipant,
}: {
    space: ISpace
    spaceId: string
    participants: ISpaceParticipant[]
    canManage: boolean
    currentParticipantRole: SpaceParticipantRole
    currentUserId: string
    onAddParticipant: () => void
    onToggleClosed: () => void
    onUpdateSettings: (patch: Partial<SpaceFormData>) => Promise<unknown>
    onUpdateParticipantRole: (participantId: string, role: 'admin' | 'participant') => Promise<unknown>
    onRemoveParticipant: (participantId: string) => Promise<unknown>
}) {
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const [editingName, setEditingName] = useState(false)
    const [nameDraft, setNameDraft] = useState(space.name)
    const [periodOpen, setPeriodOpen] = useState(false)
    const isClosed = space.status === 'closed'
    const isOwner = currentParticipantRole === 'owner'
    const isAdmin = currentParticipantRole === 'admin'

    const updateSetting = async (key: string, patch: Partial<SpaceFormData>) => {
        if (!canManage) return
        setSavingKey(key)
        try {
            await onUpdateSettings(patch)
        } finally {
            setSavingKey(null)
        }
    }

    const commitName = async () => {
        const next = nameDraft.trim()
        if (!next || next === space.name) {
            setNameDraft(space.name)
            setEditingName(false)
            return
        }

        await updateSetting('name', { name: next })
        setEditingName(false)
    }

    const updatePeriod = async (range: DateRange | undefined) => {
        if (!range?.from) return
        await updateSetting('period', {
            startDate: range.from,
            endDate: range.to,
        })
    }

    const canEditParticipantRole = (participant: ISpaceParticipant) => {
        if (!canManage || participant.role === 'owner') return false
        if (extractId(participant.userId) === currentUserId) return false
        return isOwner
    }

    const canRemoveParticipant = (participant: ISpaceParticipant) => {
        if (!canManage || participant.role === 'owner') return false
        if (extractId(participant.userId) === currentUserId) return false
        return isOwner || (isAdmin && participant.role === 'participant')
    }

    return (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
            <div className="space-y-4">
            <SpaceSurface>
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">General</h2>
                </div>

                <div className="mt-4 divide-y divide-border/70">
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Nombre</span>
                        <div className="flex min-w-0 flex-1 justify-end">
                            {editingName ? (
                                <Input
                                    value={nameDraft}
                                    onChange={(event) => setNameDraft(event.target.value)}
                                    onBlur={() => void commitName()}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') void commitName()
                                        if (event.key === 'Escape') {
                                            setNameDraft(space.name)
                                            setEditingName(false)
                                        }
                                    }}
                                    autoFocus
                                    className="h-8 max-w-[220px] rounded-full text-right"
                                    disabled={savingKey === 'name'}
                                />
                            ) : (
                                <button
                                    type="button"
                                    className="inline-flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-right font-medium text-foreground hover:bg-accent/50 disabled:pointer-events-none"
                                    onClick={() => canManage && setEditingName(true)}
                                    disabled={!canManage}
                                >
                                    <span className="truncate">{space.name}</span>
                                    {canManage ? <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Tipo</span>
                        {canManage ? (
                            <Select
                                value={space.type}
                                onValueChange={(value) => void updateSetting('type', { type: value as SpaceFormData['type'] })}
                                disabled={savingKey === 'type'}
                            >
                                <SelectTrigger size="sm" className="h-8 w-[150px] rounded-full bg-background/80">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    {Object.entries(SPACE_TYPE_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="font-medium text-foreground">{SPACE_TYPE_LABELS[space.type]}</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Período</span>
                        {canManage ? (
                            <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="rounded-full bg-background/80">
                                        <CalendarRange className="h-3.5 w-3.5" />
                                        {formatSpaceDateRange(space.startDate, space.endDate)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" align="end">
                                    <Calendar
                                        mode="range"
                                        selected={{
                                            from: space.startDate ? new Date(space.startDate) : undefined,
                                            to: space.endDate ? new Date(space.endDate) : undefined,
                                        }}
                                        onSelect={(range) => void updatePeriod(range)}
                                    />
                                    <p className="px-2 pb-2 text-xs text-muted-foreground">
                                        Seleccioná inicio y fin sobre el mismo calendario para ver la guía del período.
                                    </p>
                                </PopoverContent>
                            </Popover>
                        ) : (
                            <span className="text-right font-medium text-foreground">
                                {formatSpaceDateRange(space.startDate, space.endDate)}
                            </span>
                        )}
                    </div>
                </div>
            </SpaceSurface>

            <SpaceSurface>
                <h2 className="text-base font-semibold text-foreground">Reparto y monedas</h2>
                <div className="mt-4 divide-y divide-border/70">
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Split por defecto</span>
                        {canManage ? (
                            <Select
                                value={space.mode === 'solo' ? 'none' : space.defaultSplitMode}
                                onValueChange={(value) =>
                                    void updateSetting('defaultSplitMode', {
                                        defaultSplitMode: value as SpaceFormData['defaultSplitMode'],
                                    })
                                }
                                disabled={savingKey === 'defaultSplitMode' || space.mode === 'solo'}
                            >
                                <SelectTrigger size="sm" className="h-8 w-[170px] rounded-full bg-background/80">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                    {Object.entries(SPACE_SPLIT_MODE_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <span className="font-medium text-foreground">
                                {SPACE_SPLIT_MODE_LABELS[space.defaultSplitMode]}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Moneda de reporte</span>
                        {canManage ? (
                            <Select
                                value={space.reportingCurrency}
                                onValueChange={(value) => void updateSetting('reportingCurrency', { reportingCurrency: value })}
                                disabled={savingKey === 'reportingCurrency'}
                            >
                                <SelectTrigger size="sm" className="h-8 w-[132px] rounded-full bg-background/80">
                                    <span className="flex items-center gap-2">
                                        <SpaceCurrencyIcon currency={space.reportingCurrency} className="h-5 w-5" />
                                        <span>{space.reportingCurrency}</span>
                                    </span>
                                </SelectTrigger>
                                <SelectContent align="end">
                                    {space.currencies.map((currency) => (
                                        <SelectItem key={currency} value={currency}>
                                            <span className="flex items-center gap-2">
                                                <SpaceCurrencyIcon currency={currency} className="h-5 w-5" />
                                                <span>{currency}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <SpaceCurrencyBadge currency={space.reportingCurrency} />
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Monedas</span>
                        <SpaceCurrencyStack currencies={space.currencies} className="max-w-[65%] justify-end" />
                    </div>
                </div>
            </SpaceSurface>

            <SpaceSurface>
                <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">Categorías</h2>
                    <p className="text-sm text-muted-foreground">
                        Organización propia del espacio para movimientos y reportes.
                    </p>
                </div>
                <div className="mt-4">
                    <SpaceCategoryManager spaceId={spaceId} canManage={canManage} />
                </div>
            </SpaceSurface>

            </div>

            <div className="space-y-4">
            <SpaceSurface>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">Participantes</h2>
                    {canManage ? (
                        <Button className="rounded-full" size="sm" onClick={onAddParticipant}>
                            <UserPlus className="h-4 w-4" />
                            Invitar
                        </Button>
                    ) : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {participants.map((participant) => {
                        const participantId = extractId(participant._id) ?? ''
                        const editableRole = canEditParticipantRole(participant)
                        const removable = canRemoveParticipant(participant)

                        return (
                            <div
                                key={participantId}
                                className="rounded-2xl border border-foreground/[0.07] bg-background/70 p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-foreground">{participant.displayName}</p>
                                        <p className="mt-1 truncate text-sm text-muted-foreground">
                                            {participant.email || 'Participante externo'}
                                        </p>
                                    </div>
                                    <SpaceInviteStatusBadge status={participant.inviteStatus} />
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {editableRole ? (
                                        <Select
                                            value={participant.role}
                                            onValueChange={(value) =>
                                                void onUpdateParticipantRole(participantId, value as 'admin' | 'participant')
                                            }
                                        >
                                            <SelectTrigger size="sm" className="h-7 rounded-full bg-background/80">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent align="start">
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="participant">Participante</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <SpaceRoleBadge role={participant.role} />
                                    )}
                                    <SpaceMetaBadge icon={FileBadge2}>
                                        {participant.kind === 'finp_user' ? 'Usuario Finp' : 'Externo'}
                                    </SpaceMetaBadge>
                                    {removable ? (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="ml-auto h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                                            onClick={() => void onRemoveParticipant(participantId)}
                                            aria-label="Quitar participante"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </SpaceSurface>

            <SpaceSurface>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Cierre</h2>
                        <p className="mt-2 text-sm font-medium text-foreground">
                            {isClosed ? 'Espacio cerrado' : 'Espacio activo'}
                        </p>
                    </div>
                    <SpaceStatusBadge status={space.status} />
                </div>

                {canManage ? (
                    <Button
                        className="mt-4 w-full rounded-full"
                        variant={isClosed ? 'default' : 'outline'}
                        onClick={onToggleClosed}
                    >
                        {isClosed ? 'Reabrir espacio' : 'Cerrar espacio'}
                    </Button>
                ) : null}
            </SpaceSurface>
            </div>
        </div>
    )
}

export function SpaceClosurePanel({
    space,
    summary,
    canManage,
    onToggleClosed,
}: {
    space: ISpace
    summary: SpaceSummarySnapshot
    canManage: boolean
    onToggleClosed: () => void
}) {
    const isClosed = space.status === 'closed'

    return (
        <SpaceSurface accent="var(--chart-2)">
            <SpaceSectionHeading
                eyebrow="Cierre"
                title="Estado operativo del espacio"
                description="Congelá el espacio cuando quieras dejarlo en modo recap y reabrilo sólo si necesitás seguir cargando movimientos."
                action={
                    canManage ? (
                        <Button className="rounded-full" onClick={onToggleClosed}>
                            {isClosed ? 'Reabrir espacio' : 'Cerrar espacio'}
                        </Button>
                    ) : null
                }
            />

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Estado actual
                            </p>
                            <p className="text-xl font-semibold tracking-tight text-foreground">
                                {isClosed ? 'Espacio cerrado' : 'Espacio abierto'}
                            </p>
                        </div>
                        <SpaceStatusBadge status={space.status} />
                    </div>

                    <div className="mt-4 space-y-3 text-sm text-secondary-foreground">
                        <p>
                            {isClosed
                                ? 'El espacio está congelado para nuevos movimientos hasta que alguien con permisos lo reabra.'
                                : 'El espacio sigue habilitado para registrar movimientos, invitar participantes y resolver pendientes.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <SpaceMetaBadge icon={Coins}>
                                {summary.totalEntryCount} movimiento{summary.totalEntryCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={Users}>
                                {summary.participantCount} participante{summary.participantCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={Plus}>
                                {summary.pendingEntryCount} pendiente{summary.pendingEntryCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Impacto
                    </p>
                    <div className="mt-4 space-y-3">
                        <SpaceTonePill positive={!isClosed}>
                            {isClosed ? 'Modo recap' : 'Operación activa'}
                        </SpaceTonePill>
                        <div className="space-y-2 text-sm text-secondary-foreground">
                            <p>Los balances y el historial siguen visibles aunque el espacio esté cerrado.</p>
                            <p>Si todavía quedan pendientes, conviene resolverlos antes del cierre definitivo.</p>
                        </div>
                    </div>
                </div>
            </div>
        </SpaceSurface>
    )
}
