'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, CreditCard } from 'lucide-react'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { getCardBrandTheme, getCompactDateLabel, hasCurrencyTotals } from '@/components/dashboard/dashboard-utils'
import {
    selectableCardIconMotion,
    selectableCardMotion,
} from '@/components/shared/selectable-card-motion'
import type { DashboardCardBrand } from '@/components/dashboard/dashboard-utils'
import type { DashboardCreditCard } from '@/components/dashboard/types'
import { cn } from '@/lib/utils'

const PAYMENT_STATE_LABELS: Record<DashboardCreditCard['paymentState'], string> = {
    no_charges: 'Sin consumos',
    unpaid: 'Sin pagar',
    partial: 'Pago parcial',
    paid: 'Pagada',
    overpaid: 'Saldo a favor',
}

function ProcessorBadge({ brand, label }: { brand: DashboardCardBrand; label: string }) {
    const logoByBrand: Partial<Record<DashboardCardBrand, { src: string; width: number; height: number; className?: string }>> = {
        visa: { src: '/card-networks/Visa.png', width: 90, height: 30, className: 'max-h-[1.9rem]' },
        mastercard: { src: '/card-networks/MasterCard.png', width: 84, height: 50, className: 'max-h-9' },
        amex: { src: '/card-networks/Amex.svg', width: 116, height: 38, className: 'max-h-9' },
        cabal: { src: '/card-networks/Cabal.PNG', width: 86, height: 32, className: 'max-h-8' },
    }
    const logo = logoByBrand[brand]

    if (logo) {
        return (
            <Image
                src={logo.src}
                alt={label}
                width={logo.width}
                height={logo.height}
                unoptimized
                className={cn('h-auto max-h-7 w-auto object-contain', logo.className)}
            />
        )
    }

    return (
        <div className="flex min-w-[88px] items-center justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground/80">{label}</span>
        </div>
    )
}

export function DashboardCardVisual({
    card,
    hidden,
    href,
    variant = 'default',
}: {
    card: DashboardCreditCard
    hidden: boolean
    href: string
    variant?: 'hero' | 'default' | 'compact'
}) {
    const theme = getCardBrandTheme(card)
    const isHero = variant === 'hero'
    const isCompact = variant === 'compact'

    return (
        <Link href={href} className={cn('group block', isHero ? 'min-h-[256px]' : isCompact ? 'min-h-[218px]' : 'min-h-[232px]')}>
            <div
                className={cn(
                    'relative flex h-full min-h-[inherit] flex-col overflow-hidden rounded-[28px] border hover:border-foreground/[0.18]',
                    selectableCardMotion
                )}
                style={{
                    background: theme.background,
                    borderColor: theme.border,
                    boxShadow: `0 18px 40px -30px ${theme.shadow}`,
                }}
            >
            <div
                className="absolute -left-16 top-[-18%] h-40 w-40 rounded-full opacity-40 blur-3xl transition-transform duration-500 ease-out group-hover:scale-110 group-hover:translate-x-3"
                style={{
                    background: `color-mix(in srgb, ${theme.accent} 22%, transparent)`,
                }}
            />
            <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                style={{
                    background:
                        `linear-gradient(135deg, color-mix(in srgb, ${theme.accent} 8%, transparent) 0%, transparent 34%, color-mix(in srgb, ${theme.accent} 10%, transparent) 100%)`,
                }}
            />
            <div
                className="absolute inset-y-0 right-0 w-[42%] opacity-70"
                style={{
                    background:
                        `linear-gradient(135deg, transparent 0%, color-mix(in srgb, ${theme.accent} 10%, transparent) 100%)`,
                }}
            />
            <div
                className="absolute inset-y-[-20%] left-[-34%] w-[28%] rotate-[18deg] bg-white/[0.08] opacity-0 blur-2xl transition-all duration-700 ease-out group-hover:left-[108%] group-hover:opacity-100"
            />
            <div className="relative flex h-full flex-col justify-between p-5 text-card-foreground">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <CreditCard
                                className={cn('h-3.5 w-3.5 text-muted-foreground/70', selectableCardIconMotion)}
                            />
                            <h3 className={cn('font-semibold tracking-tight', isHero ? 'text-2xl' : 'text-lg')}>
                                {card.name}
                            </h3>
                        </div>
                        {card.institution && (
                            <p className="text-sm text-muted-foreground">{card.institution}</p>
                        )}
                        <span className="inline-flex rounded-full border border-foreground/10 bg-background/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                            {PAYMENT_STATE_LABELS[card.paymentState]}
                        </span>
                    </div>

                    <div className="flex flex-col items-end gap-3 text-right">
                        <ProcessorBadge brand={theme.brand} label={theme.label} />
                        <div className="flex justify-end">
                            <span
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/65 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out group-hover:border-foreground/20 group-hover:bg-background/80 group-hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.9)]"
                            >
                                <ArrowUpRight className={cn('h-4 w-4 text-muted-foreground group-hover:-translate-y-0.5', selectableCardIconMotion)} />
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-[22px] border border-foreground/10 bg-background/60 p-4 transition-colors duration-200 group-hover:border-foreground/15">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Pendiente</p>
                        {hasCurrencyTotals(card.monthlyPending) ? (
                            <CurrencyBreakdownAmount
                                totals={card.monthlyPending}
                                hidden={hidden}
                                primaryColor="var(--foreground)"
                                secondaryColor="var(--muted-foreground)"
                                hideZeroSecondary
                                preserveSecondarySpace
                                className={cn('mt-3 font-semibold tracking-tight', isHero ? 'text-[1.55rem]' : 'text-[1.25rem]')}
                            />
                        ) : (
                            <p className={cn('mt-3 font-semibold tracking-tight', isHero ? 'text-[1.4rem]' : 'text-[1.1rem]')}>
                                Sin pendiente
                            </p>
                        )}
                    </div>

                    <div className="grid gap-3">
                        <div className="rounded-[22px] border border-foreground/10 bg-background/60 p-3 transition-colors duration-200 group-hover:border-foreground/15">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Movimientos</p>
                            <p className="mt-2 text-base font-semibold tracking-tight">{card.activeCharges}</p>
                        </div>
                        <div className="rounded-[22px] border border-foreground/10 bg-background/60 p-3 transition-colors duration-200 group-hover:border-foreground/15">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Cuotas</p>
                            <p className="mt-2 text-base font-semibold tracking-tight">{card.activeInstallments}</p>
                        </div>
                    </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 rounded-[22px] border border-foreground/10 bg-background/60 px-4 py-3 transition-colors duration-200 group-hover:border-foreground/15">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Último consumo</p>
                        <p className="mt-1 text-sm font-medium tracking-tight">
                            {card.latestPurchaseDate ? getCompactDateLabel(card.latestPurchaseDate) : 'Sin consumos'}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Pagado este mes</p>
                        <CurrencyBreakdownAmount
                            totals={card.monthlyPaid}
                            hidden={hidden}
                            primaryColor="var(--foreground)"
                            secondaryColor="var(--muted-foreground)"
                            hideZeroSecondary
                            preserveSecondarySpace
                            className="mt-1 text-sm font-semibold tracking-tight"
                        />
                    </div>
                </div>
            </div>
            </div>
        </Link>
    )
}
