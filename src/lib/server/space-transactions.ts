import { Types } from 'mongoose'
import { createTransactionForUser } from '@/lib/server/transactions'
import type { Currency } from '@/lib/constants'
import type { ISpaceEntry, ITransaction } from '@/types'

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

    const entryCurrency = entry.currency as Currency
    const transactionAmount = amountOverride ?? entry.amount
    const transactionType = transactionTypeOverride ?? mapEntryTypeToTransactionType(entry.type)
    const transactionDate = dateOverride ?? entry.date

    // Operational amount: only set when the reporting amount differs from the account impact.
    // This happens when the payer advances the full cost but their personal share is smaller.
    const resolvedOperationalAmount =
        operationalAmountOverride !== undefined && operationalAmountOverride !== transactionAmount
            ? operationalAmountOverride
            : undefined

    const payload: Record<string, unknown> = {
        type: transactionType,
        amount: transactionAmount,
        currency: entryCurrency,
        date: transactionDate,
        description: description?.trim() || entry.title,
        categoryId,
        spaceId: entry.spaceId.toString(),
        spaceEntryId: entry._id.toString(),
    }

    if (transactionType === 'income') {
        payload.destinationAccountId = accountId
    } else {
        payload.sourceAccountId = accountId
    }

    return createTransactionForUser(userId, payload, {
        createdFrom: 'web',
        status: 'confirmed',
        metadata: {
            spaceNameSnapshot,
            operationalAmount: resolvedOperationalAmount,
        },
    })
}
