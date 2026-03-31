/**
 * Utilidades puras para lógica de filtros de transacciones.
 * Extraídas del componente para permitir unit testing sin contexto de React.
 */

export type CategoryOption = {
    value: string
    label: string
    type: string
    color?: string
}

export type Filters = {
    type: string
    categoryId: string
    accountId: string
    currency?: string
}

/** Normaliza tipos de transacción al dominio de categorías. */
export function getCategoryTypeForTransactionType(type: string): string {
    if (type === 'credit_card_expense') return 'expense'
    return type
}

/**
 * Determina si una categoría es compatible con el tipo de transacción seleccionado.
 * Si no hay tipo seleccionado, todas las categorías son compatibles.
 */
export function isCategoryCompatible(categoryType: string, selectedType: string): boolean {
    if (!selectedType) return true
    return categoryType === getCategoryTypeForTransactionType(selectedType)
}

/** Determina si un tipo de transacción es un consumo con tarjeta de crédito. */
export function isCCExpenseType(type: string): boolean {
    return type === 'credit_card_expense'
}

/**
 * Normaliza los filtros activos: si la categoría seleccionada no existe
 * o no es compatible con el tipo seleccionado, la limpia automáticamente.
 */
export function normalizeFilters(filters: Filters, categories: CategoryOption[]): Filters {
    if (!filters.categoryId) return filters

    const selectedCategory = categories.find((category) => category.value === filters.categoryId)

    if (!selectedCategory) {
        return {
            ...filters,
            categoryId: '',
        }
    }

    if (!isCategoryCompatible(selectedCategory.type, filters.type)) {
        return {
            ...filters,
            categoryId: '',
        }
    }

    return filters
}
