import { describe, expect, it } from 'vitest'
import {
    detectRuleConflicts,
    evaluateRules,
    normalizeRuleText,
    previewRuleActions,
} from '@/lib/utils/rules'
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

describe('previewRuleActions', () => {
    it('previews the same safe actions used by transaction creation', () => {
        const preview = previewRuleActions(
            makeRule({
                setType: 'income',
                categoryId: {
                    toString: () => 'category-1',
                } as ITransactionRule['categoryId'],
                normalizeMerchant: 'Café Martínez',
            }),
            {
                type: 'expense',
                description: 'Café',
            }
        )

        expect(preview).toEqual({
            result: {
                type: 'income',
                categoryId: 'category-1',
                merchant: 'Café Martínez',
            },
            appliedActions: {
                setType: 'income',
                categoryId: 'category-1',
                normalizeMerchant: 'Café Martínez',
            },
            skippedActions: [],
        })
    })

    it('protects specialized types and explicit user values', () => {
        const preview = previewRuleActions(
            makeRule({
                setType: 'income',
                categoryId: {
                    toString: () => 'category-rule',
                } as ITransactionRule['categoryId'],
                normalizeMerchant: 'Comercio normalizado',
            }),
            {
                type: 'credit_card_expense',
                description: 'Café',
                categoryId: 'category-user',
                merchant: 'Comercio elegido',
            }
        )

        expect(preview.appliedActions).toEqual({})
        expect(preview.skippedActions).toEqual([
            { action: 'setType', reason: 'specialized_type' },
            { action: 'categoryId', reason: 'explicit_value' },
            { action: 'normalizeMerchant', reason: 'explicit_value' },
        ])
    })
})

describe('detectRuleConflicts', () => {
    it('detects overlapping rules with contradictory actions and explains priority', () => {
        const candidate = makeRule({
            _id: { toString: () => 'candidate' } as ITransactionRule['_id'],
            name: 'Uber general',
            value: 'uber',
            priority: 10,
            categoryId: {
                toString: () => 'transport',
            } as ITransactionRule['categoryId'],
        })
        const existing = makeRule({
            _id: { toString: () => 'existing' } as ITransactionRule['_id'],
            name: 'Uber Eats',
            value: 'uber eats',
            priority: 5,
            categoryId: {
                toString: () => 'food',
            } as ITransactionRule['categoryId'],
        })

        expect(detectRuleConflicts(candidate, [existing])).toEqual([
            expect.objectContaining({
                ruleId: 'existing',
                kind: 'contradictory_actions',
                severity: 'warning',
                priorityRelation: 'candidate_wins',
                differingActions: ['categoryId'],
            }),
        ])
    })

    it('reports redundant rules as information instead of a blocking warning', () => {
        const action = {
            toString: () => 'transport',
        } as ITransactionRule['categoryId']
        const candidate = makeRule({
            _id: { toString: () => 'candidate' } as ITransactionRule['_id'],
            categoryId: action,
        })
        const existing = makeRule({
            _id: { toString: () => 'existing' } as ITransactionRule['_id'],
            categoryId: action,
        })

        expect(detectRuleConflicts(candidate, [existing])).toEqual([
            expect.objectContaining({
                kind: 'redundant',
                severity: 'info',
                differingActions: [],
            }),
        ])
    })

    it('does not flag unrelated text patterns', () => {
        const candidate = makeRule({ value: 'uber' })
        const existing = makeRule({
            _id: { toString: () => 'existing' } as ITransactionRule['_id'],
            value: 'farmacia',
        })

        expect(detectRuleConflicts(candidate, [existing])).toEqual([])
    })
})
