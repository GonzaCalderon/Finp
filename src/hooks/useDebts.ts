'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, DEBT_INVALIDATION_TAGS } from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { IDebt, IDebtMovement } from '@/types/debt'
import type { DebtSummary } from '@/lib/utils/debt'

export type CreateDebtPayload = {
    direction: 'payable' | 'receivable'
    counterpartyName: string
    amount: number
    currency: string
    date: Date | string
    notes?: string
}

export type PayDebtPayload = {
    amount: number
    accountId: string
    date: Date | string
    notes?: string
}

export type CollectDebtPayload = {
    amount: number
    accountId: string
    date: Date | string
    notes?: string
}

export function useDebts() {
    const [debts, setDebts] = useState<IDebt[]>([])
    const [allDebts, setAllDebts] = useState<IDebt[]>([])
    const [summary, setSummary] = useState<DebtSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchDebts = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const [activeData, allData, summaryData] = await Promise.all([
                apiJson<{ debts: IDebt[]; total: number }>('/api/debts'),
                apiJson<{ debts: IDebt[]; total: number }>('/api/debts?includeIgnored=true'),
                apiJson<{ summary: DebtSummary }>('/api/debts/summary'),
            ])

            setDebts(activeData.debts)
            setAllDebts(allData.debts)
            setSummary(summaryData.summary)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar deudas')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    const createDebt = useCallback(async (body: CreateDebtPayload): Promise<IDebt> => {
        const data = await apiJson<{ debt: IDebt }>('/api/debts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(DEBT_INVALIDATION_TAGS)
        return data.debt
    }, [])

    const payDebt = useCallback(async (debtId: string, body: PayDebtPayload): Promise<IDebt> => {
        const data = await apiJson<{ debt: IDebt }>(`/api/debts/${debtId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(DEBT_INVALIDATION_TAGS)
        return data.debt
    }, [])

    const collectDebt = useCallback(async (debtId: string, body: CollectDebtPayload): Promise<IDebt> => {
        const data = await apiJson<{ debt: IDebt }>(`/api/debts/${debtId}/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(DEBT_INVALIDATION_TAGS)
        return data.debt
    }, [])

    const ignoreDebt = useCallback(async (debtId: string): Promise<IDebt> => {
        const data = await apiJson<{ debt: IDebt }>(`/api/debts/${debtId}/ignore`, {
            method: 'POST',
        })
        invalidateData(DEBT_INVALIDATION_TAGS)
        return data.debt
    }, [])

    const restoreDebt = useCallback(async (debtId: string): Promise<IDebt> => {
        const data = await apiJson<{ debt: IDebt }>(`/api/debts/${debtId}/ignore`, {
            method: 'DELETE',
        })
        invalidateData(DEBT_INVALIDATION_TAGS)
        return data.debt
    }, [])

    const cancelDebt = useCallback(async (debtId: string): Promise<IDebt> => {
        const data = await apiJson<{ debt: IDebt }>(`/api/debts/${debtId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'cancelled' }),
        })
        invalidateData(DEBT_INVALIDATION_TAGS)
        return data.debt
    }, [])

    const getDebtWithMovements = useCallback(async (debtId: string): Promise<{ debt: IDebt; movements: IDebtMovement[] }> => {
        return apiJson<{ debt: IDebt; movements: IDebtMovement[] }>(`/api/debts/${debtId}`)
    }, [])

    useEffect(() => {
        void fetchDebts()
    }, [fetchDebts])

    useDataInvalidation(['debts'], () => {
        void fetchDebts({ silent: true })
    })

    return {
        debts,
        allDebts,
        summary,
        loading,
        refreshing,
        error,
        fetchDebts,
        createDebt,
        payDebt,
        collectDebt,
        ignoreDebt,
        restoreDebt,
        cancelDebt,
        getDebtWithMovements,
    }
}
