import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'
import type { SpaceEntryFormData } from '@/lib/validations'

type Filters = {
    type?: string
    status?: string
}

export function useSpaceEntries(spaceId?: string, filters: Filters = {}) {
    const [entries, setEntries] = useState<ISpaceEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchEntries = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return

        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const params = new URLSearchParams()
            if (filters.type) params.set('type', filters.type)
            if (filters.status) params.set('status', filters.status)

            const query = params.toString()
            const data = await apiJson<{
                entries: ISpaceEntry[]
                personalImpactsByEntryId?: Record<string, ISpaceEntryPersonalImpact>
            }>(
                `/api/spaces/${spaceId}/entries${query ? `?${query}` : ''}`
            )

            setEntries(data.entries)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar movimientos')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [filters.status, filters.type, spaceId])

    const createEntry = useCallback(async (body: SpaceEntryFormData) => {
        if (!spaceId) {
            throw new Error('Espacio inválido')
        }

        const data = await apiJson<{ entry: ISpaceEntry }>(`/api/spaces/${spaceId}/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.entry
    }, [spaceId])

    useEffect(() => {
        if (!spaceId) return
        void fetchEntries()
    }, [fetchEntries, spaceId])

    useDataInvalidation(['spaces'], () => {
        if (!spaceId) return
        void fetchEntries({ silent: true })
    })

    return {
        entries,
        loading,
        refreshing,
        error,
        fetchEntries,
        createEntry,
    }
}
