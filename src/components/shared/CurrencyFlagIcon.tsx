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
}: {
    currency: string
    className?: string
}) {
    const { Flag, meta } = resolveCurrencyFlag(currency)

    return (
        <span
            className={cn(
                'inline-flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[0.35rem] border border-border/80 bg-muted align-middle shadow-sm',
                className
            )}
            title={meta ? `${currency} · ${meta.name}` : currency}
        >
            {Flag ? (
                <Flag className="h-full w-full object-cover" aria-hidden="true" />
            ) : (
                <span className="text-[10px] font-semibold text-muted-foreground">
                    {currency.slice(0, 2)}
                </span>
            )}
        </span>
    )
}
