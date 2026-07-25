import { useCallback, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import type { CommitmentSuggestion } from '@/lib/utils/commitment-suggestions'

export function useCommitmentSuggestions() {
    const [suggestions, setSuggestions] = useState<CommitmentSuggestion[]>([])
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        try {
            const data = await apiJson<{ suggestions: CommitmentSuggestion[] }>(
                '/api/commitments/suggestions'
            )
            setSuggestions(data.suggestions)
        } catch {
            // Las sugerencias reducen trabajo, pero nunca deben bloquear Compromisos.
            setSuggestions([])
        } finally {
            setLoading(false)
        }
    }, [])

    const dismiss = useCallback(async (suggestion: CommitmentSuggestion) => {
        await apiJson('/api/quick-capture/suggestions/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                intent: 'create_commitment',
                subjectKey: suggestion.subjectKey,
            }),
        })
        setSuggestions((current) =>
            current.filter((item) => item.subjectKey !== suggestion.subjectKey)
        )
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    return { suggestions, loading, refresh, dismiss }
}
