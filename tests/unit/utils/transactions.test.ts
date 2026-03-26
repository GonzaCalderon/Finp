import { describe, it, expect } from 'vitest'
import { isCategoryCompatible, normalizeFilters } from '@/lib/utils/transactions'
import type { CategoryOption, Filters } from '@/lib/utils/transactions'

// Categorías de ejemplo
const CAT_INCOME: CategoryOption = { value: 'cat-income-1', label: 'Sueldo', type: 'income', color: '#16a34a' }
const CAT_EXPENSE: CategoryOption = { value: 'cat-expense-1', label: 'Supermercado', type: 'expense', color: '#22c55e' }
const CATEGORIES = [CAT_INCOME, CAT_EXPENSE]

const emptyFilters: Filters = { type: '', categoryId: '', accountId: '' }

// ─── isCategoryCompatible ─────────────────────────────────────────────────────
describe('isCategoryCompatible', () => {
    it('devuelve true cuando no hay tipo seleccionado', () => {
        expect(isCategoryCompatible('income', '')).toBe(true)
        expect(isCategoryCompatible('expense', '')).toBe(true)
    })

    it('devuelve true cuando categoría y tipo coinciden', () => {
        expect(isCategoryCompatible('income', 'income')).toBe(true)
        expect(isCategoryCompatible('expense', 'expense')).toBe(true)
    })

    it('devuelve false cuando categoría y tipo NO coinciden', () => {
        expect(isCategoryCompatible('expense', 'income')).toBe(false)
        expect(isCategoryCompatible('income', 'expense')).toBe(false)
    })
})

// ─── normalizeFilters ─────────────────────────────────────────────────────────
describe('normalizeFilters', () => {
    it('devuelve filtros sin cambio cuando no hay categoryId', () => {
        const filters: Filters = { ...emptyFilters, type: 'income' }
        const result = normalizeFilters(filters, CATEGORIES)
        expect(result).toEqual(filters)
    })

    it('limpia categoryId si la categoría no existe en la lista', () => {
        const filters: Filters = { type: '', categoryId: 'cat-inexistente', accountId: '' }
        const result = normalizeFilters(filters, CATEGORIES)
        expect(result.categoryId).toBe('')
    })

    it('mantiene categoryId si la categoría es compatible con el tipo', () => {
        const filters: Filters = { type: 'income', categoryId: CAT_INCOME.value, accountId: '' }
        const result = normalizeFilters(filters, CATEGORIES)
        expect(result.categoryId).toBe(CAT_INCOME.value)
    })

    it('limpia categoryId si la categoría no es compatible con el tipo', () => {
        // Tipo expense, pero la categoría seleccionada es income → se limpia
        const filters: Filters = { type: 'expense', categoryId: CAT_INCOME.value, accountId: '' }
        const result = normalizeFilters(filters, CATEGORIES)
        expect(result.categoryId).toBe('')
    })

    it('no modifica accountId ni type al limpiar categoryId', () => {
        const filters: Filters = { type: 'expense', categoryId: CAT_INCOME.value, accountId: 'account-123' }
        const result = normalizeFilters(filters, CATEGORIES)
        expect(result.type).toBe('expense')
        expect(result.accountId).toBe('account-123')
        expect(result.categoryId).toBe('')
    })

    it('devuelve filtros sin cambio cuando sin tipo y categoría compatible con lista', () => {
        const filters: Filters = { type: '', categoryId: CAT_EXPENSE.value, accountId: '' }
        const result = normalizeFilters(filters, CATEGORIES)
        // Sin tipo seleccionado, cualquier categoría existente es compatible
        expect(result.categoryId).toBe(CAT_EXPENSE.value)
    })

    it('no muta el objeto original de filtros', () => {
        const filters: Filters = { type: 'expense', categoryId: CAT_INCOME.value, accountId: '' }
        const filtersCopy = { ...filters }
        normalizeFilters(filters, CATEGORIES)
        expect(filters).toEqual(filtersCopy)
    })
})
