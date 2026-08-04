import type { Currency } from '@/lib/constants'

export type ProjectionMode = 'annual' | 'monthly'
export type ProjectionGrouping = 'type' | 'card' | 'category'
export type ProjectionItemKind = 'commitment' | 'card_single' | 'card_installment' | 'hypothetical'
export type ProjectionCertainty = 'confirmed' | 'calculated' | 'estimated' | 'pending_amount'
export type ProjectionSourceType = 'scheduled_commitment' | 'installment_plan' | 'transaction' | 'hypothetical'
export type ProjectionScenarioState = 'modified' | 'omitted' | 'moved' | 'hypothetical'

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
    link?: {
        href: string
        label: string
    }
    simulation?: {
        state: ProjectionScenarioState
        changeId: string
        originalAmount?: number
        originalMonth?: string
        destinationMonth?: string
    }
}

export interface ProjectionTotals {
    commitments: ProjectionCurrencyTotals
    cardSingle: ProjectionCurrencyTotals
    cardInstallments: ProjectionCurrencyTotals
    hypothetical: ProjectionCurrencyTotals
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
    ownerId?: string
}

export type ProjectionScenarioTarget = {
    sourceType: Exclude<ProjectionSourceType, 'hypothetical'>
    sourceId: string
    period: string
}

export type ProjectionScenarioAdjustChange = {
    id: string
    type: 'adjust'
    target: ProjectionScenarioTarget
    scope: 'occurrence' | 'forward'
    amount: number
    destinationPeriod?: string
}

export type ProjectionScenarioOmitChange = {
    id: string
    type: 'omit'
    target: ProjectionScenarioTarget
    scope: 'occurrence' | 'forward'
}

export type ProjectionScenarioHypotheticalChange = {
    id: string
    type: 'hypothetical'
    description: string
    amount: number
    currency: Currency
    categoryId?: string
    expense:
        | {
            type: 'commitment'
            recurrence:
                | { type: 'once'; date: string }
                | { type: 'weekly'; startDate: string; endDate?: string }
                | { type: 'monthly'; dayOfMonth: number; startDate: string; endDate?: string }
        }
        | {
            type: 'card_single'
            accountId: string
            purchaseDate: string
            firstClosingMonth: string
        }
        | {
            type: 'card_installment'
            accountId: string
            purchaseDate: string
            firstClosingMonth: string
            installmentCount: number
        }
}

export type ProjectionScenarioChange =
    | ProjectionScenarioAdjustChange
    | ProjectionScenarioOmitChange
    | ProjectionScenarioHypotheticalChange

export type ProjectionScenarioWarning = {
    changeId: string
    code: 'source_missing' | 'outside_horizon' | 'past_period'
    message: string
}

export type ProjectionScenarioPeriodComparison = {
    month: string
    base: ProjectionCurrencyTotals
    scenario: ProjectionCurrencyTotals
    difference: ProjectionCurrencyTotals
}

export interface ProjectionScenarioResponse {
    base: ProjectionResponse
    scenario: ProjectionResponse
    comparison: {
        periods: ProjectionScenarioPeriodComparison[]
        horizon: {
            base: ProjectionCurrencyTotals
            scenario: ProjectionCurrencyTotals
            difference: ProjectionCurrencyTotals
        }
        changeCount: number
    }
    warnings: ProjectionScenarioWarning[]
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
