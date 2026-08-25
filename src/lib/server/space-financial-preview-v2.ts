import { Types } from 'mongoose'

import { Debt, Space, SpaceEntry, SpaceParticipant, Transaction } from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import { getSpaceCapabilitiesV2 } from '@/lib/server/space-capabilities'
import {
    calculateSpaceSharesV2,
    calculateSpaceDebtProjectionsV2,
    convertSpaceAmountV2,
    derivePersonalImpactAmountsV2,
    type SpaceSplitAllocationV2,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type {
    ISpace,
    ISpaceParticipant,
    ITransaction,
    SpaceEntryPreviewDto,
    SpaceSettlementPreviewDto,
    ISpaceEntry,
} from '@/types'
import type { IDebt } from '@/types/debt'
import type { SpaceSplitMode } from '@/lib/constants'

async function loadPreviewContext(spaceId: string, actorUserId: string) {
    if (!Types.ObjectId.isValid(spaceId)) {
        throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    const [space, participants] = await Promise.all([
        Space.findById(spaceId).lean<ISpace | null>(),
        SpaceParticipant.find({ spaceId }).lean<ISpaceParticipant[]>(),
    ])
    if (!space) throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    const currentParticipant = participants.find(
        (participant) => extractId(participant.userId) === actorUserId
    )
    if (!currentParticipant) {
        throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    return { space, participants, currentParticipant }
}

export async function previewSpaceEntryV2(input: {
    actorUserId: string
    spaceId: string
    amount: number
    currency: string
    exchangeRate?: number
    paidByParticipantId: string
    sharedWithParticipantIds: string[]
    splitMode: SpaceSplitMode
    splitAllocations?: SpaceSplitAllocationV2[]
    linkedTransactionId?: string
}): Promise<SpaceEntryPreviewDto> {
    const context = await loadPreviewContext(input.spaceId, input.actorUserId)
    const caps = getSpaceCapabilitiesV2({
        status: context.space.status,
        role: context.currentParticipant.role,
        isActiveParticipant: context.currentParticipant.isActive,
        isOwnerRecord: extractId(context.space.ownerUserId) === input.actorUserId,
    })
    if (!caps.has('create_entry')) {
        throw new ServiceError(409, 'SPACE_STATE_CONFLICT', 'No se pueden crear movimientos en el estado actual.')
    }
    const activeIds = new Set(context.participants
        .filter((participant) => participant.isActive)
        .map((participant) => extractId(participant._id)))
    if (
        !activeIds.has(input.paidByParticipantId) ||
        input.sharedWithParticipantIds.some((id) => !activeIds.has(id))
    ) {
        throw new ServiceError(409, 'SPACE_PARTICIPANT_INACTIVE', 'El reparto incluye una persona inactiva.')
    }
    const conversion = convertSpaceAmountV2({
        amount: input.amount,
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
        exchangeRate: input.exchangeRate,
    })
    const shares = calculateSpaceSharesV2({
        amount: input.amount,
        reportingAmount: conversion.reportingAmount,
        splitMode: input.splitMode,
        participantIds: input.sharedWithParticipantIds,
        allocations: input.splitAllocations,
    })
    const currentParticipantId = extractId(context.currentParticipant._id)!
    const ownShare = shares.find((share) => share.participantId === currentParticipantId)
    const amounts = derivePersonalImpactAmountsV2({
        entryType: 'expense',
        entryAmount: input.amount,
        ownShareAmount: ownShare?.amount ?? 0,
        isPayer: input.paidByParticipantId === currentParticipantId,
    })
    let linkExisting: SpaceEntryPreviewDto['linkExisting']
    if (input.linkedTransactionId) {
        const transaction = Types.ObjectId.isValid(input.linkedTransactionId)
            ? await Transaction.findOne({
                _id: input.linkedTransactionId,
                userId: input.actorUserId,
                status: { $ne: 'voided' },
            }).lean<ITransaction | null>()
            : null
        const issues: NonNullable<SpaceEntryPreviewDto['linkExisting']>['issues'] = []
        if (!transaction) issues.push('transaction_not_found')
        if (transaction && transaction.currency !== input.currency) issues.push('currency_mismatch')
        const expectedAmount = amounts.accountImpactAmount || amounts.ownShareAmount
        if (transaction && Math.abs(transaction.amount - expectedAmount) > 0.01) issues.push('amount_mismatch')
        linkExisting = {
            transactionId: input.linkedTransactionId,
            compatible: issues.length === 0,
            issues,
        }
    }
    const ownReportingShare = ownShare?.reportingAmount ?? 0
    const isPayer = input.paidByParticipantId === currentParticipantId
    return {
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
        totalAmount: input.amount,
        reportingAmount: conversion.reportingAmount,
        ownShareAmount: amounts.ownShareAmount,
        accountImpactAmount: amounts.accountImpactAmount,
        operationalAmount: amounts.operationalAmount,
        recoverableAdvanceAmount: amounts.recoverableAdvanceAmount,
        debtDeltaReporting: isPayer
            ? conversion.reportingAmount - ownReportingShare
            : -ownReportingShare,
        personalAction: amounts.action === 'none'
            ? 'not_applicable'
            : amounts.accountImpactAmount > 0
                ? 'account_required'
                : 'optional',
        linkExisting,
    }
}

export async function previewSpaceSettlementV2(input: {
    actorUserId: string
    spaceId: string
    mode: 'own' | 'represented'
    debtId?: string
    payerParticipantId?: string
    receiverParticipantId?: string
    amount: number
    currency: string
    exchangeRate?: number
}): Promise<SpaceSettlementPreviewDto> {
    const context = await loadPreviewContext(input.spaceId, input.actorUserId)
    const capabilities = getSpaceCapabilitiesV2({
        status: context.space.status,
        role: context.currentParticipant.role,
        isActiveParticipant: context.currentParticipant.isActive,
        isOwnerRecord: extractId(context.space.ownerUserId) === input.actorUserId,
    })
    if (!capabilities.has('settle_balance')) {
        throw new ServiceError(403, 'SPACE_CAPABILITY_DENIED', 'No podés liquidar este saldo.')
    }
    let payerParticipantId: string
    let receiverParticipantId: string
    let balanceReporting: number
    if (input.mode === 'own') {
        const debt = input.debtId && Types.ObjectId.isValid(input.debtId)
            ? await Debt.findOne({
                _id: input.debtId,
                userId: input.actorUserId,
                spaceId: input.spaceId,
                contractVersion: 2,
                status: { $in: ['active', 'partially_paid', 'ignored'] },
            }).lean<IDebt | null>()
            : null
        if (!debt) throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'La obligación no está disponible.')
        const actorParticipantId = extractId(context.currentParticipant._id)!
        const counterpartyId = extractId(debt.counterpartyParticipantId)
        if (!counterpartyId) throw new ServiceError(409, 'SPACE_DEBT_COUNTERPARTY_MISSING', 'Falta la contraparte histórica.')
        payerParticipantId = debt.direction === 'payable' ? actorParticipantId : counterpartyId
        receiverParticipantId = debt.direction === 'receivable' ? actorParticipantId : counterpartyId
        balanceReporting = debt.remainingAmount
    } else {
        if (!capabilities.has('act_for_participant')) {
            throw new ServiceError(403, 'SPACE_REPRESENTATION_DENIED', 'No podés liquidar en nombre de otras personas.')
        }
        if (!input.payerParticipantId || !input.receiverParticipantId) {
            throw new ServiceError(400, 'SPACE_SETTLEMENT_PARTIES_INVALID', 'Indicá pagador y receptor.')
        }
        payerParticipantId = input.payerParticipantId
        receiverParticipantId = input.receiverParticipantId
        const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
            .lean<ISpaceEntry[]>()
        const projection = calculateSpaceDebtProjectionsV2({
            mode: context.space.debtMode ?? 'simplified',
            entries: entries.map((entry) => ({
                entryId: extractId(entry._id)!,
                status: entry.status === 'voided' ? 'voided' as const : 'recorded' as const,
                type: entry.type,
                amount: entry.amount,
                reportingAmount: entry.reportingAmount,
                paidByParticipantId: extractId(entry.paidByParticipantId),
                sharedWithParticipantIds: (entry.sharedWithParticipantIds ?? [])
                    .map(extractId).filter((id): id is string => Boolean(id)),
                splitMode: entry.splitMode,
                splitAllocations: (entry.splitAllocations ?? []).map((allocation) => ({
                    participantId: extractId(allocation.participantId)!,
                    percentage: allocation.percentage,
                    amount: allocation.amount,
                })),
            })),
            participants: context.participants.map((participant) => ({
                participantId: extractId(participant._id)!,
                displayName: participant.displayName,
                userId: extractId(participant.userId),
            })),
        }).find((item) =>
            item.fromParticipantId === payerParticipantId &&
            item.toParticipantId === receiverParticipantId
        )
        if (!projection) throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'No existe un saldo vigente entre esas personas.')
        balanceReporting = projection.amount
    }
    const conversion = convertSpaceAmountV2({
        amount: input.amount,
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
        exchangeRate: input.exchangeRate,
    })
    if (conversion.reportingAmount > balanceReporting + 0.01) {
        throw new ServiceError(409, 'SPACE_SETTLEMENT_EXCEEDS_BALANCE', 'La liquidación supera el saldo vigente.')
    }
    return {
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
        amount: input.amount,
        reportingAmount: conversion.reportingAmount,
        payerParticipantId,
        receiverParticipantId,
        actorMovesPersonalAccount: input.mode === 'own',
        actorAccountImpactAmount: input.mode === 'own' ? input.amount : 0,
        actorOperationalAmount: 0,
        remainingBalanceReporting: Math.max(0, balanceReporting - conversion.reportingAmount),
    }
}
