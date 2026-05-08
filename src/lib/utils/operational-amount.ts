import type { ITransaction } from '@/types'

// Transaction types that move real money between accounts but must NOT count
// as operational income or expense in reports, dashboard, sankey, or cashflow.
const NON_OPERATIONAL_TYPES = new Set(['personal_debt_payment', 'personal_debt_collect'])

export function isNonOperationalTransactionType(type: string): boolean {
    return NON_OPERATIONAL_TYPES.has(type)
}

/**
 * Returns the amount that should count for reporting purposes.
 * - Returns 0 for debt-related types (they move money but aren't income/expense).
 * - For space payer transactions where the user paid the full amount on behalf of others,
 *   `operationalAmount` stores only their personal share; falls back to `amount` otherwise.
 */
export function getOperationalAmount(
    transaction: Pick<ITransaction, 'type' | 'amount' | 'operationalAmount'>
): number {
    if (isNonOperationalTransactionType(transaction.type)) return 0
    return transaction.operationalAmount ?? transaction.amount
}

/**
 * The amount to show as the primary figure in any transaction display.
 * For split transactions from spaces, this is the user's personal share.
 * For everything else, it's the full amount.
 */
export function getPrimaryDisplayAmount(
    transaction: Pick<ITransaction, 'amount' | 'operationalAmount'>
): number {
    return transaction.operationalAmount ?? transaction.amount
}

/**
 * Returns true when the transaction has a personal share different from the
 * full amount paid — i.e., it's a split/shared expense and we should show
 * the total alongside the primary (share) amount.
 */
export function isSplitTransaction(
    transaction: Pick<ITransaction, 'amount' | 'operationalAmount'>
): boolean {
    return (
        transaction.operationalAmount !== undefined &&
        transaction.operationalAmount !== transaction.amount
    )
}

/**
 * Returns the operational expense amount for the transaction.
 * Returns 0 for anything that is not an expense, or is a non-operational type.
 * Callers are responsible for filtering out installment-plan expenses if needed.
 */
export function getOperationalExpenseAmount(
    transaction: Pick<ITransaction, 'type' | 'amount' | 'operationalAmount'>
): number {
    if (isNonOperationalTransactionType(transaction.type)) return 0
    if (transaction.type !== 'expense') return 0
    return transaction.operationalAmount ?? transaction.amount
}

/**
 * Returns the operational income amount for the transaction.
 * Returns 0 for anything that is not an income, or is a non-operational type.
 */
export function getOperationalIncomeAmount(
    transaction: Pick<ITransaction, 'type' | 'amount' | 'operationalAmount'>
): number {
    if (isNonOperationalTransactionType(transaction.type)) return 0
    if (transaction.type !== 'income') return 0
    return transaction.operationalAmount ?? transaction.amount
}
