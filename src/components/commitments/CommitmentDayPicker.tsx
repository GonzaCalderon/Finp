'use client'

import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface CommitmentDayPickerProps {
    value?: number
    error?: string
    onChange: (day: number) => void
}

// Enero de 2024 empieza en lunes y tiene 31 días. Funciona como una
// representación visual estable del día mensual, sin fingir que se elige una
// fecha o un año concretos.
const REFERENCE_MONTH = new Date(2024, 0, 1)
const DAY_PICKER_FORMATTERS = {
    formatCaption: () => 'Día del mes',
}
const DAY_PICKER_LABELS = {
    labelGrid: () => 'Días del mes',
    labelDayButton: (date: Date) => `Día ${date.getDate()} del mes`,
}

export function CommitmentDayPicker({
    value,
    error,
    onChange,
}: CommitmentDayPickerProps) {
    const [open, setOpen] = useState(false)
    const selectedDate = value ? new Date(2024, 0, value) : undefined

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        aria-invalid={Boolean(error)}
                        className={cn(
                            'h-11 w-full justify-start rounded-xl bg-background px-3 text-left font-medium sm:max-w-56',
                            !value && 'text-muted-foreground',
                            error && 'border-destructive'
                        )}
                    >
                        <CalendarDays className="size-4 text-muted-foreground" />
                        {value ? `Día ${value}` : 'Elegí un día'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-auto max-w-[calc(100vw-1rem)] p-0"
                >
                    <Calendar
                        mode="single"
                        month={REFERENCE_MONTH}
                        selected={selectedDate}
                        hideNavigation
                        showOutsideDays={false}
                        className="[--cell-size:--spacing(10)]"
                        formatters={DAY_PICKER_FORMATTERS}
                        labels={DAY_PICKER_LABELS}
                        onSelect={(date) => {
                            if (!date) return
                            onChange(date.getDate())
                            setOpen(false)
                        }}
                    />
                </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
                Si el mes es más corto, vence el último día disponible.
            </p>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
    )
}
