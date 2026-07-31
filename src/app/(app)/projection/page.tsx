'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, CreditCard, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CurrencyBreakdownAmount } from '@/components/shared/CurrencyBreakdownAmount'
import { useAppStartupReady } from '@/components/shared/AppStartupGate'
import { ProjectionChart } from '@/components/projection/ProjectionChart'
import { ProjectionControls } from '@/components/projection/ProjectionControls'
import { ProjectionPeriodCard } from '@/components/projection/ProjectionPeriodCard'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences } from '@/hooks/usePreferences'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { apiJson } from '@/lib/client/auth-client'
import { addCurrencyTotals, emptyCurrencyTotals } from '@/lib/utils/currency-totals'
import { fadeIn } from '@/lib/utils/animations'
import type { ProjectionCurrencyTotals, ProjectionResponse } from '@/types/projection'

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
const PROJECTION_TAGS = ['projection'] as const

function SummaryCard({
    title,
    totals,
    hidden,
    accent,
    primary = false,
}: {
    title: string
    totals: ProjectionCurrencyTotals
    hidden: boolean
    accent: string
    primary?: boolean
}) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 md:p-4">
            <span className="absolute inset-x-4 top-0 h-0.5 rounded-full" style={{ background: accent }} />
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
            <CurrencyBreakdownAmount
                totals={totals}
                hidden={hidden}
                align="left"
                hideZeroSecondary
                preserveSecondarySpace
                className={primary ? 'text-lg font-semibold tabular-nums md:text-xl' : 'text-sm font-semibold tabular-nums md:text-base'}
            />
        </div>
    )
}

