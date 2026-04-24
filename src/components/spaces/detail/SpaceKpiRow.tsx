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
            amount: summary.totalReporting,
            footer: `${summary.totalEntryCount} mov.`,
        },
        {
            label: 'Tu parte',
            amount: summary.yourShareReporting,
            footer: 'Correspondiente',
        },
        {
            label: 'Pendiente',
            amount: summary.pendingToPayReporting,
            footer: summary.pendingEntryCount > 0
                ? `${summary.pendingEntryCount} por confirmar`
                : 'Sin pendientes',
        },
        {
            label: 'A favor',
            amount: summary.pendingToCollectReporting,
            footer: 'Por cobrar',
            accent: 'var(--chart-3)',
        },
    ]

    return (
        <>
            <div className="rounded-[22px] border border-foreground/[0.08] bg-background/72 p-3 md:hidden">
                <div className="grid grid-cols-2 divide-x divide-y divide-border/70 overflow-hidden rounded-[16px]">
                    {items.map((item, index) => (
                        <div
                            key={item.label}
                            className={[
                                'min-w-0 p-3',
                                index < 2 ? 'border-t-0' : '',
                                index % 2 === 0 ? 'border-l-0' : '',
                            ].join(' ')}
                        >
                            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {item.label}
                            </p>
                            <SpaceAmountInline
                                amount={item.amount}
                                currency={reportingCurrency}
                                hidden={hidden}
                                color={item.accent}
                                className="mt-1 block text-xl font-semibold tracking-tight"
                            />
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                {item.footer}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
                <SpaceMetricCard
                    label="Gastado total"
                    amount={summary.totalReporting}
                    currency={reportingCurrency}
                    hidden={hidden}
                    footer={`${summary.totalEntryCount} movimiento${summary.totalEntryCount === 1 ? '' : 's'} registrado${summary.totalEntryCount === 1 ? '' : 's'}`}
                    compact
                />
                <SpaceMetricCard
                    label="Tu parte"
                    amount={summary.yourShareReporting}
                    currency={reportingCurrency}
                    hidden={hidden}
                    footer="Lo que te corresponde dentro del espacio."
                    compact
                />
                <SpaceMetricCard
                    label="Pendiente"
                    amount={summary.pendingToPayReporting}
                    currency={reportingCurrency}
                    hidden={hidden}
                    footer={
                        summary.pendingEntryCount > 0
                            ? `${summary.pendingEntryCount} pendiente${summary.pendingEntryCount === 1 ? '' : 's'} de confirmación`
                            : 'Sin pagos pendientes para vos.'
                    }
                    compact
                />
                <SpaceMetricCard
                    label="Saldo a favor"
                    amount={summary.pendingToCollectReporting}
                    currency={reportingCurrency}
                    hidden={hidden}
                    accent="var(--chart-3)"
                    footer="Lo que hoy el espacio te debe a vos."
                    compact
                />
            </div>
        </>
    )
}
