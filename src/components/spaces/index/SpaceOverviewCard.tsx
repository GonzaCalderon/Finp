'use client'

import Link from 'next/link'
import { AlertCircle, ChevronRight } from 'lucide-react'
import {
    SpaceAmountInline,
    SpaceInitialsAvatar,
    SpaceModeBadge,
    SpaceStatusBadge,
    SpaceTypeIcon,
    SpaceTypeBadge,
} from '@/components/spaces/SpaceUi'
import { formatSpaceDateRange, resolveSpaceTypeAccent, extractId } from '@/lib/utils/spaces'
import type { ISpaceListItem } from '@/types'

function ProgressRing({ pct, color }: { pct: number; color: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-secondary">
                <div
                    className="h-full rounded-full transition-[width_.3s]"
                    style={{ width: `${Math.min(pct, 100)}%`, background: color }}
                />
            </div>
            <span
                className="tabular-nums text-[11px] text-muted-foreground"
                style={{ minWidth: 28, textAlign: 'right' }}
            >
                {Math.round(pct)}%
            </span>
        </div>
    )
}

function MiniSparkline({ points, color }: { points: Array<{ amount: number }>; color: string }) {
    const max = Math.max(...points.map((p) => p.amount), 1)
    return (
        <div className="flex h-8 items-end gap-0.5">
            {points.length > 0 ? (
                points.map((p, i) => (
                    <div
                        key={i}
                        className="w-1.5 rounded-sm"
                        style={{
                            height: `${Math.max((p.amount / max) * 100, 14)}%`,
                            background: `color-mix(in srgb, ${color} 60%, transparent)`,
                        }}
                    />
                ))
            ) : (
                <div className="h-full w-8 rounded-sm border border-dashed border-border" />
            )}
        </div>
    )
}

// ── Compact card (mobile only) ────────────────────────────────────────────────
function SpaceOverviewCardMobile({ item, hidden }: { item: ISpaceListItem; hidden: boolean }) {
    const confirmedRatio =
        item.summary.totalEntryCount > 0
            ? Math.max(
                  0,
                  ((item.summary.totalEntryCount - item.summary.pendingEntryCount) /
                      item.summary.totalEntryCount) *
                      100
              )
            : 0

    const balancePositive = item.summary.pendingToCollectReporting > 0
    const balanceAmount = balancePositive
        ? item.summary.pendingToCollectReporting
        : item.summary.pendingToPayReporting

    return (
        <Link
            href={`/spaces/${extractId(item.space._id)}`}
            className="group flex items-center gap-3 rounded-[22px] border border-foreground/[0.08] bg-card/94 px-4 py-3 transition-all hover:border-primary/20"
            style={{ boxShadow: 'var(--card-shadow)' }}
        >
            <SpaceTypeIcon type={item.space.type} className="h-11 w-11 shrink-0 rounded-[14px]" />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                        {item.space.name}
                    </h3>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                    <SpaceTypeBadge type={item.space.type} className="px-2 py-0.5 text-[10px]" />
                    <SpaceStatusBadge
                        status={item.space.status}
                        className="px-2 py-0.5 text-[10px]"
                    />
                    {item.summary.pendingEntryCount > 0 && (
                        <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: 'rgba(212,160,23,0.15)', color: '#A67C00' }}
                        >
                            {item.summary.pendingEntryCount} pend.
                        </span>
                    )}
                </div>
                <div className="mt-1">
                    <ProgressRing
                        pct={confirmedRatio}
                        color="linear-gradient(90deg, var(--chart-3), color-mix(in srgb, var(--sky) 70%, white))"
                    />
                </div>
            </div>

            <div className="shrink-0 text-right">
                <p className="text-[10px] text-muted-foreground">Tu parte</p>
                <SpaceAmountInline
                    amount={item.summary.yourShareReporting}
                    currency={item.space.reportingCurrency}
                    hidden={hidden}
                    className="text-sm font-semibold"
                />
                {balanceAmount > 0 && (
                    <SpaceAmountInline
                        amount={balanceAmount}
                        currency={item.space.reportingCurrency}
                        hidden={hidden}
                        color={balancePositive ? 'var(--chart-3)' : undefined}
                        className="text-xs"
                    />
                )}
            </div>
        </Link>
    )
}

