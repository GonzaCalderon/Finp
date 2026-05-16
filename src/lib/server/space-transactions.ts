import { Types } from 'mongoose'
import { Account, Transaction } from '@/lib/models'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import {
    getInitialBalancesByCurrency,
    supportsCurrency,
} from '@/lib/utils/accounts'
import type { Currency } from '@/lib/constants'
import type { IAccount, ISpaceEntry, ITransaction } from '@/types'

type CreateSpaceTransactionOptions = {
    entry: ISpaceEntry
    userId: string
    accountId: string
    description?: string
    categoryId?: string
    spaceNameSnapshot?: string
    amountOverride?: number
    /** Personal share to use for reporting when different from amountOverride (payer case). */
    operationalAmountOverride?: number
    dateOverride?: Date
    transactionTypeOverride?: ITransaction['type']
}

function mapEntryTypeToTransactionType(entry: ISpaceEntry['type']) {
    if (entry === 'income') return 'income'
    if (entry === 'adjustment') return 'adjustment'
    return 'expense'
}

export async function createTransactionFromSpaceEntry({
    entry,
    userId,
    accountId,
    description,
    categoryId,
    spaceNameSnapshot,
    amountOverride,
    operationalAmountOverride,
    dateOverride,
    transactionTypeOverride,
}: CreateSpaceTransactionOptions) {
    if (!Types.ObjectId.isValid(accountId)) {
        throw new Error('La cuenta seleccionada no es válida.')
    }

    const account = await Account.findOne({
        _id: accountId,
        userId,
    }).lean<IAccount | null>()

    if (!account) {
        throw new Error('La cuenta seleccionada no existe o no pertenece al usuario.')
    }

    const entryCurrency = entry.currency as Currency
    if (!supportsCurrency(account, entryCurrency)) {
        throw new Error(`La cuenta "${account.name}" no opera en ${entry.currency}.`)
    }

    const transactionAmount = amountOverride ?? entry.amount
    const transactionType = transactionTypeOverride ?? mapEntryTypeToTransactionType(entry.type)
    const transactionDate = dateOverride ?? entry.date

    if (transactionType !== 'income' && account.allowNegativeBalance === false) {
        const balances = await calculateAccountBalancesByCurrency(account._id, account.userId, {
            initialBalances: getInitialBalancesByCurrency(account),
        })
        const balance = balances[entryCurrency]

        if (balance - transactionAmount < 0) {
            throw new Error(`Saldo insuficiente en "${account.name}".`)
        }
    }

    // Operational amount: only set when the reporting amount differs from the account impact.
    // This happens when the payer advances the full cost but their personal share is smaller.
    const resolvedOperationalAmount =
        operationalAmountOverride !== undefined && operationalAmountOverride !== transactionAmount
            ? operationalAmountOverride
            : undefined

    const payload: Partial<ITransaction> = {
        userId: account.userId,
        type: transactionType,
        amount: transactionAmount,
        currency: entryCurrency,
        date: transactionDate,
        description: description?.trim() || entry.title,
        categoryId: categoryId
            ? new Types.ObjectId(categoryId)
            : undefined,
        status: 'confirmed',
        createdFrom: 'web',
        spaceId: entry.spaceId,
        spaceEntryId: entry._id,
        spaceNameSnapshot,
        operationalAmount: resolvedOperationalAmount,
    }

    if (transactionType === 'income') {
        payload.destinationAccountId = account._id
    } else {
        payload.sourceAccountId = account._id
    }

    return Transaction.create(payload)
}
