import { describe, expect, it } from 'vitest'
import { buildProjectionScenario } from '@/lib/utils/projection-scenario'
import { buildProjectionTotals } from '@/lib/utils/projection-totals'
import type {
    ProjectionItem,
    ProjectionPeriod,
    ProjectionResponse,
    ProjectionScenarioChange,
} from '@/types/projection'

function item(month: string, overrides: Partial<ProjectionItem> = {}): ProjectionItem {
    return {
        id: `commitment:rent:${month}`,
        sourceId: 'rent',
        source: { type: 'scheduled_commitment', id: 'rent' },
        kind: 'commitment',
        description: 'Alquiler',
        amount: 100,
        currency: 'ARS',
        certainty: 'estimated',
        isRegistered: false,
        occurrences: 1,
        link: { href: '/commitments', label: 'Ver Compromisos' },
        ...overrides,
    }
}

function period(month: string, items: ProjectionItem[], currentPeriod = '2026-07'): ProjectionPeriod {
    return {
        month,
        isCurrentMonth: month === currentPeriod,
        isPast: month < currentPeriod,
        items,
        totals: buildProjectionTotals(items),
    }
}

function base(months = ['2026-07', '2026-08', '2026-09']): ProjectionResponse {
    return {
        currentPeriod: '2026-07',
        projection: months.map((month) => period(month, [item(month)])),
    }
}

