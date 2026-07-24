import { describe, expect, it } from 'vitest'
import { evaluateRules, normalizeRuleText } from '@/lib/utils/rules'
import type { ITransactionRule } from '@/types'

function makeRule(
    overrides: Partial<ITransactionRule> = {}
): ITransactionRule {
    return {
        _id: { toString: () => 'rule-1' } as ITransactionRule['_id'],
        userId: { toString: () => 'user-1' } as ITransactionRule['userId'],
        name: 'Regla',
        isActive: true,
        priority: 0,
        appliesTo: 'any',
        field: 'description',
        condition: 'contains',
        value: 'cafe',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    }
}

describe('normalizeRuleText', () => {
    it('normalizes accents, punctuation, whitespace and operation prefixes', () => {
        expect(normalizeRuleText('  PAGO EN   Café-Martínez!!  ')).toBe('cafe martinez')
    })

    it('removes variable banking references without deleting meaningful short numbers', () => {
        expect(normalizeRuleText('Compra Netflix ref: AB-92837465 plan 4')).toBe('netflix plan 4')
    })

    it('removes long mixed identifiers that change between transactions', () => {
        expect(normalizeRuleText('Consumo Spotify A1B2C3D4E5F6')).toBe('spotify')
    })
})

describe('evaluateRules', () => {
    it('matches normalized text and returns an explainable snapshot', () => {
        const result = evaluateRules(
            [makeRule({ value: 'Cafe Martinez', condition: 'equals' })],
            {
                type: 'expense',
                description: 'PAGO EN CAFÉ-MARTÍNEZ ref 998877',
            }
        )

        expect(result).toMatchObject({
            matched: true,
            match: {
                field: 'description',
                condition: 'equals',
                value: 'Cafe Martinez',
                normalizedFieldValue: 'cafe martinez',
                normalizedRuleValue: 'cafe martinez',
            },
        })
    })

    it('orders rules by priority consistently at the engine boundary', () => {
        const low = makeRule({ name: 'Baja', priority: 1 })
        const high = makeRule({ name: 'Alta', priority: 10 })

        const result = evaluateRules(
            [low, high],
            { type: 'expense', description: 'Café' }
        )

        expect(result.rule?.name).toBe('Alta')
    })

    it('ignores inactive rules and rules for a different transaction kind', () => {
        const result = evaluateRules(
            [
                makeRule({ isActive: false, priority: 20 }),
                makeRule({ appliesTo: 'income', priority: 10 }),
            ],
            { type: 'expense', description: 'Café' }
        )

        expect(result).toEqual({ matched: false, rule: null })
    })
})
