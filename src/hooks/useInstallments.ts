import { useState, useEffect } from 'react'
import type { IInstallmentPlan } from '@/types'
import type { InstallmentFormData } from '@/lib/validations'
import { apiJson } from '@/lib/client/auth-client'
import {
    INSTALLMENT_INVALIDATION_TAGS,
    invalidateData,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'

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

    const fetchPlans = async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setLoading(true)
            }
            setError(null)

            const data = await apiJson<InstallmentsResponse>('/api/installments')
            setPlans(data.plans)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar planes')
        } finally {
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }

    const createPlan = async (body: InstallmentFormData) => {
        const data = await apiJson<CreatePlanResponse>('/api/installments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(INSTALLMENT_INVALIDATION_TAGS)
        return data.plan
    }

    const updatePlan = async (id: string, body: InstallmentFormData) => {
        const data = await apiJson<CreatePlanResponse>(`/api/installments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        invalidateData(INSTALLMENT_INVALIDATION_TAGS)
        return data.plan
    }

    const deletePlan = async (id: string) => {
        await apiJson(`/api/installments/${id}`, {
            method: 'DELETE',
        })
        invalidateData(INSTALLMENT_INVALIDATION_TAGS)
    }

    useEffect(() => {
        fetchPlans()
    }, [])

    useDataInvalidation(['credit-card-expenses'], () => {
        void fetchPlans({ silent: true })
    })

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
