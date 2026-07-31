'use client'

import { useMemo } from 'react'

import { FieldShell } from '@/components/shared/FieldShell'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type MonthOption = {
    value: string
    label: string
}

type MonthPickerFieldProps = {
    id?: string
    testId?: string
    value?: string
    onValueChange: (value: string) => void
    options?: readonly MonthOption[]
    label?: string
    error?: string
    showErrors?: boolean
    helperText?: string
    placeholder?: string
    disabled?: boolean
    density?: 'default' | 'compact'
    className?: string
}

function buildDefaultOptions() {
    const anchor = new Date()
    return Array.from({ length: 24 }, (_, index) => {
        const date = new Date(anchor.getFullYear(), anchor.getMonth() - 6 + index, 1)
        return {
            value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            label: date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
        }
    })
}

export function MonthPickerField({
    id,
    testId,
    value,
    onValueChange,
    options,
    label = 'Mes',
    error,
    showErrors = true,
    helperText,
    placeholder = 'Seleccioná un mes',
    disabled,
    density = 'default',
    className,
}: MonthPickerFieldProps) {
    const defaultOptions = useMemo(() => buildDefaultOptions(), [])
    const availableOptions = options ?? defaultOptions
    const compact = density === 'compact'

    return (
        <FieldShell
            id={id}
            label={label}
            error={showErrors ? error : undefined}
            helperText={helperText}
            className={className}
        >
            <Select value={value} onValueChange={onValueChange} disabled={disabled}>
                <SelectTrigger
                    id={id}
                    data-testid={testId}
                    aria-label={typeof label === 'string' ? label : undefined}
                    size={compact ? 'sm' : 'default'}
                    aria-invalid={Boolean(error)}
                    className={cn('w-full rounded-[1rem] bg-background/80', error && 'border-destructive')}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {availableOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            <span className="capitalize">{option.label}</span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </FieldShell>
    )
}
