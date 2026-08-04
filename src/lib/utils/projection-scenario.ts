import { resolveCommitmentOccurrencesInRange } from '@/lib/utils/commitment-dates'
import { addCurrencyTotals, emptyCurrencyTotals } from '@/lib/utils/currency-totals'
import { parseFinancialPeriod } from '@/lib/utils/period'
import { buildProjectionTotals } from '@/lib/utils/projection-totals'
import type {
    ProjectionCurrencyTotals,
    ProjectionItem,
    ProjectionPeriod,
    ProjectionReference,
    ProjectionResponse,
    ProjectionScenarioAdjustChange,
    ProjectionScenarioChange,
    ProjectionScenarioResponse,
    ProjectionScenarioWarning,
} from '@/types/projection'

type IndexedChange = { change: ProjectionScenarioChange; index: number }

function difference(
    scenario: ProjectionCurrencyTotals,
    base: ProjectionCurrencyTotals
): ProjectionCurrencyTotals {
    return {
        ars: scenario.ars - base.ars,
        usd: scenario.usd - base.usd,
    }
}

function localDate(value: string): Date {
    return new Date(`${value}T12:00:00`)
}

function sameSource(item: ProjectionItem, change: Exclude<ProjectionScenarioChange, { type: 'hypothetical' }>) {
    return item.source.type === change.target.sourceType && item.source.id === change.target.sourceId
}

function selectedChange(
    item: ProjectionItem,
    period: string,
    changes: IndexedChange[]
): Exclude<ProjectionScenarioChange, { type: 'hypothetical' }> | null {
    const applicable = changes.filter(
        (entry): entry is IndexedChange & {
            change: Exclude<ProjectionScenarioChange, { type: 'hypothetical' }>
        } => entry.change.type !== 'hypothetical' && sameSource(item, entry.change)
    )

    // Una decisión explícita para el período siempre gana sobre una regla que
    // se venía propagando desde antes.
    const occurrence = applicable
        .filter(({ change }) => change.scope === 'occurrence' && change.target.period === period)
        .sort((left, right) => right.index - left.index)[0]
    if (occurrence) return occurrence.change

    // Si hay más de una regla hacia adelante, la más nueva representa la
    // última intención vigente del usuario.
    return applicable
        .filter(({ change }) => change.scope === 'forward' && change.target.period <= period)
        .sort((left, right) => (
            right.change.target.period.localeCompare(left.change.target.period) ||
            right.index - left.index
        ))[0]?.change ?? null
}

function adjustedAmount(item: ProjectionItem, change: ProjectionScenarioAdjustChange): number {
    return change.amount * Math.max(item.occurrences ?? 1, 1)
}

