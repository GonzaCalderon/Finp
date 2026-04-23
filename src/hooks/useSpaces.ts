import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type {
    ISpace,
    ISpaceListItem,
    ISpacePendingAction,
} from '@/types'
import type { SpaceFormData } from '@/lib/validations'

type SpacesResponse = {
    spaces: ISpaceListItem[]
    pendingActions: ISpacePendingAction[]
    pendingCount: number
}

export function useSpaces() {
    const [spaces, setSpaces] = useState<ISpaceListItem[]>([])
    const [pendingActions, setPendingActions] = useState<ISpacePendingAction[]>([])
    const [pendingCount, setPendingCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchSpaces = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<SpacesResponse>('/api/spaces')
            setSpaces(data.spaces)
            setPendingActions(data.pendingActions)
            setPendingCount(data.pendingCount)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar espacios')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    const createSpace = useCallback(async (body: SpaceFormData) => {
        const data = await apiJson<{ space: ISpace }>('/api/spaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.space
    }, [])

    useEffect(() => {
        void fetchSpaces()
    }, [fetchSpaces])

    useDataInvalidation(['spaces'], () => {
        void fetchSpaces({ silent: true })
    })

    return {
        spaces,
        pendingActions,
        pendingCount,
        loading,
        refreshing,
        error,
        fetchSpaces,
        createSpace,
    }
}
