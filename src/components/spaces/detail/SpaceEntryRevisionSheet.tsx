'use client'

import { CalendarRange, Coins, History } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { SpaceAmountInline, SpaceInitialsAvatar, SpaceMetaBadge } from '@/components/spaces/SpaceUi'
import { extractId, formatSpaceDate } from '@/lib/utils/spaces'
import type { ISpaceEntrySnapshot, ISpaceParticipant } from '@/types'

export function SpaceEntryRevisionSheet({
    open,
    onOpenChange,
    snapshot,
    participants,
    reportingCurrency,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    snapshot: ISpaceEntrySnapshot | null
    participants: ISpaceParticipant[]
    reportingCurrency: string
}) {
    if (!snapshot) return null

    const participantsById = new Map(participants.map((p) => [extractId(p._id) ?? '', p]))
    const payer = participantsById.get(extractId(snapshot.paidByParticipantId) ?? '')
    const editedBy = Object.values(participants).find(
        (p) => extractId(p.userId) === extractId(snapshot.editedByUserId)
    )
    const editedByName = editedBy?.displayName ?? 'Un participante'

    const sharedParticipants = (snapshot.sharedWithParticipantIds ?? [])
        .map((pid) => participantsById.get(extractId(pid) ?? ''))
        .filter((p): p is ISpaceParticipant => Boolean(p))

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
                <SheetHeader className="border-b border-border/70 px-5 py-5">
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Versión anterior
                        </span>
                    </div>
                    <SheetTitle className="pr-8 text-xl font-semibold tracking-tight">
                        {snapshot.title}
                    </SheetTitle>
                    <SheetDescription>
                        Modificado por {editedByName} el{' '}
                        {formatSpaceDate(snapshot.snapshotAt)}
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 px-5 py-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[20px] border border-foreground/[0.07] bg-card/70 p-4">
                            <p className="text-xs text-muted-foreground">Monto original</p>
                            <SpaceAmountInline
                                amount={snapshot.amount}
                                currency={snapshot.currency}
                                hidden={false}
                                className="mt-1 text-lg font-semibold"
                            />
                        </div>
                        <div className="rounded-[20px] border border-foreground/[0.07] bg-card/70 p-4">
                            <p className="text-xs text-muted-foreground">Reporte</p>
                            <SpaceAmountInline
                                amount={snapshot.reportingAmount}
                                currency={reportingCurrency}
                                hidden={false}
                                className="mt-1 text-lg font-semibold"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <SpaceMetaBadge icon={CalendarRange}>{formatSpaceDate(snapshot.date)}</SpaceMetaBadge>
                        <SpaceMetaBadge icon={Coins}>{snapshot.currency}</SpaceMetaBadge>
                    </div>

                    {payer ? (
                        <section className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Pagador
                            </p>
                            <div className="flex items-center gap-3 rounded-[20px] border border-foreground/[0.07] bg-background/72 p-3">
                                <SpaceInitialsAvatar name={payer.displayName} />
                                <div>
                                    <p className="font-semibold text-foreground">{payer.displayName}</p>
                                    <p className="text-xs text-muted-foreground">{payer.email ?? 'Participante del espacio'}</p>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    {sharedParticipants.length > 0 ? (
                        <section className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Incluidos
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {sharedParticipants.map((p) => (
                                    <span
                                        key={extractId(p._id)}
                                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium"
                                    >
                                        <SpaceInitialsAvatar name={p.displayName} className="h-6 w-6 text-[10px]" />
                                        {p.displayName}
                                    </span>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {snapshot.notes ? (
                        <section className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                Notas
                            </p>
                            <p className="rounded-[20px] border border-foreground/[0.07] bg-background/72 p-4 text-sm text-secondary-foreground">
                                {snapshot.notes}
                            </p>
                        </section>
                    ) : null}

                    <p className="text-center text-xs text-muted-foreground/60">
                        Esta es una versión de auditoría. No representa el estado actual del movimiento.
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    )
}
