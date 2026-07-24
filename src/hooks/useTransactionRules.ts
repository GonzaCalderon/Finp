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
import type {
    RuleActionPreview,
    RuleConflict,
    RuleMatchSnapshot,
} from '@/lib/utils/rules'
import type { TransactionRuleSuggestion } from '@/lib/utils/rule-suggestions'

export interface RuleSimulationSample {
    type: 'expense' | 'income' | 'credit_card_expense'
    description?: string
    merchant?: string
    categoryId?: string
}

export interface RuleSimulationRuleInput {
    name: string
    isActive: boolean
    priority: number
    appliesTo: 'expense' | 'income' | 'any'
    field: 'description' | 'merchant'
    condition: 'contains' | 'equals' | 'starts_with'
    value: string
    categoryId?: string
    setType?: 'expense' | 'income'
    normalizeMerchant?: string
}

export interface SimulatedRuleResult {
    id: string
    name: string
    priority: number
    isCandidate: boolean
    match?: RuleMatchSnapshot
    actions: RuleActionPreview
}

export interface RuleSimulationResult {
    normalizedSample: {
        description: string
        merchant: string
    }
    candidateMatches: boolean
    matchedRules: SimulatedRuleResult[]
    winner: SimulatedRuleResult | null
    conflicts: RuleConflict[]
}

export function useTransactionRules() {
    const [rules, setRules] = useState<ITransactionRule[]>([])
    const [loading, setLoading] = useState(true)
    const [suggestions, setSuggestions] = useState<TransactionRuleSuggestion[]>([])
    const [suggestionsLoading, setSuggestionsLoading] = useState(true)
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

    const fetchSuggestions = useCallback(async () => {
        try {
            setSuggestionsLoading(true)
            const json = await apiJson<{ suggestions: TransactionRuleSuggestion[] }>(
                '/api/transaction-rules/suggestions'
            )
            setSuggestions(json.suggestions)
        } catch {
            setSuggestions([])
        } finally {
            setSuggestionsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchRules()
        fetchSuggestions()
    }, [fetchRules, fetchSuggestions])

    useDataInvalidation(['rules'], () => {
        void fetchRules()
    })

    useDataInvalidation(['rules', 'transactions'], () => {
        void fetchSuggestions()
    })

    const createRule = useCallback(
        async (data: Partial<ITransactionRule>) => {
            try {
                const json = await apiJson<{ rule: ITransactionRule }>('/api/transaction-rules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                setRules((prev) => [json.rule, ...prev])
                success('Regla creada')
                invalidateData(RULE_INVALIDATION_TAGS)
                return json.rule as ITransactionRule
            } catch (err) {
                toastError(err instanceof Error ? err.message : 'Error al crear la regla')
                throw err
            }
        },
        [success, toastError]
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

    const dismissSuggestion = useCallback(
        async (key: string) => {
            await apiJson('/api/transaction-rules/suggestions/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            })
            setSuggestions((current) =>
                current.filter((suggestion) => suggestion.key !== key)
            )
        },
        []
    )

    const simulateRule = useCallback(
        async (
            data: RuleSimulationRuleInput,
            sample: RuleSimulationSample,
            editingRuleId?: string
        ) => apiJson<RuleSimulationResult>('/api/transaction-rules/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rule: data,
                sample,
                editingRuleId,
            }),
        }),
        []
    )

    return {
        rules,
        loading,
        suggestions,
        suggestionsLoading,
        fetchRules,
        fetchSuggestions,
        createRule,
        updateRule,
        toggleRule,
        deleteRule,
        dismissSuggestion,
        simulateRule,
    }
}
