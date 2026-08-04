'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ProjectionScenarioActions } from '@/components/projection/ProjectionScenarioActions'
import {
    ProjectionScenarioSheet,
    type ProjectionScenarioSheetIntent,
} from '@/components/projection/ProjectionScenarioSheet'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { usePageTitle } from '@/hooks/usePageTitle'
import { usePreferences } from '@/hooks/usePreferences'
import { useHideAmounts } from '@/contexts/HideAmountsContext'
import { apiJson } from '@/lib/client/auth-client'
import {
    clearProjectionScenarioDraft,
    loadProjectionScenarioDraft,
    saveProjectionScenarioDraft,
} from '@/lib/client/projection-scenario'
import { addCurrencyTotals, emptyCurrencyTotals } from '@/lib/utils/currency-totals'
import { fadeIn } from '@/lib/utils/animations'
import type {
    ProjectionCurrencyTotals,
    ProjectionItem,
    ProjectionResponse,
    ProjectionScenarioChange,
    ProjectionScenarioResponse,
    ProjectionTotals,
} from '@/types/projection'

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
                preserveSecondarySpace
                className={primary ? 'text-lg font-semibold tabular-nums md:text-xl' : 'text-sm font-semibold tabular-nums md:text-base'}
            />
        </div>
    )
}

function CountCard({ count }: { count: number }) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 md:p-4">
            <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-violet-500" />
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Gastos simulados</p>
            <p className="text-lg font-semibold tabular-nums md:text-xl">{count}</p>
            <p className="mt-1 text-xs text-muted-foreground">en esta prueba</p>
        </div>
    )
}

function aggregateTotals(projection: ProjectionResponse['projection']): ProjectionTotals {
    return projection.reduce(
        (result, period) => ({
            commitments: addCurrencyTotals(result.commitments, period.totals.commitments),
            cardSingle: addCurrencyTotals(result.cardSingle, period.totals.cardSingle),
            cardInstallments: addCurrencyTotals(result.cardInstallments, period.totals.cardInstallments),
            hypothetical: addCurrencyTotals(result.hypothetical, period.totals.hypothetical),
            estimated: addCurrencyTotals(result.estimated, period.totals.estimated),
            total: addCurrencyTotals(result.total, period.totals.total),
            pendingAmountCount: result.pendingAmountCount + period.totals.pendingAmountCount,
        }),
        {
            commitments: emptyCurrencyTotals(),
            cardSingle: emptyCurrencyTotals(),
            cardInstallments: emptyCurrencyTotals(),
            hypothetical: emptyCurrencyTotals(),
            estimated: emptyCurrencyTotals(),
            total: emptyCurrencyTotals(),
            pendingAmountCount: 0,
        }
    )
}

function sameChangeSlot(left: ProjectionScenarioChange, right: ProjectionScenarioChange) {
    if (left.id === right.id) return true
    if (left.type === 'hypothetical' || right.type === 'hypothetical') return false
    return left.scope === right.scope &&
        left.target.sourceType === right.target.sourceType &&
        left.target.sourceId === right.target.sourceId &&
        left.target.period === right.target.period
}

