'use client'

import { useCallback, useRef, useState } from 'react'

import { ApiError, apiJson } from '@/lib/client/auth-client'
import type { SpaceEntryDraftDto } from '@/types'

type DraftFields = SpaceEntryDraftDto['fields']
type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

function draftFingerprint(step: 1 | 2 | 3, fields: DraftFields) {
    return JSON.stringify({ step, fields })
}

export function useSpaceEntryDraft({
    spaceId,
    expectedSpaceRevision,
}: {
    spaceId: string
    expectedSpaceRevision: number
}) {
    const [draft, setDraftState] = useState<SpaceEntryDraftDto | null>(null)
    const [loading, setLoading] = useState(false)
    const [saveState, setSaveState] = useState<DraftSaveState>('idle')
    const [error, setError] = useState<string | null>(null)
    const draftRef = useRef<SpaceEntryDraftDto | null>(null)
    const lastSavedFingerprintRef = useRef<string | null>(null)
    const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

    const setDraft = useCallback((next: SpaceEntryDraftDto | null) => {
        draftRef.current = next
        setDraftState(next)
        lastSavedFingerprintRef.current = next
            ? draftFingerprint(next.step, next.fields)
            : null
    }, [])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await apiJson<{ data: SpaceEntryDraftDto | null }>(
                `/api/spaces/${spaceId}/entry-draft`
            )
            setDraft(response.data)
            setSaveState(response.data ? 'saved' : 'idle')
            return response.data
        } catch (loadError) {
            const message = loadError instanceof Error
                ? loadError.message
                : 'No pudimos recuperar el borrador.'
            setError(message)
            setSaveState('error')
            throw loadError
        } finally {
            setLoading(false)
        }
    }, [setDraft, spaceId])

    const save = useCallback((fields: DraftFields, step: 1 | 2 | 3) => {
        const fingerprint = draftFingerprint(step, fields)
        if (lastSavedFingerprintRef.current === fingerprint && draftRef.current) {
            return Promise.resolve(draftRef.current)
        }

        let resolveSave!: (value: SpaceEntryDraftDto) => void
        let rejectSave!: (reason?: unknown) => void
        const result = new Promise<SpaceEntryDraftDto>((resolve, reject) => {
            resolveSave = resolve
            rejectSave = reject
        })

        saveQueueRef.current = saveQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                const current = draftRef.current
                if (lastSavedFingerprintRef.current === fingerprint && current) {
                    resolveSave(current)
                    return
                }

                setSaveState('saving')
                setError(null)
                try {
                    const response = await apiJson<{ data: SpaceEntryDraftDto }>(
                        `/api/spaces/${spaceId}/entry-draft`,
                        {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                draftId: current?.id,
                                expectedRevision: current?.revision,
                                expectedSpaceRevision,
                                step,
                                fields,
                            }),
                        }
                    )
                    setDraft(response.data)
                    lastSavedFingerprintRef.current = fingerprint
                    setSaveState('saved')
                    resolveSave(response.data)
                } catch (saveError) {
                    const message = saveError instanceof Error
                        ? saveError.message
                        : 'No pudimos guardar el borrador.'
                    setError(message)
                    setSaveState(
                        saveError instanceof ApiError && saveError.status === 409
                            ? 'conflict'
                            : 'error'
                    )
                    rejectSave(saveError)
                }
            })

        return result
    }, [expectedSpaceRevision, setDraft, spaceId])

    const discard = useCallback(() => {
        const operation = saveQueueRef.current
            .catch(() => undefined)
            .then(async () => {
                const current = draftRef.current
                if (!current) return null
                const response = await apiJson<{ data: SpaceEntryDraftDto }>(
                    `/api/spaces/${spaceId}/entry-draft`,
                    {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            draftId: current.id,
                            expectedRevision: current.revision,
                        }),
                    }
                )
                setDraft(null)
                setSaveState('idle')
                setError(null)
                return response.data
            })
        saveQueueRef.current = operation.then(() => undefined, () => undefined)
        return operation
    }, [setDraft, spaceId])

    return {
        draft,
        loading,
        saveState,
        error,
        load,
        save,
        discard,
        setDraft,
    }
}
