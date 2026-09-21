import { useCallback, useEffect, useState } from 'react'
import { ApiError, apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { SpaceDetailDto, SpaceMutationResultDto } from '@/types'
import {
    adaptSpaceDetailDtoForUi,
    type SpaceDetailUiPayload,
} from '@/lib/client/space-api-adapter'
import type { SpaceFormData } from '@/lib/validations'

export function useSpace(spaceId?: string) {
    const [data, setData] = useState<SpaceDetailUiPayload | null>(null)
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

            const payload = await apiJson<{ data: SpaceDetailDto }>(`/api/spaces/${spaceId}`)
            setData(adaptSpaceDetailDtoForUi(payload.data))
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

        const isV2 = data?.api.sourceContract === 'v2'
        try {
            if (isV2) {
                const statusChanged = body.status !== data.space.status
                await apiJson<SpaceMutationResultDto<unknown>>(`/api/spaces/${spaceId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify(statusChanged ? {
                        intent: 'lifecycle',
                        expectedRevision: data.api.space.revision,
                        targetStatus: body.status,
                    } : {
                        intent: 'settings',
                        expectedRevision: data.api.space.revision,
                        name: body.name,
                        description: body.description,
                        currencies: body.currencies,
                        reportingCurrency: body.reportingCurrency,
                        defaultSplitMode: body.defaultSplitMode,
                        timezone: data.api.space.timezone,
                    }),
                })
                await fetchSpace({ silent: true })
                invalidateData(SPACE_INVALIDATION_TAGS)
                return data.space
            }
            const response = await apiJson<{ space: SpaceDetailUiPayload['space'] }>(`/api/spaces/${spaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })

            invalidateData(SPACE_INVALIDATION_TAGS)
            return response.space
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                await fetchSpace({ silent: true })
            }
            throw error
        }
    }, [data, fetchSpace, spaceId])

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
