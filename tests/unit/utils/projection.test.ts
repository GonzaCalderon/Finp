import { describe, expect, it } from 'vitest'
import { buildProjectionGroups } from '@/lib/utils/projection'
import type { ProjectionGroup, ProjectionItem } from '@/types/projection'

function item(overrides: Partial<ProjectionItem> & Pick<ProjectionItem, 'id' | 'kind'>): ProjectionItem {
    return {
        sourceId: overrides.id,
        source: { type: 'scheduled_commitment', id: overrides.id },
        description: overrides.id,
        amount: 100,
        currency: 'ARS',
        certainty: 'confirmed',
        isRegistered: true,
        category: { id: 'food', name: 'Comida' },
        link: { href: '/transactions', label: 'Ver' },
        ...overrides,
    }
}

function collectItems(groups: ProjectionGroup[]): ProjectionItem[] {
    return groups.flatMap((group) => [
        ...group.items,
        ...collectItems(group.children),
    ])
}

const ITEMS: ProjectionItem[] = [
    item({ id: 'commitment', kind: 'commitment', amount: 80_000, account: { id: 'bank', name: 'Banco' } }),
    item({
        id: 'single',
        kind: 'card_single',
        amount: 50_000,
        card: { id: 'visa', name: 'Visa' },
        link: { href: '/transactions/credit-card?cardId=visa', label: 'Ver en Tarjetas' },
    }),
    item({
        id: 'installment',
        kind: 'card_installment',
        amount: 25,
        currency: 'USD',
        card: { id: 'visa', name: 'Visa' },
        category: { id: 'travel', name: 'Viajes' },
        link: { href: '/transactions/credit-card?cardId=visa', label: 'Ver en Tarjetas' },
    }),
]

describe('agrupaciones de proyeccion', () => {
    it.each(['type', 'card', 'category'] as const)(
        'mantiene exactamente la misma lista y los mismos totales al agrupar por %s',
        (grouping) => {
            const groups = buildProjectionGroups(ITEMS, grouping)
            const collected = collectItems(groups)

            expect(collected.map((entry) => entry.id).sort()).toEqual(
                ITEMS.map((entry) => entry.id).sort()
            )
            expect(groups.reduce((sum, group) => sum + group.totals.ars, 0)).toBe(130_000)
            expect(groups.reduce((sum, group) => sum + group.totals.usd, 0)).toBe(25)
        }
    )

    it('separa compromisos de las tarjetas al agrupar por tarjeta', () => {
        const groups = buildProjectionGroups(ITEMS, 'card')

        expect(groups.map((group) => group.label)).toEqual(['Compromisos', 'Visa'])
        expect(groups[1].children.map((group) => group.label)).toEqual([
            'TC · cuotas',
            'TC · un pago',
        ])
    })
})
