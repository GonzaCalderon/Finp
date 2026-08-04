'use client'

import { CircleDollarSign, ListChecks, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ProjectionScenarioActions({
    active,
    view,
    changeCount,
    previewing,
    onStart,
    onViewChange,
    onAdd,
    onChanges,
    onDiscard,
}: {
    active: boolean
    view: 'base' | 'scenario'
    changeCount: number
    previewing: boolean
    onStart: () => void
    onViewChange: (view: 'base' | 'scenario') => void
    onAdd: () => void
    onChanges: () => void
    onDiscard: () => void
}) {
    if (!active) {
        return (
            <Button type="button" onClick={onStart} className="min-h-10 w-full md:w-auto">
                <CircleDollarSign data-icon="inline-start" />
                ¿Qué pasa si gasto…?
            </Button>
        )
    }

    return (
        <>
            <div className="flex items-center gap-1 rounded-full bg-muted/70 p-1" aria-label="Comparar proyección real y simulada">
                {(['base', 'scenario'] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={view === option}
                        onClick={() => onViewChange(option)}
                        className={cn(
                            'min-h-9 rounded-full px-4 text-sm font-medium transition-colors',
                            view === option
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {option === 'base' ? 'Base real' : 'Con gastos'}
                    </button>
                ))}
            </div>

            <div className="hidden items-center gap-2 md:flex">
                <Button type="button" variant="outline" onClick={onChanges}>
                    <ListChecks data-icon="inline-start" />
                    Gastos simulados ({changeCount})
                </Button>
                <Button type="button" onClick={onAdd} disabled={changeCount >= 50}>
                    <Plus data-icon="inline-start" />
                    Sumar un gasto
                </Button>
                <Button type="button" variant="ghost" onClick={onDiscard} disabled={previewing}>
                    <RotateCcw data-icon="inline-start" />
                    Descartar
                </Button>
            </div>

            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
                <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
                    <Button type="button" variant="outline" className="min-h-11" onClick={onChanges}>
                        <ListChecks data-icon="inline-start" />
                        Simulados ({changeCount})
                    </Button>
                    <Button type="button" className="min-h-11" onClick={onAdd} disabled={changeCount >= 50}>
                        <Plus data-icon="inline-start" />
                        Sumar gasto
                    </Button>
                </div>
            </div>
        </>
    )
}
