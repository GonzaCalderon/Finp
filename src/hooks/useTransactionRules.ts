'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ITransactionRule } from '@/types'
import { useToast } from '@/hooks/useToast'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    RULE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'

export function useTransactionRules() {
    const [rules, setRules] = useState<ITransactionRule[]>([])
    const [loading, setLoading] = useState(true)
    const { success, error: toastError } = useToast()

    const fetchRules = useCallback(async () => {
        try {
            setLoading(true)
            const json = await apiJson<{ rules: ITransactionRule[] }>('/api/transaction-rules')
            setRules(json.rules)
        } catch {
            // silent
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

    useDataInvalidation(['rules'], () => {
        void fetchRules()
    })

    const createRule = useCallback(
        async (data: Partial<ITransactionRule>) => {
            const json = await apiJson<{ rule: ITransactionRule }>('/api/transaction-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            setRules((prev) => [json.rule, ...prev])
            success('Regla creada')
            invalidateData(RULE_INVALIDATION_TAGS)
            return json.rule as ITransactionRule
        },
        [success]
    )

    const updateRule = useCallback(
        async (id: string, data: Partial<ITransactionRule>) => {
            const json = await apiJson<{ rule: ITransactionRule }>(`/api/transaction-rules/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            setRules((prev) => prev.map((r) => (r._id.toString() === id ? json.rule : r)))
            success('Regla actualizada')
            invalidateData(RULE_INVALIDATION_TAGS)
            return json.rule as ITransactionRule
        },
        [success]
    )

    const toggleRule = useCallback(
        async (id: string, isActive: boolean) => {
            try {
                const json = await apiJson<{ rule: ITransactionRule }>(`/api/transaction-rules/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive }),
                })
                setRules((prev) => prev.map((r) => (r._id.toString() === id ? json.rule : r)))
                invalidateData(RULE_INVALIDATION_TAGS)
            } catch (err) {
                toastError(err instanceof Error ? err.message : 'Error al cambiar estado')
            }
        },
        [toastError]
    )

    const deleteRule = useCallback(
        async (id: string) => {
            await apiJson(`/api/transaction-rules/${id}`, { method: 'DELETE' })
            setRules((prev) => prev.filter((r) => r._id.toString() !== id))
            success('Regla eliminada')
            invalidateData(RULE_INVALIDATION_TAGS)
        },
        [success]
    )

    return {
        rules,
        loading,
        fetchRules,
        createRule,
        updateRule,
        toggleRule,
        deleteRule,
    }
}
