'use client'

import { CalendarDays } from 'lucide-react'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type PeriodOption<TValue extends string> = {
    value: TValue
    label: string
}

type PeriodSelectorProps<TValue extends string> = {
    value: TValue
    options: readonly PeriodOption<TValue>[]
    onValueChange: (value: TValue) => void
    ariaLabel?: string
    disabled?: boolean
    compact?: boolean
    className?: string
}

export function PeriodSelector<TValue extends string>({
    value,
    options,
    onValueChange,
    ariaLabel = 'Período',
    disabled,
    compact = true,
    className,
}: PeriodSelectorProps<TValue>) {
    return (
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
            <SelectTrigger
                size={compact ? 'sm' : 'default'}
                aria-label={ariaLabel}
                className={cn('rounded-full bg-background/80', className)}
            >
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
