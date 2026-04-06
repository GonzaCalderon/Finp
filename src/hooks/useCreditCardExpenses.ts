import { useState, useEffect, useCallback } from 'react'
import type { IInstallmentPlan, ITransaction } from '@/types'
import {
    getInstallmentStatusForMonth,
    getRemainingDebtForMonth,
    getSingleCreditCardExpenseStatusForMonth,
} from '@/lib/utils/credit-card'
import { apiJson } from '@/lib/client/auth-client'
import {
    INSTALLMENT_INVALIDATION_TAGS,
    invalidateData,
    TRANSACTION_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'

export type InstallmentPlanWithTransaction = IInstallmentPlan & {
    parentTransaction?: ITransaction | null
}

export type InstallmentStatus =
    | { state: 'not_started'; label: 'Aún no inicia' }
    | { state: 'active'; label: string; current: number; total: number }
    | { state: 'finished'; label: 'Finalizado' }
export const getInstallmentStatus = getInstallmentStatusForMonth
export const getRemainingDebt = getRemainingDebtForMonth

export interface CreditCardExpenseItem {
    kind: 'plan'
    plan: InstallmentPlanWithTransaction
}

export interface SingleCCExpenseItem {
    kind: 'single'
    transaction: ITransaction
}

export type CCExpenseItem = CreditCardExpenseItem | SingleCCExpenseItem

function isFinished(item: CCExpenseItem, selectedMonth: string, monthStartDay: number): boolean {
    if (item.kind === 'plan') {
        const status = getInstallmentStatus(item.plan, selectedMonth)
        return status.state === 'finished'
    }
    const status = getSingleCreditCardExpenseStatusForMonth(item.transaction, selectedMonth, monthStartDay)
    return status.state === 'finished'
}

export function useCreditCardExpenses(selectedMonth: string, monthStartDay = 1) {
    const [plans, setPlans] = useState<InstallmentPlanWithTransaction[]>([])
    const [singleExpenses, setSingleExpenses] = useState<ITransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAll = useCallback(async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setLoading(true)
            }
            setError(null)

            const [plansData, txData] = await Promise.all([
                apiJson<{ plans?: InstallmentPlanWithTransaction[] }>('/api/installments'),
                apiJson<{ transactions?: ITransaction[] }>(
                    '/api/transactions?type=credit_card_expense&noInstallmentPlan=true&limit=200'
                ),
            ])

            setPlans(plansData.plans ?? [])
            setSingleExpenses(txData.transactions ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar gastos con TC')
        } finally {
            if (!options?.silent) {
                setLoading(false)
            }
        }
    }, [])

    const deletePlan = async (id: string) => {
        await apiJson(`/api/installments/${id}`, { method: 'DELETE' })
        invalidateData(INSTALLMENT_INVALIDATION_TAGS)
    }

    const deleteTransaction = async (id: string) => {
        await apiJson(`/api/transactions/${id}`, { method: 'DELETE' })
        invalidateData(TRANSACTION_INVALIDATION_TAGS)
    }

    useEffect(() => {
        fetchAll()
    }, [fetchAll])

    useDataInvalidation(['credit-card-expenses'], () => {
        void fetchAll({ silent: true })
    })

    // Build unified list
    const allItems: CCExpenseItem[] = [
        ...plans.map((plan): CreditCardExpenseItem => ({ kind: 'plan', plan })),
        ...singleExpenses.map((tx): SingleCCExpenseItem => ({ kind: 'single', transaction: tx })),
    ].sort((a, b) => {
        const aDate = a.kind === 'plan' ? new Date(a.plan.purchaseDate).getTime() : new Date(a.transaction.date).getTime()
        const bDate = b.kind === 'plan' ? new Date(b.plan.purchaseDate).getTime() : new Date(b.transaction.date).getTime()
        return bDate - aDate
    })

    return {
        allItems,
        plans,
        singleExpenses,
        loading,
        error,
        fetchAll,
        deletePlan,
        deleteTransaction,
        isFinished: (item: CCExpenseItem) => isFinished(item, selectedMonth, monthStartDay),
    }
}