describe('motor puro de escenarios de Proyección', () => {
    it('aplica hacia adelante, prioriza el inicio más reciente y luego el cambio puntual', () => {
        const changes: ProjectionScenarioChange[] = [
            {
                id: 'forward-july',
                type: 'adjust',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
                scope: 'forward',
                amount: 120,
            },
            {
                id: 'forward-august',
                type: 'adjust',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-08' },
                scope: 'forward',
                amount: 130,
            },
            {
                id: 'only-september',
                type: 'adjust',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-09' },
                scope: 'occurrence',
                amount: 90,
            },
        ]

        const result = buildProjectionScenario({ base: base(), changes })

        expect(result.scenario.projection.map((entry) => entry.totals.total.ars)).toEqual([120, 130, 90])
        expect(result.scenario.projection[2].items[0].simulation?.changeId).toBe('only-september')
        expect(result.comparison.horizon).toEqual({
            base: { ars: 300, usd: 0 },
            scenario: { ars: 340, usd: 0 },
            difference: { ars: 40, usd: 0 },
        })
    })

    it('interpreta el ajuste como monto por ocurrencia y omitir quita estimados y pendientes', () => {
        const source = base(['2026-07'])
        source.projection[0] = period('2026-07', [item('2026-07', {
            amount: 400,
            occurrences: 4,
            certainty: 'pending_amount',
        })])

        const adjusted = buildProjectionScenario({
            base: source,
            changes: [{
                id: 'weekly-price',
                type: 'adjust',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
                scope: 'occurrence',
                amount: 125,
            }],
        })
        expect(adjusted.scenario.projection[0].totals.total.ars).toBe(500)
        expect(adjusted.scenario.projection[0].totals.pendingAmountCount).toBe(0)

        const omitted = buildProjectionScenario({
            base: source,
            changes: [{
                id: 'omit',
                type: 'omit',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
                scope: 'occurrence',
            }],
        })
        expect(omitted.scenario.projection[0].totals.total.ars).toBe(0)
        expect(omitted.scenario.projection[0].totals.pendingAmountCount).toBe(0)
        expect(omitted.scenario.projection[0].items[0].simulation?.state).toBe('omitted')
    })

    it('mueve una sola vez, elimina el origen y suma el destino sin tocar la base', () => {
        const source = base(['2026-07', '2026-08'])
        const result = buildProjectionScenario({
            base: source,
            changes: [{
                id: 'move-rent',
                type: 'adjust',
                target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
                scope: 'occurrence',
                amount: 100,
                destinationPeriod: '2026-08',
            }],
        })

        expect(result.scenario.projection[0].totals.total.ars).toBe(0)
        expect(result.scenario.projection[1].totals.total.ars).toBe(200)
        expect(result.scenario.projection[1].items.filter((entry) => entry.simulation?.changeId === 'move-rent')).toHaveLength(1)
        expect(source.projection[0].totals.total.ars).toBe(100)
    })

    it('calcula compromisos simulados únicos, semanales y mensuales, con meses cortos y ARS/USD separados', () => {
        const source: ProjectionResponse = {
            currentPeriod: '2026-01',
            projection: ['2026-01', '2026-02', '2026-03'].map((month) => period(month, [], '2026-01')),
        }
        const changes: ProjectionScenarioChange[] = [
            {
                id: 'once-usd',
                type: 'hypothetical',
                description: 'Compra única',
                amount: 25,
                currency: 'USD',
                expense: { type: 'commitment', recurrence: { type: 'once', date: '2026-02-10' } },
            },
            {
                id: 'weekly-ars',
                type: 'hypothetical',
                description: 'Clases',
                amount: 10,
                currency: 'ARS',
                expense: {
                    type: 'commitment',
                    recurrence: { type: 'weekly', startDate: '2026-02-01', endDate: '2026-02-28' },
                },
            },
            {
                id: 'monthly-31',
                type: 'hypothetical',
                description: 'Suscripción',
                amount: 5,
                currency: 'USD',
                expense: {
                    type: 'commitment',
                    recurrence: { type: 'monthly', dayOfMonth: 31, startDate: '2026-01-01', endDate: '2026-03-31' },
                },
            },
        ]

        const result = buildProjectionScenario({ base: source, changes })

        expect(result.scenario.projection.map((entry) => entry.totals.commitments)).toEqual([
            { ars: 0, usd: 5 },
            { ars: 40, usd: 30 },
            { ars: 0, usd: 5 },
        ])
        expect(result.scenario.projection[1].items.find((entry) => entry.sourceId === 'monthly-31')?.dueDate).toContain('2026-02-28')
    })

    it('respeta períodos financieros personalizados y un horizonte de 24 meses', () => {
        const months = Array.from({ length: 24 }, (_, index) => {
            const date = new Date(2026, index, 1)
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        })
        const source: ProjectionResponse = {
            currentPeriod: '2026-01',
            projection: months.map((month) => period(month, [], '2026-01')),
        }
        const result = buildProjectionScenario({
            base: source,
            monthStartDay: 15,
            changes: [{
                id: 'weekly-custom-period',
                type: 'hypothetical',
                description: 'Gasto semanal',
                amount: 10,
                currency: 'ARS',
                expense: {
                    type: 'commitment',
                    recurrence: { type: 'weekly', startDate: '2026-01-14', endDate: '2026-02-20' },
                },
            }],
        })

        expect(result.scenario.projection).toHaveLength(24)
        expect(result.scenario.projection[0].totals.commitments.ars).toBe(40)
        expect(result.scenario.projection[1].totals.commitments.ars).toBe(10)
    })

    it('proyecta compras con tarjeta en un pago y en cuotas sobre la tarjeta elegida', () => {
        const source: ProjectionResponse = {
            currentPeriod: '2026-07',
            projection: ['2026-07', '2026-08', '2026-09', '2026-10'].map((month) => period(month, [])),
        }
        const cards = [{ id: 'card-1', name: 'Visa', color: '#123456', dueDay: 10 }]
        const changes: ProjectionScenarioChange[] = [
            {
                id: 'single',
                type: 'hypothetical',
                description: 'Auriculares',
                amount: 90,
                currency: 'USD',
                expense: {
                    type: 'card_single',
                    accountId: 'card-1',
                    purchaseDate: '2026-07-31',
                    firstClosingMonth: '2026-08',
                },
            },
            {
                id: 'installments',
                type: 'hypothetical',
                description: 'Notebook',
                amount: 120_000,
                currency: 'ARS',
                expense: {
                    type: 'card_installment',
                    accountId: 'card-1',
                    purchaseDate: '2026-07-31',
                    firstClosingMonth: '2026-08',
                    installmentCount: 3,
                },
            },
        ]

        const result = buildProjectionScenario({ base: source, changes, cards })

        expect(result.scenario.projection.map((entry) => entry.totals.cardSingle.usd)).toEqual([0, 90, 0, 0])
        expect(result.scenario.projection.map((entry) => entry.totals.cardInstallments.ars)).toEqual([0, 40_000, 40_000, 40_000])
        const firstInstallment = result.scenario.projection[1].items.find((entry) => entry.sourceId === 'installments')
        expect(firstInstallment).toMatchObject({
            kind: 'card_installment',
            card: { id: 'card-1', name: 'Visa' },
            installment: { current: 1, count: 3 },
            simulation: { state: 'hypothetical' },
        })
        expect(firstInstallment?.dueDate).toContain('2026-08-10')
    })

    it('deja sin efecto y advierte un origen eliminado, pasado o fuera del horizonte', () => {
        const source = base()
        source.projection.unshift(period('2026-06', [item('2026-06')]))
        const result = buildProjectionScenario({
            base: source,
            changes: [
                {
                    id: 'missing',
                    type: 'omit',
                    target: { sourceType: 'transaction', sourceId: 'gone', period: '2026-07' },
                    scope: 'occurrence',
                },
                {
                    id: 'outside',
                    type: 'omit',
                    target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2027-01' },
                    scope: 'occurrence',
                },
                {
                    id: 'past',
                    type: 'omit',
                    target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-06' },
                    scope: 'occurrence',
                },
            ],
        })

        expect(result.warnings.map((warning) => warning.code)).toEqual(['source_missing', 'outside_horizon', 'past_period'])
        expect(result.scenario.projection.map((entry) => entry.totals.total.ars)).toEqual([100, 100, 100, 100])
    })

    it('restaura la base al quitar todos los cambios', () => {
        const source = base()
        const result = buildProjectionScenario({ base: source, changes: [] })
        expect(result.scenario).toEqual(source)
        expect(result.comparison.horizon.difference).toEqual({ ars: 0, usd: 0 })
    })
})
