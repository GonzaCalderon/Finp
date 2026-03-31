import { useState, useEffect } from 'react'
import type { IInstallmentPlan } from '@/types'
import type { InstallmentFormData } from '@/lib/validations'

interface InstallmentsResponse {
    plans: IInstallmentPlan[]
}

interface CreatePlanResponse {
    plan: IInstallmentPlan
}

export function useInstallments() {
    const [plans, setPlans] = useState<IInstallmentPlan[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchPlans = async () => {
        try {
            setLoading(true)
            setError(null)

            const res = await fetch('/api/installments')
            const data: InstallmentsResponse & { error?: string } = await res.json()

            if (!res.ok) throw new Error(data.error || 'Error al cargar planes')

            setPlans(data.plans)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar planes')
        } finally {
            setLoading(false)
        }
    }

    const createPlan = async (body: InstallmentFormData) => {
        const res = await fetch('/api/installments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const data: CreatePlanResponse & { error?: string } = await res.json()

        if (!res.ok) throw new Error(data.error || 'Error al crear plan de cuotas')

        await fetchPlans()
        return data.plan
    }

    const updatePlan = async (id: string, body: InstallmentFormData) => {
        const res = await fetch(`/api/installments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const data: CreatePlanResponse & { error?: string } = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al actualizar plan de cuotas')

        await fetchPlans()
        return data.plan
    }

    const deletePlan = async (id: string) => {
        const res = await fetch(`/api/installments/${id}`, {
            method: 'DELETE',
        })

        const data: { error?: string } = await res.json()

        if (!res.ok) throw new Error(data.error || 'Error al eliminar plan de cuotas')

        await fetchPlans()
    }

    useEffect(() => {
        fetchPlans()
    }, [])

    return {
        plans,
        loading,
        error,
        fetchPlans,
        createPlan,
        updatePlan,
        deletePlan,
    }
}
