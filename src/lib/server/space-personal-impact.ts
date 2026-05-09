import { Types } from 'mongoose'
import { Category, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
import { createTransactionFromSpaceEntry } from '@/lib/server/space-transactions'
import { buildEntryShares, extractId, roundAmount } from '@/lib/utils/spaces'
import type {
    ISpaceEntry,
    ISpaceEntryPersonalImpact,
    ISpaceEntryPersonalImpactByEntry,
    ISpaceParticipant,
    ITransaction,
} from '@/types'
import type { SpacePersonalImpactKind, SpacePersonalPendingActionType } from '@/lib/constants'
import { SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'

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

type UpsertLinkedParams = {
    spaceId: string
    entryId: string
    userId: string
    participantId: string
    impactKind: SpacePersonalImpactKind
    actionType?: SpacePersonalPendingActionType
    transactionId: string
    accountId: string
    categoryId?: string
    amount: number
    currency: string
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

/**
 * Devuelve impactos personales por entry con estructura explícita:
 * { linkedImpact, pendingActions }
 * Solo linked cuenta como "En tu Finp". pending son acciones pendientes de decisión.
 */
export async function getPersonalImpactForEntries(
    spaceId: string,
    userId: string,
    entryIds: string[],
    entries: ISpaceEntry[] = [],
    participants: ISpaceParticipant[] = []
): Promise<Record<string, ISpaceEntryPersonalImpactByEntry>> {
    const validEntryIds = entryIds.filter((entryId) => Types.ObjectId.isValid(entryId))
    if (validEntryIds.length === 0) return {}

    const impacts = await SpaceEntryPersonalImpact.find({
        spaceId,
        userId,
        entryId: { $in: validEntryIds },
        status: { $in: [SPACE_PERSONAL_IMPACT_STATUSES.LINKED, SPACE_PERSONAL_IMPACT_STATUSES.PENDING] },
    }).lean<ISpaceEntryPersonalImpact[]>()

    const byEntryId: Record<string, ISpaceEntryPersonalImpactByEntry> = {}

    impacts.forEach((impact) => {
        const entryId = extractId(impact.entryId)
        if (!entryId) return
        if (!byEntryId[entryId]) {
            byEntryId[entryId] = { pendingActions: [] }
        }
        if (impact.status === SPACE_PERSONAL_IMPACT_STATUSES.LINKED) {
            byEntryId[entryId].linkedImpact = impact
        } else {
            byEntryId[entryId].pendingActions.push(impact)
        }
    })

    // Soporte legado: entries con linkedTransactionId pero sin SpaceEntryPersonalImpact
    entries.forEach((entry) => {
        const entryId = extractId(entry._id)
        if (!entryId || byEntryId[entryId]?.linkedImpact) return
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

        if (!byEntryId[entryId]) {
            byEntryId[entryId] = { pendingActions: [] }
        }
        byEntryId[entryId].linkedImpact = {
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
            status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
            createdAt: entry.confirmedAt ?? entry.createdAt,
            updatedAt: entry.updatedAt,
        }
    })

    return byEntryId
}

/**
 * Transiciona un pending existente a linked, o crea un linked directo si no hay pending.
 * No duplica si ya existe un linked vigente.
 * Regla: solo puede existir un linked vigente por (userId, entryId).
 */
export async function upsertLinkedPersonalImpact(
    params: UpsertLinkedParams
): Promise<ISpaceEntryPersonalImpact> {
    const {
        spaceId, entryId, userId, participantId, impactKind,
        actionType, transactionId, accountId, categoryId, amount, currency,
    } = params

    const resolvedAt = new Date()

    // Si ya existe pending con el mismo actionType, transicionarlo a linked
    const pendingQuery = actionType
        ? { userId, entryId, actionType, status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING }
        : { userId, entryId, status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING }

    const existingPending = await SpaceEntryPersonalImpact.findOneAndUpdate(
        pendingQuery,
        {
            $set: {
                status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                transactionId: new Types.ObjectId(transactionId),
                accountId: new Types.ObjectId(accountId),
                ...(categoryId && { categoryId: new Types.ObjectId(categoryId) }),
                resolvedAt,
            },
        },
        { new: true }
    ).lean<ISpaceEntryPersonalImpact | null>()

    if (existingPending) return existingPending

    // Si ya existe linked, retornarlo (no duplicar)
    const existingLinked = await SpaceEntryPersonalImpact.findOne({
        userId,
        entryId,
        status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
    }).lean<ISpaceEntryPersonalImpact | null>()

    if (existingLinked) return existingLinked

    // Crear linked nuevo
    return SpaceEntryPersonalImpact.create({
        spaceId,
        entryId,
        userId,
        participantId,
        transactionId: new Types.ObjectId(transactionId),
        accountId: new Types.ObjectId(accountId),
        ...(categoryId && { categoryId: new Types.ObjectId(categoryId) }),
        impactKind,
        amount,
        currency,
        status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
        ...(actionType && { actionType }),
        resolvedAt,
    })
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

    // Verificar si ya existe un linked vigente
    const existing = await SpaceEntryPersonalImpact.findOne({
        userId,
        entryId,
        status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
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

    // For payer_full_amount: the transaction amount = full entry cost (account impact),
    // but operational reporting should use only the payer's personal share.
    let payerPersonalShare: number | undefined
    if (resolvedImpactKind === 'payer_full_amount') {
        const currentParticipantId = extractId(currentParticipant._id)
        const payerShare = currentParticipantId
            ? buildEntryShares(entry, participants).find(
                (s) => s.participantId === currentParticipantId
            )
            : undefined
        if (payerShare && payerShare.amount < resolvedAmount) {
            payerPersonalShare = roundAmount(payerShare.amount)
        }
    }

    if (mode === 'create_transaction') {
        if (!accountId) throw new Error('Selecciona una cuenta para registrar en tu Finp.')
        transaction = await createTransactionFromSpaceEntry({
            entry,
            userId,
            accountId,
            description,
            categoryId,
            amountOverride: resolvedAmount,
            operationalAmountOverride: payerPersonalShare,
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

    const transactionIdStr = extractId(transaction?._id)
    if (!transactionIdStr || !resolvedAccountId) {
        throw new Error('No se pudo resolver la transaccion o cuenta.')
    }

    // Buscar un pending existente para transicionarlo, o crear linked directo
    const pendingToResolve = await SpaceEntryPersonalImpact.findOneAndUpdate(
        {
            userId,
            entryId,
            status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
        },
        {
            $set: {
                status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
                transactionId: new Types.ObjectId(transactionIdStr),
                accountId: new Types.ObjectId(resolvedAccountId),
                ...(categoryId && { categoryId: new Types.ObjectId(categoryId) }),
                resolvedAt: new Date(),
            },
        },
        { new: true }
    ).lean<ISpaceEntryPersonalImpact | null>()

    if (pendingToResolve) return pendingToResolve

    return SpaceEntryPersonalImpact.create({
        spaceId,
        entryId,
        userId,
        participantId: resolvedParticipantId,
        transactionId: new Types.ObjectId(transactionIdStr),
        accountId: new Types.ObjectId(resolvedAccountId),
        ...(categoryId && { categoryId: new Types.ObjectId(categoryId) }),
        impactKind: resolvedImpactKind,
        amount: resolvedAmount,
        currency: entry.currency,
        status: SPACE_PERSONAL_IMPACT_STATUSES.LINKED,
        resolvedAt: new Date(),
    })
}
