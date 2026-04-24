'use client'

import { Bell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ISpacePendingAction } from '@/types'

function buildPendingTypes(actions: ISpacePendingAction[]) {
    const types: string[] = []
    if (actions.some((a) => a.kind === 'invite')) types.push('Invitaciones')
    if (actions.some((a) => a.kind === 'confirmation')) types.push('Confirmaciones')
    return types.join(' · ')
}

export function SpacesPageHeader({
    totalSpaces,
    pendingCount,
    pendingActions,
    onCreate,
    onShowPending,
}: {
    totalSpaces: number
    pendingCount: number
    pendingActions: ISpacePendingAction[]
    onCreate: () => void
    onShowPending: () => void
}) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Espacios</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Agrupá y analizá contextos financieros individuales o compartidos.
                    </p>
                </div>
                <Button className="rounded-full px-5" onClick={onCreate}>
                    <Plus className="h-4 w-4" />
                    Nuevo espacio
                </Button>
            </div>

            {pendingCount > 0 && (
                <div
                    className="flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3"
                    style={{
                        background: 'color-mix(in srgb, #f59e0b 8%, transparent)',
                        borderColor: 'color-mix(in srgb, #f59e0b 22%, transparent)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Bell
                            className="h-4 w-4 shrink-0"
                            style={{ color: '#b45309' }}
                        />
                        <div className="text-sm">
                            <span className="font-semibold" style={{ color: '#92400e' }}>
                                {pendingCount} acción{pendingCount === 1 ? '' : 'es'} pendiente{pendingCount === 1 ? '' : 's'}
                            </span>
                            {buildPendingTypes(pendingActions) && (
                                <span style={{ color: '#a16207' }}>
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
                        style={{ color: '#92400e' }}
                    >
                        Ver todas &rsaquo;
                    </button>
                </div>
            )}
        </div>
    )
}
