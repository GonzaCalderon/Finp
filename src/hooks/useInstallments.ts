import { useState, useEffect } from 'react'
import type { IInstallmentPlan } from '@/types'

export function useInstallments() {
    const [plans, setPlans] = useState<IInstallmentPlan[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchPlans = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/installments')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setPlans(data.plans)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar planes')
        } finally {
            setLoading(false)
        }
    }

    const createPlan = async (body: Partial<IInstallmentPlan>) => {
        const res = await fetch('/api/installments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchPlans()
        return data
    }

    const deletePlan = async (id: string) => {
        const res = await fetch(`/api/installments/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await fetchPlans()
    }

    useEffect(() => {
        fetchPlans()
    }, [])

    return { plans, loading, error, fetchPlans, createPlan, deletePlan }
}