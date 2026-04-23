'use client'

import { Bell, Plus, Radar, Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SpaceSectionHeading, SpaceSurface } from '@/components/spaces/SpaceUi'

export function SpacesPageHeader({
    totalSpaces,
    activeSpaces,
    pendingCount,
    onCreate,
    onShowPending,
}: {
    totalSpaces: number
    activeSpaces: number
    pendingCount: number
    onCreate: () => void
    onShowPending: () => void
}) {
    const stats = [
        {
            label: 'Espacios',
            value: totalSpaces,
            icon: Sparkles,
        },
        {
            label: 'Activos',
            value: activeSpaces,
            icon: Radar,
        },
        {
            label: 'Pendientes',
            value: pendingCount,
            icon: Users,
        },
    ]

    return (
        <SpaceSurface accent="var(--chart-3)" className="overflow-hidden">
            <div className="absolute -right-12 top-0 hidden h-44 w-44 rounded-full bg-[color:rgba(16,185,129,0.08)] blur-3xl md:block" />
            <div className="absolute bottom-0 left-1/3 hidden h-28 w-28 rounded-full bg-[color:rgba(74,158,204,0.12)] blur-3xl md:block" />

            <SpaceSectionHeading
                eyebrow="Colaboración financiera"
                title="Espacios"
                description="Separá viajes, hogar, pareja o proyectos en contextos claros, con balances, pendientes y movimientos bien organizados."
                action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" className="rounded-full" onClick={onShowPending}>
                            <Bell className="h-4 w-4" />
                            Pendientes
                            {pendingCount > 0 ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                                    {pendingCount}
                                </span>
                            ) : null}
                        </Button>
                        <Button className="rounded-full px-4" onClick={onCreate}>
                            <Plus className="h-4 w-4" />
                            Nuevo espacio
                        </Button>
                    </div>
                }
            />

            <div className="mt-6 grid gap-3 md:grid-cols-3">
                {stats.map((item) => {
                    const Icon = item.icon

                    return (
                        <div
                            key={item.label}
                            className="rounded-[26px] border border-foreground/[0.06] bg-background/75 p-4 backdrop-blur-sm"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                        {item.label}
                                    </p>
                                    <p className="text-3xl font-semibold tracking-tight">{item.value}</p>
                                </div>

                                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </SpaceSurface>
    )
}
