'use client'

import { CalendarRange, Coins, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceMetaBadge, SpaceModeBadge, SpaceSectionHeading, SpaceStatusBadge, SpaceSurface, SpaceTypeBadge, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
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
    return (
        <SpaceSurface accent="var(--chart-1)">
            <SpaceSectionHeading
                eyebrow="Espacio"
                title={space.name}
                description={
                    space.description ||
                    'Este espacio todavía no tiene una descripción cargada, pero ya está listo para ordenar movimientos, participantes y balances.'
                }
                action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        {canManage ? (
                            <Button variant="outline" className="rounded-full" onClick={onInvite}>
                                <UserPlus className="h-4 w-4" />
                                Invitar
                            </Button>
                        ) : null}
                        <Button className="rounded-full" onClick={onCreateEntry}>
                            <Coins className="h-4 w-4" />
                            Nuevo movimiento
                        </Button>
                    </div>
                }
            />

            <div className="mt-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-4">
                    <SpaceTypeIcon type={space.type} className="h-16 w-16 rounded-[24px]" iconClassName="h-7 w-7" />

                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <SpaceTypeBadge type={space.type} />
                            <SpaceModeBadge mode={space.mode} />
                            <SpaceStatusBadge status={space.status} />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <SpaceMetaBadge icon={Users}>
                                {summary.participantCount} participante{summary.participantCount === 1 ? '' : 's'}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={Coins}>{space.currencies.join(' / ')}</SpaceMetaBadge>
                            <SpaceMetaBadge icon={CalendarRange}>
                                {formatSpaceDateRange(space.startDate, space.endDate)}
                            </SpaceMetaBadge>
                            <SpaceMetaBadge icon={CalendarRange}>
                                Creado {formatSpaceDate(space.createdAt)}
                            </SpaceMetaBadge>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px] xl:max-w-[480px]">
                    <div className="rounded-[24px] border border-foreground/[0.06] bg-background/72 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Estado
                        </p>
                        <p className="mt-2 text-lg font-semibold tracking-tight">
                            {summary.pendingEntryCount > 0 ? 'Con revisión pendiente' : 'Operando con normalidad'}
                        </p>
                    </div>

                    <div className="rounded-[24px] border border-foreground/[0.06] bg-background/72 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Moneda de reporte
                        </p>
                        <p className="mt-2 text-lg font-semibold tracking-tight">
                            {space.reportingCurrency}
                        </p>
                    </div>

                    <div className="rounded-[24px] border border-foreground/[0.06] bg-background/72 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Movimientos
                        </p>
                        <p className="mt-2 text-lg font-semibold tracking-tight">
                            {summary.totalEntryCount}
                        </p>
                    </div>
                </div>
            </div>
        </SpaceSurface>
    )
}