export default function ProjectionPage() {
    const { preferences, setProjectionPreferences } = usePreferences()
    const { hidden } = useHideAmounts()
    const [year, setYear] = useState(currentYear)
    const [projection, setProjection] = useState<ProjectionResponse['projection']>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)

    const mode = preferences.projectionMode
    const months = preferences.projectionMonths
    const grouping = preferences.projectionGrouping
    const chartCurrency = preferences.projectionChartCurrency

    usePageTitle('Proyección')

    useEffect(() => {
        const controller = new AbortController()

        async function fetchProjection() {
            setLoading(true)
            setError(null)
            const params = new URLSearchParams({ mode })
            if (mode === 'annual') params.set('year', String(year))
            else params.set('months', String(months))

            try {
                const data = await apiJson<ProjectionResponse>(`/api/projection?${params}`, {
                    signal: controller.signal,
                })
                if (!controller.signal.aborted) setProjection(data.projection)
            } catch (caught) {
                if (controller.signal.aborted) return
                setError(caught instanceof Error ? caught.message : 'No se pudo cargar la proyección.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }

        void fetchProjection()
        return () => controller.abort()
    }, [mode, months, reloadToken, year])

    const reload = useCallback(() => setReloadToken((value) => value + 1), [])
    useDataInvalidation(PROJECTION_TAGS, reload)
    useAppStartupReady(!loading)

    const totals = useMemo(() => projection.reduce(
        (result, period) => ({
            commitments: addCurrencyTotals(result.commitments, period.totals.commitments),
            cardSingle: addCurrencyTotals(result.cardSingle, period.totals.cardSingle),
            cardInstallments: addCurrencyTotals(result.cardInstallments, period.totals.cardInstallments),
            estimated: addCurrencyTotals(result.estimated, period.totals.estimated),
            total: addCurrencyTotals(result.total, period.totals.total),
            pendingAmountCount: result.pendingAmountCount + period.totals.pendingAmountCount,
        }),
        {
            commitments: emptyCurrencyTotals(),
            cardSingle: emptyCurrencyTotals(),
            cardInstallments: emptyCurrencyTotals(),
            estimated: emptyCurrencyTotals(),
            total: emptyCurrencyTotals(),
            pendingAmountCount: 0,
        }
    ), [projection])

    const hasItems = projection.some((period) => period.items.length > 0)
    const includesMultipleYears = new Set(projection.map((period) => period.month.slice(0, 4))).size > 1
    const hasEstimates = totals.estimated.ars > 0 || totals.estimated.usd > 0

    return (
        <motion.main className="mx-auto max-w-6xl space-y-5 p-4 md:space-y-6 md:p-6" {...fadeIn}>
            <header>
                <h1 className="text-xl font-semibold tracking-tight">Proyección</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Compromisos y consumos de tarjeta esperados, con ARS y USD siempre separados.
                </p>
            </header>

            <ProjectionControls
                grouping={grouping}
                mode={mode}
                months={months}
                year={year}
                years={YEARS}
                onGroupingChange={(projectionGrouping) => setProjectionPreferences({ projectionGrouping })}
                onModeChange={(projectionMode) => setProjectionPreferences({ projectionMode })}
                onMonthsChange={(projectionMonths) => setProjectionPreferences({ projectionMonths })}
                onYearChange={setYear}
            />

            {loading ? (
                <div className="space-y-3" aria-label="Cargando proyección" aria-busy="true">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((value) => <Skeleton key={value} className="h-28 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-64 rounded-2xl" />
                    {[0, 1, 2].map((value) => <Skeleton key={value} className="h-28 rounded-2xl" />)}
                </div>
            ) : error ? (
                <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center" role="alert">
                    <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden="true" />
                    <h2 className="mt-3 font-semibold">No pudimos cargar la proyección</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
                    <Button type="button" variant="outline" className="mt-4" onClick={reload}>
                        <RefreshCw data-icon="inline-start" />
                        Reintentar
                    </Button>
                </section>
            ) : !hasItems ? (
                <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
                    <CalendarClock className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                    <h2 className="mt-3 font-semibold">Todavía no hay gastos para proyectar</h2>
                    <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                        Creá un compromiso o registrá una compra con tarjeta para anticipar los próximos períodos.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <Button asChild><Link href="/commitments">Ver Compromisos</Link></Button>
                        <Button asChild variant="outline">
                            <Link href="/transactions/credit-card">
                                <CreditCard data-icon="inline-start" />
                                Ver Tarjetas
                            </Link>
                        </Button>
                    </div>
                </section>
            ) : (
                <>
                    <section aria-label="Resumen de proyección">
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                            <SummaryCard title="Total proyectado" totals={totals.total} hidden={hidden} accent="var(--foreground)" primary />
                            <SummaryCard title="Compromisos" totals={totals.commitments} hidden={hidden} accent="var(--sky)" />
                            <SummaryCard title="TC · un pago" totals={totals.cardSingle} hidden={hidden} accent="#10B981" />
                            <SummaryCard title="TC · cuotas" totals={totals.cardInstallments} hidden={hidden} accent="#F59E0B" />
                        </div>
                        {(hasEstimates || totals.pendingAmountCount > 0) && (
                            <p className="mt-2 text-xs text-muted-foreground">
                                {[
                                    hasEstimates ? 'El total incluye montos estimados.' : null,
                                    totals.pendingAmountCount > 0
                                        ? `${totals.pendingAmountCount} ${totals.pendingAmountCount === 1 ? 'monto todavía está' : 'montos todavía están'} a confirmar.`
                                        : null,
                                ].filter(Boolean).join(' ')}
                            </p>
                        )}
                    </section>

                    <ProjectionChart
                        projection={projection}
                        currency={chartCurrency}
                        hidden={hidden}
                        onCurrencyChange={(projectionChartCurrency) =>
                            setProjectionPreferences({ projectionChartCurrency })
                        }
                    />

                    <section className="space-y-3" aria-label="Detalle por período">
                        {projection.map((period) => (
                            <ProjectionPeriodCard
                                key={period.month}
                                period={period}
                                grouping={grouping}
                                hidden={hidden}
                                includeYear={mode === 'annual' || includesMultipleYears}
                            />
                        ))}
                    </section>
                </>
            )}
        </motion.main>
    )
}
