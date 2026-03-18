import { useState, useEffect } from 'react'
import type { IScheduledCommitment } from '@/types'

export function useCommitments() {
    const [commitments, setCommitments] = useState<IScheduledCommitment[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchCommitments = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/commitments')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setCommitments(data.commitments)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar compromisos')
        } finally {
            setLoading(false)
        }
    }

    const createCommitment = async (body: Partial<IScheduledCommitment>) => {
        const res = await fetch('/api/commitments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCommitments()
        return data.commitment
    }

    const updateCommitment = async (id: string, body: Partial<IScheduledCommitment>) => {
        const res = await fetch(`/api/commitments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCommitments()
        return data.commitment
    }

    const deleteCommitment = async (id: string) => {
        const res = await fetch(`/api/commitments/${id}`, {
            method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchCommitments()
    }

    useEffect(() => {
        fetchCommitments()
    }, [])

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