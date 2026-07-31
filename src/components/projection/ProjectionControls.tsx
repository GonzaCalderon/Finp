'use client'

import { PeriodSelector } from '@/components/shared/PeriodSelector'
import { cn } from '@/lib/utils'
import type { ProjectionGrouping, ProjectionMode } from '@/types/projection'

const GROUPING_OPTIONS: Array<{ value: ProjectionGrouping; label: string }> = [
    { value: 'type', label: 'Por tipo' },
    { value: 'card', label: 'Por tarjeta' },
    { value: 'category', label: 'Por categoría' },
]

const MONTH_OPTIONS = [1, 3, 6, 9, 12]

function SegmentedButton({
    active,
    children,
    onClick,
}: {
    active: boolean
    children: React.ReactNode
    onClick: () => void
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'min-h-9 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
        >
            {children}
        </button>
    )
}

export function ProjectionControls({
    grouping,
    mode,
    months,
    year,
    years,
    onGroupingChange,
    onModeChange,
    onMonthsChange,
    onYearChange,
}: {
    grouping: ProjectionGrouping
    mode: ProjectionMode
    months: number
    year: number
    years: number[]
    onGroupingChange: (grouping: ProjectionGrouping) => void
    onModeChange: (mode: ProjectionMode) => void
    onMonthsChange: (months: number) => void
    onYearChange: (year: number) => void
}) {
    return (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 md:grid-cols-[1fr_auto] md:items-center md:p-4">
            <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Agrupar detalle
                </p>
                <div className="flex flex-wrap gap-1 rounded-full bg-muted/50 p-1" aria-label="Agrupación de proyección">
                    {GROUPING_OPTIONS.map((option) => (
                        <SegmentedButton
                            key={option.value}
                            active={grouping === option.value}
                            onClick={() => onGroupingChange(option.value)}
                        >
                            {option.label}
                        </SegmentedButton>
                    ))}
                </div>
            </div>

            <div className="min-w-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:text-right">
                    Horizonte
                </p>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <div className="flex rounded-full bg-muted/50 p-1" aria-label="Modo de proyección">
                        <SegmentedButton active={mode === 'monthly'} onClick={() => onModeChange('monthly')}>
                            Próximos
                        </SegmentedButton>
                        <SegmentedButton active={mode === 'annual'} onClick={() => onModeChange('annual')}>
                            Año calendario
                        </SegmentedButton>
                    </div>
                    {mode === 'annual' ? (
                        <PeriodSelector
                            value={String(year)}
                            options={years.map((value) => ({ value: String(value), label: String(value) }))}
                            onValueChange={(value) => onYearChange(Number(value))}
                            ariaLabel="Año de proyección"
                            className="w-28"
                        />
                    ) : (
                        <PeriodSelector
                            value={String(months)}
                            options={MONTH_OPTIONS.map((value) => ({
                                value: String(value),
                                label: value === 1 ? '1 mes' : `${value} meses`,
                            }))}
                            onValueChange={(value) => onMonthsChange(Number(value))}
                            ariaLabel="Horizonte de proyección"
                            className="w-32"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
