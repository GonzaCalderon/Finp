'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiJson } from '@/lib/client/auth-client'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { DataTag } from '@/lib/client/data-sync'
import type { NavInsight, NavInsightsResponse } from '@/types/nav-insight'

const FALLBACK_INSIGHT: NavInsight = {
    id: 'fallback-ready',
    type: 'empty',
    priority: 100,
    title: 'Finp listo',
    description: 'Todo al dia.',
    href: '/dashboard',
    icon: 'check-circle',
    tone: 'green',
}

const WATCHED_TAGS: DataTag[] = [
    'nav-insights',
    'notifications',
    'personal-pending-actions',
    'debts',
    'spaces',
    'commitments',
    'transactions',
]

export function useNavInsights() {
    const [insights, setInsights] = useState<NavInsight[]>([FALLBACK_INSIGHT])
    const [generatedAt, setGeneratedAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    const fetchInsights = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) setLoading(true)
            const data = await apiJson<NavInsightsResponse>('/api/nav-insights')
            setInsights(data.insights?.length ? data.insights : [FALLBACK_INSIGHT])
            setActiveIndex(0)
            setGeneratedAt(data.generatedAt ?? null)
            setError(null)
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                setInsights([FALLBACK_INSIGHT])
                setError(null)
                return
            }
            setInsights((current) => current.length ? current : [FALLBACK_INSIGHT])
            setError(err instanceof Error ? err.message : 'Error al cargar insight')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchInsights()
    }, [fetchInsights])

    useDataInvalidation(WATCHED_TAGS, () => {
        void fetchInsights({ silent: true })
    })

    useEffect(() => {
        const onFocus = () => {
            void fetchInsights({ silent: true })
        }
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                void fetchInsights({ silent: true })
            }
        }

        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisibility)
        }
    }, [fetchInsights])

    useEffect(() => {
        const id = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void fetchInsights({ silent: true })
            }
        }, 90_000)

        return () => window.clearInterval(id)
    }, [fetchInsights])

    useEffect(() => {
        if (insights.length <= 1) return

        const id = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % insights.length)
        }, 12_000)

        return () => window.clearInterval(id)
    }, [insights.length])

    const primaryInsight = useMemo(
        () => [...insights].sort((a, b) => a.priority - b.priority)[0] ?? FALLBACK_INSIGHT,
        [insights]
    )

    const activeInsight = insights[activeIndex] ?? primaryInsight

    return {
        insights,
        primaryInsight,
        activeInsight,
        generatedAt,
        loading,
        error,
        refresh: fetchInsights,
    }
}
