'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpaceEntryPersonalImpact } from '@/types'

type PendingActionsResponse = {
    pendingActions: ISpaceEntryPersonalImpact[]
    total: number
}

export function usePersonalPendingActions() {
    const [pendingActions, setPendingActions] = useState<ISpaceEntryPersonalImpact[]>([])
    const [needsReviewActions, setNeedsReviewActions] = useState<ISpaceEntryPersonalImpact[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const [pendingData, reviewData] = await Promise.all([
                apiJson<PendingActionsResponse>('/api/personal-pending-actions?status=pending'),
                apiJson<PendingActionsResponse>('/api/personal-pending-actions?status=needs_review'),
            ])

            setPendingActions(pendingData.pendingActions)
            setNeedsReviewActions(reviewData.pendingActions)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar pendientes')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useDataInvalidation(['spaces', 'debts'], () => {
        void refresh({ silent: true })
    })

    return {
        pendingActions,
        needsReviewActions,
        loading,
        refreshing,
        error,
        refresh,
    }
}
