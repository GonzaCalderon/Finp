'use client'

import { FileBadge2, FileText, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceAmountInline, SpaceEntryStatusBadge, SpaceEntryTypeBadge, SpaceMetaBadge, SpaceSectionHeading, SpaceSurface, SpaceTypeBadge } from '@/components/spaces/SpaceUi'
import { formatSpaceDate, extractId } from '@/lib/utils/spaces'
import type { Currency } from '@/lib/constants'
import type { ISpaceEntry, ISpaceParticipant, ISpacePendingAction } from '@/types'

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

function formatAttachmentSize(size: number) {
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`
    }

    if (size >= 1024) {
        return `${Math.round(size / 1024)} KB`
    }

    return `${size} B`
}

export function RecentSpaceMovementsCard({
    entries,
    participants,
    reportingCurrency,
    hidden,
    onViewAll,
}: {
    entries: ISpaceEntry[]
    participants: ISpaceParticipant[]
    reportingCurrency: Currency
    hidden: boolean
    onViewAll: () => void
}) {
    const recentEntries = entries.slice(0, 4)
    const participantsById = new Map(
        participants.map((participant) => [extractId(participant._id) ?? '', participant])
    )

    return (
        <SpaceSurface accent="var(--chart-4)">
            <SpaceSectionHeading
                eyebrow="Actividad"
                title="Movimientos recientes"
                description="Lo último que pasó dentro del espacio, con mejor jerarquía entre tipo, estado y montos."
                action={
                    <Button variant="ghost" className="rounded-full" onClick={onViewAll}>
                        Ver todos
                    </Button>
                }
            />

            <div className="mt-5 space-y-3">
                {recentEntries.length > 0 ? (
                    recentEntries.map((entry) => {
                        const payer = participantsById.get(extractId(entry.paidByParticipantId) ?? '')

                        return (
                            <div
                                key={extractId(entry._id)}
                                className="rounded-[26px] border border-foreground/[0.07] bg-background/74 p-4"
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <SpaceEntryTypeBadge type={entry.type} />
                                            <SpaceEntryStatusBadge status={entry.status} />
                                        </div>

                                        <div className="space-y-1.5">
                                            <p className="text-base font-semibold text-foreground">{entry.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {entry.description || entry.notes || 'Sin detalle adicional por ahora.'}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <SpaceMetaBadge icon={FileText}>{formatSpaceDate(entry.date)}</SpaceMetaBadge>
                                            <SpaceMetaBadge icon={FileBadge2}>
                                                {payer?.displayName ?? 'Sin pagador'}
                                            </SpaceMetaBadge>
                                            <SpaceMetaBadge icon={FileBadge2}>
                                                {resolveCategoryName(entry)}
                                            </SpaceMetaBadge>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[260px]">
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
                    })
                ) : (
                    <div className="rounded-[26px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground">
                        Todavía no hay movimientos recientes para mostrar.
                    </div>
                )}
            </div>
        </SpaceSurface>
    )
}

export function RecentSpaceAttachmentsCard({
    entries,
}: {
    entries: ISpaceEntry[]
}) {
    const attachments = entries
        .flatMap((entry) =>
            (entry.attachments ?? []).map((attachment) => ({
                ...attachment,
                entry,
            }))
        )
        .slice(0, 4)

    return (
        <SpaceSurface accent="var(--chart-5)">
            <SpaceSectionHeading
                eyebrow="Comprobantes"
                title="Adjuntos recientes"
                description="Imágenes, PDFs o archivos asociados a movimientos del espacio."
            />

            <div className="mt-5 space-y-3">
                {attachments.length > 0 ? (
                    attachments.map((attachment) => (
                        <div
                            key={`${extractId(attachment._id) ?? attachment.storageKey}-${extractId(attachment.entry._id)}`}
                            className="flex flex-col gap-3 rounded-[26px] border border-foreground/[0.07] bg-background/74 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
                                    <Paperclip className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-semibold text-foreground">{attachment.fileName}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {attachment.entry.title} · {formatSpaceDate(attachment.createdAt)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <SpaceMetaBadge icon={Paperclip}>{attachment.mimeType}</SpaceMetaBadge>
                                <SpaceMetaBadge icon={FileText}>
                                    {formatAttachmentSize(attachment.size)}
                                </SpaceMetaBadge>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="rounded-[26px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground">
                        Todavía no hay comprobantes adjuntos en este espacio.
                    </div>
                )}
            </div>
        </SpaceSurface>
    )
}

export function SpacePendingConfirmationsCard({
    actions,
    onReview,
}: {
    actions: Array<Extract<ISpacePendingAction, { kind: 'confirmation' }>>
    onReview: (action: Extract<ISpacePendingAction, { kind: 'confirmation' }>) => void
}) {
    return (
        <SpaceSurface accent="var(--chart-2)">
            <SpaceSectionHeading
                eyebrow="Revisión"
                title="Pendientes dentro del espacio"
                description="Confirmaciones que todavía esperan una acción del pagador antes de quedar cerradas."
            />

            <div className="mt-5 space-y-3">
                {actions.length > 0 ? (
                    actions.map((action) => (
                        <div
                            key={extractId(action.entry._id)}
                            className="flex flex-col gap-4 rounded-[26px] border border-foreground/[0.07] bg-background/74 p-4 md:flex-row md:items-center md:justify-between"
                        >
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    <SpaceEntryTypeBadge type={action.entry.type} />
                                    <SpaceTypeBadge type={action.space.type} />
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground">{action.entry.title}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {action.requestedByParticipant?.displayName ?? 'Un participante'} te marcó como pagador.
                                    </p>
                                </div>
                            </div>

                            <Button className="rounded-full" onClick={() => onReview(action)}>
                                Revisar
                            </Button>
                        </div>
                    ))
                ) : (
                    <div className="rounded-[26px] border border-dashed border-border bg-background/60 px-4 py-12 text-center text-sm text-muted-foreground">
                        No hay confirmaciones pendientes dentro de este espacio.
                    </div>
                )}
            </div>
        </SpaceSurface>
    )
}
