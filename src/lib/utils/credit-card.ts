import type { IInstallmentPlan, ITransaction } from '@/types'
import { parseFinancialPeriod } from '@/lib/utils/period'
import {
    getOperationalStartFinancialPeriod,
    hasOperationalCoverage,
    isOnOrAfterOperationalStart,
} from '@/lib/utils/operational-start'

export type MonthlyInstallmentStatus =
    | { state: 'not_started'; label: 'Aún no inicia'; current: null; total: number }
    | { state: 'active'; label: string; current: number; total: number }
    | { state: 'finished'; label: 'Finalizado'; current: null; total: number }

export interface MonthlyCardChargeItem {
    kind: 'single' | 'installment'
    cardId: string
    cardName?: string
    cardColor?: string
    amount: number
    currency: string
    description: string
    categoryId?: string
    categoryName?: string
    categoryColor?: string
    purchaseDate: Date
    installmentNumber: number
    installmentCount: number
    sourceId: string
}

export interface MonthlyCardPaymentSummary {
    cardId: string
    cardName?: string
    cardColor?: string
    currency: string
    due: number
    paid: number
    pending: number
    items: MonthlyCardChargeItem[]
}

type RefLike = string | { _id?: { toString(): string }; name?: string; color?: string; currency?: string } | null | undefined

export const CREDIT_CARD_PAYMENT_TYPES = ['credit_card_payment', 'debt_payment'] as const

export function normalizeLegacyTransactionType(type?: string | null): string | undefined {
    if (!type) return undefined
    if (type === 'debt_payment') return 'credit_card_payment'
    return type
}

export function isCreditCardPaymentType(type?: string | null): boolean {
    return normalizeLegacyTransactionType(type) === 'credit_card_payment'
}

export function isCreditCardExpenseType(type?: string | null): boolean {
    return normalizeLegacyTransactionType(type) === 'credit_card_expense'
}

export function getRefId(value: RefLike): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value._id?.toString() ?? ''
}

export function getRefName(value: RefLike): string | undefined {
    if (!value || typeof value === 'string') return undefined
    return value.name
}

export function getRefColor(value: RefLike): string | undefined {
    if (!value || typeof value === 'string') return undefined
    return value.color
}

export function getRefCurrency(value: RefLike): string | undefined {
    if (!value || typeof value === 'string') return undefined
    return value.currency
}

export function isDateInFinancialPeriod(
    input: Date | string,
    period: string,
    monthStartDay = 1
): boolean {
    const date = input instanceof Date ? input : new Date(input)
    const { start, end } = parseFinancialPeriod(period, monthStartDay)
    return date >= start && date < end
}

export function getInstallmentIndexForMonth(plan: IInstallmentPlan, selectedMonth: string): number {
    const [sy, sm] = plan.firstClosingMonth.split('-').map(Number)
    const [cy, cm] = selectedMonth.split('-').map(Number)
    return (cy - sy) * 12 + (cm - sm)
}

export function getInstallmentStatusForMonth(
    plan: IInstallmentPlan,
    selectedMonth: string
): MonthlyInstallmentStatus {
    const diff = getInstallmentIndexForMonth(plan, selectedMonth)

    if (diff < 0) {
        return {
            state: 'not_started',
            label: 'Aún no inicia',
            current: null,
            total: plan.installmentCount,
        }
    }

    if (diff >= plan.installmentCount) {
        return {
            state: 'finished',
            label: 'Finalizado',
            current: null,
            total: plan.installmentCount,
        }
    }

    return {
        state: 'active',
        label: `Cuota ${diff + 1}/${plan.installmentCount}`,
        current: diff + 1,
        total: plan.installmentCount,
    }
}

export function getSingleCreditCardExpenseStatusForMonth(
    transaction: ITransaction,
    selectedMonth: string,
    monthStartDay = 1
): MonthlyInstallmentStatus {
    if (isDateInFinancialPeriod(transaction.date, selectedMonth, monthStartDay)) {
        return {
            state: 'active',
            label: 'Cuota 1/1',
            current: 1,
            total: 1,
        }
    }

    const { start } = parseFinancialPeriod(selectedMonth, monthStartDay)
    const txDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date)

    if (txDate >= start) {
        return {
            state: 'not_started',
            label: 'Aún no inicia',
            current: null,
            total: 1,
        }
    }

    return {
        state: 'finished',
        label: 'Finalizado',
        current: null,
        total: 1,
    }
}

export function getRemainingDebtForMonth(plan: IInstallmentPlan, selectedMonth: string): number {
    const status = getInstallmentStatusForMonth(plan, selectedMonth)
    if (status.state === 'finished') return 0
    if (status.state === 'not_started') return plan.totalAmount
    const paidInstallments = status.current - 1
    return plan.installmentAmount * (plan.installmentCount - paidInstallments)
}

