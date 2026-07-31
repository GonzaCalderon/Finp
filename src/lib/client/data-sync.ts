'use client'

export const DATA_TAGS = [
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'accounts',
    'account-detail',
    'commitments',
    'projection',
    'rules',
    'categories',
    'preferences',
    'settings',
    'spaces',
    'debts',
    'personal-pending-actions',
    'notifications',
    'nav-insights',
] as const

export type DataTag = (typeof DATA_TAGS)[number]

type InvalidationListener = (tags: Set<DataTag>) => void

const listeners = new Set<InvalidationListener>()

export function subscribeToInvalidation(listener: InvalidationListener) {
    listeners.add(listener)

    return () => {
        listeners.delete(listener)
    }
}

export function invalidateData(tags: readonly DataTag[]) {
    if (tags.length === 0) return

    const invalidatedTags = new Set(tags)
    listeners.forEach((listener) => {
        listener(invalidatedTags)
    })
}

export function matchesInvalidation(
    watchedTags: readonly DataTag[],
    invalidatedTags: ReadonlySet<DataTag>
) {
    return watchedTags.some((tag) => invalidatedTags.has(tag))
}

export const TRANSACTION_INVALIDATION_TAGS: DataTag[] = [
    'transactions',
    'dashboard',
    'accounts',
    'account-detail',
    'credit-card-expenses',
    'nav-insights',
    'projection',
]

export const INSTALLMENT_INVALIDATION_TAGS: DataTag[] = [
    'credit-card-expenses',
    'transactions',
    'dashboard',
    'projection',
    'accounts',
    'account-detail',
    'nav-insights',
]

export const COMMITMENT_INVALIDATION_TAGS: DataTag[] = [
    'commitments',
    'dashboard',
    'projection',
    'transactions',
    'accounts',
    'account-detail',
    'nav-insights',
]

export const ACCOUNT_INVALIDATION_TAGS: DataTag[] = [
    'accounts',
    'account-detail',
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'commitments',
    'preferences',
    'projection',
]

export const CATEGORY_INVALIDATION_TAGS: DataTag[] = [
    'categories',
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'rules',
    'settings',
    'projection',
]

// Incluye 'transactions' porque cada movimiento muestra la regla que lo completó:
// sin esto, renombrar o borrar una regla dejaba los pills de procedencia obsoletos.
export const RULE_INVALIDATION_TAGS: DataTag[] = ['rules', 'transactions']

export const PREFERENCE_INVALIDATION_TAGS: DataTag[] = [
    'preferences',
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'projection',
]

export const PERSONAL_PENDING_ACTIONS_INVALIDATION_TAGS: DataTag[] = [
    'personal-pending-actions',
    'notifications',
    'nav-insights',
]

export const NOTIFICATION_INVALIDATION_TAGS: DataTag[] = ['notifications', 'nav-insights']

export const SPACE_INVALIDATION_TAGS: DataTag[] = [
    'spaces',
    'debts',
    'transactions',
    'dashboard',
    'accounts',
    'account-detail',
    'personal-pending-actions',
    'notifications',
    'nav-insights',
]

export const ALL_DATA_TAGS: DataTag[] = [...DATA_TAGS]

export const DEBT_INVALIDATION_TAGS: DataTag[] = [
    'debts',
    'spaces',
    'transactions',
    'dashboard',
    'accounts',
    'account-detail',
    'personal-pending-actions',
    'notifications',
    'nav-insights',
]
