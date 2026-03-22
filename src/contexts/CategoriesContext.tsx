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

type DefaultCategoryItem = {
    name: string
    type: string
    color: string
}

type CategoriesContextValue = {
    categories: ICategory[]
    loading: boolean
    error: string | null
    fetchCategories: () => Promise<void>
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

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const res = await fetch('/api/categories')
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error al cargar categorías')
            }

            setCategories(data.categories ?? [])
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Error al cargar categorías'
            )
        } finally {
            setLoading(false)
        }
    }, [])

    const createCategory = useCallback(
        async (body: Partial<ICategory>) => {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error al crear categoría')
            }

            const newCategory = data.category as ICategory

            setCategories((prev) => {
                const exists = prev.some(
                    (category) => category._id.toString() === newCategory._id.toString()
                )

                if (exists) return prev
                return [...prev, newCategory]
            })

            return newCategory
        },
        []
    )

    const updateCategory = useCallback(
        async (id: string, body: Partial<ICategory>) => {
            const res = await fetch(`/api/categories/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Error al actualizar categoría')
            }

            const updatedCategory = data.category as ICategory

            setCategories((prev) =>
                prev.map((category) =>
                    category._id.toString() === id ? updatedCategory : category
                )
            )

            return updatedCategory
        },
        []
    )

    const deleteCategory = useCallback(async (id: string, migrateTo?: string) => {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ migrateTo }),
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Error al eliminar categoría')
        }

        setCategories((prev) =>
            prev.filter((category) => category._id.toString() !== id)
        )
    }, [])

    const addDefaultCategories = useCallback(async (names: string[]) => {
        const res = await fetch('/api/categories/defaults', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names }),
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Error al agregar categorías predeterminadas')
        }

        await fetchCategories()
        return data.created as number
    }, [fetchCategories])

    const fetchMissingDefaults = useCallback(async () => {
        const res = await fetch('/api/categories/defaults')
        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.error || 'Error al cargar categorías predeterminadas')
        }

        return data as {
            missing: DefaultCategoryItem[]
            existing: DefaultCategoryItem[]
        }
    }, [])

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