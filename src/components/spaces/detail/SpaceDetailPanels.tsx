'use client'

import { useState } from 'react'
import { CalendarRange, Coins, FileBadge2, FileText, Plus, Settings2, Sparkles, UserPlus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SpaceAmountInline, SpaceCurrencyBadge, SpaceCurrencyIcon, SpaceCurrencyStack, SpaceEntryStatusBadge, SpaceEntryTypeBadge, SpaceInviteStatusBadge, SpaceMetaBadge, SpaceRoleBadge, SpaceSectionHeading, SpaceStatusBadge, SpaceSurface, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { SPACE_MODE_LABELS, SPACE_SPLIT_MODE_LABELS, SPACE_STATUS_LABELS, SPACE_TYPE_LABELS, extractId, formatSpaceDate, formatSpaceDateRange } from '@/lib/utils/spaces'
import type { ISpace, ISpaceEntry, ISpaceParticipant, SpaceSummarySnapshot } from '@/types'
import type { SpaceFormData } from '@/lib/validations'

export type SpaceEntryFilter = 'all' | ISpaceEntry['type']
type SpaceEntrySort = 'recent' | 'amount' | 'status'

function resolveCategoryName(entry: ISpaceEntry) {
    if (
        entry.categoryId &&
        typeof entry.categoryId === 'object' &&
        'name' in entry.categoryId &&
        typeof entry.categoryId.name === 'string'
    ) {
        return entry.categoryId.name
    }

    return 'Sin categoría'
}

function MovementCard({
    entry,
    reportingCurrency,
    hidden,
    participants,
}: {
    entry: ISpaceEntry
    reportingCurrency: string
    hidden: boolean
    participants: ISpaceParticipant[]
}) {
    const payer = participants.find(
        (participant) => extractId(participant._id) === extractId(entry.paidByParticipantId)
    )
    const attachments = entry.attachments?.length ?? 0

    return (
        <div className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <SpaceEntryTypeBadge type={entry.type} />
                        <SpaceEntryStatusBadge status={entry.status} />
                    </div>

                    <div className="space-y-1.5">
                        <p className="text-lg font-semibold tracking-tight text-foreground">{entry.title}</p>
                        <p className="text-sm text-muted-foreground">
                            {entry.description || entry.notes || 'Sin detalle adicional.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SpaceMetaBadge icon={CalendarRange}>{formatSpaceDate(entry.date)}</SpaceMetaBadge>
                        <SpaceMetaBadge icon={Users}>{payer?.displayName ?? 'Sin pagador'}</SpaceMetaBadge>
                        <SpaceMetaBadge icon={FileBadge2}>{resolveCategoryName(entry)}</SpaceMetaBadge>
                        {attachments > 0 ? (
                            <SpaceMetaBadge icon={FileText}>
                                {attachments} adjunto{attachments === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[300px]">
                    <div className="rounded-[20px] border border-foreground/[0.06] bg-card/70 p-3">
                        <p className="text-xs text-muted-foreground">Monto original</p>
                        <SpaceAmountInline
                            amount={entry.amount}
                            currency={entry.currency}
                            hidden={hidden}
                            className="mt-1 text-base font-semibold"
                        />
                    </div>
                    <div className="rounded-[20px] border border-foreground/[0.06] bg-card/70 p-3">
                        <p className="text-xs text-muted-foreground">Reporte</p>
                        <SpaceAmountInline
                            amount={entry.reportingAmount}
                            currency={reportingCurrency}
                            hidden={hidden}
                            className="mt-1 text-base font-semibold"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export function SpaceMovementsPanel({
    entries,
    participants,
    entryFilter,
    onFilterChange,
    reportingCurrency,
    hidden,
    onCreate,
}: {
    entries: ISpaceEntry[]
    participants: ISpaceParticipant[]
    entryFilter: SpaceEntryFilter
    onFilterChange: (filter: SpaceEntryFilter) => void
    reportingCurrency: string
    hidden: boolean
    onCreate: () => void
}) {
    const [sort, setSort] = useState<SpaceEntrySort>('recent')
    const filters: SpaceEntryFilter[] = ['all', 'expense', 'income', 'adjustment', 'settlement']
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
                description="Gastos, ingresos, ajustes y liquidaciones con una lectura más clara de montos, estado y contexto."
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
                            <span>{filter === 'all' ? 'Todos' : filter === 'expense' ? 'Gastos' : filter === 'income' ? 'Ingresos' : filter === 'adjustment' ? 'Ajustes' : 'Liquidaciones'}</span>
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

            <div className="mt-5 space-y-3">
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
    summary,
    participants,
    canManage,
    onEdit,
    onAddParticipant,
    onToggleClosed,
    onUpdateSettings,
}: {
    space: ISpace
    summary: SpaceSummarySnapshot
    participants: ISpaceParticipant[]
    canManage: boolean
    onEdit: () => void
    onAddParticipant: () => void
    onToggleClosed: () => void
    onUpdateSettings: (patch: Partial<SpaceFormData>) => Promise<unknown>
}) {
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const isClosed = space.status === 'closed'

    const updateSetting = async (key: string, patch: Partial<SpaceFormData>) => {
        if (!canManage) return
        setSavingKey(key)
        try {
            await onUpdateSettings(patch)
        } finally {
            setSavingKey(null)
        }
    }

    return (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_0.9fr]">
            <SpaceSurface>
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">General</h2>
                    {canManage ? (
                        <Button variant="outline" size="sm" className="rounded-full" onClick={onEdit}>
                            <Settings2 className="h-4 w-4" />
                            Editar nombre
                        </Button>
                    ) : null}
                </div>

                <div className="mt-4 divide-y divide-border/70">
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Nombre</span>
                        <span className="min-w-0 truncate text-right font-medium text-foreground">{space.name}</span>
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
                        <span className="text-right font-medium text-foreground">
                            {formatSpaceDateRange(space.startDate, space.endDate)}
                        </span>
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
                <h2 className="text-base font-semibold text-foreground">Actividad</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-foreground/[0.07] bg-background/70 p-3">
                        <p className="text-xs text-muted-foreground">Movimientos</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{summary.totalEntryCount}</p>
                    </div>
                    <div className="rounded-2xl border border-foreground/[0.07] bg-background/70 p-3">
                        <p className="text-xs text-muted-foreground">Pendientes</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{summary.pendingEntryCount}</p>
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <SpaceStatusBadge status={space.status} />
                    <SpaceMetaBadge icon={Users}>
                        {summary.participantCount} participante{summary.participantCount === 1 ? '' : 's'}
                    </SpaceMetaBadge>
                    <SpaceMetaBadge icon={Coins}>
                        <SpaceCurrencyBadge currency={space.reportingCurrency} />
                    </SpaceMetaBadge>
                </div>
            </SpaceSurface>

            <SpaceSurface className="lg:col-span-2">
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
                    {participants.map((participant) => (
                        <div
                            key={extractId(participant._id)}
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
                            <div className="mt-3 flex flex-wrap gap-2">
                                <SpaceRoleBadge role={participant.role} />
                                <SpaceMetaBadge icon={FileBadge2}>
                                    {participant.kind === 'finp_user' ? 'Usuario Finp' : 'Externo'}
                                </SpaceMetaBadge>
                            </div>
                        </div>
                    ))}
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

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-foreground/[0.07] bg-background/70 p-3">
                        <p className="text-xs text-muted-foreground">Movimientos</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{summary.totalEntryCount}</p>
                    </div>
                    <div className="rounded-2xl border border-foreground/[0.07] bg-background/70 p-3">
                        <p className="text-xs text-muted-foreground">Pendientes</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{summary.pendingEntryCount}</p>
                    </div>
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
