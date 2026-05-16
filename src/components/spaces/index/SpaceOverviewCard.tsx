'use client'

import Link from 'next/link'
import { CalendarRange } from 'lucide-react'
import {
    SpaceAmountInline,
    SpaceInitialsAvatar,
    SpaceTypeBadge,
    SpaceTypeIcon,
} from '@/components/spaces/SpaceUi'
import {
    selectableCardMotion,
} from '@/components/shared/selectable-card-motion'
import { formatSpaceDateRange, extractId } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { ISpaceListItem } from '@/types'

function BalanceStatusInline({
    toCollect,
    toPay,
    currency,
    hidden,
    compact = false,
}: {
    toCollect: number
    toPay: number
    currency: string
    hidden: boolean
    compact?: boolean
}) {
    if (toCollect > 0) {
        return (
            <div className={cn('text-right', compact ? '' : 'space-y-0.5')}>
                <p
                    className={cn('font-semibold leading-none', compact ? 'text-[10px]' : 'text-xs')}
                    style={{ color: 'var(--chart-3)' }}
                >
                    Te deben
                </p>
                <SpaceAmountInline
                    amount={toCollect}
                    currency={currency}
                    hidden={hidden}
                    color="var(--chart-3)"
                    className={cn('font-semibold tabular-nums leading-tight', compact ? 'text-xs' : 'text-sm')}
                />
            </div>
        )
    }
    if (toPay > 0) {
        return (
            <div className={cn('text-right', compact ? '' : 'space-y-0.5')}>
                <p
                    className={cn('font-semibold leading-none', compact ? 'text-[10px]' : 'text-xs')}
                    style={{ color: 'var(--warning-foreground)' }}
                >
                    Debes
                </p>
                <SpaceAmountInline
                    amount={toPay}
                    currency={currency}
                    hidden={hidden}
                    color="var(--warning-foreground)"
                    className={cn('font-semibold tabular-nums leading-tight', compact ? 'text-xs' : 'text-sm')}
                />
            </div>
        )
    }
    return (
        <p
            className={cn('text-muted-foreground', compact ? 'text-[10px]' : 'text-xs')}
        >
            Al día
        </p>
    )
}

// ── Row card (mobile) ─────────────────────────────────────────────────────────
function SpaceOverviewCardMobile({ item, hidden }: { item: ISpaceListItem; hidden: boolean }) {
    const topParticipants = item.participants.slice(0, 3)
    const toCollect = item.summary.pendingToCollectReporting
    const toPay = item.summary.pendingToPayReporting

    return (
        <Link href={`/spaces/${extractId(item.space._id)}`} className="group block">
            <div
                className={cn(
                    'flex items-center gap-3 rounded-[22px] border border-foreground/[0.08] bg-card/94 px-4 py-3 hover:border-primary/20',
                    selectableCardMotion
                )}
                style={{ boxShadow: 'var(--card-shadow)' }}
            >
                <SpaceTypeIcon type={item.space.type} className="h-11 w-11 shrink-0 rounded-[14px]" />

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                            {item.space.name}
                        </h3>
                        <BalanceStatusInline
                            toCollect={toCollect}
                            toPay={toPay}
                            currency={item.space.reportingCurrency}
                            hidden={hidden}
                            compact
                        />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                        <SpaceTypeBadge type={item.space.type} className="px-2 py-0.5 text-[10px]" />
                        <div className="flex items-center gap-1.5">
                            <div className="flex -space-x-1">
                                {topParticipants.map((p) => (
                                    <SpaceInitialsAvatar
                                        key={extractId(p._id)}
                                        name={p.displayName}
                                        className="h-[18px] w-[18px] border-card text-[7px]"
                                    />
                                ))}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {item.summary.participantCount} part.
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}

// ── Full card (desktop) ───────────────────────────────────────────────────────
export function SpaceOverviewCard({ item, hidden }: { item: ISpaceListItem; hidden: boolean }) {
    const topParticipants = item.participants.slice(0, 4)
    const isFaded = item.space.status === 'closed' || item.space.status === 'archived'
    const toCollect = item.summary.pendingToCollectReporting
    const toPay = item.summary.pendingToPayReporting

    return (
        <>
            {/* Mobile row */}
            <div className="md:hidden">
                <SpaceOverviewCardMobile item={item} hidden={hidden} />
            </div>

            {/* Desktop card */}
            <Link
                href={`/spaces/${extractId(item.space._id)}`}
                className="group hidden h-full md:block"
            >
                <div
                    className={cn(
                        'flex h-full flex-col rounded-[28px] border border-foreground/[0.08] p-5 hover:border-primary/18',
                        selectableCardMotion
                    )}
                    style={{
                        background: 'color-mix(in srgb, var(--card) 92%, transparent)',
                        boxShadow: 'var(--card-shadow)',
                        opacity: isFaded ? 0.76 : 1,
                    }}
                >
                    {/* Icon + title/type + balance status */}
                    <div className="flex items-start gap-3">
                        <SpaceTypeIcon
                            type={item.space.type}
                            className="h-[42px] w-[42px] shrink-0 rounded-[13px]"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="truncate text-[1.05rem] font-semibold leading-tight tracking-tight text-foreground">
                                    {item.space.name}
                                </h3>
                                <div className="shrink-0">
                                    <BalanceStatusInline
                                        toCollect={toCollect}
                                        toPay={toPay}
                                        currency={item.space.reportingCurrency}
                                        hidden={hidden}
                                    />
                                </div>
                            </div>
                            <SpaceTypeBadge
                                type={item.space.type}
                                className="mt-1.5 px-2.5 py-0.5 text-[11px]"
                            />
                        </div>
                    </div>

                    <div className="my-4 border-t border-foreground/[0.07]" />

                    {/* Participants + total amount */}
                    <div className="flex items-center justify-between gap-3">
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
                                {item.summary.participantCount} participante{item.summary.participantCount === 1 ? '' : 's'}
                            </span>
                        </div>
                        <SpaceAmountInline
                            amount={item.summary.totalReporting}
                            currency={item.space.reportingCurrency}
                            hidden={hidden}
                            className="text-sm font-semibold tabular-nums"
                        />
                    </div>

                    {/* Spacer to push dates to bottom */}
                    <div className="flex-1" />

                    {/* Dates (if present) */}
                    {item.space.startDate ? (
                        <>
                            <div className="mt-4 border-t border-foreground/[0.07]" />
                            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <CalendarRange className="h-3 w-3 shrink-0" />
                                {formatSpaceDateRange(item.space.startDate, item.space.endDate)}
                            </div>
                        </>
                    ) : null}
                </div>
            </Link>
        </>
    )
}
