'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
    search,
    onSearchChange,
    onChange,
}: {
    selected: SpaceStatusFilter
    counts: Record<SpaceStatusFilter, number>
    search: string
    onSearchChange: (value: string) => void
    onChange: (value: SpaceStatusFilter) => void
}) {
    return (
        <div className="rounded-[24px] border border-foreground/[0.08] bg-card/92 p-2 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative lg:w-[320px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Buscar por nombre, tipo o moneda"
                        className="h-10 rounded-[16px] border-border bg-background/80 pl-9"
                    />
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-0.5 lg:flex-wrap lg:justify-end lg:overflow-visible lg:pb-0">
                    {FILTERS.map((filter) => (
                        <button
                            key={filter.value}
                            type="button"
                            onClick={() => onChange(filter.value)}
                            className={cn(
                                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
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
            </div>
        </div>
    )
}
