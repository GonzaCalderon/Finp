'use client'

import { Clock3 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SpaceStatusFilter = 'all' | 'active' | 'paused' | 'closed' | 'archived'

const FILTERS: Array<{ value: SpaceStatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'paused', label: 'Pausados' },
    { value: 'closed', label: 'Cerrados' },
    { value: 'archived', label: 'Archivados' },
]

export function SpacesFiltersBar({
    selected,
    counts,
    visibleCount,
    onChange,
}: {
    selected: SpaceStatusFilter
    counts: Record<SpaceStatusFilter, number>
    visibleCount: number
    onChange: (value: SpaceStatusFilter) => void
}) {
    return (
        <div className="flex flex-col gap-3 rounded-[28px] border border-foreground/[0.08] bg-card/92 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                    <button
                        key={filter.value}
                        type="button"
                        onClick={() => onChange(filter.value)}
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors',
                            selected === filter.value
                                ? 'border-primary/20 bg-primary/10 text-primary'
                                : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <span>{filter.label}</span>
                        <span
                            className={cn(
                                'rounded-full px-2 py-0.5 text-[11px]',
                                selected === filter.value
                                    ? 'bg-primary/12 text-primary'
                                    : 'bg-secondary text-secondary-foreground'
                            )}
                        >
                            {counts[filter.value]}
                        </span>
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                <span>
                    {visibleCount} espacio{visibleCount === 1 ? '' : 's'} visible{visibleCount === 1 ? '' : 's'}
                </span>
            </div>
        </div>
    )
}
