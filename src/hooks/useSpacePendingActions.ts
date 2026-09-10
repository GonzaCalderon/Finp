import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpacePendingAction } from '@/types'

type PendingResponse = {
    pendingActions: ISpacePendingAction[]
    total: number
    invitations: number
    unreadActivityCount: number
}

export function useSpacePendingActions() {
    const [pendingActions, setPendingActions] = useState<ISpacePendingAction[]>([])
    const [counts, setCounts] = useState({
        total: 0,
        invitations: 0,
        unreadActivityCount: 0,
    })
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchPendingActions = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<PendingResponse>('/api/spaces/pending')
            setPendingActions(data.pendingActions)
            setCounts({
                total: data.total,
                invitations: data.invitations,
                unreadActivityCount: data.unreadActivityCount,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar pendientes')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    const respondToInvite = useCallback(
        async (
            spaceId: string,
            participantId: string,
            inviteStatus: 'accepted' | 'declined'
        ) => {
            const data = await apiJson(
                `/api/spaces/${spaceId}/participants/${participantId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ inviteStatus }),
                }
            )

            invalidateData(SPACE_INVALIDATION_TAGS)
            return data
        },
        []
    )

    useEffect(() => {
        void fetchPendingActions()
    }, [fetchPendingActions])

    useDataInvalidation(['spaces'], () => {
        void fetchPendingActions({ silent: true })
    })

    return {
        pendingActions,
        counts,
        loading,
        refreshing,
        error,
        fetchPendingActions,
        respondToInvite,
    }
}
