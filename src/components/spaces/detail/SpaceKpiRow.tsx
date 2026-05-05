'use client'

import { SpaceAmountInline, SpaceMetricCard } from '@/components/spaces/SpaceUi'
import type { SpaceSummarySnapshot } from '@/types'

export function SpaceKpiRow({
    summary,
    reportingCurrency,
    hidden,
}: {
    summary: SpaceSummarySnapshot
    reportingCurrency: string
    hidden: boolean
}) {
    const items = [
        {
            label: 'Gastado',
            desktopLabel: 'Gastado total',
            amount: summary.totalReporting,
            footer: `${summary.totalEntryCount} mov.`,
            desktopFooter: `${summary.totalEntryCount} movimiento${summary.totalEntryCount === 1 ? '' : 's'} registrado${summary.totalEntryCount === 1 ? '' : 's'}`,
        },
        {
            label: 'Tu parte',
            desktopLabel: 'Tu parte',
            amount: summary.yourShareReporting,
            footer: 'Correspondiente',
            desktopFooter: 'Lo que te corresponde dentro del espacio.',
            accent: 'var(--chart-1)',
        },
        {
            label: 'Pendiente',
            desktopLabel: 'Pendiente',
            amount: summary.pendingToPayReporting,
            footer: summary.pendingEntryCount > 0 ? `${summary.pendingEntryCount} por confirmar` : 'Sin pendientes',
            desktopFooter: summary.pendingEntryCount > 0
                ? `${summary.pendingEntryCount} pendiente${summary.pendingEntryCount === 1 ? '' : 's'} de confirmación`
                : 'Sin pagos pendientes para vos.',
            accent: 'var(--destructive)',
        },
        {
            label: 'A favor',
            desktopLabel: 'Saldo a favor',
            amount: summary.pendingToCollectReporting,
            footer: 'Por cobrar',
            desktopFooter: 'Lo que hoy el espacio te debe a vos.',
            accent: 'var(--chart-3)',
        },
    ]

    return (
        <>
            <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card/55 md:hidden">
                {items.map((item, index) => (
                    <div
                        key={item.label}
                        className={[
                            'p-3',
                            index % 2 === 0 ? 'border-r border-border/60' : '',
                            index < 2 ? 'border-b border-border/60' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {item.label}
                        </p>
                        <SpaceAmountInline
                            amount={item.amount}
                            currency={reportingCurrency}
                            hidden={hidden}
                            color={item.accent}
                            className="mt-1 block text-lg font-semibold tracking-tight"
                        />
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {item.footer}
                        </p>
                    </div>
                ))}
            </div>

            <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
                {items.map((item, index) => (
                    <SpaceMetricCard
                        key={item.label}
                        label={item.desktopLabel}
                        amount={item.amount}
                        currency={reportingCurrency}
                        hidden={hidden}
                        accent={item.accent}
                        footer={item.desktopFooter}
                        compact
                    />
                ))}
            </div>
        </>
    )
}
