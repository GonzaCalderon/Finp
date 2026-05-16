import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, SPACE_INVALIDATION_TAGS } from '@/lib/client/data-sync'

export type SpaceInviteLinkState = {
    hasActiveInvite: boolean
    invite: {
        id?: string
        hasActiveInvite: boolean
        expiresAt?: string
        usedCount: number
        createdAt?: string
        tokenPreview?: string
        tokenAvailable: boolean
    } | null
    inviteUrl?: string | null
    tokenAvailable: boolean
}

export function useSpaceInvites(spaceId?: string) {
    const [state, setState] = useState<SpaceInviteLinkState | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchState = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return
        try {
            if (!options?.silent) setLoading(true)
            setError(null)
            const data = await apiJson<SpaceInviteLinkState>(`/api/spaces/${spaceId}/invites`)
            setState(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar invitaciones')
        } finally {
            setLoading(false)
        }
    }, [spaceId])

    const createLink = useCallback(async (body: { expiresInDays?: 1 | 3 | 7; regenerate?: boolean }) => {
        if (!spaceId) throw new Error('Espacio inválido')

        const data = await apiJson<SpaceInviteLinkState>(`/api/spaces/${spaceId}/invites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        setState(data)
        invalidateData(SPACE_INVALIDATION_TAGS)
        return data
    }, [spaceId])

    const revokeLink = useCallback(async (inviteId: string) => {
        if (!spaceId) throw new Error('Espacio inválido')

        await apiJson(`/api/spaces/${spaceId}/invites/${inviteId}`, {
            method: 'DELETE',
        })
        await fetchState({ silent: true })
        invalidateData(SPACE_INVALIDATION_TAGS)
    }, [fetchState, spaceId])

    useEffect(() => {
        void fetchState()
    }, [fetchState])

    return {
        state,
        loading,
        error,
        fetchState,
        createLink,
        revokeLink,
    }
}
