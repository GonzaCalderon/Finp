import { useState, useEffect, useRef } from 'react'
import type { ITransaction } from '@/types'

interface TransactionFilters {
    month?: string
    type?: string
    categoryId?: string
    accountId?: string
    limit?: number
}

export function useTransactions(filters: TransactionFilters = {}) {
    const [transactions, setTransactions] = useState<ITransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const isFirstLoad = useRef(true)

    const buildQuery = (f: TransactionFilters) => {
        const params = new URLSearchParams()
        if (f.month) params.set('month', f.month)
        if (f.type) params.set('type', f.type)
        if (f.categoryId) params.set('categoryId', f.categoryId)
        if (f.accountId) params.set('accountId', f.accountId)
        if (f.limit) params.set('limit', f.limit.toString())
        return params.toString()
    }

    const fetchTransactions = async (f: TransactionFilters = filters) => {
        try {
            if (isFirstLoad.current) {
                setLoading(true)
            } else {
                setRefreshing(true)
            }
            const query = buildQuery(f)
            const res = await fetch(`/api/transactions?${query}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setTransactions(data.transactions)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar transacciones')
        } finally {
            setLoading(false)
            setRefreshing(false)
            isFirstLoad.current = false
        }
    }

    const createTransaction = async (body: Record<string, unknown>) => {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchTransactions()
        return data.transaction
    }

    const updateTransaction = async (id: string, body: Record<string, unknown>) => {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchTransactions()
        return data.transaction
    }

    const deleteTransaction = async (id: string) => {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchTransactions()
    }

    useEffect(() => {
        fetchTransactions()
    }, [filters.month, filters.type, filters.categoryId, filters.accountId])

    return {
        transactions,
        loading,
        refreshing,
        error,
        fetchTransactions,
        createTransaction,
        updateTransaction,
        deleteTransaction,
    }
}