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
    const impactUrl = `/api/spaces/${input.spaceId}/entries/${input.spaceEntryId}/personal-impact`
    const current = await apiJson<{
        impact: { _id: string; revision?: number } | null
    }>(impactUrl)

    if (current.impact) {
        await apiJson(impactUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': crypto.randomUUID(),
            },
            body: JSON.stringify({
                impactId: current.impact._id,
                expectedRevision: current.impact.revision ?? 0,
                decision: { type: 'remove_transaction' },
            }),
        })
        return {
            ok: true,
            deletedTransaction: true,
            orphanTransactionDeleted: false,
        }
    }

    // Una transacción sin impacto persistido ya no tiene un contrato de Espacios
    // que resolver. Se elimina por su recurso personal sin tocar el movimiento.
    await apiJson(`/api/transactions/${transactionId}`, { method: 'DELETE' })
    return {
        ok: true,
        deletedTransaction: true,
        orphanTransactionDeleted: true,
    }
}
