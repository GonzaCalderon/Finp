'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ITransactionRule } from '@/types'
import { useToast } from '@/hooks/useToast'

export function useTransactionRules() {
    const [rules, setRules] = useState<ITransactionRule[]>([])
    const [loading, setLoading] = useState(true)
    const { success, error: toastError } = useToast()

    const fetchRules = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/transaction-rules')
            const json = await res.json()
            if (res.ok) setRules(json.rules)
        } catch {
            // silent
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRules()
    }, [fetchRules])

    const createRule = useCallback(
        async (data: Partial<ITransactionRule>) => {
            const res = await fetch('/api/transaction-rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error ?? 'Error al crear regla')
            setRules((prev) => [json.rule, ...prev])
            success('Regla creada')
            return json.rule as ITransactionRule
        },
        [success]
    )

    const updateRule = useCallback(
        async (id: string, data: Partial<ITransactionRule>) => {
            const res = await fetch(`/api/transaction-rules/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error ?? 'Error al actualizar regla')
            setRules((prev) => prev.map((r) => (r._id.toString() === id ? json.rule : r)))
            success('Regla actualizada')
            return json.rule as ITransactionRule
        },
        [success]
    )

    const toggleRule = useCallback(
        async (id: string, isActive: boolean) => {
            try {
                const res = await fetch(`/api/transaction-rules/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive }),
                })
                const json = await res.json()
                if (!res.ok) throw new Error(json.error)
                setRules((prev) => prev.map((r) => (r._id.toString() === id ? json.rule : r)))
            } catch (err) {
                toastError(err instanceof Error ? err.message : 'Error al cambiar estado')
            }
        },
        [toastError]
    )

    const deleteRule = useCallback(
        async (id: string) => {
            const res = await fetch(`/api/transaction-rules/${id}`, { method: 'DELETE' })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error ?? 'Error al eliminar regla')
            setRules((prev) => prev.filter((r) => r._id.toString() !== id))
            success('Regla eliminada')
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