function applyExistingChanges(
    base: ProjectionResponse,
    changes: ProjectionScenarioChange[],
    warnings: ProjectionScenarioWarning[]
): ProjectionPeriod[] {
    const indexed = changes.map((change, index) => ({ change, index }))
    const visibleMonths = new Set(base.projection.map((period) => period.month))
    const actionable = new Set<string>()

    for (const change of changes) {
        if (change.type === 'hypothetical') continue
        if (!visibleMonths.has(change.target.period)) {
            warnings.push({
                changeId: change.id,
                code: 'outside_horizon',
                message: 'El período de origen ya no está dentro del horizonte visible.',
            })
            continue
        }
        if (change.target.period < base.currentPeriod) {
            warnings.push({
                changeId: change.id,
                code: 'past_period',
                message: 'Los períodos pasados son de sólo lectura.',
            })
            continue
        }

        const origin = base.projection
            .find((period) => period.month === change.target.period)
            ?.items.some((item) => sameSource(item, change))
        if (!origin) {
            warnings.push({
                changeId: change.id,
                code: 'source_missing',
                message: 'El gasto original ya no existe en la proyección base.',
            })
            continue
        }

        if (
            change.type === 'adjust' &&
            change.destinationPeriod &&
            (!visibleMonths.has(change.destinationPeriod) || change.destinationPeriod < base.currentPeriod)
        ) {
            warnings.push({
                changeId: change.id,
                code: 'outside_horizon',
                message: 'El período de destino ya no está dentro del horizonte editable.',
            })
            continue
        }
        actionable.add(change.id)
    }

    const moved = new Map<string, ProjectionItem[]>()
    const periods = base.projection.map((period) => {
        if (period.isPast) return { ...period, items: period.items.map((item) => ({ ...item })) }

        const items = period.items.map((item) => {
            const change = selectedChange(
                item,
                period.month,
                indexed.filter((entry) => actionable.has(entry.change.id))
            )
            if (!change) return { ...item }

            if (change.type === 'omit') {
                return {
                    ...item,
                    amount: 0,
                    simulation: {
                        state: 'omitted' as const,
                        changeId: change.id,
                        originalAmount: item.amount,
                        originalMonth: period.month,
                    },
                }
            }

            const amount = adjustedAmount(item, change)
            if (change.destinationPeriod) {
                // El origen permanece visible para explicar el movimiento, pero
                // sólo el clon del destino conserva impacto financiero.
                const destinationItem: ProjectionItem = {
                    ...item,
                    id: `scenario-move:${change.id}:${change.destinationPeriod}`,
                    amount,
                    isRegistered: false,
                    dueDate: undefined,
                    simulation: {
                        state: 'moved',
                        changeId: change.id,
                        originalAmount: item.amount,
                        originalMonth: period.month,
                        destinationMonth: change.destinationPeriod,
                    },
                }
                const destinationItems = moved.get(change.destinationPeriod) ?? []
                destinationItems.push(destinationItem)
                moved.set(change.destinationPeriod, destinationItems)

                return {
                    ...item,
                    amount: 0,
                    simulation: destinationItem.simulation,
                }
            }

            return {
                ...item,
                amount,
                certainty: item.certainty === 'pending_amount' ? 'calculated' as const : item.certainty,
                simulation: {
                    state: 'modified' as const,
                    changeId: change.id,
                    originalAmount: item.amount,
                    originalMonth: period.month,
                },
            }
        })

        return { ...period, items }
    })

    return periods.map((period) => {
        const items = [...period.items, ...(moved.get(period.month) ?? [])]
        return { ...period, items, totals: buildProjectionTotals(items) }
    })
}

function hypotheticalOccurrences(
    change: Extract<ProjectionScenarioChange, { type: 'hypothetical' }>,
    period: string,
    monthStartDay: number
): Date[] {
    if (change.expense.type !== 'commitment') return []
    const { start, end } = parseFinancialPeriod(period, monthStartDay)
    const recurrence = change.expense.recurrence
    if (recurrence.type === 'once') {
        return resolveCommitmentOccurrencesInRange(
            { recurrence: 'once', dueDate: localDate(recurrence.date) },
            start,
            end
        )
    }
    if (recurrence.type === 'weekly') {
        return resolveCommitmentOccurrencesInRange(
            {
                recurrence: 'weekly',
                startDate: localDate(recurrence.startDate),
                endDate: recurrence.endDate ? localDate(recurrence.endDate) : undefined,
            },
            start,
            end
        )
    }
    return resolveCommitmentOccurrencesInRange(
        {
            recurrence: 'monthly',
            dayOfMonth: recurrence.dayOfMonth,
            startDate: localDate(recurrence.startDate),
            endDate: recurrence.endDate ? localDate(recurrence.endDate) : undefined,
        },
        start,
        end
    )
}

function monthDistance(from: string, to: string) {
    const [fromYear, fromMonth] = from.split('-').map(Number)
    const [toYear, toMonth] = to.split('-').map(Number)
    return (toYear - fromYear) * 12 + toMonth - fromMonth
}

function dateInPeriod(period: string, day: number) {
    const [year, month] = period.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    return new Date(year, month - 1, Math.min(day, lastDay), 12).toISOString()
}

type ScenarioCardReference = ProjectionReference & { dueDay?: number }

