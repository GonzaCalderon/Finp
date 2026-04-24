'use client'

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
    onChange,
}: {
    selected: SpaceStatusFilter
    counts: Record<SpaceStatusFilter, number>
    onChange: (value: SpaceStatusFilter) => void
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
                <button
                    key={filter.value}
                    type="button"
                    onClick={() => onChange(filter.value)}
                    className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                        selected === filter.value
                            ? 'border-primary/20 bg-primary/10 text-primary'
                            : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
                    )}
                >
                    <span>{filter.label}</span>
                    <span
                        className={cn(
                            'rounded-full px-1.5 py-0.5 text-[11px]',
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
    )
}
