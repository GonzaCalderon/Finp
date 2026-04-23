'use client'

import { SpaceMetricCard } from '@/components/spaces/SpaceUi'
import type { Currency } from '@/lib/constants'
import type { SpaceSummarySnapshot } from '@/types'

export function SpaceKpiRow({
    summary,
    reportingCurrency,
    hidden,
}: {
    summary: SpaceSummarySnapshot
    reportingCurrency: Currency
    hidden: boolean
}) {
    return (
        <div className="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
            <SpaceMetricCard
                label="Gastado total"
                amount={summary.totalReporting}
                currency={reportingCurrency}
                hidden={hidden}
                footer={`${summary.totalEntryCount} movimiento${summary.totalEntryCount === 1 ? '' : 's'} registrado${summary.totalEntryCount === 1 ? '' : 's'}`}
            />
            <SpaceMetricCard
                label="Tu parte"
                amount={summary.yourShareReporting}
                currency={reportingCurrency}
                hidden={hidden}
                footer="Lo que te corresponde dentro del espacio."
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
            />
            <SpaceMetricCard
                label="Saldo a favor"
                amount={summary.pendingToCollectReporting}
                currency={reportingCurrency}
                hidden={hidden}
                accent="var(--chart-3)"
                footer="Lo que hoy el espacio te debe a vos."
            />
        </div>
    )
}
