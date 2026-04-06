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
]

export const INSTALLMENT_INVALIDATION_TAGS: DataTag[] = [
    'credit-card-expenses',
    'dashboard',
    'projection',
    'accounts',
    'account-detail',
]

export const COMMITMENT_INVALIDATION_TAGS: DataTag[] = [
    'commitments',
    'dashboard',
    'projection',
    'transactions',
    'accounts',
]

export const ACCOUNT_INVALIDATION_TAGS: DataTag[] = [
    'accounts',
    'account-detail',
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'commitments',
    'preferences',
]

export const CATEGORY_INVALIDATION_TAGS: DataTag[] = [
    'categories',
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'rules',
    'settings',
]

export const RULE_INVALIDATION_TAGS: DataTag[] = ['rules']

export const PREFERENCE_INVALIDATION_TAGS: DataTag[] = [
    'preferences',
    'dashboard',
    'transactions',
    'credit-card-expenses',
    'projection',
]

export const ALL_DATA_TAGS: DataTag[] = [...DATA_TAGS]
