'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormattedAmountInputProps = {
    id: string
    label: string
    value?: number
    currency?: string
    error?: string
    placeholder?: string
    autoFocus?: boolean
    onValueChangeAction: (value: number) => void
}

function formatIntegerPart(value: string) {
    if (!value) return ''
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function sanitizeRawInput(raw: string) {
    const cleaned = raw.replace(/[^\d,]/g, '')
    const parts = cleaned.split(',')

    if (parts.length === 1) return cleaned

    const integerPart = parts[0]
    const decimalPart = parts.slice(1).join('').slice(0, 2)

    return `${integerPart},${decimalPart}`
}

function displayFromNumber(value?: number) {
    if (value === undefined || Number.isNaN(value) || value === 0) return ''

    const fixed = value.toFixed(2)
    const [intPartRaw, decPartRaw] = fixed.split('.')
    const intPart = formatIntegerPart(intPartRaw)
    const trimmedDecimals = decPartRaw.replace(/0+$/, '')

    return trimmedDecimals ? `${intPart},${trimmedDecimals}` : intPart
}

function parseDisplayToNumber(display: string) {
    if (!display) return 0
    const normalized = display.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isNaN(parsed) ? 0 : parsed
}

export function FormattedAmountInput({
                                         id,
                                         label,
                                         value,
                                         currency = 'ARS',
                                         error,
                                         placeholder = '0',
                                         autoFocus,
                                         onValueChangeAction,
                                     }: FormattedAmountInputProps) {
    const [displayValue, setDisplayValue] = useState(displayFromNumber(value))

    useEffect(() => {
        setDisplayValue(displayFromNumber(value))
    }, [value])

    const currencyLabel = useMemo(() => (currency === 'USD' ? 'US$' : '$'), [currency])

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>

            <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currencyLabel}
        </span>

                <Input
                    id={id}
                    inputMode="decimal"
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    value={displayValue}
                    onChange={(e) => {
                        const sanitized = sanitizeRawInput(e.target.value)
                        const [intPartRaw = '', decPartRaw] = sanitized.split(',')

                        const normalizedInt = intPartRaw.replace(/^0+(?=\d)/, '')
                        const formattedInt = formatIntegerPart(normalizedInt)
                        const nextDisplay =
                            decPartRaw !== undefined ? `${formattedInt},${decPartRaw}` : formattedInt

                        setDisplayValue(nextDisplay)
                        onValueChangeAction(parseDisplayToNumber(nextDisplay))
                    }}
                    className="pl-9 text-base md:text-sm"
                />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    )
}