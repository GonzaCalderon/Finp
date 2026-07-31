import type { Currency } from '@/lib/constants'

export type ProjectionMode = 'annual' | 'monthly'
export type ProjectionGrouping = 'type' | 'card' | 'category'
export type ProjectionItemKind = 'commitment' | 'card_single' | 'card_installment'
export type ProjectionCertainty = 'confirmed' | 'calculated' | 'estimated' | 'pending_amount'
export type ProjectionSourceType = 'scheduled_commitment' | 'installment_plan' | 'transaction'

export type ProjectionCurrencyTotals = {
    ars: number
    usd: number
}

export type ProjectionReference = {
    id: string
    name: string
    color?: string
}

export interface ProjectionItem {
    id: string
    sourceId: string
    source: {
        type: ProjectionSourceType
        id: string
    }
    kind: ProjectionItemKind
    description: string
    amount: number
    currency: Currency
    certainty: ProjectionCertainty
    isRegistered: boolean
    category?: ProjectionReference
    card?: ProjectionReference & { dueDay?: number }
    account?: ProjectionReference
    dueDate?: string
    purchaseDate?: string
    recurrence?: string
    occurrences?: number
    installment?: {
        current: number
        count: number
    }
    link: {
        href: string
        label: string
    }
}

export interface ProjectionTotals {
    commitments: ProjectionCurrencyTotals
    cardSingle: ProjectionCurrencyTotals
    cardInstallments: ProjectionCurrencyTotals
    estimated: ProjectionCurrencyTotals
    total: ProjectionCurrencyTotals
    pendingAmountCount: number
}

export interface ProjectionPeriod {
    month: string
    isCurrentMonth: boolean
    isPast: boolean
    items: ProjectionItem[]
    totals: ProjectionTotals
}

export interface ProjectionResponse {
    projection: ProjectionPeriod[]
    currentPeriod: string
}

export interface ProjectionGroup {
    key: string
    label: string
    totals: ProjectionCurrencyTotals
    href?: string
    linkLabel?: string
    children: ProjectionGroup[]
    items: ProjectionItem[]
}
