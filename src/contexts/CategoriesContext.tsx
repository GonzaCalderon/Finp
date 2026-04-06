'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react'
import type { ICategory } from '@/types'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import { apiJson } from '@/lib/client/auth-client'
import {
    CATEGORY_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'

type DefaultCategoryItem = {
    name: string
    type: string
    color: string
}

type CategoriesContextValue = {
    categories: ICategory[]
    loading: boolean
    error: string | null
    fetchCategories: (options?: { silent?: boolean }) => Promise<void>
    createCategory: (body: Partial<ICategory>) => Promise<ICategory>
    updateCategory: (id: string, body: Partial<ICategory>) => Promise<ICategory>
    deleteCategory: (id: string, migrateTo?: string) => Promise<void>
    addDefaultCategories: (names: string[]) => Promise<number>
    fetchMissingDefaults: () => Promise<{
        missing: DefaultCategoryItem[]
        existing: DefaultCategoryItem[]
    }>
}

const CategoriesContext = createContext<CategoriesContextValue | undefined>(
    undefined
)

export function CategoriesProvider({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    const [categories, setCategories] = useState<ICategory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCategories = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<{ categories?: ICategory[] }>('/api/categories')
            setCategories(data.categories ?? [])
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Error al cargar categorías'
            )
        } finally {
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }, [])

    const createCategory = useCallback(
        async (body: Partial<ICategory>) => {
            const data = await apiJson<{ category: ICategory }>('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const newCategory = data.category as ICategory

            setCategories((prev) => {
                const exists = prev.some(
                    (category) => category._id.toString() === newCategory._id.toString()
                )

                if (exists) return prev
                return [...prev, newCategory]
            })

            invalidateData(CATEGORY_INVALIDATION_TAGS)
            return newCategory
        },
        []
    )

    const updateCategory = useCallback(
        async (id: string, body: Partial<ICategory>) => {
            const data = await apiJson<{ category: ICategory }>(`/api/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const updatedCategory = data.category as ICategory

            setCategories((prev) =>
                prev.map((category) =>
                    category._id.toString() === id ? updatedCategory : category
                )
            )

            invalidateData(CATEGORY_INVALIDATION_TAGS)
            return updatedCategory
        },
        []
    )

    const deleteCategory = useCallback(async (id: string, migrateTo?: string) => {
        await apiJson(`/api/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ migrateTo }),
        })

        setCategories((prev) =>
            prev.filter((category) => category._id.toString() !== id)
        )
        invalidateData(CATEGORY_INVALIDATION_TAGS)
    }, [])

    const addDefaultCategories = useCallback(async (names: string[]) => {
        const data = await apiJson<{ created: number }>('/api/categories/defaults', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names }),
        })

        invalidateData(CATEGORY_INVALIDATION_TAGS)
        return data.created as number
    }, [fetchCategories])

    const fetchMissingDefaults = useCallback(async () => {
        return apiJson<{
            missing: DefaultCategoryItem[]
            existing: DefaultCategoryItem[]
        }>('/api/categories/defaults')
    }, [])

    useDataInvalidation(['categories'], () => {
        void fetchCategories({ silent: true })
    })

    useEffect(() => {
        void fetchCategories()
    }, [fetchCategories])

    const value = useMemo<CategoriesContextValue>(
        () => ({
            categories,
            loading,
            error,
            fetchCategories,
            createCategory,
            updateCategory,
            deleteCategory,
            addDefaultCategories,
            fetchMissingDefaults,
        }),
        [
            categories,
            loading,
            error,
            fetchCategories,
            createCategory,
            updateCategory,
            deleteCategory,
            addDefaultCategories,
            fetchMissingDefaults,
        ]
    )

    return (
        <CategoriesContext.Provider value={value}>
            {children}
        </CategoriesContext.Provider>
    )
}

export function useCategoriesContext() {
    const context = useContext(CategoriesContext)

    if (!context) {
        throw new Error(
            'useCategoriesContext debe usarse dentro de un CategoriesProvider'
        )
    }

    return context
}
