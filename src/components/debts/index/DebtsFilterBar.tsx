'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { DebtFilterOption, DebtSortOption } from '@/lib/utils/debts-ui'

export type DebtsFilter = DebtFilterOption
export type DebtsSort = DebtSortOption

const MAIN_FILTERS: Array<{ value: DebtFilterOption; label: string }> = [
    { value: 'all', label: 'Todo' },
    { value: 'payable', label: 'Debo' },
    { value: 'receivable', label: 'Me deben' },
    { value: 'space', label: 'Espacios' },
    { value: 'manual', label: 'Manuales' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'needs_review', label: 'Revisión' },
]

const MORE_FILTERS: Array<{ value: DebtFilterOption; label: string }> = [
    { value: 'paid', label: 'Saldadas' },
    { value: 'ignored', label: 'Ignoradas' },
    { value: 'cancelled', label: 'Canceladas' },
    { value: 'partially_paid', label: 'Parciales' },
]

const SORT_OPTIONS: Array<{ value: DebtSortOption; label: string }> = [
    { value: 'net', label: 'Mayor saldo neto' },
    { value: 'payable', label: 'Mayor deuda' },
    { value: 'receivable', label: 'Mayor cobro' },
    { value: 'updated', label: 'Actualizado' },
    { value: 'name', label: 'Nombre' },
    { value: 'spaces_first', label: 'Espacios primero' },
]

function FilterPills({
    active,
    onChange,
}: {
    active: DebtFilterOption
    onChange: (filter: DebtFilterOption) => void
}) {
    return (
        <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
            {MAIN_FILTERS.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => onChange(value)}
                    className={cn(
                        'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                        active === value
                            ? 'border-primary/20 bg-primary/10 text-primary'
                            : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}

function MoreSelect({
    active,
    onChange,
}: {
    active: DebtFilterOption
    onChange: (filter: DebtFilterOption) => void
}) {
    const isHistorical = MORE_FILTERS.some((filter) => filter.value === active)
    return (
        <Select value={isHistorical ? active : 'more'} onValueChange={(value) => onChange(value as DebtFilterOption)}>
            <SelectTrigger size="sm" className="h-8 rounded-full border-border/70 bg-background/80 text-xs">
                <SelectValue placeholder="Más" />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
                <SelectItem value="more" disabled>Más</SelectItem>
                {MORE_FILTERS.map((filter) => (
                    <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

function SortSelect({
    sort,
    onSortChange,
}: {
    sort: DebtSortOption
    onSortChange: (sort: DebtSortOption) => void
}) {
    return (
        <Select value={sort} onValueChange={(value) => onSortChange(value as DebtSortOption)}>
            <SelectTrigger size="sm" className="h-8 rounded-full border-border/70 bg-background/80 text-xs">
                <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
                {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export function DebtsFilterBar({
    active,
    onChange,
    search,
    onSearchChange,
    sort,
    onSortChange,
}: {
    active: DebtFilterOption
    onChange: (filter: DebtFilterOption) => void
    search: string
    onSearchChange: (value: string) => void
    sort: DebtSortOption
    onSortChange: (sort: DebtSortOption) => void
}) {
    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative md:w-[310px] md:shrink-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Buscar persona, espacio o nota"
                        className="h-10 rounded-full border-border bg-background/80 pl-9"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <FilterPills active={active} onChange={onChange} />
                </div>
                <div className="flex items-center justify-between gap-2 md:shrink-0 md:justify-end">
                    <MoreSelect active={active} onChange={onChange} />
                    <SortSelect sort={sort} onSortChange={onSortChange} />
                </div>
            </div>
        </div>
    )
}
