import { describe, expect, it } from 'vitest'
import { buildCommitmentSuggestions } from '@/lib/utils/commitment-suggestions'

const monthlyHistory = [
    {
        transactionId: '1',
        description: 'Internet hogar',
        merchant: 'FibraNet',
        amount: 20_000,
        currency: 'ARS' as const,
        occurredAt: new Date(2026, 0, 8),
        categoryId: 'services',
        categoryName: 'Servicios',
        accountId: 'bank',
    },
    {
        transactionId: '2',
        description: 'Internet hogar',
        merchant: 'FibraNet',
        amount: 20_500,
        currency: 'ARS' as const,
        occurredAt: new Date(2026, 1, 9),
        categoryId: 'services',
        accountId: 'bank',
    },
    {
        transactionId: '3',
        description: 'Internet hogar',
        merchant: 'FibraNet',
        amount: 21_000,
        currency: 'ARS' as const,
        occurredAt: new Date(2026, 2, 8),
        categoryId: 'services',
        accountId: 'bank',
    },
]

describe('buildCommitmentSuggestions', () => {
    it('propone un compromiso mensual explicable y precarga datos dominantes', () => {
        const [suggestion] = buildCommitmentSuggestions({
            history: monthlyHistory,
            existingCommitments: [],
        })

        expect(suggestion).toMatchObject({
            description: 'FibraNet',
            amount: 20_500,
            currency: 'ARS',
            amountPolicy: 'fixed',
            dayOfMonth: 8,
            categoryId: 'services',
            accountId: 'bank',
            occurrences: 3,
        })
        expect(suggestion.evidence).toHaveLength(4)
    })

    it('marca monto variable cuando hay cinco meses y la variación supera el umbral', () => {
        const variableHistory = Array.from({ length: 5 }, (_, index) => ({
            ...monthlyHistory[index % monthlyHistory.length],
            transactionId: `variable-${index}`,
            occurredAt: new Date(2026, index, 8),
            amount: [10_000, 20_000, 35_000, 22_000, 31_000][index],
        }))
        const [suggestion] = buildCommitmentSuggestions({
            history: variableHistory,
            existingCommitments: [],
        })

        expect(suggestion.amountPolicy).toBe('variable')
        expect(suggestion.estimationMode).toBe('last')
        expect(suggestion.amount).toBe(31_000)
    })

    it('descarta Pizza con sólo tres meses y variación alta', () => {
        expect(
            buildCommitmentSuggestions({
                history: monthlyHistory.map((entry, index) => ({
                    ...entry,
                    description: 'Pizza',
                    merchant: 'Pizza',
                    categoryName: 'Restaurantes y delivery',
                    amount: [6_100, 4_000, 7_800][index],
                })),
                existingCommitments: [],
            })
        ).toEqual([])
    })

    it('exige cobertura temporal mínima del 75%', () => {
        expect(
            buildCommitmentSuggestions({
                history: monthlyHistory.map((entry, index) => ({
                    ...entry,
                    occurredAt: new Date(2026, index * 3, 8),
                })),
                existingCommitments: [],
            })
        ).toEqual([])
    })

    it('no propone patrones débiles o con varias ocurrencias mensuales', () => {
        expect(
            buildCommitmentSuggestions({
                history: monthlyHistory.slice(0, 2),
                existingCommitments: [],
            })
        ).toEqual([])
        expect(
            buildCommitmentSuggestions({
                history: [
                    ...monthlyHistory,
                    {
                        ...monthlyHistory[0],
                        transactionId: 'duplicate-month',
                        occurredAt: new Date(2026, 0, 20),
                    },
                ],
                existingCommitments: [],
            })
        ).toEqual([])
    })

    it('respeta compromisos existentes y descartes persistentes', () => {
        const [candidate] = buildCommitmentSuggestions({
            history: monthlyHistory,
            existingCommitments: [],
        })

        expect(
            buildCommitmentSuggestions({
                history: monthlyHistory,
                existingCommitments: [
                    {
                        description: 'FibraNet',
                        normalizedDescription: 'fibranet',
                        currency: 'ARS',
                    },
                ],
            })
        ).toEqual([])
        expect(
            buildCommitmentSuggestions({
                history: monthlyHistory,
                existingCommitments: [],
                dismissedSubjectKeys: [candidate.subjectKey],
            })
        ).toEqual([])
    })
})
