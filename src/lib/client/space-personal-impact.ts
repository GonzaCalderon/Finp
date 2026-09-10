'use client'

import { apiJson } from '@/lib/client/auth-client'
import {
    NOTIFICATION_INVALIDATION_TAGS,
    SPACE_INVALIDATION_TAGS,
    TRANSACTION_INVALIDATION_TAGS,
    type DataTag,
} from '@/lib/client/data-sync'
import type { SpaceSplitMode } from '@/lib/constants'
import type { SpaceLinkCandidatesResultDto } from '@/types'

/**
 * Candidatos de vínculo resueltos por el servidor
 * (arquitectura.md §8 «Candidatos de vínculo personal»): un único origen para
 * el alta guiada y para el impacto personal de un movimiento existente, así
 * ambos diálogos muestran exactamente lo que `resolve` va a aceptar.
 */
export async function fetchLinkCandidatesForNewEntry(input: {
    spaceId: string
    amount: number
    currency: string
    paidByParticipantId: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations?: Array<{ participantId: string; percentage?: number; amount?: number }>
    dateKey: string
    timezone: string
}): Promise<SpaceLinkCandidatesResultDto> {
    const { spaceId, ...body } = input
    const response = await apiJson<{ data: SpaceLinkCandidatesResultDto }>(
        `/api/spaces/${spaceId}/link-candidates`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'preview', ...body }),
        }
    )
    return response.data
}

export async function fetchLinkCandidatesForImpact(input: {
    spaceId: string
    entryId: string
    impactId: string
}): Promise<SpaceLinkCandidatesResultDto> {
    const response = await apiJson<{ data: SpaceLinkCandidatesResultDto }>(
        `/api/spaces/${input.spaceId}/link-candidates`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'impact',
                entryId: input.entryId,
                impactId: input.impactId,
            }),
        }
    )
    return response.data
}

export const PERSONAL_SPACE_TRANSACTION_INVALIDATION_TAGS: DataTag[] = Array.from(
    new Set([
        ...TRANSACTION_INVALIDATION_TAGS,
        ...SPACE_INVALIDATION_TAGS,
        ...NOTIFICATION_INVALIDATION_TAGS,
    ])
)

export type RemovePersonalSpaceTransactionResponse = {
    ok: true
    orphanTransactionDeleted: boolean
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
        return { ok: true, orphanTransactionDeleted: false }
    }

    // Una transacción sin impacto persistido ya no tiene un contrato de Espacios
    // que resolver. Se elimina por su recurso personal sin tocar el movimiento.
    await apiJson(`/api/transactions/${transactionId}`, { method: 'DELETE' })
    return { ok: true, orphanTransactionDeleted: true }
}
