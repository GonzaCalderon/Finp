'use client'

import { Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SpacesPendingBell({
    pendingCount,
    onShowPending,
}: {
    pendingCount: number
    onShowPending: () => void
}) {
    return (
        <button
            type="button"
            onClick={onShowPending}
            className="relative inline-flex h-9 items-center gap-2 rounded-full border border-foreground/[0.08] bg-background/80 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Ver notificaciones"
        >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificaciones</span>
            {pendingCount > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-warning-foreground">
                    {pendingCount > 9 ? '9+' : pendingCount}
                </span>
            ) : null}
        </button>
    )
}

export function SpacesPageTopBar({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Administra tus proyectos
            </h1>

            <Button className="hidden h-9 rounded-full px-4 text-sm md:flex" onClick={onCreate}>
                <Plus className="h-3.5 w-3.5" />
                Nuevo espacio
            </Button>
        </div>
    )
}
