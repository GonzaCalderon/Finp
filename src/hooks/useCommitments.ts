import { useState, useEffect } from 'react'
import type { IScheduledCommitment } from '@/types'
import { apiJson } from '@/lib/client/auth-client'
import {
    COMMITMENT_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'

export function useCommitments() {
    const [commitments, setCommitments] = useState<IScheduledCommitment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCommitments = async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setLoading(true)
            }
            const data = await apiJson<{ commitments: IScheduledCommitment[] }>('/api/commitments')
            setCommitments(data.commitments)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar compromisos')
        } finally {
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }

    const createCommitment = async (body: Record<string, unknown>) => {
        const data = await apiJson<{ commitment: IScheduledCommitment }>('/api/commitments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(COMMITMENT_INVALIDATION_TAGS)
        return data.commitment
    }

    const updateCommitment = async (id: string, body: Record<string, unknown>) => {
        const data = await apiJson<{ commitment: IScheduledCommitment }>(`/api/commitments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(COMMITMENT_INVALIDATION_TAGS)
        return data.commitment
    }

    const deleteCommitment = async (id: string) => {
        await apiJson(`/api/commitments/${id}`, {
            method: 'DELETE',
        })
        invalidateData(COMMITMENT_INVALIDATION_TAGS)
    }

    useEffect(() => {
        fetchCommitments()
    }, [])

    useDataInvalidation(['commitments'], () => {
        void fetchCommitments({ silent: true })
    })

    return {
        commitments,
        loading,
        error,
        fetchCommitments,
        createCommitment,
        updateCommitment,
        deleteCommitment,
    }
}
