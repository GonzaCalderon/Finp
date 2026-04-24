'use client'

import { Bell, CheckCircle2, Clock3, Plus, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ISpacePendingAction } from '@/types'

function buildPendingTypes(actions: ISpacePendingAction[]) {
    const types: string[] = []
    if (actions.some((a) => a.kind === 'invite')) types.push('Invitaciones')
    if (actions.some((a) => a.kind === 'confirmation')) types.push('Confirmaciones')
    return types.join(' · ')
}

export function SpacesPageHeader({
    totalSpaces,
    activeSpaces,
    totalMovements,
    pendingCount,
    pendingActions,
    onCreate,
    onShowPending,
}: {
    totalSpaces: number
    activeSpaces: number
    totalMovements: number
    pendingCount: number
    pendingActions: ISpacePendingAction[]
    onCreate: () => void
    onShowPending: () => void
}) {
    const metrics = [
        {
            label: 'Activos',
            value: activeSpaces,
            icon: CheckCircle2,
            tone: 'text-primary bg-primary/10',
        },
        {
            label: 'Movimientos',
            value: totalMovements,
            icon: WalletCards,
            tone: 'text-secondary-foreground bg-secondary',
        },
        {
            label: 'Pendientes',
            value: pendingCount,
            icon: Clock3,
            tone: pendingCount > 0
                ? 'text-warning-foreground bg-warning-soft'
                : 'text-muted-foreground bg-secondary',
        },
    ]

    return (
        <div
            className="relative overflow-hidden rounded-[30px] border border-foreground/[0.08] bg-card px-4 py-4 shadow-sm md:px-5 md:py-5"
            style={{ boxShadow: 'var(--card-shadow)' }}
        >
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                    background:
                        'linear-gradient(90deg, transparent, color-mix(in srgb, var(--sky) 36%, var(--background)), transparent)',
                }}
            />

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.48fr)] xl:items-end">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                        Espacios
                    </div>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                                Tus contextos financieros
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
                                {totalSpaces === 0
                                    ? 'Separá viajes, hogar, pareja o proyectos sin mezclar la operación diaria de Finp.'
                                    : `${totalSpaces} espacio${totalSpaces === 1 ? '' : 's'} con balances, participantes, monedas del espacio y pendientes en un solo lugar.`}
                            </p>
                        </div>
                        <Button className="h-11 rounded-full px-5 sm:shrink-0" onClick={onCreate}>
                            <Plus className="h-4 w-4" />
                            Nuevo espacio
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {metrics.map((metric) => {
                        const Icon = metric.icon

                        return (
                            <div
                                key={metric.label}
                                className="rounded-[20px] border border-foreground/[0.07] bg-background/78 px-3 py-3"
                            >
                                <div
                                    className={cn(
                                        'mb-3 flex h-8 w-8 items-center justify-center rounded-full',
                                        metric.tone
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </div>
                                <p className="text-2xl font-semibold tracking-tight text-foreground">
                                    {metric.value}
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    {metric.label}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {pendingCount > 0 && (
                <div
                    className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3"
                    style={{
                        background: 'var(--warning-soft)',
                        borderColor: 'color-mix(in srgb, var(--warning) 24%, transparent)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Bell
                            className="h-4 w-4 shrink-0"
                            style={{ color: 'var(--warning-foreground)' }}
                        />
                        <div className="text-sm">
                            <span className="font-semibold" style={{ color: 'var(--warning-foreground)' }}>
                                {pendingCount} acción{pendingCount === 1 ? '' : 'es'} pendiente{pendingCount === 1 ? '' : 's'}
                            </span>
                            {buildPendingTypes(pendingActions) && (
                                <span className="text-muted-foreground">
                                    {' · '}
                                    {buildPendingTypes(pendingActions)}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onShowPending}
                        className="shrink-0 text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'var(--warning-foreground)' }}
                    >
                        Ver todas &rsaquo;
                    </button>
                </div>
            )}
        </div>
    )
}
