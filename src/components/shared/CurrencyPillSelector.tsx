'use client'

import { useId, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { Button } from '@/components/ui/button'
import { DURATION, easeSmooth } from '@/lib/utils/animations'
import { cn } from '@/lib/utils'

const MotionButton = motion.create(Button)

type CurrencyPillSelectorProps<TCurrency extends string> = {
    value: TCurrency
    options: readonly TCurrency[]
    onValueChange: (currency: TCurrency) => void
    ariaLabel?: string
    disabled?: boolean
    readOnly?: boolean
    compact?: boolean
    className?: string
}

export function CurrencyPillSelector<TCurrency extends string>({
    value,
    options,
    onValueChange,
    ariaLabel = 'Moneda',
    disabled = false,
    readOnly = false,
    compact = false,
    className,
}: CurrencyPillSelectorProps<TCurrency>) {
    const selectionId = useId()
    const reduceMotion = useReducedMotion()

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        if (disabled || readOnly || options.length < 2) return

        event.preventDefault()
        const currentIndex = Math.max(0, options.indexOf(value))
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
        const nextIndex = (currentIndex + direction + options.length) % options.length
        const nextCurrency = options[nextIndex]
        onValueChange(nextCurrency)
        requestAnimationFrame(() => {
            document
                .querySelector<HTMLButtonElement>(
                    `[data-currency-group="${selectionId}"][data-currency="${nextCurrency}"]`
                )
                ?.focus()
        })
    }

    return (
        <div
            className={cn('flex min-w-0 flex-wrap gap-2', className)}
            role="radiogroup"
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
        >
            {options.map((currency) => {
                const selected = currency === value

                return (
                    <MotionButton
                        key={currency}
                        type="button"
                        variant="ghost"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        data-currency-group={selectionId}
                        data-currency={currency}
                        disabled={disabled || readOnly}
                        onClick={() => onValueChange(currency)}
                        whileTap={disabled || readOnly || reduceMotion ? undefined : { scale: 0.97 }}
                        transition={{
                            duration: reduceMotion ? 0 : DURATION.fast,
                            ease: easeSmooth,
                        }}
                        className={cn(
                            'relative isolate min-w-[4.75rem] flex-1 overflow-hidden rounded-full border bg-background/80 p-0 font-semibold shadow-none',
                            'focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-100',
                            compact ? 'h-8 text-xs' : 'h-10 text-sm',
                            selected
                                ? 'border-primary/55 bg-primary/[0.06] text-foreground shadow-[0_4px_12px_color-mix(in_srgb,var(--primary)_10%,transparent)]'
                                : 'border-border/80 text-muted-foreground hover:border-foreground/20 hover:bg-muted/55 hover:text-foreground'
                        )}
                    >
                        {selected ? (
                            <motion.span
                                layoutId={`currency-pill-${selectionId}`}
                                className="absolute inset-0 rounded-full ring-1 ring-inset ring-primary/25"
                                transition={{
                                    duration: reduceMotion ? 0 : DURATION.normal,
                                    ease: easeSmooth,
                                }}
                                aria-hidden="true"
                            />
                        ) : null}
                        <span className="relative z-10 flex w-full items-center justify-center gap-1.5 px-2.5 tracking-[0.04em]">
                            <CurrencyFlagIcon
                                currency={currency}
                                size={compact ? 'xs' : 'sm'}
                            />
                            {currency}
                        </span>
                    </MotionButton>
                )
            })}
        </div>
    )
}
