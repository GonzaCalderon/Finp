'use client'

import { useState } from 'react'
import { CalendarRange, ChevronDown, ChevronUp, Coins, ListChecks, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceCurrencyStack, SpaceMetaBadge, SpaceModeBadge, SpaceStatusBadge, SpaceTypeBadge, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
import { cn } from '@/lib/utils'
import { formatSpaceDateRange } from '@/lib/utils/spaces'
import type { ISpace, SpaceSummarySnapshot } from '@/types'

const DESCRIPTION_THRESHOLD = 80

export function SpaceHero({
    space,
    summary,
    canManage,
    onInvite,
    onCreateEntry,
    className,
}: {
    space: ISpace
    summary: SpaceSummarySnapshot
    canManage: boolean
    onInvite: () => void
    onCreateEntry: () => void
    className?: string
}) {
    const description = space.description ?? ''
    const isLong = description.length > DESCRIPTION_THRESHOLD
    const [expanded, setExpanded] = useState(false)

    return (
        <section className={cn('py-2 md:py-3', className)}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-start gap-3 md:gap-4">
                    <SpaceTypeIcon type={space.type} className="hidden h-12 w-12 rounded-[18px] md:flex md:h-14 md:w-14 md:rounded-[20px]" iconClassName="h-5 w-5 md:h-6 md:w-6" />

                    <div className="min-w-0 space-y-3">
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                <SpaceTypeBadge type={space.type} />
                                <SpaceModeBadge mode={space.mode} />
                                <SpaceStatusBadge status={space.status} />
                            </div>
                            <h2 className="text-[1.35rem] font-semibold tracking-tight text-foreground md:text-2xl">
                                {space.name}
                            </h2>
                            {description ? (
                                <div>
                                    <p className="max-w-4xl text-sm text-muted-foreground md:text-[0.95rem]">
                                        {isLong && !expanded
                                            ? `${description.slice(0, DESCRIPTION_THRESHOLD)}…`
                                            : description}
                                    </p>
                                    {isLong && (
                                        <button
                                            type="button"
                                            onClick={() => setExpanded((v) => !v)}
                                            className="mt-0.5 flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                                        >
                                            {expanded ? (
                                                <><ChevronUp className="h-3 w-3" /> Ver menos</>
                                            ) : (
                                                <><ChevronDown className="h-3 w-3" /> Ver más</>
                                            )}
                                        </button>
                                    )}
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                            <SpaceMetaBadge icon={Users}>
                                {summary.participantCount} participante{summary.participantCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={Coins}>
                                <SpaceCurrencyStack currencies={space.currencies} />
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={ListChecks}>
                                {summary.totalEntryCount} movimiento{summary.totalEntryCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={CalendarRange}>
                                {formatSpaceDateRange(space.startDate, space.endDate)}
                            </SpaceMetaBadge>
                        </div>
                    </div>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-row xl:pt-3">
                    {canManage ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={onInvite}>
                            <UserPlus className="h-4 w-4" />
                            Invitar
                        </Button>
                    ) : null}
                    <Button size="sm" className="rounded-full" onClick={onCreateEntry}>
                        <Coins className="h-4 w-4" />
                        Nuevo movimiento
                    </Button>
                </div>
            </div>
        </section>
    )
}
