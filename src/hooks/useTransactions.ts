import { useState, useEffect, useRef, useCallback } from 'react'
import type { ITransaction } from '@/types'
import type { TransactionFormData } from '@/lib/validations'

interface TransactionFilters {
    month?: string
    type?: string
    categoryId?: string
    accountId?: string
    noInstallmentPlan?: boolean
    sort?: string
    limit?: number
}

export interface TransactionSummary {
    income: number
    expense: number
    creditCardExpense: number
}

const DEFAULT_SUMMARY: TransactionSummary = {
    income: 0,
    expense: 0,
    creditCardExpense: 0,
}

export function useTransactions(filters: TransactionFilters = {}) {
    const [transactions, setTransactions] = useState<ITransaction[]>([])
    const [summary, setSummary] = useState<TransactionSummary>(DEFAULT_SUMMARY)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(false)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const isFirstLoad = useRef(true)
    const PAGE_LIMIT = filters.limit ?? 30

    const buildQuery = (f: TransactionFilters, p: number) => {
        const params = new URLSearchParams()
        if (f.month) params.set('month', f.month)
        if (f.type) params.set('type', f.type)
        if (f.categoryId) params.set('categoryId', f.categoryId)
        if (f.accountId) params.set('accountId', f.accountId)
        if (f.noInstallmentPlan) params.set('noInstallmentPlan', 'true')
        if (f.sort) params.set('sort', f.sort)
        params.set('page', String(p))
        params.set('limit', String(PAGE_LIMIT))
        return params.toString()
    }

    const fetchTransactions = useCallback(async (isRefresh = false) => {
        try {
            setError(null)
            if (isFirstLoad.current) setLoading(true)
            else if (isRefresh) setRefreshing(true)
            else setRefreshing(true)

            const query = buildQuery(filters, 1)
            const res = await fetch(`/api/transactions?${query}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al cargar transacciones')

            setTransactions(data.transactions)
            setHasMore(data.hasMore)
            setTotal(data.total)
            setPage(1)
            if (data.summary) setSummary(data.summary)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar transacciones')
        } finally {
            setLoading(false)
            setRefreshing(false)
            isFirstLoad.current = false
        }
    }, [filters.month, filters.type, filters.categoryId, filters.accountId, filters.sort, filters.noInstallmentPlan])

    const loadMore = async () => {
        if (!hasMore || loadingMore) return
        try {
            setLoadingMore(true)
            const nextPage = page + 1
            const query = buildQuery(filters, nextPage)
            const res = await fetch(`/api/transactions?${query}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setTransactions((prev) => [...prev, ...data.transactions])
            setHasMore(data.hasMore)
            setPage(nextPage)
        } catch (err) {
            console.error('Error al cargar más:', err)
        } finally {
            setLoadingMore(false)
        }
    }

    const createTransaction = async (body: TransactionFormData) => {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al crear transacción')
        await fetchTransactions(true)
        return data.transaction
    }

    const updateTransaction = async (id: string, body: TransactionFormData) => {
        const res = await fetch(`/api/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al actualizar transacción')
        await fetchTransactions(true)
        return data.transaction
    }

    const deleteTransaction = async (id: string) => {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al eliminar transacción')
        await fetchTransactions(true)
    }

    useEffect(() => {
        isFirstLoad.current = true
        fetchTransactions()
    }, [filters.month, filters.type, filters.categoryId, filters.accountId, filters.sort, filters.noInstallmentPlan])

    return {
        transactions,
        summary,
        loading,
        refreshing,
        loadingMore,
        error,
        hasMore,
        total,
        fetchTransactions,
        loadMore,
        createTransaction,
        updateTransaction,
        deleteTransaction,
    }
}
