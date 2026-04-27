import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpaceCategory } from '@/types'
import type { SpaceCategoryFormData } from '@/lib/validations'

type UpdateCategoryBody = Partial<SpaceCategoryFormData> & {
    isArchived?: boolean
}

export function useSpaceCategories(spaceId?: string) {
    const [categories, setCategories] = useState<ISpaceCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchCategories = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return

        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<{ categories: ISpaceCategory[] }>(
                `/api/spaces/${spaceId}/categories`
            )
            setCategories(data.categories)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar categorías')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [spaceId])

    const createCategory = useCallback(async (body: SpaceCategoryFormData) => {
        if (!spaceId) throw new Error('Espacio inválido')

        const data = await apiJson<{ category: ISpaceCategory }>(
            `/api/spaces/${spaceId}/categories`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        )

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.category
    }, [spaceId])

    const updateCategory = useCallback(async (categoryId: string, body: UpdateCategoryBody) => {
        if (!spaceId) throw new Error('Espacio inválido')

        const data = await apiJson<{ category: ISpaceCategory }>(
            `/api/spaces/${spaceId}/categories/${categoryId}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        )

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.category
    }, [spaceId])

    const archiveCategory = useCallback(
        (categoryId: string) => updateCategory(categoryId, { isArchived: true }),
        [updateCategory]
    )

    const deleteCategory = useCallback(async (categoryId: string) => {
        if (!spaceId) throw new Error('Espacio inválido')

        await apiJson(`/api/spaces/${spaceId}/categories/${categoryId}`, {
            method: 'DELETE',
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
    }, [spaceId])

    const seedCategories = useCallback(async () => {
        if (!spaceId) throw new Error('Espacio inválido')

        const data = await apiJson<{
            created: ISpaceCategory[]
            categories: ISpaceCategory[]
        }>(`/api/spaces/${spaceId}/categories/seed`, {
            method: 'POST',
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data
    }, [spaceId])

    useEffect(() => {
        if (!spaceId) return
        void fetchCategories()
    }, [fetchCategories, spaceId])

    useDataInvalidation(['spaces'], () => {
        if (!spaceId) return
        void fetchCategories({ silent: true })
    })

    return {
        categories,
        loading,
        refreshing,
        error,
        fetchCategories,
        createCategory,
        updateCategory,
        archiveCategory,
        deleteCategory,
        seedCategories,
    }
}
