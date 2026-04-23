import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpaceDetailPayload } from '@/types'
import type { SpaceFormData } from '@/lib/validations'

export function useSpace(spaceId?: string) {
    const [data, setData] = useState<ISpaceDetailPayload | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchSpace = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return

        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const payload = await apiJson<ISpaceDetailPayload>(`/api/spaces/${spaceId}`)
            setData(payload)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar el espacio')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [spaceId])

    const updateSpace = useCallback(async (body: SpaceFormData) => {
        if (!spaceId) {
            throw new Error('Espacio inválido')
        }

        const response = await apiJson<{ space: ISpaceDetailPayload['space'] }>(`/api/spaces/${spaceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
        return response.space
    }, [spaceId])

    useEffect(() => {
        if (!spaceId) return
        void fetchSpace()
    }, [fetchSpace, spaceId])

    useDataInvalidation(['spaces'], () => {
        if (!spaceId) return
        void fetchSpace({ silent: true })
    })

    return {
        data,
        loading,
        refreshing,
        error,
        fetchSpace,
        updateSpace,
    }
}