export function buildMonthlyCardPaymentSummary(params: {
    month: string
    monthStartDay?: number
    plans: IInstallmentPlan[]
    transactions: ITransaction[]
    operationalStartDate?: string | Date
}): MonthlyCardPaymentSummary[] {
    const { month, monthStartDay = 1, plans, transactions, operationalStartDate } = params
    const summaryByCard = new Map<string, MonthlyCardPaymentSummary>()
    const { start, end } = parseFinancialPeriod(month, monthStartDay)

    if (!hasOperationalCoverage(start, end, operationalStartDate)) {
        return []
    }

    const operationalStartPeriod = getOperationalStartFinancialPeriod(operationalStartDate, monthStartDay)

    const ensureCard = (args: {
        cardId: string
        cardName?: string
        cardColor?: string
        currency?: string
    }) => {
        if (!args.cardId) return null
        const existing = summaryByCard.get(args.cardId)
        if (existing) return existing

        const created: MonthlyCardPaymentSummary = {
            cardId: args.cardId,
            cardName: args.cardName,
            cardColor: args.cardColor,
            currency: args.currency ?? 'ARS',
            due: 0,
            paid: 0,
            pending: 0,
            items: [],
        }
        summaryByCard.set(args.cardId, created)
        return created
    }

    for (const plan of plans) {
        if (operationalStartPeriod) {
            const operationalDiff = getInstallmentIndexForMonth(plan, operationalStartPeriod)
            const selectedDiff = getInstallmentIndexForMonth(plan, month)
            if (selectedDiff < Math.max(0, operationalDiff)) continue
        }

        const status = getInstallmentStatusForMonth(plan, month)
        if (status.state !== 'active') continue

        const cardId = getRefId(plan.accountId)
        const summary = ensureCard({
            cardId,
            cardName: getRefName(plan.accountId),
            cardColor: getRefColor(plan.accountId),
            currency: plan.currency,
        })

        if (!summary) continue

        summary.due += plan.installmentAmount
        summary.items.push({
            kind: 'installment',
            cardId,
            cardName: summary.cardName,
            cardColor: summary.cardColor,
            amount: plan.installmentAmount,
            currency: plan.currency,
            description: plan.description,
            categoryId: getRefId(plan.categoryId),
            categoryName: getRefName(plan.categoryId),
            categoryColor: getRefColor(plan.categoryId),
            purchaseDate: plan.purchaseDate instanceof Date ? plan.purchaseDate : new Date(plan.purchaseDate),
            installmentNumber: status.current ?? 1,
            installmentCount: plan.installmentCount,
            sourceId: plan._id.toString(),
        })
    }

    for (const transaction of transactions) {
        const normalizedType = normalizeLegacyTransactionType(transaction.type)
        if (normalizedType === 'credit_card_expense' && !transaction.installmentPlanId) {
            if (!isOnOrAfterOperationalStart(transaction.date, operationalStartDate)) continue
            if (!isDateInFinancialPeriod(transaction.date, month, monthStartDay)) continue

            const cardId = getRefId(transaction.sourceAccountId)
            const summary = ensureCard({
                cardId,
                cardName: getRefName(transaction.sourceAccountId),
                cardColor: getRefColor(transaction.sourceAccountId),
                currency: transaction.currency,
            })

            if (!summary) continue

            summary.due += transaction.amount
            summary.items.push({
                kind: 'single',
                cardId,
                cardName: summary.cardName,
                cardColor: summary.cardColor,
                amount: transaction.amount,
                currency: transaction.currency,
                description: transaction.description,
                categoryId: getRefId(transaction.categoryId),
                categoryName: getRefName(transaction.categoryId),
                categoryColor: getRefColor(transaction.categoryId),
                purchaseDate: transaction.date instanceof Date ? transaction.date : new Date(transaction.date),
                installmentNumber: 1,
                installmentCount: 1,
                sourceId: transaction._id.toString(),
            })
        }

        if (isCreditCardPaymentType(normalizedType)) {
            if (!isOnOrAfterOperationalStart(transaction.date, operationalStartDate)) continue
            if (!isDateInFinancialPeriod(transaction.date, month, monthStartDay)) continue

            const cardId = getRefId(transaction.destinationAccountId)
            const summary = ensureCard({
                cardId,
                cardName: getRefName(transaction.destinationAccountId),
                cardColor: getRefColor(transaction.destinationAccountId),
                currency: getRefCurrency(transaction.destinationAccountId) ?? transaction.currency,
            })

            if (!summary) continue
            summary.paid += transaction.amount
        }
    }

    return Array.from(summaryByCard.values())
        .map((summary) => ({
            ...summary,
            pending: Math.max(0, summary.due - summary.paid),
            items: summary.items.sort((a, b) => a.installmentNumber - b.installmentNumber),
        }))
        .sort((a, b) => b.due - a.due)
}
