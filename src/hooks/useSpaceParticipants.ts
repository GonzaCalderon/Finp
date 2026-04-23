import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { ISpaceParticipant } from '@/types'
import type {
    SpaceParticipantFormData,
} from '@/lib/validations'

export function useSpaceParticipants(spaceId?: string) {
    const [participants, setParticipants] = useState<ISpaceParticipant[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchParticipants = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return

        try {
            if (options?.silent) {
                setRefreshing(true)
            } else {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<{ participants: ISpaceParticipant[] }>(
                `/api/spaces/${spaceId}/participants`
            )
            setParticipants(data.participants)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar participantes')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [spaceId])

    const addParticipant = useCallback(async (body: SpaceParticipantFormData) => {
        if (!spaceId) {
            throw new Error('Espacio inválido')
        }

        const data = await apiJson<{ participant: ISpaceParticipant }>(
            `/api/spaces/${spaceId}/participants`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        )

        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.participant
    }, [spaceId])

    const respondToInvite = useCallback(
        async (participantId: string, inviteStatus: 'accepted' | 'declined') => {
            if (!spaceId) {
                throw new Error('Espacio inválido')
            }

            const data = await apiJson<{ participant: ISpaceParticipant }>(
                `/api/spaces/${spaceId}/participants/${participantId}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ inviteStatus }),
                }
            )

            invalidateData(SPACE_INVALIDATION_TAGS)
            return data.participant
        },
        [spaceId]
    )

    useEffect(() => {
        if (!spaceId) return
        void fetchParticipants()
    }, [fetchParticipants, spaceId])

    useDataInvalidation(['spaces'], () => {
        if (!spaceId) return
        void fetchParticipants({ silent: true })
    })

    return {
        participants,
        loading,
        refreshing,
        error,
        fetchParticipants,
        addParticipant,
        respondToInvite,
    }
}
