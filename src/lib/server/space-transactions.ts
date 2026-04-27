import { Types } from 'mongoose'
import { Account, Transaction } from '@/lib/models'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import {
    getInitialBalancesByCurrency,
    supportsCurrency,
} from '@/lib/utils/accounts'
import { extractId } from '@/lib/utils/spaces'
import type { Currency } from '@/lib/constants'
import type { IAccount, ISpaceEntry, ITransaction } from '@/types'

type CreateSpaceTransactionOptions = {
    entry: ISpaceEntry
    userId: string
    accountId: string
    description?: string
    categoryId?: string
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

    if (entry.type !== 'income' && account.allowNegativeBalance === false) {
        const balances = await calculateAccountBalancesByCurrency(account._id, account.userId, {
            initialBalances: getInitialBalancesByCurrency(account),
        })
        const balance = balances[entryCurrency]

        if (balance - entry.amount < 0) {
            throw new Error(`Saldo insuficiente en "${account.name}".`)
        }
    }

    const fallbackCategoryId = extractId(entry.categoryId)
    const payload: Partial<ITransaction> = {
        userId: account.userId,
        type: mapEntryTypeToTransactionType(entry.type),
        amount: entry.amount,
        currency: entryCurrency,
        date: entry.date,
        description: description?.trim() || entry.title,
        categoryId: categoryId
            ? new Types.ObjectId(categoryId)
            : fallbackCategoryId
                ? new Types.ObjectId(fallbackCategoryId)
                : undefined,
        status: 'confirmed',
        createdFrom: 'web',
        spaceId: entry.spaceId,
        spaceEntryId: entry._id,
    }

    if (entry.type === 'income') {
        payload.destinationAccountId = account._id
    } else {
        payload.sourceAccountId = account._id
    }

    return Transaction.create(payload)
}
