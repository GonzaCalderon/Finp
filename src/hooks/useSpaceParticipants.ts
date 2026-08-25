import { useCallback, useEffect, useState } from 'react'

import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, SPACE_INVALIDATION_TAGS } from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type {
    ISpaceParticipant,
    SpaceDetailDto,
    SpaceMutationResultDto,
    SpaceParticipantDto,
} from '@/types'
import type { SpaceParticipantFormData } from '@/lib/validations'

function participantDtoForUi(participant: SpaceParticipantDto, spaceId: string) {
    return {
        _id: participant.id,
        spaceId,
        kind: participant.kind,
        userId: participant.userId,
        displayName: participant.displayName,
        role: participant.role,
        inviteStatus: participant.inviteStatus,
        isActive: participant.isActive,
        revision: participant.revision,
    } as unknown as ISpaceParticipant
}

export function useSpaceParticipants(spaceId?: string, spaceApi?: SpaceDetailDto) {
    const [participants, setParticipants] = useState<ISpaceParticipant[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchParticipants = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return
        try {
            if (options?.silent) setRefreshing(true)
            else setLoading(true)
            setError(null)
            const data = await apiJson<{
                data?: SpaceParticipantDto[]
                participants?: ISpaceParticipant[]
            }>(`/api/spaces/${spaceId}/participants`)
            setParticipants(data.data
                ? data.data.map((participant) => participantDtoForUi(participant, spaceId))
                : data.participants ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar participantes')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [spaceId])

    const addParticipant = useCallback(async (body: SpaceParticipantFormData) => {
        if (!spaceId) throw new Error('Espacio inválido')
        if (spaceApi?.sourceContract === 'v2') {
            const result = await apiJson<SpaceMutationResultDto<{ participantId: string }>>(
                `/api/spaces/${spaceId}/participants`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify({ ...body, expectedRevision: spaceApi.space.revision }),
                }
            )
            invalidateData(SPACE_INVALIDATION_TAGS)
            return { _id: result.data.participantId } as unknown as ISpaceParticipant
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
    }, [spaceApi, spaceId])

    const respondToInvite = useCallback(async (
        participantId: string,
        inviteStatus: 'accepted' | 'declined'
    ) => {
        if (!spaceId) throw new Error('Espacio inválido')
        if (spaceApi?.sourceContract === 'v2') {
            const participant = spaceApi.participants.find((item) => item.id === participantId)
            const result = await apiJson<SpaceMutationResultDto<unknown>>(
                `/api/spaces/${spaceId}/participants/${participantId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify({
                        intent: 'invite_response',
                        expectedParticipantRevision: participant?.revision ?? 0,
                        inviteStatus,
                    }),
                }
            )
            invalidateData(SPACE_INVALIDATION_TAGS)
            return result.data as ISpaceParticipant
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
    }, [spaceApi, spaceId])

    const updateParticipantRole = useCallback(async (
        participantId: string,
        role: 'admin' | 'participant'
    ) => {
        if (!spaceId) throw new Error('Espacio inválido')
        if (spaceApi?.sourceContract === 'v2') {
            const participant = spaceApi.participants.find((item) => item.id === participantId)
            const result = await apiJson<SpaceMutationResultDto<unknown>>(
                `/api/spaces/${spaceId}/participants/${participantId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Idempotency-Key': crypto.randomUUID(),
                    },
                    body: JSON.stringify({
                        intent: 'role',
                        expectedParticipantRevision: participant?.revision ?? 0,
                        role,
                    }),
                }
            )
            invalidateData(SPACE_INVALIDATION_TAGS)
            return result.data as ISpaceParticipant
        }
        const data = await apiJson<{ participant: ISpaceParticipant }>(
            `/api/spaces/${spaceId}/participants/${participantId}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
            }
        )
        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.participant
    }, [spaceApi, spaceId])

    const removeParticipant = useCallback(async (participantId: string) => {
        if (!spaceId) throw new Error('Espacio inválido')
        if (spaceApi?.sourceContract === 'v2') {
            const participant = spaceApi.participants.find((item) => item.id === participantId)
            const result = await apiJson<SpaceMutationResultDto<unknown>>(
                `/api/spaces/${spaceId}/participants/${participantId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Idempotency-Key': crypto.randomUUID(),
                        'Expected-Revision': String(participant?.revision ?? 0),
                    },
                }
            )
            invalidateData(SPACE_INVALIDATION_TAGS)
            return result.data as ISpaceParticipant
        }
        const data = await apiJson<{ participant: ISpaceParticipant }>(
            `/api/spaces/${spaceId}/participants/${participantId}`,
            { method: 'DELETE' }
        )
        invalidateData(SPACE_INVALIDATION_TAGS)
        return data.participant
    }, [spaceApi, spaceId])

    useEffect(() => {
        if (spaceId) void fetchParticipants()
    }, [fetchParticipants, spaceId])

    useDataInvalidation(['spaces'], () => {
        if (spaceId) void fetchParticipants({ silent: true })
    })

    return {
        participants,
        loading,
        refreshing,
        error,
        fetchParticipants,
        addParticipant,
        respondToInvite,
        updateParticipantRole,
        removeParticipant,
    }
}