// ── Full card (desktop) ───────────────────────────────────────────────────────
export function SpaceOverviewCard({ item, hidden }: { item: ISpaceListItem; hidden: boolean }) {
    const accent = resolveSpaceTypeAccent(item.space.type)
    const topParticipants = item.participants.slice(0, 3)
    const confirmedRatio =
        item.summary.totalEntryCount > 0
            ? Math.max(
                  0,
                  ((item.summary.totalEntryCount - item.summary.pendingEntryCount) /
                      item.summary.totalEntryCount) *
                      100
              )
            : 0
    const isFaded = item.space.status === 'closed' || item.space.status === 'archived'
    const collectPositive = item.summary.pendingToCollectReporting > 0

    const metrics = [
        { label: 'Gastado', amount: item.summary.totalReporting },
        { label: 'Tu parte', amount: item.summary.yourShareReporting },
        {
            label: collectPositive ? 'A favor' : 'Pendiente',
            amount: collectPositive
                ? item.summary.pendingToCollectReporting
                : item.summary.pendingToPayReporting,
            color: collectPositive ? 'var(--chart-3)' : undefined,
        },
    ]

    return (
        <>
            {/* Mobile compact */}
            <div className="md:hidden">
                <SpaceOverviewCardMobile item={item} hidden={hidden} />
            </div>

            {/* Desktop full card */}
            <Link
                href={`/spaces/${extractId(item.space._id)}`}
                className="group hidden h-full flex-col rounded-[28px] border border-foreground/[0.08] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/18 md:flex"
                style={{
                    background: `radial-gradient(circle at top left, color-mix(in srgb, ${accent?.color ?? 'var(--chart-3)'} 8%, transparent) 0%, transparent 38%), var(--card, hsl(var(--card)))`,
                    boxShadow: 'var(--card-shadow)',
                    opacity: isFaded ? 0.76 : 1,
                }}
            >
                {/* Header: icon + badges */}
                <div className="flex items-start justify-between gap-3">
                    <SpaceTypeIcon
                        type={item.space.type}
                        className="h-[42px] w-[42px] shrink-0 rounded-[13px]"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <SpaceStatusBadge
                            status={item.space.status}
                            className="px-2.5 py-1 text-[11px]"
                        />
                        {item.summary.pendingEntryCount > 0 && (
                            <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
                                style={{ background: 'rgba(212,160,23,0.15)', color: '#A67C00' }}
                            >
                                <AlertCircle className="h-[11px] w-[11px]" />
                                {item.summary.pendingEntryCount}
                            </span>
                        )}
                    </div>
                </div>

                {/* Title + badges + description */}
                <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                        <h3 className="text-[1.05rem] font-semibold leading-tight tracking-tight text-foreground">
                            {item.space.name}
                        </h3>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-50" />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <SpaceTypeBadge type={item.space.type} className="px-2.5 py-0.5 text-[11px]" />
                        <SpaceModeBadge mode={item.space.mode} className="px-2.5 py-0.5 text-[11px]" />
                    </div>
                    {item.space.description && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {item.space.description}
                        </p>
                    )}
                </div>

                {/* Participants + currencies */}
                <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                            {topParticipants.map((p) => (
                                <SpaceInitialsAvatar
                                    key={extractId(p._id)}
                                    name={p.displayName}
                                    className="h-[26px] w-[26px] border-card text-[10px]"
                                />
                            ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {item.summary.participantCount} participante
                            {item.summary.participantCount === 1 ? '' : 's'}
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {item.space.currencies.map((c) => (
                            <span
                                key={c}
                                className="rounded-full border border-border/80 bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                            >
                                {c}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Metrics */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {metrics.map(({ label, amount, color }) => (
                        <div
                            key={label}
                            className="rounded-[18px] border border-foreground/[0.06] bg-background/75 p-2.5"
                        >
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <SpaceAmountInline
                                amount={amount}
                                currency={item.space.reportingCurrency}
                                hidden={hidden}
                                color={color}
                                className="mt-1 text-sm font-semibold leading-tight tabular-nums"
                            />
                        </div>
                    ))}
                </div>

                {/* Footer: date + progress + sparkline */}
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-foreground/[0.06] pt-3">
                    <div className="min-w-0 flex-1">
                        {item.space.startDate && (
                            <p className="mb-1.5 text-[11px] text-muted-foreground">
                                {formatSpaceDateRange(item.space.startDate, item.space.endDate)}
                            </p>
                        )}
                        <ProgressRing pct={confirmedRatio} color={accent?.color ?? 'var(--chart-3)'} />
                    </div>
                    <MiniSparkline
                        points={item.summary.monthlyTrend}
                        color={accent?.color ?? 'var(--chart-3)'}
                    />
                </div>
            </Link>
        </>
    )
}
