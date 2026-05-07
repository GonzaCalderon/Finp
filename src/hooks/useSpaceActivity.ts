import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpaceActivityEvent } from '@/types'

type ActivityResponse = {
    events: ISpaceActivityEvent[]
    unreadCount: number
    total: number
}

export function useSpaceActivity(spaceId?: string) {
    const [events, setEvents] = useState<ISpaceActivityEvent[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const endpoints = useMemo(() => {
        const base = spaceId ? `/api/spaces/${spaceId}/activity` : '/api/spaces/activity'
        return {
            list: base,
            read: `${base}/read`,
        }
    }, [spaceId])

    const fetchActivity = useCallback(async (options?: { silent?: boolean; limit?: number; skip?: number }) => {
        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const params = new URLSearchParams()
            if (options?.limit) params.set('limit', String(options.limit))
            if (options?.skip) params.set('skip', String(options.skip))
            const query = params.toString()
            const data = await apiJson<ActivityResponse>(`${endpoints.list}${query ? `?${query}` : ''}`)

            setEvents(data.events)
            setUnreadCount(data.unreadCount)
            setTotal(data.total)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar actividad')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [endpoints.list])

    const markRead = useCallback(async (eventIds?: string[]) => {
        await apiJson(endpoints.read, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventIds }),
        })

        await fetchActivity({ silent: true })
        invalidateData(SPACE_INVALIDATION_TAGS)
    }, [endpoints.read, fetchActivity])

    useEffect(() => {
        void fetchActivity()
    }, [fetchActivity])

    useDataInvalidation(['spaces'], () => {
        void fetchActivity({ silent: true })
    })

    return {
        events,
        unreadCount,
        total,
        loading,
        refreshing,
        error,
        fetchActivity,
        markRead,
        refresh: () => fetchActivity({ silent: true }),
    }
}
