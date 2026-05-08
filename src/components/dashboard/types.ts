import type { ReactNode } from 'react'

export interface CommitmentItem {
    _id: string
    description: string
    amount: number
    currency: string
    dayOfMonth?: number
}

export interface DashboardCurrencyTotals {
    ars: number
    usd: number
}

export interface DashboardSummaryData {
    totalIncome: DashboardCurrencyTotals
    totalExpense: DashboardCurrencyTotals
    balance: DashboardCurrencyTotals
    totalDebt: DashboardCurrencyTotals
    totalCreditCardExpense: DashboardCurrencyTotals
    totalMonthlyCommitments: DashboardCurrencyTotals
    operationalStartDate?: string
}

export interface DashboardTrendData {
    income: number | null
    expense: number | null
    balance: number | null
    debt: number | null
}

export interface DashboardExpenseCategory {
    key: string
    name: string
    color?: string
    ars: number
    usd: number
}

export interface DashboardAccount {
    _id: string
    name: string
    institution?: string
    type: string
    currency: string
    supportedCurrencies?: string[]
    includeInNetWorth: boolean
    balance: number
    balancesByCurrency: { ARS: number; USD: number }
    color?: string
    creditCardConfig?: {
        closingDay?: number
        dueDay?: number
        creditLimit?: number
    }
}

export interface DashboardInstallmentItem {
    _id: string
    description: string
    installmentAmount: number
    currency: string
    firstClosingMonth: string
    installmentCount: number
    installmentNumber?: number
}

export interface DashboardCreditCard {
    accountId: string
    name: string
    institution?: string
    processor?: string
    color?: string
    currency: string
    supportedCurrencies?: string[]
    balancesByCurrency: { ARS: number; USD: number }
    monthlyDue: DashboardCurrencyTotals
    monthlyPaid: DashboardCurrencyTotals
    monthlyPending: DashboardCurrencyTotals
    activeInstallments: number
    activeCharges: number
    latestPurchaseDate?: string
}

export interface DashboardRecentTransaction {
    _id: string
    type: string
    description: string
    amount: number
    currency: string
    date: string
    impact: 'positive' | 'negative' | 'neutral'
    merchant?: string
    category?: {
        key: string
        name: string
        color?: string
    } | null
    primaryAccount?: {
        _id: string
        name: string
        color?: string
    } | null
    sourceAccount?: {
        _id: string
        name: string
        color?: string
    } | null
    destinationAccount?: {
        _id: string
        name: string
        color?: string
    } | null
    installmentCount?: number
    spaceId?: string
    spaceNameSnapshot?: string
    totalAmount?: number
}

export interface DashboardData {
    month: string
    summary: DashboardSummaryData
    trends: DashboardTrendData
    expenseByCategory: DashboardExpenseCategory[]
    accounts: DashboardAccount[]
    netWorth: {
        assets: DashboardCurrencyTotals
        liabilities: DashboardCurrencyTotals
        total: DashboardCurrencyTotals
    }
    pendingCommitments: CommitmentItem[]
    installmentsThisMonth: DashboardInstallmentItem[]
    creditCards: DashboardCreditCard[]
    recentTransactions: DashboardRecentTransaction[]
}

export interface DashboardMonthOption {
    value: string
    label: string
}

export interface DashboardViewProps {
    data: DashboardData
    month: string
    monthOptions: DashboardMonthOption[]
    refreshing: boolean
    hidden: boolean
    onMonthChange: (month: string) => void
    onApplyCommitment: (commitment: CommitmentItem) => void
    appliedId: string | null
    operationalStartConfigured: boolean
    headerSlot?: ReactNode
}
