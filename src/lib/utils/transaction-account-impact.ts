import type { Currency } from '@/lib/constants'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'

type RefLike =
    | string
    | { toString(): string; _id?: { toString(): string } }
    | null
    | undefined

type TransactionImpactLike = {
    type?: string | null
    amount: number
    currency: Currency | string
    sourceAccountId?: RefLike
    destinationAccountId?: RefLike
    destinationAmount?: number
    destinationCurrency?: Currency | string
}

export type TransactionAccountImpactDirection = 'increase' | 'decrease' | 'neutral'

export type TransactionAccountImpact = {
    accountId: string
    currency: Currency
    delta: number
    direction: TransactionAccountImpactDirection
}

function getRefId(value: RefLike): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    return value._id?.toString() ?? value.toString()
}

function getDirection(delta: number): TransactionAccountImpactDirection {
    if (delta > 0) return 'increase'
    if (delta < 0) return 'decrease'
    return 'neutral'
}

function normalizeCurrency(value: Currency | string): Currency {
    return value === 'USD' ? 'USD' : 'ARS'
}

function impact(accountId: string, currency: Currency, delta: number): TransactionAccountImpact | null {
    if (!accountId) return null
    return {
        accountId,
        currency,
        delta,
        direction: getDirection(delta),
    }
}

function mergeImpacts(impacts: TransactionAccountImpact[]): TransactionAccountImpact[] {
    const byAccountAndCurrency = new Map<string, TransactionAccountImpact>()

    for (const item of impacts) {
        const key = `${item.accountId}:${item.currency}`
        const current = byAccountAndCurrency.get(key)
        if (!current) {
            byAccountAndCurrency.set(key, { ...item })
            continue
        }

        current.delta += item.delta
        current.direction = getDirection(current.delta)
    }

    return Array.from(byAccountAndCurrency.values())
}

/**
 * Mirrors calculateAccountBalancesByCurrency:
 * destinationAccountId is added to balances and sourceAccountId is subtracted.
 * Keep both functions in sync if balance semantics change.
 */
export function getTransactionAccountImpacts(transaction: TransactionImpactLike): TransactionAccountImpact[] {
    const type = normalizeLegacyTransactionType(transaction.type) ?? transaction.type
    const sourceAccountId = getRefId(transaction.sourceAccountId)
    const destinationAccountId = getRefId(transaction.destinationAccountId)
    const impacts: TransactionAccountImpact[] = []

    if (sourceAccountId) {
        const sourceImpact = impact(sourceAccountId, normalizeCurrency(transaction.currency), -transaction.amount)
        if (sourceImpact) impacts.push(sourceImpact)
    }

    if (destinationAccountId) {
        const destinationDelta =
            type === 'exchange' && typeof transaction.destinationAmount === 'number'
                ? transaction.destinationAmount
                : transaction.amount
        const destinationCurrency =
            type === 'exchange' && transaction.destinationCurrency
                ? normalizeCurrency(transaction.destinationCurrency)
                : normalizeCurrency(transaction.currency)
        const destinationImpact = impact(destinationAccountId, destinationCurrency, destinationDelta)
        if (destinationImpact) impacts.push(destinationImpact)
    }

    return mergeImpacts(impacts)
}

export function getTransactionAccountImpact(
    transaction: TransactionImpactLike,
    accountId?: string
): TransactionAccountImpact | null {
    const impacts = getTransactionAccountImpacts(transaction)
    if (accountId) {
        return impacts.find((item) => item.accountId === accountId) ?? null
    }

    const type = normalizeLegacyTransactionType(transaction.type) ?? transaction.type
    const primaryAccountId =
        type === 'income'
            ? getRefId(transaction.destinationAccountId)
            : getRefId(transaction.sourceAccountId)

    if (primaryAccountId) {
        return impacts.find((item) => item.accountId === primaryAccountId) ?? null
    }

    return impacts[0] ?? null
}

export function getBalanceBeforeReplacingTransaction({
    currentBalance,
    previousTransaction,
    accountId,
    currency,
}: {
    currentBalance: number
    previousTransaction?: TransactionImpactLike | null
    accountId: string
    currency: Currency
}) {
    if (!previousTransaction) return currentBalance

    const previousImpact = getTransactionAccountImpacts(previousTransaction).find(
        (item) => item.accountId === accountId && item.currency === currency
    )

    return currentBalance - (previousImpact?.delta ?? 0)
}
