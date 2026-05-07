import { Types } from 'mongoose'
import { Category, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import { createTransactionFromSpaceEntry } from '@/lib/server/space-transactions'
import { buildEntryShares, extractId, roundAmount } from '@/lib/utils/spaces'
import type { ISpaceEntry, ISpaceEntryPersonalImpact, ISpaceParticipant, ITransaction } from '@/types'
import type { SpacePersonalImpactKind } from '@/lib/constants'

type CreatePersonalImpactParams = {
    spaceId: string
    entry: ISpaceEntry
    participants: ISpaceParticipant[]
    userId: string
    participantId: string
    mode: 'create_transaction' | 'link_existing'
    accountId?: string
    categoryId?: string
    linkedTransactionId?: string
    description?: string
    impactKind?: SpacePersonalImpactKind
    amount?: number
    spaceNameSnapshot?: string
}

export function resolveCurrentUserEntryShare(
    entry: ISpaceEntry,
    participants: ISpaceParticipant[],
    currentUserId: string
) {
    const currentParticipant = participants.find(
        (participant) => participant.isActive && extractId(participant.userId) === currentUserId
    )
    const currentParticipantId = extractId(currentParticipant?._id)
    if (!currentParticipant || !currentParticipantId) return null

    const payerId = extractId(entry.paidByParticipantId)
    const payerUserId = extractId(
        participants.find((participant) => extractId(participant._id) === payerId)?.userId
    )
    const receiverId = entry.type === 'settlement'
        ? extractId(entry.sharedWithParticipantIds?.[0])
        : undefined

    if (entry.type === 'settlement') {
        if (payerId === currentParticipantId) {
            return {
                participant: currentParticipant,
                amount: roundAmount(entry.amount),
                impactKind: 'settlement_paid' as const,
            }
        }

        if (receiverId === currentParticipantId) {
            return {
                participant: currentParticipant,
                amount: roundAmount(entry.amount),
                impactKind: 'settlement_received' as const,
            }
        }

        return null
    }

    if (payerUserId === currentUserId) {
        return {
            participant: currentParticipant,
            amount: roundAmount(entry.amount),
            impactKind: 'payer_full_amount' as const,
        }
    }

    const share = buildEntryShares(entry, participants).find(
        (allocation) => allocation.participantId === currentParticipantId
    )

    if (!share) return null

    return {
        participant: currentParticipant,
        amount: roundAmount(share.amount),
        impactKind: 'participant_share' as const,
    }
}

export function resolveSuggestedImpactKind(
    entry: ISpaceEntry,
    currentUserParticipantId: string
): SpacePersonalImpactKind | null {
    const payerId = extractId(entry.paidByParticipantId)
    const receiverId = entry.type === 'settlement'
        ? extractId(entry.sharedWithParticipantIds?.[0])
        : undefined

    if (entry.type === 'settlement') {
        if (payerId === currentUserParticipantId) return 'settlement_paid'
        if (receiverId === currentUserParticipantId) return 'settlement_received'
        return null
    }

    if (payerId === currentUserParticipantId) return 'payer_full_amount'
    return 'participant_share'
}

async function validatePersonalCategory(categoryId: string | undefined, userId: string) {
    if (!categoryId) return
    if (!Types.ObjectId.isValid(categoryId)) {
        throw new Error('La categoria seleccionada no es valida.')
    }

    const category = await Category.findOne({ _id: categoryId, userId }).lean()
    if (!category) {
        throw new Error('La categoria seleccionada no existe o no pertenece al usuario.')
    }
}

export async function getPersonalImpactForEntries(
    spaceId: string,
    userId: string,
    entryIds: string[],
    entries: ISpaceEntry[] = [],
    participants: ISpaceParticipant[] = []
) {
    const validEntryIds = entryIds.filter((entryId) => Types.ObjectId.isValid(entryId))
    if (validEntryIds.length === 0) return {}

    const impacts = await SpaceEntryPersonalImpact.find({
        spaceId,
        userId,
        entryId: { $in: validEntryIds },
        status: 'linked',
    }).lean<ISpaceEntryPersonalImpact[]>()

    const byEntryId: Record<string, ISpaceEntryPersonalImpact> = {}
    impacts.forEach((impact) => {
        const entryId = extractId(impact.entryId)
        if (entryId) byEntryId[entryId] = impact
    })

    entries.forEach((entry) => {
        const entryId = extractId(entry._id)
        if (!entryId || byEntryId[entryId]) return
        if (entry.status !== 'linked' && !entry.linkedTransactionId) return

        const confirmedByUserId = extractId(entry.confirmedByUserId)
        const payer = participants.find(
            (participant) => extractId(participant._id) === extractId(entry.paidByParticipantId)
        )
        const payerUserId = extractId(payer?.userId)
        const legacyBelongsToUser = confirmedByUserId === userId || payerUserId === userId

        if (!legacyBelongsToUser || !entry.linkedTransactionId) return

        const share = resolveCurrentUserEntryShare(entry, participants, userId)
        if (!share) return
        const participantId = extractId(share.participant._id)
        const linkedTransactionId = extractId(entry.linkedTransactionId)
        if (!participantId || !linkedTransactionId) return
        const legacyCategoryId = extractId(entry.categoryId)

        byEntryId[entryId] = {
            _id: new Types.ObjectId(),
            spaceId: new Types.ObjectId(extractId(entry.spaceId) ?? spaceId),
            entryId: new Types.ObjectId(entryId),
            userId: new Types.ObjectId(userId),
            participantId: new Types.ObjectId(participantId),
            transactionId: new Types.ObjectId(linkedTransactionId),
            categoryId: legacyCategoryId
                ? new Types.ObjectId(legacyCategoryId)
                : undefined,
            impactKind: share.impactKind,
            amount: share.amount,
            currency: entry.currency,
            status: 'linked',
            createdAt: entry.confirmedAt ?? entry.createdAt,
            updatedAt: entry.updatedAt,
        }
    })

    return byEntryId
}

export async function createPersonalImpactFromSpaceEntry({
    spaceId,
    entry,
    participants,
    userId,
    participantId,
    mode,
    accountId,
    categoryId,
    linkedTransactionId,
    description,
    impactKind,
    amount,
    spaceNameSnapshot,
}: CreatePersonalImpactParams) {
    const entryId = extractId(entry._id)
    if (!entryId) throw new Error('Movimiento invalido.')

    const existing = await SpaceEntryPersonalImpact.findOne({
        userId,
        entryId,
        status: 'linked',
    }).lean<ISpaceEntryPersonalImpact | null>()

    if (existing) {
        const error = new Error('Este movimiento ya esta registrado en tu Finp.')
        error.name = 'DuplicatePersonalImpactError'
        throw error
    }

    const suggested = resolveCurrentUserEntryShare(entry, participants, userId)
    const currentParticipant = suggested?.participant ?? participants.find(
        (participant) => participant.isActive && extractId(participant.userId) === userId
    )
    if (!currentParticipant) {
        throw new Error('No se pudo identificar tu participante en este espacio.')
    }
    const resolvedParticipantId = participantId || extractId(currentParticipant._id)
    if (!resolvedParticipantId) {
        throw new Error('No se pudo identificar tu participante en este espacio.')
    }

    await validatePersonalCategory(categoryId, userId)

    const resolvedImpactKind = impactKind ?? suggested?.impactKind ?? 'participant_share'
    const resolvedAmount = roundAmount(amount ?? suggested?.amount ?? entry.amount)
    if (resolvedAmount <= 0) {
        throw new Error('El monto a registrar debe ser mayor a 0.')
    }

    let transaction: ITransaction | null = null
    let resolvedAccountId = accountId

    if (mode === 'create_transaction') {
        if (!accountId) throw new Error('Selecciona una cuenta para registrar en tu Finp.')
        transaction = await createTransactionFromSpaceEntry({
            entry,
            userId,
            accountId,
            description,
            categoryId,
            amountOverride: resolvedAmount,
            transactionTypeOverride: resolvedImpactKind === 'settlement_received' ? 'income' : undefined,
            spaceNameSnapshot,
        })
        resolvedAccountId = extractId(transaction.sourceAccountId) ?? extractId(transaction.destinationAccountId)
    } else {
        if (!linkedTransactionId) throw new Error('Selecciona una transaccion existente.')
        transaction = await Transaction.findOne({
            _id: linkedTransactionId,
            userId,
        }).lean<ITransaction | null>()

        if (!transaction) {
            throw new Error('La transaccion a vincular no existe o no te pertenece.')
        }
        resolvedAccountId = extractId(transaction.sourceAccountId) ?? extractId(transaction.destinationAccountId)
    }

    return SpaceEntryPersonalImpact.create({
        spaceId,
        entryId,
        userId,
        participantId: resolvedParticipantId,
        transactionId: transaction?._id,
        accountId: resolvedAccountId,
        categoryId,
        impactKind: resolvedImpactKind,
        amount: resolvedAmount,
        currency: entry.currency,
        status: 'linked',
    })
}
