'use client'

import { useState } from 'react'
import { CalendarRange, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { FieldShell } from '@/components/shared/FieldShell'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DateRangePickerFieldProps = {
    value: DateRange | undefined
    onChange: (range: DateRange | undefined) => void
    label?: string
    error?: string
    disabled?: boolean
    clearable?: boolean
    density?: 'default' | 'compact'
    className?: string
}

function formatRange(range: DateRange | undefined) {
    if (!range?.from) return 'Seleccioná un período'
    const from = range.from.toLocaleDateString('es-AR')
    const to = range.to?.toLocaleDateString('es-AR')
    return to ? `${from} – ${to}` : `Desde ${from}`
}

export function DateRangePickerField({
    value,
    onChange,
    label = 'Período',
    error,
    disabled,
    clearable = true,
    density = 'default',
    className,
}: DateRangePickerFieldProps) {
    const [open, setOpen] = useState(false)
    const compact = density === 'compact'

    return (
        <FieldShell label={label} error={error} className={className}>
            <div className="flex items-center gap-1.5">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            aria-invalid={Boolean(error)}
                            className={cn(
                                'min-w-0 flex-1 justify-start rounded-[1rem] bg-background/80 text-left font-medium',
                                compact ? 'h-7 px-2 text-xs' : 'h-10 px-3 text-sm',
                                !value?.from && 'text-muted-foreground',
                                error && 'border-destructive'
                            )}
                        >
                            <CalendarRange className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                            <span className="truncate">{formatRange(value)}</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="range"
                            selected={value}
                            defaultMonth={value?.from}
                            onSelect={onChange}
                            showOutsideDays={false}
                        />
                    </PopoverContent>
                </Popover>
                {clearable && value?.from ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        aria-label="Limpiar período"
                        className={cn('shrink-0 rounded-full', compact ? 'h-7 w-7' : 'h-9 w-9')}
                        onClick={() => onChange(undefined)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                ) : null}
            </div>
        </FieldShell>
    )
}
