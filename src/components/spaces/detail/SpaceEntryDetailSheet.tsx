'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Coins, FileBadge2, Users } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import {
    SpaceAmountInline,
    SpaceEntryStatusBadge,
    SpaceEntryTypeBadge,
    SpaceInitialsAvatar,
    SpaceMetaBadge,
} from '@/components/spaces/SpaceUi'
import { SpaceAttachmentsUploader } from '@/components/spaces/dialogs/SpaceAttachmentsUploader'
import { extractId, formatSpaceDate } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryAttachment, ISpaceParticipant } from '@/types'

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

export function SpaceEntryDetailSheet({
    open,
    onOpenChange,
    entry,
    participants,
    spaceId,
    currency,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    entry: ISpaceEntry | null
    participants: ISpaceParticipant[]
    spaceId: string
    currency: string
    canDelete?: boolean
    onDelete?: (entryId: string) => void
}) {
    const [currentEntry, setCurrentEntry] = useState<ISpaceEntry | null>(entry)

    useEffect(() => {
        setCurrentEntry(entry)
    }, [entry])

    const participantsById = useMemo(
        () => new Map(participants.map((participant) => [extractId(participant._id) ?? '', participant])),
        [participants]
    )

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

    const updateAttachments = (updater: (attachments: ISpaceEntryAttachment[]) => ISpaceEntryAttachment[]) => {
        setCurrentEntry((previous) => {
            if (!previous) return previous
            return {
                ...previous,
                attachments: updater(previous.attachments ?? []),
            }
        })
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
                <SheetHeader className="border-b border-border/70 px-5 py-5">
                    <div className="flex flex-wrap gap-2 pr-8">
                        <SpaceEntryTypeBadge type={currentEntry.type} />
                        <SpaceEntryStatusBadge status={currentEntry.status} />
                    </div>
                    <SheetTitle className="pr-8 text-2xl font-semibold tracking-tight">
                        {currentEntry.title}
                    </SheetTitle>
                    <SheetDescription>
                        {currentEntry.description || 'Movimiento del espacio'}
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 px-5 py-5">
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
                    </div>

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
                                Incluidos
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
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    )
}
