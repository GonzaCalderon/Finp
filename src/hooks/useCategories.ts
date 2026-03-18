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

    const archiveCategory = async (id: string) => {
        const res = await fetch(`/api/categories/${id}`, {
            method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCategories()
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
        archiveCategory,
    }
}