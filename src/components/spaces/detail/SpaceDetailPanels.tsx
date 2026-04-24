'use client'

import { CalendarRange, Coins, FileBadge2, FileText, Plus, Settings2, Sparkles, UserPlus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { SpaceAmountInline, SpaceEntryStatusBadge, SpaceEntryTypeBadge, SpaceInviteStatusBadge, SpaceMetaBadge, SpaceModeBadge, SpaceRoleBadge, SpaceSectionHeading, SpaceStatusBadge, SpaceSurface, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { SPACE_SPLIT_MODE_LABELS, SPACE_TYPE_LABELS, extractId, formatSpaceDate, formatSpaceDateRange } from '@/lib/utils/spaces'
import type { ISpace, ISpaceEntry, ISpaceParticipant, SpaceSummarySnapshot } from '@/types'

export type SpaceEntryFilter = 'all' | ISpaceEntry['type']

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

    return (
        <SpaceSurface accent="var(--chart-4)">
            <SpaceSectionHeading
                eyebrow="Historial"
                title="Movimientos"
                description="Gastos, ingresos, ajustes y liquidaciones con una lectura más clara de montos, estado y contexto."
            />

            <div className="mt-5 flex flex-wrap gap-2">
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

            <div className="mt-5 space-y-3">
                {filteredEntries.length === 0 ? (
                    <EmptyState
                        icon={Sparkles}
                        title="Todavía no hay movimientos"
                        description="Registrá el primero para empezar a ver balances, evolución y distribución."
                        actionLabel="Nuevo movimiento"
                        onAction={onCreate}
                    />
                ) : (
                    filteredEntries.map((entry) => (
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
    canManage,
    onEdit,
}: {
    space: ISpace
    summary: SpaceSummarySnapshot
    canManage: boolean
    onEdit: () => void
}) {
    return (
        <div className="space-y-4">
            <SpaceSurface accent="var(--chart-1)">
                <SpaceSectionHeading
                    eyebrow="Configuración"
                    title="Ajustes generales"
                    description="Una vista más ordenada del tipo de espacio, su forma de trabajo y las reglas financieras que hoy lo gobiernan."
                    action={
                        canManage ? (
                            <Button variant="outline" className="rounded-full" onClick={onEdit}>
                                <Settings2 className="h-4 w-4" />
                                Editar
                            </Button>
                        ) : null
                    }
                />

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Identidad
                        </p>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Tipo</span>
                                <span className="font-medium text-foreground">
                                    {SPACE_TYPE_LABELS[space.type]}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Estado</span>
                                <SpaceStatusBadge status={space.status} />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Modo</span>
                                <SpaceModeBadge mode={space.mode} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Finanzas
                        </p>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Monedas</span>
                                <span className="font-medium text-foreground">{space.currencies.join(' / ')}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Reporte</span>
                                <span className="font-medium text-foreground">{space.reportingCurrency}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Split por defecto</span>
                                <span className="font-medium text-foreground">
                                    {SPACE_SPLIT_MODE_LABELS[space.defaultSplitMode]}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Contexto
                        </p>
                        <div className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Período</span>
                                <span className="font-medium text-right text-foreground">
                                    {formatSpaceDateRange(space.startDate, space.endDate)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Participantes</span>
                                <span className="font-medium text-foreground">{summary.participantCount}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Movimientos</span>
                                <span className="font-medium text-foreground">{summary.totalEntryCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </SpaceSurface>

            <SpaceSurface accent="var(--chart-2)">
                <SpaceSectionHeading
                    eyebrow="Descripción"
                    title="Propósito del espacio"
                    description="La descripción y el alcance ayudan a entender rápidamente qué entra y qué no entra acá."
                />

                <div className="mt-5 rounded-[28px] border border-foreground/[0.07] bg-background/74 p-4 text-sm text-secondary-foreground">
                    {space.description || 'Todavía no se cargó una descripción para este espacio.'}
                </div>
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
