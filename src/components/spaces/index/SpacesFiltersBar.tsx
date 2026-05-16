'use client'

import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SpaceStatusFilter = 'all' | 'active' | 'paused' | 'closed' | 'archived'

export type SpaceSortOption = 'recent' | 'name' | 'balance'

const FILTERS: Array<{ value: SpaceStatusFilter; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'active', label: 'Activos' },
    { value: 'paused', label: 'En pausa' },
    { value: 'closed', label: 'Cerrados' },
    { value: 'archived', label: 'Archivados' },
]

const SORT_OPTIONS: Array<{ value: SpaceSortOption; label: string }> = [
    { value: 'recent', label: 'Reciente' },
    { value: 'name', label: 'Nombre' },
    { value: 'balance', label: 'Balance' },
]

function FilterPills({
    selected,
    counts,
    onChange,
    className,
}: {
    selected: SpaceStatusFilter
    counts: Record<SpaceStatusFilter, number>
    onChange: (value: SpaceStatusFilter) => void
    className?: string
}) {
    return (
        <div className={cn('flex flex-wrap gap-1.5', className)}>
            {FILTERS.map((filter) => (
                <button
                    key={filter.value}
                    type="button"
                    onClick={() => onChange(filter.value)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
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

function SortSelect({
    sort,
    onSortChange,
    className,
}: {
    sort: SpaceSortOption
    onSortChange: (sort: SpaceSortOption) => void
    className?: string
}) {
    return (
        <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
            <span className="shrink-0">Ordenar por:</span>
            <Select value={sort} onValueChange={(v) => onSortChange(v as SpaceSortOption)}>
                <SelectTrigger size="sm" className="h-7 rounded-full border-border/70 bg-background/80 text-xs">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                    {SORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

export function SpacesFiltersBar({
    selected,
    counts,
    search,
    onSearchChange,
    onChange,
    sort,
    onSortChange,
    onCreateSpace,
}: {
    selected: SpaceStatusFilter
    counts: Record<SpaceStatusFilter, number>
    search: string
    onSearchChange: (value: string) => void
    onChange: (value: SpaceStatusFilter) => void
    sort: SpaceSortOption
    onSortChange: (sort: SpaceSortOption) => void
    onCreateSpace: () => void
}) {
    return (
        <>
            <div className="space-y-3 md:hidden">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Buscar espacio..."
                            className="h-10 rounded-full border-border bg-background/80 pl-9"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onCreateSpace}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-foreground/[0.1] bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                        aria-label="Nuevo espacio"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                <FilterPills selected={selected} counts={counts} onChange={onChange} />
                <SortSelect sort={sort} onSortChange={onSortChange} />
            </div>

            <div className="hidden md:block">
                <div className="flex items-center gap-3">
                    <div className="relative w-[300px] shrink-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Buscar espacio..."
                            className="h-10 rounded-full border-border bg-background/80 pl-9"
                        />
                    </div>

                    <FilterPills
                        selected={selected}
                        counts={counts}
                        onChange={onChange}
                        className="flex-1"
                    />

                    <SortSelect sort={sort} onSortChange={onSortChange} className="shrink-0" />
                </div>
            </div>
        </>
    )
}
