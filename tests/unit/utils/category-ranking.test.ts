import { describe, expect, it } from 'vitest'

import {
    orderCategoryIds,
    rankCategoryHistory,
    type CategoryHistoryEntry,
} from '@/lib/utils/category-ranking'

function history(
    categoryId: string,
    description: string,
    occurredAt: string
): CategoryHistoryEntry {
    return { categoryId, description, occurredAt }
}

describe('category ranking', () => {
    const entries = [
        history('supermercado', 'Compra semanal', '2026-07-22T12:00:00.000Z'),
        history('supermercado', 'Compra de alimentos', '2026-07-18T12:00:00.000Z'),
        history('transporte', 'Uber a oficina', '2026-07-10T12:00:00.000Z'),
        history('supermercado', 'Compra semanal', '2026-07-02T12:00:00.000Z'),
    ]

    it('sin descripcion prioriza una combinacion de recencia y frecuencia', () => {
        const ranking = rankCategoryHistory(entries)

        expect(ranking.map((item) => item.categoryId)).toEqual([
            'supermercado',
            'transporte',
        ])
    })

    it('una descripcion similar pesa mas que la frecuencia general', () => {
        const ranking = rankCategoryHistory(entries, { description: 'Uber oficina' })

        expect(ranking[0].categoryId).toBe('transporte')
        expect(ranking[0].score).toBeGreaterThan(ranking[1].score)
        expect(ranking[0].reason).toMatch(/movimiento/i)
    })

    it('normaliza mayusculas, signos y acentos al comparar', () => {
        const ranking = rankCategoryHistory([
            history('salud', 'Farmácia Central', '2026-07-01T12:00:00.000Z'),
            history('otros', 'Compra general', '2026-07-22T12:00:00.000Z'),
        ], { description: 'FARMACIA, CENTRAL' })

        expect(ranking[0].categoryId).toBe('salud')
    })

    it('combina ranking historico, uso local y seleccion actual sin ocultar categorias', () => {
        const ordered = orderCategoryIds({
            categoryIds: ['supermercado', 'transporte', 'salud', 'otros'],
            historyRanking: [
                { categoryId: 'transporte', score: 80 },
                { categoryId: 'supermercado', score: 40 },
            ],
            recentCategoryIds: ['salud', 'supermercado'],
            selectedCategoryId: 'otros',
        })

        expect(ordered).toEqual(['otros', 'transporte', 'supermercado', 'salud'])
        expect(ordered).toHaveLength(4)
    })
})
