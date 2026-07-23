'use client'

import type { ComponentType, SVGProps } from 'react'
import * as FlagIcons from 'country-flag-icons/react/1x1'

import { ISO_CURRENCIES } from '@/lib/constants/iso-currencies'
import { cn } from '@/lib/utils'

type FlagComponent = ComponentType<SVGProps<SVGSVGElement>>

function resolveCurrencyFlag(currency: string) {
    const meta = ISO_CURRENCIES.find((item) => item.code === currency)
    const flagKey = meta?.countryCode.replaceAll('-', '_')
    const Flag = flagKey
        ? (FlagIcons as unknown as Record<string, FlagComponent>)[flagKey]
        : undefined

    return { Flag, meta }
}

export function CurrencyFlagIcon({
    currency,
    className,
    size = 'sm',
}: {
    currency: string
    className?: string
    size?: 'xs' | 'sm' | 'md'
}) {
    const { Flag, meta } = resolveCurrencyFlag(currency)

    return (
        <span
            className={cn(
                'relative isolate inline-flex shrink-0 items-center justify-center rounded-full align-middle',
                size === 'xs' && 'h-3.5 w-3.5',
                size === 'sm' && 'h-5 w-5',
                size === 'md' && 'h-6 w-6',
                className
            )}
            title={meta ? `${currency} · ${meta.name}` : currency}
        >
            <span
                aria-hidden="true"
                className="absolute -inset-1 -z-10 rounded-full bg-background/80 blur-[3px]"
            />
            <span
                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted"
                style={{
                    clipPath: 'circle(49% at 50% 50%)',
                }}
            >
                {Flag ? (
                    <Flag className="h-full w-full object-cover" aria-hidden="true" />
                ) : (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                        {currency.slice(0, 2)}
                    </span>
                )}
            </span>
        </span>
    )
}
