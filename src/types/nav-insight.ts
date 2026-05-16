export type NavInsightType =
    | 'notification'
    | 'pending'
    | 'debt'
    | 'space'
    | 'commitment'
    | 'summary'
    | 'empty'

export type NavInsightTone = 'sky' | 'green' | 'amber' | 'red' | 'purple' | 'muted'

export type NavInsight = {
    id: string
    type: NavInsightType
    priority: number
    title: string
    description?: string
    href?: string
    icon?: string
    tone?: NavInsightTone
    count?: number
}

export type NavInsightsResponse = {
    insights: NavInsight[]
    generatedAt: string
}
