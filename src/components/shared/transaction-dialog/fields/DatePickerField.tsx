'use client'

import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

import { FieldShell } from '@/components/shared/FieldShell'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DURATION, easeSmooth } from '@/lib/utils/animations'
import { cn } from '@/lib/utils'

interface DatePickerFieldProps {
    label?: string
    value: Date | undefined
    error?: string
    showErrors?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
    onChange: (date: Date | undefined) => void
    className?: string
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    density?: 'default' | 'compact'
    minDate?: Date
    maxDate?: Date
}

function dayStamp(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function DatePickerField({
    label = 'Fecha',
    value,
    error,
    showErrors = true,
    isOpen,
    onOpenChange,
    onChange,
    className = 'w-full',
    placeholder = 'Seleccioná una fecha',
    disabled,
    clearable = false,
    density = 'default',
    minDate,
    maxDate,
}: DatePickerFieldProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const reduceMotion = useReducedMotion()
    const open = isOpen ?? internalOpen
    const compact = density === 'compact'

    function setOpen(nextOpen: boolean) {
        if (isOpen === undefined) setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
    }

    return (
        <FieldShell
            label={label}
            error={showErrors ? error : undefined}
            className={className}
        >
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
                                !value && 'text-muted-foreground',
                                error && 'border-destructive'
                            )}
                        >
                            <CalendarIcon className={cn('shrink-0 text-muted-foreground', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                            <span className="truncate">
                                {value instanceof Date
                                    ? value.toLocaleDateString('es-AR')
                                    : placeholder}
                            </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <motion.div
                            initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                                duration: reduceMotion ? 0 : DURATION.normal,
                                ease: easeSmooth,
                            }}
                        >
                            <Calendar
                                mode="single"
                                selected={value}
                                defaultMonth={value}
                                onSelect={(date) => {
                                    onChange(date)
                                    if (date) setOpen(false)
                                }}
                                disabled={(date) =>
                                    Boolean(
                                        (minDate && dayStamp(date) < dayStamp(minDate)) ||
                                        (maxDate && dayStamp(date) > dayStamp(maxDate))
                                    )
                                }
                            />
                        </motion.div>
                    </PopoverContent>
                </Popover>
                {clearable && value ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        aria-label={`Limpiar ${label.toLocaleLowerCase('es')}`}
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
