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
            {/* Mobile: horizontal scroll, 3 cards visible + 4th as scroll hint */}
            <div className="md:hidden">
                <div
                    className="flex gap-3 overflow-x-auto pb-1"
                    style={{ scrollSnapType: 'x mandatory', scrollPaddingLeft: '0px' }}
                >
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className="min-w-0 shrink-0 rounded-[20px] border border-foreground/[0.08] bg-background/72 p-3"
                            style={{
                                width: 'calc(33.33% - 8px)',
                                minWidth: '104px',
                                scrollSnapAlign: 'start',
                            }}
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
            </div>

            {/* Desktop: 4-card grid */}
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
