'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiJson } from '@/lib/client/auth-client'
import type { SpaceQuotesDto } from '@/types'

const REFRESH_INTERVAL_MS = 15 * 60 * 1000

export function useSpaceQuotes(spaceId?: string, enabled = true) {
    const [data, setData] = useState<SpaceQuotesDto | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        if (!spaceId || !enabled || document.visibilityState === 'hidden') return
        setLoading(true)
        try {
            const response = await apiJson<{ data: SpaceQuotesDto }>(`/api/spaces/${spaceId}/quotes`)
            setData(response.data)
            setError(null)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No pudimos actualizar las cotizaciones.')
        } finally {
            setLoading(false)
        }
    }, [enabled, spaceId])

    useEffect(() => {
        if (!spaceId || !enabled) return
        void refresh()
        const handleFocus = () => void refresh()
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') void refresh()
        }
        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibility)
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') void refresh()
        }, REFRESH_INTERVAL_MS)
        return () => {
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibility)
            window.clearInterval(interval)
        }
    }, [enabled, refresh, spaceId])

    return { data, loading, error, refresh }
}
