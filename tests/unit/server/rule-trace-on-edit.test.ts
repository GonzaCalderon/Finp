import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    find: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Account: {},
    Category: {},
    Transaction: {},
    TransactionRule: { find: mocks.find },
    User: {},
}))

const { resolveRuleTraceForEdit } = await import('@/lib/server/transactions')

const verduleria = {
    _id: { toString: () => 'rule-1' },
    name: 'Verdulería',
    isActive: true,
    priority: 10,
    appliesTo: 'any',
    field: 'description',
    condition: 'contains',
    value: 'verduleria',
    categoryId: { toString: () => 'category-super' },
}

function rules(list: unknown[]) {
    return { sort: vi.fn().mockResolvedValue(list) }
}

describe('resolveRuleTraceForEdit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.find.mockReturnValue(rules([verduleria]))
    })

    it('devuelve la traza de la regla que coincide', async () => {
        const result = await resolveRuleTraceForEdit('user-1', {
            type: 'expense',
            description: 'Verduleria del barrio',
        })

        expect(result).toMatchObject({
            matched: true,
            appliedRuleId: 'rule-1',
            appliedRuleNameSnapshot: 'Verdulería',
        })
    })

    it('no coincide nada cuando la descripción cambió: la traza se limpia', async () => {
        const result = await resolveRuleTraceForEdit('user-1', {
            type: 'expense',
            description: 'Ferretería',
        })

        expect(result).toEqual({ matched: false })
    })

    it('la categoría explícita del usuario gana sobre la de la regla', async () => {
        const result = await resolveRuleTraceForEdit('user-1', {
            type: 'expense',
            description: 'Verduleria del barrio',
            categoryId: 'category-elegida-a-mano',
        })

        expect(result.matched).toBe(true)
        if (!result.matched) throw new Error('debía coincidir')
        // La acción de categoría queda omitida por valor explícito.
        expect(result.appliedRuleActions.categoryId).toBeUndefined()
    })

    it('sin categoría explícita registra la acción de la regla', async () => {
        const result = await resolveRuleTraceForEdit('user-1', {
            type: 'expense',
            description: 'Verduleria del barrio',
        })

        expect(result.matched).toBe(true)
        if (!result.matched) throw new Error('debía coincidir')
        expect(result.appliedRuleActions.categoryId).toBe('category-super')
    })

    it('un gasto con tarjeta coincide con las reglas de gasto', async () => {
        const result = await resolveRuleTraceForEdit('user-1', {
            type: 'credit_card_expense',
            description: 'Verduleria del barrio',
        })

        expect(result.matched).toBe(true)
    })

    it('no evalúa reglas en tipos financieros especializados', async () => {
        for (const type of ['transfer', 'exchange', 'credit_card_payment', 'adjustment']) {
            await expect(
                resolveRuleTraceForEdit('user-1', { type, description: 'Verduleria del barrio' })
            ).resolves.toEqual({ matched: false })
        }

        expect(mocks.find).not.toHaveBeenCalled()
    })

    it('sin reglas activas no consulta nada más y limpia la traza', async () => {
        mocks.find.mockReturnValue(rules([]))

        await expect(
            resolveRuleTraceForEdit('user-1', { type: 'expense', description: 'Verduleria' })
        ).resolves.toEqual({ matched: false })
    })

    it('consulta sólo las reglas activas del usuario', async () => {
        await resolveRuleTraceForEdit('user-1', { type: 'expense', description: 'x' })

        expect(mocks.find).toHaveBeenCalledWith({ userId: 'user-1', isActive: true })
    })
})
