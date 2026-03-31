'use client'

import { useMemo, useState } from 'react'
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
    allowNegative?: boolean
    onNegativeInputDetectedAction?: () => void
    onValueChangeAction: (value: number) => void
}

function formatIntegerPart(value: string) {
    if (!value) return ''
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function sanitizeRawInput(raw: string, allowNegative = false) {
    const trimmed = raw.trim()
    const isNegative = allowNegative && trimmed.startsWith('-')
    const cleaned = trimmed.replace(/[^\d,.-]/g, '')
    const unsigned = isNegative ? cleaned.slice(1) : cleaned
    const lastComma = unsigned.lastIndexOf(',')
    const lastDot = unsigned.lastIndexOf('.')
    const separatorIndex = Math.max(lastComma, lastDot)

    if (separatorIndex === -1) {
        const digitsOnly = unsigned.replace(/[.,]/g, '')
        return isNegative ? `-${digitsOnly}` : digitsOnly
    }

    const digitsAfterSeparator = unsigned.slice(separatorIndex + 1).replace(/[.,]/g, '')
    const shouldTreatAsDecimal = digitsAfterSeparator.length <= 2

    if (!shouldTreatAsDecimal) {
        const digitsOnly = unsigned.replace(/[.,]/g, '')
        return isNegative ? `-${digitsOnly}` : digitsOnly
    }

    const integerPart = unsigned.slice(0, separatorIndex).replace(/[.,]/g, '')
    const decimalPart = digitsAfterSeparator.slice(0, 2)

    return `${isNegative ? '-' : ''}${integerPart}${separatorIndex >= 0 ? ',' : ''}${decimalPart}`
}

function displayFromNumber(value?: number) {
    if (value === undefined || Number.isNaN(value) || value === 0) return ''

    const isNegative = value < 0
    const fixed = Math.abs(value).toFixed(2)
    const [intPartRaw, decPartRaw] = fixed.split('.')
    const intPart = formatIntegerPart(intPartRaw)
    const trimmedDecimals = decPartRaw.replace(/0+$/, '')
    const prefix = isNegative ? '-' : ''

    return trimmedDecimals ? `${prefix}${intPart},${trimmedDecimals}` : `${prefix}${intPart}`
}

function parseDisplayToNumber(display: string) {
    if (!display) return 0
    const isNegative = display.startsWith('-')
    const normalized = display.replace('-', '').replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    if (Number.isNaN(parsed)) return 0
    return isNegative ? -parsed : parsed
}

export function FormattedAmountInput({
                                         id,
                                         label,
                                         value,
                                         currency = 'ARS',
                                         error,
                                         placeholder = '0',
                                         autoFocus,
                                         allowNegative = false,
                                         onNegativeInputDetectedAction,
                                         onValueChangeAction,
                                     }: FormattedAmountInputProps) {
    const [displayValue, setDisplayValue] = useState(displayFromNumber(value))
    const [isFocused, setIsFocused] = useState(false)

    const currencyLabel = useMemo(() => (currency === 'USD' ? 'US$' : '$'), [currency])
    const renderedValue = isFocused ? displayValue : displayFromNumber(value)

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
                    value={renderedValue}
                    onFocus={() => {
                        setDisplayValue(displayFromNumber(value))
                        setIsFocused(true)
                    }}
                    onBlur={() => {
                        setIsFocused(false)
                    }}
                    onChange={(e) => {
                        const sanitized = sanitizeRawInput(e.target.value, allowNegative)
                        const isNegative = allowNegative && sanitized.startsWith('-')
                        const unsignedSanitized = isNegative ? sanitized.slice(1) : sanitized
                        const [intPartRaw = '', decPartRaw] = unsignedSanitized.split(',')

                        const normalizedInt = intPartRaw.replace(/^0+(?=\d)/, '')
                        const formattedInt = formatIntegerPart(normalizedInt)
                        const nextDisplay =
                            decPartRaw !== undefined ? `${formattedInt},${decPartRaw}` : formattedInt
                        const signedDisplay = isNegative ? `-${nextDisplay}` : nextDisplay

                        setDisplayValue(signedDisplay)
                        if (isNegative) onNegativeInputDetectedAction?.()
                        onValueChangeAction(parseDisplayToNumber(signedDisplay))
                    }}
                    className="pl-9 text-base md:text-sm"
                />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    )
}
