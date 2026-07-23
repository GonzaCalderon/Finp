'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { FieldShell } from '@/components/shared/FieldShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ISO_CURRENCIES } from '@/lib/constants/iso-currencies'
import { DURATION, easeSmooth } from '@/lib/utils/animations'
import { cn } from '@/lib/utils'

const MotionButton = motion.create(Button)

type CurrencyMultiSelectorProps<TCurrency extends string> = {
    value: readonly TCurrency[]
    options: readonly TCurrency[]
    onValueChange: (currencies: TCurrency[]) => void
    label?: string
    error?: string
    helperText?: string
    disabled?: boolean
    minimumSelections?: number
    density?: 'default' | 'compact'
    className?: string
}

function currencyName(code: string) {
    return ISO_CURRENCIES.find((currency) => currency.code === code)?.name ?? 'Moneda personalizada'
}

export function CurrencyMultiSelector<TCurrency extends string>({
    value,
    options,
    onValueChange,
    label = 'Monedas',
    error,
    helperText,
    disabled,
    minimumSelections = 1,
    density = 'default',
    className,
}: CurrencyMultiSelectorProps<TCurrency>) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const reduceMotion = useReducedMotion()
    const compact = density === 'compact'
    const filteredOptions = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase('es')
        if (!normalized) return options
        return options.filter((currency) => {
            const name = currencyName(currency)
            return (
                currency.toLocaleLowerCase('es').includes(normalized) ||
                name.toLocaleLowerCase('es').includes(normalized)
            )
        })
    }, [options, query])

    function toggle(currency: TCurrency) {
        const selected = value.includes(currency)
        if (selected && value.length <= minimumSelections) return
        onValueChange(
            selected
                ? value.filter((item) => item !== currency)
                : [...value, currency]
        )
    }

    if (options.length <= 2) {
        return (
            <FieldShell
                label={label}
                error={error}
                helperText={helperText}
                className={className}
            >
                <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={label}>
                    {options.map((currency) => {
                        const selected = value.includes(currency)
                        const locked = selected && value.length <= minimumSelections
                        return (
                            <MotionButton
                                key={currency}
                                type="button"
                                variant="ghost"
                                aria-pressed={selected}
                                disabled={disabled}
                                onClick={() => toggle(currency)}
                                whileTap={disabled || locked || reduceMotion ? undefined : { scale: 0.97 }}
                                transition={{
                                    duration: reduceMotion ? 0 : DURATION.fast,
                                    ease: easeSmooth,
                                }}
                                className={cn(
                                    'min-w-[4.75rem] flex-1 rounded-full border bg-background/80 font-semibold',
                                    compact ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm',
                                    selected
                                        ? 'border-primary/55 bg-primary/[0.06] text-foreground shadow-sm'
                                        : 'border-border/80 text-muted-foreground hover:bg-muted/55'
                                )}
                            >
                                <CurrencyFlagIcon currency={currency} size={compact ? 'xs' : 'sm'} />
                                {currency}
                            </MotionButton>
                        )
                    })}
                </div>
            </FieldShell>
        )
    }

    return (
        <FieldShell
            label={label}
            error={error}
            helperText={helperText}
            className={className}
        >
            <Popover
                open={open}
                onOpenChange={(nextOpen) => {
                    if (disabled) return
                    setOpen(nextOpen)
                    if (!nextOpen) setQuery('')
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        disabled={disabled}
                        className={cn(
                            'w-full justify-between rounded-[1rem] bg-background/80',
                            compact ? 'h-7 px-2 text-xs' : 'h-10 px-3 text-sm'
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span className="flex -space-x-1">
                                {value.slice(0, 3).map((currency) => (
                                    <CurrencyFlagIcon
                                        key={currency}
                                        currency={currency}
                                        size={compact ? 'xs' : 'sm'}
                                        className="ring-2 ring-background"
                                    />
                                ))}
                            </span>
                            <span className="truncate font-medium">
                                {value.length === 1 ? value[0] : `${value.length} monedas`}
                            </span>
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    className="w-[min(22rem,var(--radix-popover-trigger-width))] space-y-2 p-2"
                >
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar moneda"
                            className="h-8 pl-8 text-sm"
                            autoFocus
                        />
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-multiselectable>
                        {filteredOptions.map((currency) => {
                            const selected = value.includes(currency)
                            const locked = selected && value.length <= minimumSelections
                            return (
                                <button
                                    key={currency}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    aria-disabled={locked}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                                        selected
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                                        locked && 'cursor-not-allowed'
                                    )}
                                    onClick={() => toggle(currency)}
                                >
                                    <CurrencyFlagIcon currency={currency} />
                                    <span className="font-semibold">{currency}</span>
                                    <span className="min-w-0 flex-1 truncate text-xs">
                                        {currencyName(currency)}
                                    </span>
                                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                                </button>
                            )
                        })}
                    </div>
                </PopoverContent>
            </Popover>
        </FieldShell>
    )
}
