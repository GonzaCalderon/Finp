'use client'

import { CalendarRange, Coins, ListChecks, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceMetaBadge, SpaceModeBadge, SpaceStatusBadge, SpaceSurface, SpaceTypeBadge, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
import { formatSpaceDate, formatSpaceDateRange } from '@/lib/utils/spaces'
import type { ISpace, SpaceSummarySnapshot } from '@/types'

export function SpaceHero({
    space,
    summary,
    canManage,
    onInvite,
    onCreateEntry,
}: {
    space: ISpace
    summary: SpaceSummarySnapshot
    canManage: boolean
    onInvite: () => void
    onCreateEntry: () => void
}) {
    const description =
        space.description ||
        'Este espacio todavía no tiene una descripción cargada, pero ya está listo para ordenar movimientos, participantes y balances.'

    return (
        <SpaceSurface accent="var(--chart-1)" padding="p-4 md:p-5" className="rounded-[26px] md:rounded-[28px]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-start gap-3 md:gap-4">
                    <SpaceTypeIcon type={space.type} className="hidden h-12 w-12 rounded-[18px] md:flex md:h-14 md:w-14 md:rounded-[20px]" iconClassName="h-5 w-5 md:h-6 md:w-6" />

                    <div className="min-w-0 space-y-3">
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                <SpaceTypeBadge type={space.type} />
                                <SpaceModeBadge mode={space.mode} />
                                <SpaceStatusBadge status={space.status} />
                            </div>
                            <div>
                                <h2 className="text-[1.35rem] font-semibold tracking-tight text-foreground md:text-2xl">
                                    {space.name}
                                </h2>
                                <p className="mt-1 line-clamp-3 max-w-4xl text-sm text-muted-foreground md:line-clamp-none md:text-[0.95rem]">
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                            <SpaceMetaBadge icon={Users}>
                                {summary.participantCount} participante{summary.participantCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={Coins}>{space.currencies.join(' / ')}</SpaceMetaBadge>
                            <SpaceMetaBadge icon={Coins}>Reporte {space.reportingCurrency}</SpaceMetaBadge>
                            <SpaceMetaBadge icon={ListChecks}>
                                {summary.totalEntryCount} movimiento{summary.totalEntryCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={CalendarRange}>
                                {formatSpaceDateRange(space.startDate, space.endDate)}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={CalendarRange}>
                                Creado {formatSpaceDate(space.createdAt)}
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
        </SpaceSurface>
    )
}
