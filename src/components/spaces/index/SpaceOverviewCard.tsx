'use client'

import Link from 'next/link'
import { ChevronRight, Paperclip, TrendingUp, Users } from 'lucide-react'
import { SpaceAmountInline, SpaceInitialsAvatar, SpaceModeBadge, SpaceStatusBadge, SpaceTypeBadge } from '@/components/spaces/SpaceUi'
import { formatSpaceDateRange, extractId } from '@/lib/utils/spaces'
import type { ISpaceListItem } from '@/types'

function SpaceOverviewMiniTrend({ points }: { points: Array<{ amount: number }> }) {
    const max = Math.max(...points.map((point) => point.amount), 1)

    return (
        <div className="flex h-12 items-end gap-1.5">
            {points.length > 0 ? (
                points.map((point, index) => (
                    <div
                        key={`${point.amount}-${index}`}
                        className="flex-1 rounded-full"
                        style={{
                            height: `${Math.max((point.amount / max) * 100, 16)}%`,
                            background:
                                'linear-gradient(180deg, color-mix(in srgb, var(--chart-3) 76%, white) 0%, color-mix(in srgb, var(--sky) 66%, white) 100%)',
                        }}
                    />
                ))
            ) : (
                <div className="h-full w-full rounded-full border border-dashed border-border" />
            )}
        </div>
    )
}

export function SpaceOverviewCard({
    item,
    hidden,
}: {
    item: ISpaceListItem
    hidden: boolean
}) {
    const topParticipants = item.participants.slice(0, 3)
    const attachmentCount = item.recentEntries.reduce(
        (total, entry) => total + (entry.attachments?.length ?? 0),
        0
    )
    const confirmedRatio =
        item.summary.totalEntryCount > 0
            ? Math.max(
                0,
                ((item.summary.totalEntryCount - item.summary.pendingEntryCount) /
                    item.summary.totalEntryCount) *
                    100
            )
            : 0

    return (
        <Link
            href={`/spaces/${extractId(item.space._id)}`}
            className="group flex h-full flex-col rounded-[30px] border border-foreground/[0.08] bg-card/94 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/18"
            style={{
                background:
                    'radial-gradient(circle at top left, color-mix(in srgb, var(--chart-3) 10%, transparent) 0%, transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--card) 98%, transparent) 0%, color-mix(in srgb, var(--card) 93%, transparent) 100%)',
                boxShadow: 'var(--card-shadow)',
            }}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <SpaceTypeBadge type={item.space.type} />
                        <SpaceModeBadge mode={item.space.mode} />
                        <SpaceStatusBadge status={item.space.status} />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[1.6rem] font-semibold tracking-tight text-foreground">
                                {item.space.name}
                            </h3>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                        </div>
                        <p className="line-clamp-2 max-w-[44ch] text-sm text-muted-foreground">
                            {item.space.description || 'Un contexto financiero compartido listo para ordenar movimientos, balances y pendientes.'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {topParticipants.map((participant) => (
                            <SpaceInitialsAvatar
                                key={extractId(participant._id)}
                                name={participant.displayName}
                                className="h-8 w-8 border-card text-[11px]"
                            />
                        ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                        {item.summary.participantCount} participante{item.summary.participantCount === 1 ? '' : 's'}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {item.space.currencies.map((currency) => (
                        <span
                            key={currency}
                            className="rounded-full border border-border/80 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-secondary-foreground"
                        >
                            {currency}
                        </span>
                    ))}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-foreground/[0.06] bg-background/75 p-3">
                    <p className="text-xs text-muted-foreground">Gastado total</p>
                    <SpaceAmountInline
                        amount={item.summary.totalReporting}
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        className="mt-2 text-lg font-semibold tracking-tight"
                    />
                </div>

                <div className="rounded-[22px] border border-foreground/[0.06] bg-background/75 p-3">
                    <p className="text-xs text-muted-foreground">Tu parte</p>
                    <SpaceAmountInline
                        amount={item.summary.yourShareReporting}
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        className="mt-2 text-lg font-semibold tracking-tight"
                    />
                </div>

                <div className="rounded-[22px] border border-foreground/[0.06] bg-background/75 p-3">
                    <p className="text-xs text-muted-foreground">
                        {item.summary.pendingToCollectReporting > 0 ? 'Saldo a favor' : 'Pendiente'}
                    </p>
                    <SpaceAmountInline
                        amount={
                            item.summary.pendingToCollectReporting > 0
                                ? item.summary.pendingToCollectReporting
                                : item.summary.pendingToPayReporting
                        }
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        color={item.summary.pendingToCollectReporting > 0 ? 'var(--chart-3)' : undefined}
                        className="mt-2 text-lg font-semibold tracking-tight"
                    />
                </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-foreground/[0.06] bg-background/72 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Ritmo del espacio
                        </p>
                        <p className="mt-1 text-sm text-secondary-foreground">
                            {formatSpaceDateRange(item.space.startDate, item.space.endDate)}
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {Math.round(confirmedRatio)}% confirmado
                    </div>
                </div>

                <div className="mt-4">
                    <SpaceOverviewMiniTrend points={item.summary.monthlyTrend} />
                </div>

                <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Operaciones resueltas</span>
                        <span>
                            {item.summary.totalEntryCount - item.summary.pendingEntryCount}/{item.summary.totalEntryCount || 0}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.min(confirmedRatio, 100)}%`,
                                background:
                                    'linear-gradient(90deg, var(--chart-3) 0%, color-mix(in srgb, var(--sky) 70%, white) 100%)',
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {item.summary.pendingEntryCount} pendiente{item.summary.pendingEntryCount === 1 ? '' : 's'}
                </span>
                {attachmentCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        {attachmentCount} adjunto{attachmentCount === 1 ? '' : 's'}
                    </span>
                ) : null}
            </div>
        </Link>
    )
}
