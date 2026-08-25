import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type {
    ISpaceEntry,
    SpaceDetailDto,
    SpaceMovementPageDto,
    SpaceMutationResultDto,
} from '@/types'
import type { SpaceEntryFormData } from '@/lib/validations'
import {
    adaptSpaceEntryDtoForUi,
    clientDateToDateKey,
} from '@/lib/client/space-api-adapter'

type Filters = {
    type?: string
    status?: string
}

export function useSpaceEntries(
    spaceId?: string,
    filters: Filters = {},
    spaceApi?: SpaceDetailDto
) {
    const [entries, setEntries] = useState<ISpaceEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pendingKeys = useRef(new Map<string, string>())

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
                data?: SpaceMovementPageDto
                entries?: ISpaceEntry[]
            }>(
                `/api/spaces/${spaceId}/entries${query ? `?${query}` : ''}`
            )

            setEntries(data.data && spaceApi
                ? data.data.items.map((entry) => adaptSpaceEntryDtoForUi(entry, spaceApi))
                : data.entries ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar movimientos')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [filters.status, filters.type, spaceApi, spaceId])

    const createEntry = useCallback(async (body: SpaceEntryFormData) => {
        if (!spaceId) {
            throw new Error('Espacio inválido')
        }

        if (spaceApi?.sourceContract === 'v2') {
            const intention = JSON.stringify(body)
            const idempotencyKey = pendingKeys.current.get(intention) ?? crypto.randomUUID()
            pendingKeys.current.set(intention, idempotencyKey)
            const isSettlement = body.type === 'settlement'
            const endpoint = isSettlement
                ? `/api/spaces/${spaceId}/settlements`
                : `/api/spaces/${spaceId}/entries`
            const payload = isSettlement ? {
                mode: 'represented',
                expectedRevision: spaceApi.space.revision,
                amount: body.amount,
                currency: body.currency,
                exchangeRate: body.exchangeRate,
                dateKey: clientDateToDateKey(body.date),
                payerParticipantId: body.paidByParticipantId,
                receiverParticipantId: body.sharedWithParticipantIds?.[0],
                description: body.notes,
            } : {
                expectedRevision: spaceApi.space.revision,
                title: body.title,
                description: body.description,
                amount: body.amount,
                currency: body.currency,
                exchangeRate: body.exchangeRate,
                dateKey: clientDateToDateKey(body.date),
                paidByParticipantId: body.paidByParticipantId,
                sharedWithParticipantIds: body.sharedWithParticipantIds?.length
                    ? body.sharedWithParticipantIds
                    : body.paidByParticipantId
                        ? [body.paidByParticipantId]
                        : [],
                splitMode: body.splitMode,
                splitAllocations: body.splitAllocations,
                spaceCategoryId: body.spaceCategoryId,
                notes: body.notes,
                personalImpact: body.personalAccountId || body.categoryId || body.linkedTransactionId ? {
                    accountId: body.personalAccountId,
                    categoryId: body.categoryId,
                    description: body.title,
                    linkedTransactionId: body.linkedTransactionId,
                } : undefined,
            }
            let result: SpaceMutationResultDto<{ entryId?: string; spaceEntryId?: string }>
            try {
                result = await apiJson<SpaceMutationResultDto<{
                    entryId?: string
                    spaceEntryId?: string
                }>>(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': idempotencyKey,
                    },
                    body: JSON.stringify(payload),
                })
            } catch (error) {
                if (error instanceof ApiError && error.status === 409) {
                    invalidateData(SPACE_INVALIDATION_TAGS)
                }
                throw error
            }
            pendingKeys.current.delete(intention)
            invalidateData(SPACE_INVALIDATION_TAGS)
            return {
                _id: result.data.entryId ?? result.data.spaceEntryId,
            } as unknown as ISpaceEntry
        }

        const data = await apiJson<{ entry: ISpaceEntry }>(`/api/spaces/${spaceId}/entries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.entry
    }, [spaceApi, spaceId])

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
