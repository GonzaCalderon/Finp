'use client'

import { useMemo, useState, type ReactNode, type Ref } from 'react'
import { Input } from '@/components/ui/input'
import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { FieldShell } from '@/components/shared/FieldShell'
import { cn } from '@/lib/utils'
import { getCurrencyScale } from '@/lib/constants/iso-currencies'

type FormattedAmountInputProps = {
    id: string
    label: string
    value?: number
    currency?: string
    error?: string
    placeholder?: string
    autoFocus?: boolean
    allowNegative?: boolean
    inputClassName?: string
    wrapperClassName?: string
    labelClassName?: string
    labelAction?: ReactNode
    inputWrapperClassName?: string
    prefixClassName?: string
    helperText?: ReactNode
    showCurrencyFlag?: boolean
    density?: 'default' | 'compact'
    disabled?: boolean
    readOnly?: boolean
    name?: string
    required?: boolean
    inputRef?: Ref<HTMLInputElement>
    onBlurAction?: () => void
    onNegativeInputDetectedAction?: () => void
    onValueChangeAction: (value: number) => void
}

function formatIntegerPart(value: string) {
    if (!value) return ''
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function sanitizeRawInput(raw: string, allowNegative = false, scale = 2) {
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
    if (scale === 0) {
        const separatorCount = (unsigned.match(/[.,]/g) ?? []).length
        const digitsOnly = unsigned.replace(/[.,]/g, '')
        if (separatorCount > 1 || digitsAfterSeparator.length === 3) {
            return isNegative ? `-${digitsOnly}` : digitsOnly
        }
        const integerPart = unsigned.slice(0, separatorIndex).replace(/[.,]/g, '')
        return `${isNegative ? '-' : ''}${integerPart}`
    }
    const shouldTreatAsDecimal = digitsAfterSeparator.length <= scale

    if (!shouldTreatAsDecimal) {
        const digitsOnly = unsigned.replace(/[.,]/g, '')
        return isNegative ? `-${digitsOnly}` : digitsOnly
    }

    const integerPart = unsigned.slice(0, separatorIndex).replace(/[.,]/g, '')
    const decimalPart = digitsAfterSeparator.slice(0, scale)

    return `${isNegative ? '-' : ''}${integerPart}${separatorIndex >= 0 ? ',' : ''}${decimalPart}`
}

function displayFromNumber(value?: number, scale = 2) {
    if (value === undefined || Number.isNaN(value) || value === 0) return ''

    const isNegative = value < 0
    const fixed = Math.abs(value).toFixed(scale)
    const [intPartRaw, decPartRaw] = fixed.split('.')
    const intPart = formatIntegerPart(intPartRaw)
    const trimmedDecimals = (decPartRaw ?? '').replace(/0+$/, '')
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

function getCurrencySymbol(currency: string) {
    try {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            currencyDisplay: 'narrowSymbol',
        })
            .formatToParts(0)
            .find((part) => part.type === 'currency')?.value ?? currency
    } catch {
        return currency
    }
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
                                         inputClassName,
                                         wrapperClassName,
                                         labelClassName,
                                         labelAction,
                                         inputWrapperClassName,
                                         prefixClassName,
                                         helperText,
                                         showCurrencyFlag = true,
                                         density = 'default',
                                         disabled,
                                         readOnly,
                                         name,
                                         required,
                                         inputRef,
                                         onBlurAction,
                                         onNegativeInputDetectedAction,
                                         onValueChangeAction,
                                     }: FormattedAmountInputProps) {
    const scale = getCurrencyScale(currency) ?? 2
    const [displayValue, setDisplayValue] = useState(displayFromNumber(value, scale))
    const [isFocused, setIsFocused] = useState(false)

    const currencyLabel = useMemo(() => getCurrencySymbol(currency), [currency])
    const renderedValue = isFocused ? displayValue : displayFromNumber(value, scale)
    const compact = density === 'compact'

    return (
        <FieldShell
            id={id}
            label={label}
            error={error}
            helperText={helperText}
            labelAction={labelAction}
            className={cn(compact ? 'space-y-1' : 'space-y-2', wrapperClassName)}
            labelClassName={labelClassName}
        >
            <div className={cn('relative', inputWrapperClassName)}>
                <span
                    className={cn(
                        'pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center text-muted-foreground',
                        compact ? 'left-2 gap-1 text-xs' : 'left-3 gap-1.5 text-sm',
                        prefixClassName
                    )}
                >
                    {showCurrencyFlag ? (
                        <CurrencyFlagIcon currency={currency} size={compact ? 'xs' : 'sm'} />
                    ) : null}
                    {currencyLabel}
                </span>

                <Input
                    ref={inputRef}
                    id={id}
                    inputMode="decimal"
                    name={name}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    readOnly={readOnly}
                    required={required}
                    aria-invalid={Boolean(error)}
                    placeholder={placeholder}
                    value={renderedValue}
                    onFocus={() => {
                        setDisplayValue(displayFromNumber(value, scale))
                        setIsFocused(true)
                    }}
                    onBlur={() => {
                        setIsFocused(false)
                        onBlurAction?.()
                    }}
                    onChange={(e) => {
                        const sanitized = sanitizeRawInput(e.target.value, allowNegative, scale)
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
                    className={cn(
                        compact ? 'h-7 rounded-md text-right text-xs' : 'text-base md:text-sm',
                        showCurrencyFlag
                            ? compact ? 'pl-[3.9rem]' : 'pl-[4.8rem]'
                            : compact ? 'pl-7' : 'pl-12',
                        inputClassName
                    )}
                />
            </div>
        </FieldShell>
    )
}
