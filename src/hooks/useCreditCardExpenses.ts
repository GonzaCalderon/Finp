import { useState, useEffect, useCallback } from 'react'
import type { IInstallmentPlan, ITransaction } from '@/types'
import {
    getInstallmentStatusForMonth,
    getRemainingDebtForMonth,
    getSingleCreditCardExpenseStatusForMonth,
} from '@/lib/utils/credit-card'

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

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const [plansRes, txRes] = await Promise.all([
                fetch('/api/installments'),
                fetch('/api/transactions?type=credit_card_expense&noInstallmentPlan=true&limit=200'),
            ])

            const [plansData, txData] = await Promise.all([plansRes.json(), txRes.json()])

            if (!plansRes.ok) throw new Error(plansData.error || 'Error al cargar planes')
            if (!txRes.ok) throw new Error(txData.error || 'Error al cargar gastos con TC')

            setPlans(plansData.plans ?? [])
            setSingleExpenses(txData.transactions ?? [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar gastos con TC')
        } finally {
            setLoading(false)
        }
    }, [])

    const deletePlan = async (id: string) => {
        const res = await fetch(`/api/installments/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al eliminar plan')
        await fetchAll()
    }

    const deleteTransaction = async (id: string) => {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al eliminar transacción')
        await fetchAll()
    }

    useEffect(() => {
        fetchAll()
    }, [fetchAll])

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
