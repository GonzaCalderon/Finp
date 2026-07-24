import type { TransactionFormInput } from '@/lib/validations'

export type PaymentMethod = 'cash' | 'debit' | 'credit_card'
export type RecentCategoryType = 'income' | 'expense'

export type DialogAccountContext =
    | 'income:destination'
    | 'expense:cash'
    | 'expense:debit'
    | 'expense:credit_card'
    | 'transfer:source'
    | 'transfer:destination'
    | 'exchange:source'
    | 'exchange:destination'
    | 'credit_card_payment:source'
    | 'credit_card_payment:destination'
    | 'adjustment:source'

type StoredDialogPrefs = {
    lastType?: TransactionFormInput['type']
    lastExpensePaymentMethod?: PaymentMethod
    accounts?: Partial<Record<DialogAccountContext, string>>
    recentCategories?: Partial<Record<RecentCategoryType, string[]>>
    descriptionAliases?: Record<string, DescriptionAlias>
}

const STORAGE_KEY = 'finp-transaction-dialog-prefs'
const MAX_RECENT_CATEGORIES = 6
const MAX_DESCRIPTION_ALIASES = 50
const VALID_TYPES: TransactionFormInput['type'][] = [
    'income',
    'expense',
    'credit_card_expense',
    'transfer',
    'exchange',
    'credit_card_payment',
    'debt_payment',
    'adjustment',
]

function canUseStorage() {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isValidType(value: unknown): value is TransactionFormInput['type'] {
    return typeof value === 'string' && VALID_TYPES.includes(value as TransactionFormInput['type'])
}

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
    return value === 'cash' || value === 'debit' || value === 'credit_card'
}

function normalizeCategoryIds(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .slice(0, MAX_RECENT_CATEGORIES)
}

export interface DescriptionAlias {
    description: string
    merchant?: string
}

function normalizeAliasKey(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function normalizeDescriptionAliases(value: unknown): Record<string, DescriptionAlias> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

    return Object.fromEntries(
        Object.entries(value)
            .filter((entry): entry is [string, DescriptionAlias] => {
                const [, alias] = entry
                return (
                    Boolean(alias) &&
                    typeof alias === 'object' &&
                    typeof alias.description === 'string' &&
                    alias.description.trim().length > 0 &&
                    (alias.merchant === undefined || typeof alias.merchant === 'string')
                )
            })
            .slice(-MAX_DESCRIPTION_ALIASES)
    )
}

function readStoredPrefs(): StoredDialogPrefs {
    if (!canUseStorage()) return {}

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return {}

        const parsed = JSON.parse(raw) as StoredDialogPrefs

        return {
            lastType: isValidType(parsed.lastType) ? parsed.lastType : undefined,
            lastExpensePaymentMethod: isValidPaymentMethod(parsed.lastExpensePaymentMethod)
                ? parsed.lastExpensePaymentMethod
                : undefined,
            accounts:
                parsed.accounts && typeof parsed.accounts === 'object'
                    ? Object.fromEntries(
                        Object.entries(parsed.accounts).filter(
                            ([, value]) => typeof value === 'string' && value.trim().length > 0
                        )
                    ) as Partial<Record<DialogAccountContext, string>>
                    : {},
            recentCategories: {
                income: normalizeCategoryIds(parsed.recentCategories?.income),
                expense: normalizeCategoryIds(parsed.recentCategories?.expense),
            },
            descriptionAliases: normalizeDescriptionAliases(parsed.descriptionAliases),
        }
    } catch {
        return {}
    }
}

function writeStoredPrefs(next: StoredDialogPrefs) {
    if (!canUseStorage()) return

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
        // ignore storage failures
    }
}

function updateStoredPrefs(updater: (current: StoredDialogPrefs) => StoredDialogPrefs) {
    const current = readStoredPrefs()
    writeStoredPrefs(updater(current))
}

function pushRecentCategory(current: string[], categoryId?: string) {
    if (!categoryId) return current
    return [categoryId, ...current.filter((item) => item !== categoryId)].slice(0, MAX_RECENT_CATEGORIES)
}

export function getStoredTransactionType() {
    return readStoredPrefs().lastType
}

export function getStoredExpensePaymentMethod() {
    return readStoredPrefs().lastExpensePaymentMethod
}

