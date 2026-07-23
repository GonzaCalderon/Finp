'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'
import { FieldShell } from '@/components/shared/FieldShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ISO_CURRENCIES } from '@/lib/constants/iso-currencies'
import { cn } from '@/lib/utils'

type CurrencySelectorProps<TCurrency extends string> = {
    value: TCurrency
    options: readonly TCurrency[]
    onValueChange: (currency: TCurrency) => void
    label?: string
    error?: string
    helperText?: string
    disabled?: boolean
    readOnly?: boolean
    density?: 'default' | 'compact'
    className?: string
    ariaLabel?: string
}

function currencyName(code: string) {
    return ISO_CURRENCIES.find((currency) => currency.code === code)?.name ?? 'Moneda personalizada'
}

export function CurrencySelector<TCurrency extends string>({
    value,
    options,
    onValueChange,
    label = 'Moneda',
    error,
    helperText,
    disabled,
    readOnly,
    density = 'default',
    className,
    ariaLabel = 'Moneda',
}: CurrencySelectorProps<TCurrency>) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
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

    if (options.length <= 2) {
        return (
            <FieldShell
                label={label}
                error={error}
                helperText={helperText}
                className={className}
            >
                <CurrencyPillSelector
                    value={value}
                    options={options}
                    onValueChange={onValueChange}
                    ariaLabel={ariaLabel}
                    disabled={disabled}
                    readOnly={readOnly}
                    compact={compact}
                />
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
                    if (disabled || readOnly) return
                    setOpen(nextOpen)
                    if (!nextOpen) setQuery('')
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-label={ariaLabel}
                        aria-expanded={open}
                        disabled={disabled || readOnly}
                        className={cn(
                            'w-full justify-between rounded-[1rem] bg-background/80 font-medium',
                            compact ? 'h-7 px-2 text-xs' : 'h-10 px-3 text-sm',
                            error && 'border-destructive'
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <CurrencyFlagIcon currency={value} size={compact ? 'xs' : 'sm'} />
                            <span>{value}</span>
                            {!compact ? (
                                <span className="truncate text-xs font-normal text-muted-foreground">
                                    {currencyName(value)}
                                </span>
                            ) : null}
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
                    <div className="max-h-64 space-y-1 overflow-y-auto" role="listbox" aria-label={ariaLabel}>
                        {filteredOptions.map((currency) => {
                            const selected = currency === value
                            return (
                                <button
                                    key={currency}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors',
                                        selected
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                                    )}
                                    onClick={() => {
                                        onValueChange(currency)
                                        setOpen(false)
                                        setQuery('')
                                    }}
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
                        {filteredOptions.length === 0 ? (
                            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                                No encontramos esa moneda.
                            </p>
                        ) : null}
                    </div>
                </PopoverContent>
            </Popover>
        </FieldShell>
    )
}
