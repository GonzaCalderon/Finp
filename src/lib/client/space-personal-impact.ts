'use client'

import { apiJson } from '@/lib/client/auth-client'
import {
    NOTIFICATION_INVALIDATION_TAGS,
    SPACE_INVALIDATION_TAGS,
    TRANSACTION_INVALIDATION_TAGS,
    type DataTag,
} from '@/lib/client/data-sync'

export const PERSONAL_SPACE_TRANSACTION_INVALIDATION_TAGS: DataTag[] = Array.from(
    new Set([
        ...TRANSACTION_INVALIDATION_TAGS,
        ...SPACE_INVALIDATION_TAGS,
        ...NOTIFICATION_INVALIDATION_TAGS,
    ])
)

export type RemovePersonalSpaceTransactionResponse = {
    ok: true
    deletedTransaction: boolean
    orphanTransactionDeleted: boolean
}

export class PersonalSpaceTransactionNotDeletedError extends Error {
    constructor() {
        super('No pudimos confirmar que la transacción se haya eliminado. Actualizamos los datos para que puedas intentar de nuevo.')
        this.name = 'PersonalSpaceTransactionNotDeletedError'
    }
}

export function withoutSelectedTransaction<
    T extends { _id: { toString(): string } | string },
>(transactions: T[], transactionId: string): T[] {
    return transactions.filter(
        (transaction) => transaction._id.toString() !== transactionId
    )
}

export async function removePersonalSpaceTransaction(input: {
    transactionId: string
    spaceId: string
    spaceEntryId: string
}): Promise<RemovePersonalSpaceTransactionResponse> {
    const transactionId = input.transactionId.trim()
    const query = new URLSearchParams({ transactionId })
    const response = await apiJson<RemovePersonalSpaceTransactionResponse>(
        `/api/spaces/${input.spaceId}/entries/${input.spaceEntryId}/personal-impact?${query.toString()}`,
        { method: 'DELETE' }
    )

    if (response.ok !== true || response.deletedTransaction !== true) {
        throw new PersonalSpaceTransactionNotDeletedError()
    }

    return response
}