export function getStoredAccountId(context: DialogAccountContext) {
    return readStoredPrefs().accounts?.[context]
}

export function getRecentCategoryIds(type: RecentCategoryType) {
    return readStoredPrefs().recentCategories?.[type] ?? []
}

export function getDescriptionAlias(value: string): DescriptionAlias | undefined {
    const key = normalizeAliasKey(value)
    if (!key) return undefined
    return readStoredPrefs().descriptionAliases?.[key]
}

export function getStoredDescriptionAliases() {
    return Object.entries(readStoredPrefs().descriptionAliases ?? {}).map(([term, alias]) => ({
        term,
        ...alias,
    }))
}

export function persistDescriptionAlias(
    source: string,
    description: string,
    merchant?: string
) {
    const sourceKey = normalizeAliasKey(source)
    const targetKey = normalizeAliasKey(description)
    if (!sourceKey || !targetKey || sourceKey === targetKey) return

    updateStoredPrefs((current) => {
        const aliases = normalizeDescriptionAliases(current.descriptionAliases)
        const nextAliases = Object.fromEntries([
            ...Object.entries(aliases).filter(([key]) => key !== sourceKey),
            [sourceKey, {
                description: description.trim(),
                merchant: merchant?.trim() || undefined,
            }],
        ].slice(-MAX_DESCRIPTION_ALIASES))

        return {
            ...current,
            descriptionAliases: nextAliases,
        }
    })
}

type PersistDialogPrefsParams = {
    type: TransactionFormInput['type']
    paymentMethod?: PaymentMethod
    sourceAccountId?: string
    destinationAccountId?: string
    categoryId?: string
}

export function persistTransactionDialogPrefs({
    type,
    paymentMethod,
    sourceAccountId,
    destinationAccountId,
    categoryId,
}: PersistDialogPrefsParams) {
    updateStoredPrefs((current) => {
        const accounts = { ...(current.accounts ?? {}) }
        const recentCategories = {
            income: normalizeCategoryIds(current.recentCategories?.income),
            expense: normalizeCategoryIds(current.recentCategories?.expense),
        }

        if (type === 'income') {
            if (destinationAccountId) accounts['income:destination'] = destinationAccountId
            return {
                ...current,
                lastType: 'income',
                accounts,
                recentCategories: {
                    ...recentCategories,
                    income: pushRecentCategory(recentCategories.income, categoryId),
                },
            }
        }

        if (type === 'expense' || type === 'credit_card_expense') {
            const resolvedPaymentMethod =
                type === 'credit_card_expense'
                    ? 'credit_card'
                    : paymentMethod && isValidPaymentMethod(paymentMethod)
                        ? paymentMethod
                        : 'debit'

            if (sourceAccountId) {
                accounts[`expense:${resolvedPaymentMethod}`] = sourceAccountId
            }

            return {
                ...current,
                lastType: 'expense',
                lastExpensePaymentMethod: resolvedPaymentMethod,
                accounts,
                recentCategories: {
                    ...recentCategories,
                    expense: pushRecentCategory(recentCategories.expense, categoryId),
                },
            }
        }

        if (type === 'transfer') {
            if (sourceAccountId) accounts['transfer:source'] = sourceAccountId
            if (destinationAccountId) accounts['transfer:destination'] = destinationAccountId
            return { ...current, lastType: type, accounts, recentCategories }
        }

        if (type === 'exchange') {
            if (sourceAccountId) accounts['exchange:source'] = sourceAccountId
            if (destinationAccountId) accounts['exchange:destination'] = destinationAccountId
            return { ...current, lastType: type, accounts, recentCategories }
        }

        if (type === 'credit_card_payment' || type === 'debt_payment') {
            if (sourceAccountId) accounts['credit_card_payment:source'] = sourceAccountId
            if (destinationAccountId) accounts['credit_card_payment:destination'] = destinationAccountId
            return { ...current, lastType: 'credit_card_payment', accounts, recentCategories }
        }

        if (type === 'adjustment') {
            if (sourceAccountId) accounts['adjustment:source'] = sourceAccountId
            return { ...current, lastType: type, accounts, recentCategories }
        }

        return current
    })
}
