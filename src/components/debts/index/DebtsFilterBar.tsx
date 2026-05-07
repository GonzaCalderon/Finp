'use client'

import { cn } from '@/lib/utils'

export type DebtsFilter = 'all' | 'payable' | 'receivable' | 'space' | 'manual' | 'ignored'

const FILTERS: { value: DebtsFilter; label: string }[] = [
    { value: 'all', label: 'Todo' },
    { value: 'payable', label: 'Debo' },
    { value: 'receivable', label: 'Me deben' },
    { value: 'space', label: 'Espacios' },
    { value: 'manual', label: 'Manuales' },
    { value: 'ignored', label: 'Ignoradas' },
]

interface DebtsFilterBarProps {
    active: DebtsFilter
    onChange: (filter: DebtsFilter) => void
}

export function DebtsFilterBar({ active, onChange }: DebtsFilterBarProps) {
    return (
        <div className="overflow-x-auto w-full">
            <div className="flex gap-2 pb-1 min-w-max">
                {FILTERS.map(({ value, label }) => (
                    <button
                        key={value}
                        onClick={() => onChange(value)}
                        className={cn(
                            'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                            active === value
                                ? 'bg-foreground text-background'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </div>
    )
}
