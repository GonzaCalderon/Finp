'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

import { SpaceAmountInline } from '@/components/spaces/SpaceUi'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { moneyToNumber } from '@/lib/utils/money'
import type { SpaceSummaryDto } from '@/types'

type Composition = NonNullable<SpaceSummaryDto['composition']>

function includedLabel(currencies: string[]) {
    const visible = currencies.slice(0, 3)
    const remaining = currencies.length - visible.length
    return `Incluye ${visible.join('/')}${remaining > 0 ? ` +${remaining}` : ''}`
}

function CompositionBody({
    composition,
    reportingCurrency,
    hidden,
    onFilterCurrency,
}: {
    composition: Composition
    reportingCurrency: string
    hidden: boolean
    onFilterCurrency?: (currency: string) => void
}) {
    return (
        <div className="space-y-2 p-1">
            {composition.map((item) => {
                const snapshot = item.snapshots.at(-1)
                return (
                    <div key={item.currency} className="rounded-xl border border-foreground/[0.07] bg-muted/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <SpaceAmountInline
                                    amount={moneyToNumber(item.original)}
                                    currency={item.currency}
                                    hidden={hidden}
                                    className="font-semibold"
                                />
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Equivale a{' '}
                                    <SpaceAmountInline
                                        amount={moneyToNumber(item.historicalReporting)}
                                        currency={reportingCurrency}
                                        hidden={hidden}
                                    />
                                </p>
                            </div>
                            {onFilterCurrency ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => onFilterCurrency(item.currency)}
                                >
                                    Ver movimientos
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            ) : null}
                        </div>
                        {snapshot ? (
                            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                                {snapshot.source === 'manual' ? 'Cotización manual' : 'Referencia guardada'} · 1 {item.currency} = {snapshot.rate} {reportingCurrency}
                            </p>
                        ) : item.currency === reportingCurrency ? (
                            <p className="mt-2 text-[11px] text-muted-foreground">Sin conversión.</p>
                        ) : null}
                    </div>
                )
            })}
            <p className="px-1 pt-1 text-[11px] leading-relaxed text-muted-foreground">
                Los gastos históricos conservan la cotización confirmada en cada movimiento. Las referencias actuales sólo revalúan posiciones abiertas.
            </p>
        </div>
    )
}

export function SpaceCurrencyComposition({
    amount,
    reportingCurrency,
    hidden,
    composition = [],
    className,
    onFilterCurrency,
}: {
    amount: number
    reportingCurrency: string
    hidden: boolean
    composition?: Composition
    className?: string
    onFilterCurrency?: (currency: string) => void
}) {
    const [open, setOpen] = useState(false)
    const desktop = useMediaQuery('(min-width: 768px)')
    const included = composition.map((item) => item.currency).filter((currency) => currency !== reportingCurrency)
    const trigger = included.length > 0 ? (
        <button
            type="button"
            className="rounded-full border border-foreground/[0.08] bg-background/70 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${includedLabel(included)}. Ver composición multimoneda.`}
        >
            {includedLabel(included)}
        </button>
    ) : null

    return (
        <div className={className}>
            <SpaceAmountInline
                amount={amount}
                currency={reportingCurrency}
                hidden={hidden}
                className="block text-[inherit] font-[inherit]"
            />
            {trigger ? (
                desktop ? (
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                        <PopoverContent align="start" className="w-[380px] p-3">
                            <p className="mb-2 px-1 text-sm font-semibold">Composición del total</p>
                            <CompositionBody
                                composition={composition}
                                reportingCurrency={reportingCurrency}
                                hidden={hidden}
                                onFilterCurrency={onFilterCurrency}
                            />
                        </PopoverContent>
                    </Popover>
                ) : (
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>{trigger}</SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[24px]">
                            <SheetHeader>
                                <SheetTitle>Composición del total</SheetTitle>
                                <SheetDescription>Monedas originales y equivalencias históricas.</SheetDescription>
                            </SheetHeader>
                            <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                                <CompositionBody
                                    composition={composition}
                                    reportingCurrency={reportingCurrency}
                                    hidden={hidden}
                                    onFilterCurrency={onFilterCurrency}
                                />
                            </div>
                        </SheetContent>
                    </Sheet>
                )
            ) : null}
        </div>
    )
}