function hypotheticalItem(
    change: Extract<ProjectionScenarioChange, { type: 'hypothetical' }>,
    period: string,
    monthStartDay: number,
    category: ProjectionReference | undefined,
    card: ScenarioCardReference | undefined
): ProjectionItem | null {
    const common = {
        id: `hypothetical:${change.id}:${period}`,
        sourceId: change.id,
        source: { type: 'hypothetical' as const, id: change.id },
        description: change.description,
        currency: change.currency,
        certainty: 'calculated' as const,
        isRegistered: false,
        category,
        simulation: {
            state: 'hypothetical' as const,
            changeId: change.id,
            originalMonth: period,
        },
    }

    if (change.expense.type === 'commitment') {
        const occurrences = hypotheticalOccurrences(change, period, monthStartDay)
        if (occurrences.length === 0) return null
        return {
            ...common,
            kind: 'commitment',
            amount: change.amount * occurrences.length,
            dueDate: occurrences[0]?.toISOString(),
            recurrence: change.expense.recurrence.type,
            occurrences: occurrences.length,
        }
    }

    const installmentIndex = monthDistance(change.expense.firstClosingMonth, period)
    const installmentCount = change.expense.type === 'card_installment'
        ? change.expense.installmentCount
        : 1
    if (installmentIndex < 0 || installmentIndex >= installmentCount) return null

    return {
        ...common,
        kind: change.expense.type,
        amount: change.amount / installmentCount,
        card,
        purchaseDate: localDate(change.expense.purchaseDate).toISOString(),
        dueDate: card?.dueDay ? dateInPeriod(period, card.dueDay) : undefined,
        occurrences: 1,
        installment: { current: installmentIndex + 1, count: installmentCount },
    }
}

function addHypotheticals(
    periods: ProjectionPeriod[],
    currentPeriod: string,
    monthStartDay: number,
    changes: ProjectionScenarioChange[],
    categories: ProjectionReference[],
    cards: ScenarioCardReference[],
    warnings: ProjectionScenarioWarning[]
): ProjectionPeriod[] {
    const categoriesById = new Map(categories.map((category) => [category.id, category]))
    const cardsById = new Map(cards.map((card) => [card.id, card]))
    const visibleMonths = new Set(periods.map((period) => period.month))

    for (const change of changes) {
        if (change.type !== 'hypothetical') continue
        const card = change.expense.type === 'commitment'
            ? undefined
            : cardsById.get(change.expense.accountId)
        const occursInVisiblePeriod = periods.some((period) => (
            period.month >= currentPeriod && Boolean(hypotheticalItem(
                change,
                period.month,
                monthStartDay,
                undefined,
                card
            ))
        ))
        if (!occursInVisiblePeriod) {
            warnings.push({
                changeId: change.id,
                code: 'outside_horizon',
                message: 'El gasto simulado no impacta dentro del horizonte visible.',
            })
        }
    }

    return periods.map((period) => {
        if (period.isPast || !visibleMonths.has(period.month)) return period
        const hypotheticalItems: ProjectionItem[] = []

        for (const change of changes) {
            if (change.type !== 'hypothetical') continue
            const card = change.expense.type === 'commitment'
                ? undefined
                : cardsById.get(change.expense.accountId)
            const item = hypotheticalItem(
                change,
                period.month,
                monthStartDay,
                change.categoryId ? categoriesById.get(change.categoryId) : undefined,
                card
            )
            if (item) hypotheticalItems.push(item)
        }

        const items = [...period.items, ...hypotheticalItems]
        return { ...period, items, totals: buildProjectionTotals(items) }
    })
}

export function buildProjectionScenario(input: {
    base: ProjectionResponse
    changes: ProjectionScenarioChange[]
    monthStartDay?: number
    categories?: ProjectionReference[]
    cards?: ScenarioCardReference[]
}): ProjectionScenarioResponse {
    const warnings: ProjectionScenarioWarning[] = []
    const adjusted = applyExistingChanges(input.base, input.changes, warnings)
    const projection = addHypotheticals(
        adjusted,
        input.base.currentPeriod,
        input.monthStartDay ?? 1,
        input.changes,
        input.categories ?? [],
        input.cards ?? [],
        warnings
    )
    const scenario: ProjectionResponse = {
        currentPeriod: input.base.currentPeriod,
        projection,
    }
    const periods = input.base.projection.map((basePeriod, index) => ({
        month: basePeriod.month,
        base: basePeriod.totals.total,
        scenario: projection[index].totals.total,
        difference: difference(projection[index].totals.total, basePeriod.totals.total),
    }))
    const horizonBase = periods.reduce(
        (totals, period) => addCurrencyTotals(totals, period.base),
        emptyCurrencyTotals()
    )
    const horizonScenario = periods.reduce(
        (totals, period) => addCurrencyTotals(totals, period.scenario),
        emptyCurrencyTotals()
    )

    return {
        base: input.base,
        scenario,
        comparison: {
            periods,
            horizon: {
                base: horizonBase,
                scenario: horizonScenario,
                difference: difference(horizonScenario, horizonBase),
            },
            changeCount: input.changes.length,
        },
        warnings,
    }
}
