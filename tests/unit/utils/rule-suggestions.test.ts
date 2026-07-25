import { describe, expect, it } from 'vitest'
import { buildTransactionRuleSuggestions } from '@/lib/utils/rule-suggestions'
import type { ITransactionRule } from '@/types'

function historyEntry(
    id: string,
    overrides: Partial<{
        type: string
        description: string
        merchant: string
        categoryId: string
    }> = {}
) {
    return {
        transactionId: id,
        type: 'expense',
        description: `Detalle${id}`,
        merchant: 'Farmacity',
        categoryId: 'salud',
        occurredAt: new Date(`2026-07-${id.padStart(2, '0')}T12:00:00.000Z`),
        ...overrides,
    }
}

function existingRule(overrides: Partial<ITransactionRule> = {}): ITransactionRule {
    return {
        _id: { toString: () => 'rule-1' } as ITransactionRule['_id'],
        userId: { toString: () => 'user-1' } as ITransactionRule['userId'],
        name: 'Farmacia',
        isActive: true,
        priority: 10,
        appliesTo: 'expense',
        field: 'merchant',
        condition: 'equals',
        value: 'farmacity',
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-01'),
        ...overrides,
    }
}

describe('buildTransactionRuleSuggestions', () => {
    it('suggests a repeated merchant after three consistent categorizations', () => {
        const suggestions = buildTransactionRuleSuggestions({
            history: [historyEntry('1'), historyEntry('2'), historyEntry('3')],
            existingRules: [],
        })

        expect(suggestions).toHaveLength(1)
        expect(suggestions[0]).toMatchObject({
            appliesTo: 'expense',
            field: 'merchant',
            condition: 'equals',
            value: 'Farmacity',
            categoryId: 'salud',
            occurrences: 3,
            normalizeMerchant: 'Farmacity',
        })
        expect(suggestions[0].confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('derives a description-token suggestion without a merchant', () => {
        const suggestions = buildTransactionRuleSuggestions({
            history: [
                historyEntry('1', { merchant: '', description: 'Netflix julio' }),
                historyEntry('2', { merchant: '', description: 'Netflix agosto' }),
                historyEntry('3', { merchant: '', description: 'Netflix septiembre' }),
            ],
            existingRules: [],
        })

        expect(suggestions).toEqual([
            expect.objectContaining({
                field: 'description',
                condition: 'contains',
                value: 'netflix',
                categoryId: 'salud',
            }),
        ])
    })

    it('does not suggest patterns already covered by a rule', () => {
        expect(
            buildTransactionRuleSuggestions({
                history: [historyEntry('1'), historyEntry('2'), historyEntry('3')],
                existingRules: [existingRule()],
            })
        ).toHaveLength(0)
    })

    it('respects persistent dismissals', () => {
        const history = [historyEntry('1'), historyEntry('2'), historyEntry('3')]
        const firstPass = buildTransactionRuleSuggestions({
            history,
            existingRules: [],
        })

        expect(
            buildTransactionRuleSuggestions({
                history,
                existingRules: [],
                dismissedKeys: [firstPass[0].key],
            })
        ).toHaveLength(0)
    })

    it('rejects noisy patterns without a dominant category', () => {
        expect(
            buildTransactionRuleSuggestions({
                history: [
                    historyEntry('1'),
                    historyEntry('2'),
                    historyEntry('3', { categoryId: 'compras' }),
                    historyEntry('4', { categoryId: 'compras' }),
                ],
                existingRules: [],
            })
        ).toHaveLength(0)
    })
})
