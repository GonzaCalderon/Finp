import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, SPACE_INVALIDATION_TAGS } from '@/lib/client/data-sync'
import type { ICategory, ISpaceCategory, ISpaceParticipant } from '@/types'
import type { SpacePersonalSettingsData } from '@/lib/validations'

export type SpacePersonalSettingsState = {
    settings: ISpaceParticipant['personalSettings'] | null
    suggestedStrategy: SpacePersonalSettingsData['categoryStrategy']
    virtualCategory?: ICategory | null
    spaceCategories: ISpaceCategory[]
    recommendation?: string | null
}

export function useSpacePersonalSettings(spaceId?: string) {
    const [state, setState] = useState<SpacePersonalSettingsState | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchSettings = useCallback(async (options?: { silent?: boolean }) => {
        if (!spaceId) return
        try {
            if (!options?.silent) setLoading(true)
            setError(null)
            const data = await apiJson<SpacePersonalSettingsState>(`/api/spaces/${spaceId}/personal-settings`)
            setState(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar Mi Finp')
        } finally {
            setLoading(false)
        }
    }, [spaceId])

    const saveSettings = useCallback(async (body: SpacePersonalSettingsData) => {
        if (!spaceId) throw new Error('Espacio inválido')
        const data = await apiJson<SpacePersonalSettingsState>(`/api/spaces/${spaceId}/personal-settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        setState((prev) => ({ ...prev, ...data }) as SpacePersonalSettingsState)
        invalidateData(SPACE_INVALIDATION_TAGS)
        return data
    }, [spaceId])

    const migrateVirtualCategory = useCallback(async (targetCategoryId: string) => {
        if (!spaceId) throw new Error('Espacio inválido')
        const data = await apiJson<{
            migratedTransactions: number
            migratedImpacts: number
            virtualCategoryId: string | null
        }>(`/api/spaces/${spaceId}/personal-settings/migrate-virtual-category`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetCategoryId }),
        })
        invalidateData(SPACE_INVALIDATION_TAGS)
        return data
    }, [spaceId])

    useEffect(() => {
        void fetchSettings()
    }, [fetchSettings])

    return {
        state,
        loading,
        error,
        fetchSettings,
        saveSettings,
        migrateVirtualCategory,
    }
}
