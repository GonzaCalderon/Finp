import { useState, useEffect } from 'react'
import type { ICategory } from '@/types'

export function useCategories() {
    const [categories, setCategories] = useState<ICategory[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCategories = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/categories')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setCategories(data.categories)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar categorías')
        } finally {
            setLoading(false)
        }
    }

    const createCategory = async (body: Partial<ICategory>) => {
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCategories()
        return data.category
    }

    const updateCategory = async (id: string, body: Partial<ICategory>) => {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCategories()
        return data.category
    }

    const deleteCategory = async (id: string, migrateTo?: string) => {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ migrateTo }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCategories()
    }

    const addDefaultCategories = async (names: string[]) => {
        const res = await fetch('/api/categories/defaults', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCategories()
        return data.created
    }

    const fetchMissingDefaults = async () => {
        const res = await fetch('/api/categories/defaults')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        return data as {
            missing: { name: string; type: string; color: string }[]
            existing: { name: string; type: string; color: string }[]
        }
    }

    useEffect(() => {
        fetchCategories()
    }, [])

    return {
        categories,
        loading,
        error,
        fetchCategories,
        createCategory,
        updateCategory,
        deleteCategory,
        addDefaultCategories,
        fetchMissingDefaults,
    }
}