export default function ProjectionPage() {
    const { preferences, setProjectionPreferences } = usePreferences()
    const { hidden } = useHideAmounts()
    const [year, setYear] = useState(currentYear)
    const [baseResponse, setBaseResponse] = useState<ProjectionResponse | null>(null)
    const [comparison, setComparison] = useState<ProjectionScenarioResponse | null>(null)
    const [scenarioActive, setScenarioActive] = useState(false)
    const [scenarioView, setScenarioView] = useState<'base' | 'scenario'>('scenario')
    const [changes, setChanges] = useState<ProjectionScenarioChange[]>([])
    const [scenarioStartedAt, setScenarioStartedAt] = useState<string | null>(null)
    const [ownerId, setOwnerId] = useState<string | null>(null)
    const [storageAvailable, setStorageAvailable] = useState(true)
    const [draftHydrated, setDraftHydrated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [previewing, setPreviewing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [sheetIntent, setSheetIntent] = useState<ProjectionScenarioSheetIntent>({ kind: 'changes' })
    const hydratedRef = useRef(false)
    const lastBaseRequestKeyRef = useRef<string | null>(null)

    const mode = preferences.projectionMode
    const months = preferences.projectionMonths
    const grouping = preferences.projectionGrouping
    const chartCurrency = preferences.projectionChartCurrency

    usePageTitle('Proyección')

    useEffect(() => {
        const controller = new AbortController()
        const requestKey = `${mode}:${mode === 'annual' ? year : months}:${reloadToken}`

        async function fetchProjection() {
            if (!draftHydrated || !scenarioActive) {
                if (draftHydrated && lastBaseRequestKeyRef.current === requestKey) return
                setLoading(true)
                setError(null)
                const params = new URLSearchParams({ mode })
                if (mode === 'annual') params.set('year', String(year))
                else params.set('months', String(months))

                try {
                    const data = await apiJson<ProjectionResponse>(`/api/projection?${params}`, {
                        signal: controller.signal,
                    })
                    if (controller.signal.aborted) return
                    setBaseResponse(data)
                    lastBaseRequestKeyRef.current = requestKey
                    if (!hydratedRef.current) {
                        hydratedRef.current = true
                        if (data.ownerId) {
                            const draft = loadProjectionScenarioDraft(data.ownerId)
                            setOwnerId(data.ownerId)
                            setChanges(draft.changes)
                            setScenarioStartedAt(draft.startedAt)
                            setStorageAvailable(draft.storageAvailable)
                            if (draft.startedAt) setScenarioActive(true)
                        }
                        setDraftHydrated(true)
                    }
                } catch (caught) {
                    if (controller.signal.aborted) return
                    setError(caught instanceof Error ? caught.message : 'No se pudo cargar la proyección.')
                } finally {
                    if (!controller.signal.aborted) setLoading(false)
                }
                return
            }

            setPreviewing(true)
            setPreviewError(null)
            try {
                const data = await apiJson<ProjectionScenarioResponse>('/api/projection/scenarios/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        view: mode === 'annual' ? { mode, year } : { mode, months },
                        changes,
                    }),
                    signal: controller.signal,
                })
                if (controller.signal.aborted) return
                setComparison(data)
                setBaseResponse(data.base)
                lastBaseRequestKeyRef.current = requestKey
            } catch (caught) {
                if (controller.signal.aborted) return
                setPreviewError(caught instanceof Error ? caught.message : 'No se pudo recalcular la simulación.')
            } finally {
                if (!controller.signal.aborted) {
                    setPreviewing(false)
                    setLoading(false)
                }
            }
        }

        void fetchProjection()
        return () => controller.abort()
    }, [changes, draftHydrated, mode, months, reloadToken, scenarioActive, year])

    const reload = useCallback(() => setReloadToken((value) => value + 1), [])
    useDataInvalidation(PROJECTION_TAGS, reload)
    useAppStartupReady(!loading)

    const displayedResponse = scenarioActive && scenarioView === 'scenario' && comparison
        ? comparison.scenario
        : baseResponse
    const projection = useMemo(() => displayedResponse?.projection ?? [], [displayedResponse])
    const totals = useMemo(() => aggregateTotals(projection), [projection])
    const hasItems = projection.some((period) => period.items.length > 0)
    const includesMultipleYears = new Set(projection.map((period) => period.month.slice(0, 4))).size > 1
    const hasEstimates = totals.estimated.ars > 0 || totals.estimated.usd > 0
    const showingScenario = scenarioActive && scenarioView === 'scenario'
    const comparisonBaseByMonth = useMemo(
        () => new Map(comparison?.base.projection.map((period) => [period.month, period]) ?? []),
        [comparison]
    )

    function persist(nextChanges: ProjectionScenarioChange[], startedAt = scenarioStartedAt) {
        if (!ownerId || !startedAt) {
            setStorageAvailable(false)
            return
        }
        const result = saveProjectionScenarioDraft({ userId: ownerId, changes: nextChanges, startedAt })
        setStorageAvailable(result.storageAvailable)
    }

    function startScenario() {
        const startedAt = new Date().toISOString()
        setScenarioActive(true)
        setScenarioView('scenario')
        setScenarioStartedAt(startedAt)
        persist([], startedAt)
        openSheet({ kind: 'hypothetical' })
    }

    function saveChange(change: ProjectionScenarioChange) {
        const remaining = changes.filter((entry) => !sameChangeSlot(entry, change))
        if (remaining.length >= 50) {
            setPreviewError('La simulación admite hasta 50 gastos. Restaurá uno antes de agregar otro.')
            return
        }
        const next = [...remaining, change]
        setChanges(next)
        persist(next)
        setScenarioView('scenario')
    }

    function removeChange(changeId: string) {
        const next = changes.filter((change) => change.id !== changeId)
        setChanges(next)
        persist(next)
    }

    function discardScenario() {
        if (ownerId) setStorageAvailable(clearProjectionScenarioDraft(ownerId).storageAvailable)
        setChanges([])
        setComparison(null)
        setScenarioActive(false)
        setScenarioView('base')
        setScenarioStartedAt(null)
        setPreviewError(null)
        setSheetOpen(false)
    }

    function openSheet(intent: ProjectionScenarioSheetIntent) {
        setSheetIntent(intent)
        setSheetOpen(true)
    }

    return (
        <motion.main className={`mx-auto max-w-6xl space-y-5 p-4 md:space-y-6 md:p-6 ${scenarioActive ? 'pb-32 md:pb-6' : ''}`} {...fadeIn}>
            <header className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:flex-row md:items-center md:justify-between md:px-6">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Proyección</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Compromisos y consumos de tarjeta esperados, con ARS y USD siempre separados.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ProjectionScenarioActions
                        active={scenarioActive}
                        view={scenarioView}
                        changeCount={changes.length}
                        previewing={previewing}
                        onStart={startScenario}
                        onViewChange={setScenarioView}
                        onAdd={() => openSheet({ kind: 'hypothetical' })}
                        onChanges={() => openSheet({ kind: 'changes' })}
                        onDiscard={() => changes.length > 0 ? openSheet({ kind: 'changes' }) : discardScenario()}
                    />
                </div>
            </header>

            {scenarioActive && (
                <section className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-4 py-3 text-sm" role="status">
                    <p className="font-medium text-violet-800 dark:text-violet-200">Vista de prueba activa</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Finp está recalculando tu Proyección con los gastos que simules acá. Podés comparar con la Base real o descartar la prueba; tus compromisos, compras y transacciones siguen igual.
                    </p>
                    {!storageAvailable && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                            El almacenamiento del navegador está bloqueado. Esta simulación no sobrevivirá una recarga.
                        </p>
                    )}
                    {previewing && <p className="mt-1 text-xs text-muted-foreground">Recalculando sobre la base más reciente…</p>}
                </section>
            )}

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

            {previewError && baseResponse && (
                <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium">No pudimos actualizar la simulación</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {previewError} {comparison
                                    ? 'Conservamos la última comparación válida.'
                                    : 'Seguimos mostrando la base hasta que puedas reintentar.'}
                            </p>
                        </div>
                        <Button type="button" variant="outline" onClick={reload}><RefreshCw data-icon="inline-start" /> Reintentar</Button>
                    </div>
                </section>
            )}

            {comparison?.warnings.length ? (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" aria-label="Advertencias de la simulación">
                    <p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-amber-600" /> Algunos gastos simulados quedaron sin efecto</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {comparison.warnings.map((warning) => <li key={`${warning.changeId}:${warning.code}`}>{warning.message}</li>)}
                    </ul>
                </section>
            ) : null}

            {loading && !baseResponse ? (
                <div className="space-y-3" aria-label="Cargando proyección" aria-busy="true">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((value) => <Skeleton key={value} className="h-28 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-64 rounded-2xl" />
                    {[0, 1, 2].map((value) => <Skeleton key={value} className="h-28 rounded-2xl" />)}
                </div>
            ) : error && !baseResponse ? (
                <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center" role="alert">
                    <AlertTriangle className="mx-auto size-6 text-destructive" aria-hidden="true" />
                    <h2 className="mt-3 font-semibold">No pudimos cargar la proyección</h2>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
                    <Button type="button" variant="outline" className="mt-4" onClick={reload}>
                        <RefreshCw data-icon="inline-start" /> Reintentar
                    </Button>
                </section>
            ) : !hasItems ? (
                <section className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
                    <CalendarClock className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
                    <h2 className="mt-3 font-semibold">Todavía no hay gastos para proyectar</h2>
                    <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                        Creá un compromiso, registrá una compra con tarjeta o simulá un gasto para anticipar los próximos períodos.
                    </p>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {scenarioActive && <Button type="button" onClick={() => openSheet({ kind: 'hypothetical' })}>Simular un gasto</Button>}
                        <Button asChild variant={scenarioActive ? 'outline' : 'default'}><Link href="/commitments">Ver Compromisos</Link></Button>
                        <Button asChild variant="outline">
                            <Link href="/transactions/credit-card"><CreditCard data-icon="inline-start" /> Ver Tarjetas</Link>
                        </Button>
                    </div>
                </section>
            ) : (
                <>
                    <section aria-label={showingScenario ? 'Comparación real y simulada' : 'Resumen de proyección'}>
                        {showingScenario && comparison ? (
                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                <SummaryCard title="Base real" totals={comparison.comparison.horizon.base} hidden={hidden} accent="var(--muted-foreground)" />
                                <SummaryCard title="Con gastos" totals={comparison.comparison.horizon.scenario} hidden={hidden} accent="#8B5CF6" primary />
                                <SummaryCard title="Diferencia" totals={comparison.comparison.horizon.difference} hidden={hidden} accent="var(--foreground)" />
                                <CountCard count={comparison.comparison.changeCount} />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                <SummaryCard title="Total proyectado" totals={totals.total} hidden={hidden} accent="var(--foreground)" primary />
                                <SummaryCard title="Compromisos" totals={totals.commitments} hidden={hidden} accent="var(--sky)" />
                                <SummaryCard title="TC · un pago" totals={totals.cardSingle} hidden={hidden} accent="#10B981" />
                                <SummaryCard title="TC · cuotas" totals={totals.cardInstallments} hidden={hidden} accent="#F59E0B" />
                            </div>
                        )}
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
                        baseProjection={showingScenario ? comparison?.base.projection : undefined}
                        currency={chartCurrency}
                        hidden={hidden}
                        onCurrencyChange={(projectionChartCurrency) => setProjectionPreferences({ projectionChartCurrency })}
                    />

                    <section className="space-y-3" aria-label="Detalle por período">
                        {projection.map((period) => (
                            <ProjectionPeriodCard
                                key={period.month}
                                period={period}
                                basePeriod={showingScenario ? comparisonBaseByMonth.get(period.month) : undefined}
                                scenario={showingScenario}
                                grouping={grouping}
                                hidden={hidden}
                                includeYear={mode === 'annual' || includesMultipleYears}
                                onSimulate={(item: ProjectionItem, itemPeriod: string) => openSheet({ kind: 'existing', item, period: itemPeriod })}
                            />
                        ))}
                    </section>
                </>
            )}

            {sheetOpen ? (
                <ProjectionScenarioSheet
                    open
                    onOpenChange={setSheetOpen}
                    intent={sheetIntent}
                    changes={changes}
                    base={baseResponse?.projection ?? []}
                    currentPeriod={baseResponse?.currentPeriod ?? `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                    onSave={saveChange}
                    onRemove={removeChange}
                    onDiscard={discardScenario}
                />
            ) : null}
        </motion.main>
    )
}
