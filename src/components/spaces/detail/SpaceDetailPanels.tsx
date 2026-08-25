'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Ban, ChevronRight, Coins, FileBadge2, History, Lock, Pencil, Plus, RefreshCw, Sparkles, Trash2, UserPlus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { DateRangePickerField } from '@/components/shared/DateRangePickerField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { SpaceCategoryManager } from '@/components/spaces/dialogs/SpaceCategoryManager'
import { SpaceInviteLinkManager } from '@/components/spaces/settings/SpaceInviteLinkManager'
import { SpacePersonalSettingsPanel } from '@/components/spaces/settings/SpacePersonalSettingsPanel'
import { SpaceAmountInline, SpaceCurrencyBadge, SpaceCurrencyStack, SpaceEntryStatusBadge, SpaceInviteStatusBadge, SpaceMetaBadge, SpaceRoleBadge, SpaceSectionHeading, SpaceStatusBadge, SpaceSurface, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { Badge } from '@/components/ui/badge'
import { SPACE_SPLIT_MODE_LABELS, SPACE_TYPE_LABELS, extractId, formatSpaceDate, formatSpaceDateRange } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { ISpace, ISpaceEntry, ISpaceEntryPersonalImpact, ISpaceEntryPersonalImpactByEntry, ISpaceParticipant, SpaceSummarySnapshot } from '@/types'
import type { SpaceFormData } from '@/lib/validations'
import type { SpaceParticipantRole } from '@/lib/constants'

export type SpaceEntryFilter = 'all' | ISpaceEntry['type']
type SpaceEntrySort = 'recent' | 'amount' | 'status'

function round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

function getUserShare(entry: ISpaceEntry, currentParticipantId: string | null): number | null {
    if (!currentParticipantId) return null
    if (entry.type === 'settlement') return null
    if (entry.isVoided) return null
    if (entry.splitMode === 'none') return null

    const sharedWith = (entry.sharedWithParticipantIds ?? []).map((id) => extractId(id))
    if (!sharedWith.includes(currentParticipantId)) return null

    if (entry.splitMode === 'equal') {
        const count = sharedWith.length
        if (count <= 1) return null
        return round2(entry.amount / count)
    }

    if (entry.splitMode === 'percentage') {
        const alloc = entry.splitAllocations?.find((a) => extractId(a.participantId) === currentParticipantId)
        if (!alloc?.percentage) return null
        const share = round2(entry.amount * alloc.percentage / 100)
        return Math.abs(share - entry.amount) < 0.01 ? null : share
    }

    if (entry.splitMode === 'fixed') {
        const alloc = entry.splitAllocations?.find((a) => extractId(a.participantId) === currentParticipantId)
        if (alloc?.amount == null) return null
        return Math.abs(alloc.amount - entry.amount) < 0.01 ? null : alloc.amount
    }

    return null
}

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
        extractId(entry.spaceCategoryId) === 'legacy-personal-category-disabled' &&
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


function MovementCard({
    entry,
    hidden,
    participants,
    currentUserId,
    personalImpact,
    reviewImpact,
    capabilities,
    highlighted,
    onEntryClick,
    onEdit,
    onVoid,
    onSyncImpact,
    onPersonalImpact,
}: {
    entry: ISpaceEntry
    reportingCurrency: string
    hidden: boolean
    participants: ISpaceParticipant[]
    currentUserId?: string
    personalImpact?: ISpaceEntryPersonalImpact
    reviewImpact?: ISpaceEntryPersonalImpact
    capabilities?: Array<'edit' | 'void'>
    highlighted?: boolean
    onEntryClick?: (entry: ISpaceEntry) => void
    onEdit?: (entry: ISpaceEntry) => void
    onVoid?: (entry: ISpaceEntry) => void
    onSyncImpact?: (entry: ISpaceEntry) => void
    onPersonalImpact?: (entry: ISpaceEntry) => void
}) {
    const payer = participants.find(
        (participant) => extractId(participant._id) === extractId(entry.paidByParticipantId)
    )
    const attachments = entry.attachments?.length ?? 0
    const category = resolveCategoryInfo(entry)
    const clickable = Boolean(onEntryClick)
    const includedCount = entry.sharedWithParticipantIds?.length ?? 0
    const legacyImpactsCurrentUser = Boolean(
        entry.linkedTransactionId &&
        currentUserId &&
        payer &&
        (extractId(entry.confirmedByUserId) === currentUserId || extractId(payer.userId) === currentUserId)
    )
    const impactsCurrentUser = personalImpact?.status === 'linked' || legacyImpactsCurrentUser
    const needsReview = Boolean(reviewImpact) && !entry.isVoided
    const settlementReceiverId = entry.type === 'settlement'
        ? extractId(entry.sharedWithParticipantIds?.[0])
        : null
    const settlementReceiver = settlementReceiverId
        ? participants.find((p) => extractId(p._id) === settlementReceiverId)
        : null

    const isVoided = entry.isVoided === true
    const isEdited = (entry.editCount ?? 0) > 0

    // Permission to edit/void per entry
    const canEditEntry = !isVoided && Boolean(capabilities?.includes('edit')) && Boolean(onEdit)
    const canVoidEntry = !isVoided && Boolean(capabilities?.includes('void')) && Boolean(onVoid)
    const hasActions = canEditEntry || canVoidEntry

    const currentParticipant = currentUserId
        ? participants.find((p) => extractId(p.userId) === currentUserId)
        : null
    const currentParticipantId = extractId(currentParticipant?._id) ?? null
    const userShare = getUserShare(entry, currentParticipantId)

    // Resolve who voided
    const voidedBy = isVoided && entry.voidedByUserId
        ? participants.find((p) => extractId(p.userId) === extractId(entry.voidedByUserId))
        : null

    // Build metadata as a typed array so each part renders as an independent element
    type MetaPart = { key: string; label: string; accent?: boolean }
    const metaParts: MetaPart[] = []

    if (isVoided) {
        metaParts.push({ key: 'date', label: formatSpaceDate(entry.date) })
        const voidedByName = voidedBy?.displayName ?? 'Un participante'
        metaParts.push({ key: 'voided-by', label: `Anulado por ${voidedByName}` })
    } else if (entry.type === 'settlement') {
        metaParts.push({ key: 'date', label: formatSpaceDate(entry.date) })
        const registrant = entry.createdByUserId
            ? participants.find((p) => extractId(p.userId) === extractId(entry.createdByUserId))
            : null
        const registrantIsPayer = !registrant || extractId(registrant._id) === extractId(entry.paidByParticipantId)
        if (!registrantIsPayer && registrant) {
            metaParts.push({ key: 'registered-by', label: `Registrado por ${registrant.displayName}` })
        }
        if (needsReview) {
            metaParts.push({ key: 'finp-review', label: 'Revisar en tu Finp', accent: true })
        } else if (impactsCurrentUser) {
            metaParts.push({ key: 'finp', label: 'En tu Finp', accent: true })
        }
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
        if (needsReview) {
            metaParts.push({ key: 'finp-review', label: 'Revisar en tu Finp', accent: true })
        } else if (impactsCurrentUser) {
            metaParts.push({ key: 'finp', label: 'En tu Finp', accent: true })
        }
    }

    return (
        <div
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            data-entry-id={extractId(entry._id)}
            onClick={() => onEntryClick?.(entry)}
            onKeyDown={(event) => {
                if (!clickable) return
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onEntryClick?.(entry)
                }
            }}
            className={cn(
                'group flex items-start justify-between gap-4 rounded-2xl border bg-background/74 px-4 py-4 transition-colors',
                highlighted ? 'border-primary/40 bg-primary/[0.04] ring-2 ring-primary/20' : 'border-foreground/[0.07]',
                isVoided ? 'opacity-60' : '',
                clickable ? 'cursor-pointer hover:border-primary/25 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''
            )}
        >
            {/* Left: color dot + title + metadata */}
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                    className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: isVoided ? 'var(--muted-foreground)' : (category.color ?? 'var(--muted-foreground)') }}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Title / settlement direction */}
                    {entry.type === 'settlement' && payer ? (
                        <div className="flex flex-wrap items-baseline gap-1">
                            <span className={cn('text-sm font-semibold', isVoided ? 'text-muted-foreground line-through' : 'text-foreground')}>{payer.displayName}</span>
                            <span className="text-xs text-muted-foreground">pagó a</span>
                            <span className={cn('text-sm font-semibold', isVoided ? 'text-muted-foreground line-through' : 'text-foreground')}>
                                {settlementReceiver?.displayName ?? 'Receptor'}
                            </span>
                        </div>
                    ) : (
                        <p className={cn('truncate text-sm font-semibold leading-snug', isVoided ? 'text-muted-foreground line-through' : 'text-foreground')}>{entry.title}</p>
                    )}
                    {/* Metadata row — each (separator + label) is a single no-wrap flex item */}
                    {metaParts.length > 0 && (
                        <div className="flex flex-wrap items-baseline gap-y-0.5">
                            {metaParts.map((part, i) => (
                                <span
                                    key={part.key}
                                    className={cn(
                                        'inline-flex items-center whitespace-nowrap text-xs leading-snug',
                                        part.accent
                                            ? 'font-medium text-primary'
                                            : 'text-muted-foreground'
                                    )}
                                >
                                    {i > 0 && (
                                        <span className="mx-1.5 select-none text-[10px] leading-none text-muted-foreground/30" aria-hidden>·</span>
                                    )}
                                    {part.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Right: amount (top) + badges & quick actions on the same row (bottom) */}
            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                <SpaceAmountInline
                    amount={entry.amount}
                    currency={entry.currency}
                    hidden={hidden}
                    className={cn('text-sm font-semibold tabular-nums', isVoided ? 'text-muted-foreground line-through' : '')}
                />
                {userShare !== null ? (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span>tu parte</span>
                        <SpaceAmountInline
                            amount={userShare}
                            currency={entry.currency}
                            hidden={hidden}
                            className="font-medium text-foreground/70"
                        />
                    </div>
                ) : null}
                {/* Badges + desktop quick actions + mobile tap affordance — single row */}
                <div className="flex items-center gap-1.5">
                    {!isVoided && !impactsCurrentUser && currentParticipant && onPersonalImpact ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onPersonalImpact(entry)
                            }}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/8 px-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Registrar en Mi Finp
                        </button>
                    ) : null}
                    {isVoided ? (
                        <Badge variant="destructive" className="gap-1 text-[10px]">
                            <Ban className="h-2.5 w-2.5" />
                            Anulado
                        </Badge>
                    ) : (
                        <>
                            {entry.type === 'settlement' && (
                                <Badge variant="secondary" className="text-[10px]">
                                    Pago
                                </Badge>
                            )}
                            <SpaceEntryStatusBadge status={entry.status} />
                            {isEdited ? (
                                <Badge variant="secondary" className="gap-1 text-[10px]">
                                    <History className="h-2.5 w-2.5" />
                                    Editado
                                </Badge>
                            ) : null}
                        </>
                    )}
                    {/* Desktop only: hover-visible quick actions */}
                    {(hasActions || needsReview) ? (
                        <div className="hidden items-center gap-0.5 transition-opacity lg:flex lg:opacity-0 lg:group-hover:opacity-100">
                            {needsReview && onSyncImpact ? (
                                <button
                                    type="button"
                                    aria-label="Resolver impacto"
                                    title="Resolver"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onSyncImpact(entry)
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-amber-500 transition-colors hover:bg-amber-500/10 hover:text-amber-600"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                            {canEditEntry ? (
                                <button
                                    type="button"
                                    aria-label="Editar movimiento"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEdit!(entry)
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                            {canVoidEntry ? (
                                <button
                                    type="button"
                                    aria-label="Anular movimiento"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onVoid!(entry)
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <Ban className="h-3.5 w-3.5" />
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                    {/* Mobile only: subtle chevron affordance — edit/void available in detail sheet */}
                    {clickable ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 lg:hidden" />
                    ) : null}
                </div>
            </div>
        </div>
    )
}

export function SpaceMovementsPanel({
    entries,
    participants,
    currentUserId,
    personalImpactsByEntryId = {},
    entryCapabilitiesById = {},
    entryFilter,
    onFilterChange,
    reportingCurrency,
    hidden,
    focusEntryId,
    onCreate,
    onEntryClick,
    onEdit,
    onVoid,
    onSyncImpact,
    onPersonalImpact,
}: {
    entries: ISpaceEntry[]
    participants: ISpaceParticipant[]
    currentUserId?: string
    personalImpactsByEntryId?: Record<string, ISpaceEntryPersonalImpactByEntry>
    entryCapabilitiesById?: Record<string, Array<'edit' | 'void'>>
    entryFilter: SpaceEntryFilter
    onFilterChange: (filter: SpaceEntryFilter) => void
    reportingCurrency: string
    hidden: boolean
    focusEntryId?: string | null
    onCreate?: () => void
    onEntryClick?: (entry: ISpaceEntry) => void
    onEdit?: (entry: ISpaceEntry) => void
    onVoid?: (entry: ISpaceEntry) => void
    onSyncImpact?: (entry: ISpaceEntry) => void
    onPersonalImpact?: (entry: ISpaceEntry) => void
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
                        actionLabel={onCreate ? 'Nuevo movimiento' : undefined}
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
                            personalImpact={personalImpactsByEntryId[extractId(entry._id) ?? '']?.linkedImpact}
                            reviewImpact={personalImpactsByEntryId[extractId(entry._id) ?? '']?.reviewImpact}
                            capabilities={entryCapabilitiesById[extractId(entry._id) ?? '']}
                            highlighted={Boolean(focusEntryId && extractId(entry._id) === focusEntryId)}
                            onEntryClick={onEntryClick}
                            onEdit={onEdit}
                                onVoid={onVoid}
                                onSyncImpact={onSyncImpact}
                                onPersonalImpact={onPersonalImpact}
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
        <SpaceSurface>
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
    const [configSection, setConfigSection] = useState<'general' | 'mi_finp'>('general')
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

    const CONFIG_SECTIONS = [
        { key: 'general' as const, label: 'General' },
        { key: 'mi_finp' as const, label: 'Mi Finp' },
    ]

    return (
        <div className="w-full space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CONFIG_SECTIONS.map(({ key, label }) => (
                <button
                    key={key}
                    type="button"
                    className={cn(
                        'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                        configSection === key
                            ? 'bg-foreground text-background'
                            : 'bg-accent/50 text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setConfigSection(key)}
                >
                    {label}
                </button>
            ))}
        </div>

        {configSection === 'general' && <SpaceSurface>
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
                            <DateRangePickerField
                                label=""
                                density="compact"
                                value={{
                                    from: space.startDate ? new Date(space.startDate) : undefined,
                                    to: space.endDate ? new Date(space.endDate) : undefined,
                                }}
                                onChange={(range) => {
                                    if (range?.from) {
                                        void updatePeriod(range)
                                        return
                                    }
                                    void updateSetting('period', {
                                        startDate: space.startDate ? new Date(space.startDate) : undefined,
                                        endDate: null,
                                    })
                                }}
                                clearable={Boolean(space.endDate)}
                                className="max-w-[260px]"
                            />
                        ) : (
                            <span className="text-right font-medium text-foreground">
                                {formatSpaceDateRange(space.startDate, space.endDate)}
                            </span>
                        )}
                    </div>
                </div>
            </SpaceSurface>}

        {configSection === 'general' && <SpaceSurface>
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
                        <div>
                            <span className="text-muted-foreground">Moneda de reporte</span>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/60">
                                <Lock className="h-2.5 w-2.5" />
                                Por ahora solo ARS
                            </p>
                        </div>
                        <SpaceCurrencyBadge currency={space.reportingCurrency} />
                    </div>
                    <div className="flex items-center justify-between gap-4 py-3 text-sm">
                        <span className="text-muted-foreground">Monedas</span>
                        <SpaceCurrencyStack currencies={space.currencies} className="max-w-[65%] justify-end" />
                    </div>
                </div>
            </SpaceSurface>}

        {configSection === 'general' && <SpaceSurface>
                <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">Categorías</h2>
                    <p className="text-sm text-muted-foreground">
                        Organización propia del espacio para movimientos y reportes.
                    </p>
                </div>
                <div className="mt-4">
                    <SpaceCategoryManager spaceId={spaceId} canManage={canManage} />
                </div>
            </SpaceSurface>}

        {configSection === 'general' && <SpaceSurface>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">Participantes</h2>
                    {canManage ? (
                        <Button className="rounded-full" size="sm" onClick={onAddParticipant}>
                            <UserPlus className="h-4 w-4" />
                            Invitar
                        </Button>
                    ) : null}
                </div>

                <div className="mt-4 grid gap-3">
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

                <div className="mt-4">
                    <SpaceInviteLinkManager spaceId={spaceId} canManage={canManage} />
                </div>
            </SpaceSurface>}

        {configSection === 'general' && <SpaceSurface>
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
            </SpaceSurface>}

        {configSection === 'mi_finp' && (
            <SpacePersonalSettingsPanel spaceId={spaceId} />
        )}
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
        <SpaceSurface>
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
