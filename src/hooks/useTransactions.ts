import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { ITransaction } from '@/types'
import type { TransactionFormData } from '@/lib/validations'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    TRANSACTION_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'

interface TransactionFilters {
    month?: string
    type?: string
    categoryId?: string
    accountId?: string
    currency?: string
    noInstallmentPlan?: boolean
    sort?: string
    limit?: number
}

export interface TransactionSummary {
    income: { ars: number; usd: number }
    expense: { ars: number; usd: number }
    creditCardExpense: { ars: number; usd: number }
}

const DEFAULT_SUMMARY: TransactionSummary = {
    income: { ars: 0, usd: 0 },
    expense: { ars: 0, usd: 0 },
    creditCardExpense: { ars: 0, usd: 0 },
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
    const normalizedFilters = useMemo(
        () => ({
            month: filters.month,
            type: filters.type,
            categoryId: filters.categoryId,
            accountId: filters.accountId,
            currency: filters.currency,
            noInstallmentPlan: filters.noInstallmentPlan,
            sort: filters.sort,
            limit: filters.limit ?? 30,
        }),
        [
            filters.month,
            filters.type,
            filters.categoryId,
            filters.accountId,
            filters.currency,
            filters.noInstallmentPlan,
            filters.sort,
            filters.limit,
        ]
    )
    const PAGE_LIMIT = normalizedFilters.limit

    const buildQuery = useCallback((p: number) => {
        const params = new URLSearchParams()
        if (normalizedFilters.month) params.set('month', normalizedFilters.month)
        if (normalizedFilters.type) params.set('type', normalizedFilters.type)
        if (normalizedFilters.categoryId) params.set('categoryId', normalizedFilters.categoryId)
        if (normalizedFilters.accountId) params.set('accountId', normalizedFilters.accountId)
        if (normalizedFilters.currency) params.set('currency', normalizedFilters.currency)
        if (normalizedFilters.noInstallmentPlan) params.set('noInstallmentPlan', 'true')
        if (normalizedFilters.sort) params.set('sort', normalizedFilters.sort)
        params.set('page', String(p))
        params.set('limit', String(PAGE_LIMIT))
        return params.toString()
    }, [PAGE_LIMIT, normalizedFilters])

    const fetchTransactions = useCallback(async (isRefresh = false) => {
        try {
            setError(null)
            if (isFirstLoad.current) setLoading(true)
            else if (isRefresh) setRefreshing(true)
            else setRefreshing(true)

            const query = buildQuery(1)
            const data = await apiJson<{
                transactions: ITransaction[]
                hasMore: boolean
                total: number
                summary?: TransactionSummary
            }>(`/api/transactions?${query}`)

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
    }, [buildQuery])

    const loadMore = async () => {
        if (!hasMore || loadingMore) return
        try {
            setLoadingMore(true)
            const nextPage = page + 1
            const query = buildQuery(nextPage)
            const data = await apiJson<{
                transactions: ITransaction[]
                hasMore: boolean
            }>(`/api/transactions?${query}`)
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
        const data = await apiJson<{ transaction: ITransaction }>('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(TRANSACTION_INVALIDATION_TAGS)
        return data.transaction
    }

    const updateTransaction = async (id: string, body: TransactionFormData) => {
        const data = await apiJson<{ transaction: ITransaction }>(`/api/transactions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(TRANSACTION_INVALIDATION_TAGS)
        return data.transaction
    }

    const deleteTransaction = async (id: string) => {
        await apiJson(`/api/transactions/${id}`, { method: 'DELETE' })
        invalidateData(TRANSACTION_INVALIDATION_TAGS)
    }

    useEffect(() => {
        isFirstLoad.current = true
        fetchTransactions()
    }, [fetchTransactions])

    useDataInvalidation(['transactions'], () => {
        void fetchTransactions(true)
    })

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
