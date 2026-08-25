'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Ban, CalendarRange, Coins, FileBadge2, FileText, HandCoins, History, Paperclip, Pencil, RefreshCw, Trash2, Users, WalletCards } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    SpaceAmountInline,
    SpaceEntryStatusBadge,
    SpaceEntryTypeBadge,
    SpaceInitialsAvatar,
    SpaceMetaBadge,
} from '@/components/spaces/SpaceUi'
import { SpaceAttachmentsUploader } from '@/components/spaces/dialogs/SpaceAttachmentsUploader'
import { VoidEntryDialog } from '@/components/spaces/dialogs/VoidEntryDialog'
import { SpaceEntryRevisionSheet } from '@/components/spaces/detail/SpaceEntryRevisionSheet'
import { SpacePersonalImpactDialog } from '@/components/spaces/dialogs/SpacePersonalImpactDialog'
import { fadeInFast, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { extractId, formatSpaceDate } from '@/lib/utils/spaces'
import type { ISpaceActivityEvent, ISpaceEntry, ISpaceEntryAttachment, ISpaceEntryPersonalImpact, ISpaceEntrySnapshot, ISpaceParticipant } from '@/types'
import type { SpaceActivityEventType } from '@/lib/constants'

function resolveCategory(entry: ISpaceEntry | null) {
    if (!entry) return null

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

    return null
}

const ENTRY_ACTIVITY_ICONS: Partial<Record<SpaceActivityEventType, typeof FileText>> = {
    entry_created: FileText,
    entry_edited: Pencil,
    entry_voided: Ban,
    settlement_created: HandCoins,
    attachment_uploaded: Paperclip,
    attachment_deleted: Trash2,
}

export function SpaceEntryDetailSheet({
    open,
    onOpenChange,
    entry,
    participants,
    spaceId,
    currency,
    currentUserId,
    personalImpact,
    reviewImpact,
    canEdit,
    canVoid,
    activityEvents = [],
    onPersonalImpactCreated,
    onEdit,
    onVoided,
    onSyncImpact,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    entry: ISpaceEntry | null
    participants: ISpaceParticipant[]
    spaceId: string
    currency: string
    currentUserId?: string
    personalImpact?: ISpaceEntryPersonalImpact
    reviewImpact?: ISpaceEntryPersonalImpact
    canEdit?: boolean
    canVoid?: boolean
    activityEvents?: ISpaceActivityEvent[]
    onPersonalImpactCreated?: (entryId: string, impact: ISpaceEntryPersonalImpact) => void
    onEdit?: (entry: ISpaceEntry, hasSubsequentSettlement: boolean) => void
    onVoided?: (entry: ISpaceEntry) => void
    onSyncImpact?: (entry: ISpaceEntry) => Promise<void>
}) {
    const [currentEntry, setCurrentEntry] = useState<ISpaceEntry | null>(entry)
    const [voidDialogOpen, setVoidDialogOpen] = useState(false)
    const [revisionSheetOpen, setRevisionSheetOpen] = useState(false)
    const [selectedSnapshot, setSelectedSnapshot] = useState<ISpaceEntrySnapshot | null>(null)
    const [impactDialogOpen, setImpactDialogOpen] = useState(false)
    const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
    const [resolving, setResolving] = useState(false)
    const [voidContext, setVoidContext] = useState({ hasLinkedTransaction: false, hasSubsequentSettlement: false, affectedUsersCount: 0 })

    useEffect(() => {
        setCurrentEntry(entry)
    }, [entry])

    const participantsById = useMemo(
        () => new Map(participants.map((participant) => [extractId(participant._id) ?? '', participant])),
        [participants]
    )

    // Resolve user by userId (not participantId) for void/edit attribution
    function resolveUserByUserId(userId: unknown): string {
        if (!userId) return 'Un participante'
        const uid = extractId(userId as Parameters<typeof extractId>[0])
        const found = participants.find((p) => extractId(p.userId) === uid)
        return found?.displayName ?? 'Un participante'
    }

    if (!currentEntry) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-xl" />
            </Sheet>
        )
    }

    const entryId = extractId(currentEntry._id) ?? ''
    const payer = participantsById.get(extractId(currentEntry.paidByParticipantId) ?? '')
    const sharedParticipants = (currentEntry.sharedWithParticipantIds ?? [])
        .map((participantId) => participantsById.get(extractId(participantId) ?? ''))
        .filter((participant): participant is ISpaceParticipant => Boolean(participant))
    const category = resolveCategory(currentEntry)
    const legacyImpactsCurrentUser = Boolean(
        currentEntry.linkedTransactionId &&
        currentUserId &&
        payer &&
        (extractId(currentEntry.confirmedByUserId) === currentUserId || extractId(payer.userId) === currentUserId)
    )
    const impactsCurrentUser = personalImpact?.status === 'linked' || legacyImpactsCurrentUser
    const isVoided = currentEntry.isVoided === true
    const hasReview = Boolean(reviewImpact && !isVoided)
    const isEdited = (currentEntry.editCount ?? 0) > 0
    const previousVersions = currentEntry.previousVersions ?? []
    const hasPreviousVersions = previousVersions.length > 0
    const relatedActivityEvents = activityEvents.filter((event) => {
        const entityId = extractId(event.entityId)
        const metadataEntryId = typeof event.metadata?.entryId === 'string'
            ? event.metadata.entryId
            : undefined

        if (entityId === entryId) return true
        if (metadataEntryId === entryId) return true
        return currentEntry.type === 'settlement' && event.entityType === 'settlement' && entityId === entryId
    })

    const updateAttachments = (updater: (attachments: ISpaceEntryAttachment[]) => ISpaceEntryAttachment[]) => {
        setCurrentEntry((previous) => {
            if (!previous) return previous
            return {
                ...previous,
                attachments: updater(previous.attachments ?? []),
            }
        })
    }

    async function handleOpenVoidDialog() {
        // Pre-fetch context for warnings (subsequent settlements + linked transaction)
        try {
            const response = await fetch(`/api/spaces/${spaceId}/entries/${entryId}`)
            if (response.ok) {
                const json = await response.json() as {
                    entry: ISpaceEntry
                    hasLinkedTransaction: boolean
                    hasSubsequentSettlement: boolean
                    affectedUsersCount?: number
                }
                setVoidContext({
                    hasLinkedTransaction: json.hasLinkedTransaction && impactsCurrentUser,
                    hasSubsequentSettlement: json.hasSubsequentSettlement,
                    affectedUsersCount: json.affectedUsersCount ?? 0,
                })
            }
        } catch {
            // use defaults
        }
        setVoidDialogOpen(true)
    }

    async function handleVoidConfirm(voidReason?: string) {
        const response = await fetch(`/api/spaces/${spaceId}/entries/${entryId}/void`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(currentEntry?.contractVersion === 2
                    ? { 'Idempotency-Key': crypto.randomUUID() }
                    : {}),
            },
            body: JSON.stringify(currentEntry?.contractVersion === 2
                ? { expectedRevision: currentEntry.revision ?? 0, reason: voidReason ?? 'Anulado por el usuario' }
                : { voidReason }),
        })

        if (!response.ok) {
            const json = await response.json() as { error?: string }
            throw new Error(json.error ?? 'Error al anular el movimiento')
        }

        const json = await response.json() as { entry?: ISpaceEntry }
        const voidedEntry = json.entry ?? ({
            ...currentEntry,
            status: 'voided',
            isVoided: true,
            revision: (currentEntry?.revision ?? 0) + 1,
        } as ISpaceEntry)
        setCurrentEntry(voidedEntry)
        onVoided?.(voidedEntry)
    }

    async function handleEditClick() {
        let hasSubsequentSettlement = false
        try {
            const response = await fetch(`/api/spaces/${spaceId}/entries/${entryId}`)
            if (response.ok) {
                const json = await response.json() as { hasSubsequentSettlement: boolean }
                hasSubsequentSettlement = json.hasSubsequentSettlement
            }
        } catch {
            // proceed without warning
        }
        if (currentEntry) onEdit?.(currentEntry, hasSubsequentSettlement)
    }

    function handleViewRevision(snapshot: ISpaceEntrySnapshot) {
        setSelectedSnapshot(snapshot)
        setRevisionSheetOpen(true)
    }

    const voidedByName = resolveUserByUserId(currentEntry.voidedByUserId)

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
                    <SheetHeader className="border-b border-border/70 px-5 py-5">
                        <div className="flex flex-wrap gap-2 pr-8">
                            <SpaceEntryTypeBadge type={currentEntry.type} />
                            {isVoided ? (
                                <Badge variant="destructive" className="gap-1">
                                    <Ban className="h-3 w-3" />
                                    Anulado
                                </Badge>
                            ) : (
                                <SpaceEntryStatusBadge status={currentEntry.status} />
                            )}
                            {isEdited && !isVoided ? (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                    <History className="h-3 w-3" />
                                    Editado
                                </Badge>
                            ) : null}
                        </div>
                        <SheetTitle className="pr-8 text-2xl font-semibold tracking-tight">
                            {currentEntry.title}
                        </SheetTitle>
                        <SheetDescription>
                            {currentEntry.description || 'Movimiento del espacio'}
                        </SheetDescription>

                        {/* Acciones */}
                        {!isVoided ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {canEdit && onEdit ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => void handleEditClick()}
                                    >
                                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                        Editar
                                    </Button>
                                ) : null}
                                {canVoid ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-destructive hover:text-destructive"
                                        onClick={() => void handleOpenVoidDialog()}
                                    >
                                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                                        Anular
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}

                        {/* Info de anulación */}
                        {isVoided ? (
                            <div className="mt-1 space-y-1.5">
                                <p className="text-xs text-muted-foreground">
                                    Anulado por{' '}
                                    <span className="font-medium text-foreground">{voidedByName}</span>
                                    {currentEntry.voidedAt ? (
                                        <> el{' '}<span className="font-medium text-foreground">{formatSpaceDate(currentEntry.voidedAt)}</span></>
                                    ) : null}
                                </p>
                                {currentEntry.voidReason ? (
                                    <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                                        <span className="font-medium">Motivo:</span> {currentEntry.voidReason}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </SheetHeader>

                    <div className="space-y-5 px-5 py-5">
                        {/* Advertencia linkedTransaction cuando anulado */}
                        {isVoided && impactsCurrentUser ? (
                            <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    Este movimiento impactó en tu Finp personal. Revisá la transacción vinculada para mantener tus finanzas consistentes.
                                </span>
                            </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-[20px] border border-foreground/[0.07] bg-card/70 p-4">
                                <p className="text-xs text-muted-foreground">Monto original</p>
                                <SpaceAmountInline
                                    amount={currentEntry.amount}
                                    currency={currentEntry.currency}
                                    hidden={false}
                                    className="mt-1 text-lg font-semibold"
                                />
                            </div>
                            <div className="rounded-[20px] border border-foreground/[0.07] bg-card/70 p-4">
                                <p className="text-xs text-muted-foreground">Reporte</p>
                                <SpaceAmountInline
                                    amount={currentEntry.reportingAmount}
                                    currency={currency}
                                    hidden={false}
                                    className="mt-1 text-lg font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <SpaceMetaBadge icon={CalendarRange}>{formatSpaceDate(currentEntry.date)}</SpaceMetaBadge>
                            <SpaceMetaBadge icon={Coins}>{currentEntry.currency}</SpaceMetaBadge>
                            {category ? (
                                <SpaceMetaBadge icon={FileBadge2}>
                                    {category.color ? (
                                        <span
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: category.color }}
                                        />
                                    ) : null}
                                    {category.name}
                                    {category.isArchived ? (
                                        <span className="ml-1 text-[10px] text-muted-foreground">Archivada</span>
                                    ) : null}
                                </SpaceMetaBadge>
                            ) : null}
                            {impactsCurrentUser ? (
                                personalImpact?.transactionId ? (
                                    <Link
                                        href={`/transactions?transactionId=${personalImpact.transactionId.toString()}`}
                                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
                                    >
                                        <Coins className="h-3 w-3" />
                                        En tu Finp
                                        <ArrowUpRight className="h-3 w-3" />
                                    </Link>
                                ) : (
                                    <SpaceMetaBadge icon={Coins}>En tu Finp</SpaceMetaBadge>
                                )
                            ) : hasReview ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                    <RefreshCw className="h-3 w-3" />
                                    Revisar en tu Finp
                                </span>
                            ) : null}
                        </div>

                        <section className="space-y-3 rounded-[20px] border border-foreground/[0.07] bg-background/72 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        <WalletCards className="h-3.5 w-3.5" />
                                        Tu Finp
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {impactsCurrentUser
                                            ? personalImpact?.transactionId
                                                ? (
                                                    <>
                                                        Registrado en tu Finp.{' '}
                                                        <Link
                                                            href={`/transactions?transactionId=${personalImpact.transactionId.toString()}`}
                                                            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                                                        >
                                                            Ver transacción
                                                            <ArrowUpRight className="h-3 w-3" />
                                                        </Link>
                                                    </>
                                                )
                                                : 'Registrado en tu Finp.'
                                            : hasReview
                                                ? 'El movimiento fue editado. Tu transacción en Finp puede estar desactualizada.'
                                                : isVoided
                                                    ? 'Este movimiento esta anulado.'
                                                    : 'Todavia no registraste este movimiento en tu Finp.'}
                                    </p>
                                    {isEdited && !isVoided && !impactsCurrentUser && !hasReview ? (
                                        <p className="text-xs text-amber-700 dark:text-amber-400">
                                            Este movimiento fue editado. Revisa el monto antes de registrarlo en tu Finp.
                                        </p>
                                    ) : null}
                                </div>
                                {hasReview && onSyncImpact ? (
                                    <Button
                                        size="sm"
                                        className="rounded-full bg-amber-500 text-white hover:bg-amber-600"
                                        onClick={() => setResolveDialogOpen(true)}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Resolver
                                    </Button>
                                ) : !impactsCurrentUser && !hasReview ? (
                                    <Button
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => setImpactDialogOpen(true)}
                                        disabled={isVoided}
                                    >
                                        <WalletCards className="h-3.5 w-3.5" />
                                        Registrar en mi Finp
                                    </Button>
                                ) : null}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Pagador
                            </p>
                            <div className="flex items-center gap-3 rounded-[20px] border border-foreground/[0.07] bg-background/72 p-3">
                                <SpaceInitialsAvatar name={payer?.displayName ?? 'Sin pagador'} />
                                <div>
                                    <p className="font-semibold text-foreground">{payer?.displayName ?? 'Sin pagador'}</p>
                                    <p className="text-xs text-muted-foreground">{payer?.email ?? 'Participante del espacio'}</p>
                                </div>
                            </div>
                        </section>

                        {sharedParticipants.length > 0 ? (
                            <section className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {currentEntry.type === 'settlement' ? 'Recibió' : 'Incluidos'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {sharedParticipants.map((participant) => (
                                        <span
                                            key={extractId(participant._id)}
                                            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium"
                                        >
                                            <SpaceInitialsAvatar name={participant.displayName} className="h-6 w-6 text-[10px]" />
                                            {participant.displayName}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {currentEntry.notes ? (
                            <section className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Notas
                                </p>
                                <p className="rounded-[20px] border border-foreground/[0.07] bg-background/72 p-4 text-sm text-secondary-foreground">
                                    {currentEntry.notes}
                                </p>
                            </section>
                        ) : null}

                        <section className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <SpaceMetaBadge icon={Users}>
                                    {sharedParticipants.length} incluido{sharedParticipants.length === 1 ? '' : 's'}
                                </SpaceMetaBadge>
                            </div>

                            {/* Historial de cambios — lista de todas las versiones */}
                            {hasPreviousVersions ? (
                                <div className="space-y-2">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        <History className="h-3.5 w-3.5" />
                                        Historial de cambios
                                    </p>
                                    <div className="space-y-1.5">
                                        {previousVersions.map((snapshot, index) => {
                                            const editorName = resolveUserByUserId(snapshot.editedByUserId)
                                            return (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => handleViewRevision(snapshot)}
                                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-left text-xs transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-foreground">
                                                            Versión {previousVersions.length - index}
                                                        </p>
                                                        <p className="mt-0.5 truncate text-muted-foreground">
                                                            {formatSpaceDate(snapshot.snapshotAt)} · {editorName}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 text-muted-foreground/50">→</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {!isVoided ? (
                                <SpaceAttachmentsUploader
                                    spaceId={spaceId}
                                    entryId={entryId}
                                    existingAttachments={currentEntry.attachments ?? []}
                                    onAttachmentUploaded={(attachment) =>
                                        updateAttachments((attachments) => [...attachments, attachment])
                                    }
                                    onAttachmentDeleted={(attachmentId) =>
                                        updateAttachments((attachments) =>
                                            attachments.filter((attachment) => extractId(attachment._id) !== attachmentId)
                                        )
                                    }
                                />
                            ) : (
                                // Adjuntos en solo lectura cuando anulado
                                (currentEntry.attachments ?? []).length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">
                                            {currentEntry.attachments!.length} adjunto{currentEntry.attachments!.length === 1 ? '' : 's'} (evidencia histórica)
                                        </p>
                                    </div>
                                ) : null
                            )}
                        </section>

                        <section className="space-y-3">
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                <History className="h-3.5 w-3.5" />
                                Actividad del movimiento
                            </p>
                            {relatedActivityEvents.length > 0 ? (
                                <motion.div
                                    className="space-y-1.5"
                                    variants={staggerContainer}
                                    initial="initial"
                                    animate="animate"
                                >
                                    {relatedActivityEvents.slice(0, 6).map((event) => {
                                        const Icon = ENTRY_ACTIVITY_ICONS[event.type] ?? History
                                        return (
                                            <motion.div
                                                key={extractId(event._id)}
                                                layout
                                                variants={staggerItem}
                                                className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-xs transition-colors hover:border-primary/30 hover:bg-primary/[0.03]"
                                            >
                                                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 font-medium text-foreground">
                                                        {event.title}
                                                    </p>
                                                    <p className="mt-0.5 text-muted-foreground">
                                                        {formatSpaceDate(event.createdAt)}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </motion.div>
                            ) : (
                                <motion.div
                                    {...fadeInFast}
                                    className="rounded-xl border border-dashed border-border bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground"
                                >
                                    Todavía no hay actividad registrada para este movimiento.
                                </motion.div>
                            )}
                        </section>
                    </div>
                </SheetContent>
            </Sheet>

            <VoidEntryDialog
                open={voidDialogOpen}
                onOpenChange={setVoidDialogOpen}
                entry={currentEntry}
                hasLinkedTransaction={voidContext.hasLinkedTransaction}
                hasSubsequentSettlement={voidContext.hasSubsequentSettlement}
                affectedUsersCount={voidContext.affectedUsersCount}
                onConfirm={handleVoidConfirm}
            />

            <SpaceEntryRevisionSheet
                open={revisionSheetOpen}
                onOpenChange={setRevisionSheetOpen}
                snapshot={selectedSnapshot}
                participants={participants}
                reportingCurrency={currency}
            />

            <SpacePersonalImpactDialog
                open={impactDialogOpen}
                onOpenChange={setImpactDialogOpen}
                spaceId={spaceId}
                entry={currentEntry}
                initialImpact={personalImpact}
                onCreated={(impact) => {
                    onPersonalImpactCreated?.(entryId, impact)
                }}
            />

            <AlertDialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Actualizar transacción personal</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                <p>
                                    Tu transacción personal de{' '}
                                    <span className="font-medium text-foreground">{currentEntry.title}</span>{' '}
                                    será actualizada con el monto y fecha actuales del movimiento.
                                </p>
                                <p>Esto resolverá la alerta de revisión pendiente.</p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                        <AlertDialogCancel disabled={resolving}>Cancelar</AlertDialogCancel>
                        {reviewImpact?.transactionId ? (
                            <Button
                                variant="outline"
                                className="rounded-md"
                                asChild
                                onClick={() => setResolveDialogOpen(false)}
                            >
                                <Link href={`/transactions?transactionId=${reviewImpact.transactionId!.toString()}`}>
                                    Editar a mano
                                </Link>
                            </Button>
                        ) : null}
                        <AlertDialogAction
                            disabled={resolving}
                            onClick={async (e) => {
                                e.preventDefault()
                                setResolving(true)
                                try {
                                    await onSyncImpact?.(currentEntry)
                                    setResolveDialogOpen(false)
                                } finally {
                                    setResolving(false)
                                }
                            }}
                        >
                            {resolving ? 'Actualizando...' : 'Confirmar y actualizar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
