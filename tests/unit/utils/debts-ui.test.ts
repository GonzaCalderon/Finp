import { describe, expect, it } from 'vitest'

import {
    buildDebtRelationships,
    filterRelationships,
    sortRelationships,
} from '@/lib/utils/debts-ui'
import type { IDebt } from '@/types/debt'

function debt(id: string, overrides: Record<string, unknown> = {}): IDebt {
    return {
        _id: id,
        userId: 'user-1',
        direction: 'payable',
        sourceType: 'manual',
        counterpartyNameSnapshot: 'Ana',
        amount: 100,
        remainingAmount: 100,
        currency: 'ARS',
        status: 'active',
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-01'),
        ...overrides,
    } as unknown as IDebt
}

describe('debt relationships', () => {
    it('agrupa por persona y conserva importes por moneda y dirección', () => {
        const [relationship] = buildDebtRelationships([
            debt('ars-payable', { remainingAmount: 500 }),
            debt('usd-receivable', {
                direction: 'receivable',
                currency: 'USD',
                remainingAmount: 20,
            }),
        ], [], {})

        expect(relationship.payable).toEqual({ ARS: 500 })
        expect(relationship.receivable).toEqual({ USD: 20 })
        expect(relationship.netByCurrency).toEqual({ ARS: -500, USD: 20 })
        expect(relationship.primaryAction).toBe('pay')
    })

    it('filtra por dirección, origen y búsqueda', () => {
        const relationships = buildDebtRelationships([
            debt('ana', { counterpartyNameSnapshot: 'Ana', direction: 'payable' }),
            debt('beto', {
                counterpartyNameSnapshot: 'Beto',
                direction: 'receivable',
                sourceType: 'space',
                spaceId: 'space-1',
            }),
        ], [], { 'space-1': 'Viaje' })

        expect(filterRelationships(relationships, 'payable', '').map((item) => item.name)).toEqual(['Ana'])
        expect(filterRelationships(relationships, 'space', '').map((item) => item.name)).toEqual(['Beto'])
        expect(filterRelationships(relationships, 'all', 'viaje').map((item) => item.name)).toEqual(['Beto'])
    })

    it('ordena sin mutar la lista original', () => {
        const relationships = buildDebtRelationships([
            debt('ana', { counterpartyNameSnapshot: 'Ana', remainingAmount: 100 }),
            debt('beto', { counterpartyNameSnapshot: 'Beto', remainingAmount: 500 }),
        ], [], {})
        const originalOrder = relationships.map((item) => item.name)

        expect(sortRelationships(relationships, 'payable').map((item) => item.name)).toEqual(['Beto', 'Ana'])
        expect(relationships.map((item) => item.name)).toEqual(originalOrder)
    })
})
