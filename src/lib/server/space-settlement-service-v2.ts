import { Types } from 'mongoose'

import { Debt, SpaceEntry, SpaceEntryPersonalImpact } from '@/lib/models'
import { CURRENCIES } from '@/lib/constants'
import { ServiceError } from '@/lib/server/errors'
import { getSpaceCapabilitiesV2 } from '@/lib/server/space-capabilities'
import {
    buildSpaceImpactOriginSnapshotV2,
    createSpaceActivityEventV2,
    loadSpaceApplicationContextV2,
} from '@/lib/server/space-application-context-v2'
import { materializeSpaceDebtsV2 } from '@/lib/server/space-debt-materialization-v2'
import { executeSpaceOperation } from '@/lib/server/space-operation-executor'
import { reconcileSpacePendingNotificationsV2 } from '@/lib/server/space-notification-reconciliation-v2'
import {
    createInternalSpaceTransaction,
    type CreateInternalSpaceTransactionInput,
} from '@/lib/server/transactions'
import {
    calculateSpaceDebtProjectionsV2,
    convertSpaceAmountV2,
    financialDateKeyToInstant,
    normalizeFinancialDateKey,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type { IDebt } from '@/types/debt'
import type { ISpaceEntry, ISpaceParticipant } from '@/types'

interface SettlementCommonInput {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    originSurface: 'spaces' | 'debts'
    amount: number
    currency: string
    exchangeRate?: number
    dateKey: string
    description?: string
}

export type SettleSpaceDebtV2Input = SettlementCommonInput & (
    | { mode?: 'own'; debtId: string; accountId: string }
    | { mode: 'represented'; payerParticipantId: string; receiverParticipantId: string }
)

async function reconcileSettlementPresentation(ids: Types.ObjectId[]) {
    if (ids.length === 0) return { state: 'not_needed' as const, failures: [] }
    try {
        const result = await reconcileSpacePendingNotificationsV2({
            pendingActionIds: ids.map((id) => id.toHexString()),
        })
        return {
            state: result.failures.length ? 'retry_required' as const : 'reconciled' as const,
            failures: result.failures,
        }
    } catch (error) {
        return {
            state: 'retry_required' as const,
            failures: [{ pendingActionId: 'batch', errorName: error instanceof Error ? error.name : 'UnknownError' }],
        }
    }
}

function participantById(participants: ISpaceParticipant[], participantId: string) {
    return participants.find((participant) => extractId(participant._id) === participantId)
}

function toLedgerEntries(entries: ISpaceEntry[]) {
    return entries.map((entry) => ({
        entryId: extractId(entry._id)!,
        status: entry.status === 'voided' ? 'voided' as const : 'recorded' as const,
        type: entry.type,
        amount: entry.amount,
        reportingAmount: entry.reportingAmount,
        paidByParticipantId: extractId(entry.paidByParticipantId),
        sharedWithParticipantIds: (entry.sharedWithParticipantIds ?? [])
            .map(extractId)
            .filter((id): id is string => Boolean(id)),
        splitMode: entry.splitMode,
        splitAllocations: (entry.splitAllocations ?? []).map((allocation) => ({
            participantId: extractId(allocation.participantId)!,
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
    }))
}

/** Única operación de liquidación para las superficies Espacios y Deudas. */
export async function settleSpaceDebtV2(input: SettleSpaceDebtV2Input) {
    const execution = await executeSpaceOperation({
        actorUserId: input.actorUserId,
        spaceId: input.spaceId,
        type: 'settle_debt',
        idempotencyKey: input.idempotencyKey,
        payload: { ...input, idempotencyKey: undefined },
        run: async (session, operationId) => {
            const context = await loadSpaceApplicationContextV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                session,
                capability: 'settle_balance',
            })
            if ((context.space.revision ?? 0) !== input.expectedRevision) {
                throw new ServiceError(409, 'SPACE_VERSION_CONFLICT', 'El Espacio cambió. Revisá el saldo antes de liquidar.', {
                    expectedRevision: input.expectedRevision,
                    actualRevision: context.space.revision ?? 0,
                })
            }
            if (!context.space.timezone) {
                throw new ServiceError(409, 'SPACE_TIMEZONE_REQUIRED', 'El Espacio necesita una zona horaria.')
            }
            if (!context.space.currencies.includes(input.currency)) {
                throw new ServiceError(400, 'SPACE_CURRENCY_UNSUPPORTED', 'La moneda no está habilitada en el Espacio.')
            }

            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpaceEntry[]>()
            const actorParticipantId = context.currentParticipant._id.toString()
            const represented = input.mode === 'represented'
            let payerParticipantId: string
            let receiverParticipantId: string
            let balanceReporting: number
            let actorDebt: IDebt | null = null

            if (represented) {
                const capabilities = getSpaceCapabilitiesV2({
                    status: context.space.status,
                    role: context.currentParticipant.role,
                    isActiveParticipant: context.currentParticipant.isActive,
                    isOwnerRecord: context.isOwnerRecord,
                })
                if (!capabilities.has('act_for_participant')) {
                    throw new ServiceError(403, 'SPACE_REPRESENTATION_DENIED', 'No podés liquidar en nombre de otras personas.')
                }
                payerParticipantId = input.payerParticipantId
                receiverParticipantId = input.receiverParticipantId
                if (payerParticipantId === receiverParticipantId) {
                    throw new ServiceError(400, 'SPACE_SETTLEMENT_PARTIES_INVALID', 'Las contrapartes deben ser distintas.')
                }
                const projection = calculateSpaceDebtProjectionsV2({
                    mode: context.space.debtMode ?? 'simplified',
                    entries: toLedgerEntries(entries),
                    participants: context.participants.map((participant) => ({
                        participantId: extractId(participant._id)!,
                        displayName: participant.displayName,
                        userId: extractId(participant.userId),
                    })),
                }).find((item) =>
                    item.fromParticipantId === payerParticipantId &&
                    item.toParticipantId === receiverParticipantId
                )
                if (!projection) {
                    throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'No existe un saldo vigente entre esas personas.')
                }
                balanceReporting = projection.amount
            } else {
                if (!Object.values(CURRENCIES).includes(input.currency as 'ARS' | 'USD')) {
                    throw new ServiceError(400, 'PERSONAL_CURRENCY_UNSUPPORTED', 'Mi Finp no admite esa moneda personal.')
                }
                actorDebt = await Debt.findOne({
                    _id: input.debtId,
                    userId: input.actorUserId,
                    spaceId: input.spaceId,
                    sourceType: 'space',
                    contractVersion: 2,
                    status: { $in: ['active', 'partially_paid', 'ignored'] },
                }).session(session).lean<IDebt | null>()
                if (!actorDebt || actorDebt.remainingAmount <= 0.01) {
                    throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'La obligación no existe o ya está saldada.')
                }
                const counterpartyParticipantId = extractId(actorDebt.counterpartyParticipantId)
                if (!counterpartyParticipantId) {
                    throw new ServiceError(409, 'SPACE_DEBT_COUNTERPARTY_MISSING', 'La contraparte histórica no está disponible.')
                }
                payerParticipantId = actorDebt.direction === 'payable' ? actorParticipantId : counterpartyParticipantId
                receiverParticipantId = actorDebt.direction === 'receivable' ? actorParticipantId : counterpartyParticipantId
                balanceReporting = actorDebt.remainingAmount
            }

            const payer = participantById(context.participants, payerParticipantId)
            const receiver = participantById(context.participants, receiverParticipantId)
            if (!payer || !receiver) {
                throw new ServiceError(409, 'SPACE_DEBT_COUNTERPARTY_MISSING', 'Las contrapartes históricas no están disponibles.')
            }
            const dateKey = normalizeFinancialDateKey(input.dateKey)
            const date = financialDateKeyToInstant(dateKey, context.space.timezone)
            const conversion = convertSpaceAmountV2({
                amount: input.amount,
                currency: input.currency,
                reportingCurrency: context.space.reportingCurrency,
                exchangeRate: input.exchangeRate,
            })
            if (conversion.reportingAmount > balanceReporting + 0.01) {
                throw new ServiceError(409, 'SPACE_SETTLEMENT_EXCEEDS_BALANCE', 'La liquidación supera el saldo vigente.')
            }

            const [createdEntry] = await SpaceEntry.create([{
                contractVersion: 2,
                spaceId: input.spaceId,
                createdByUserId: input.actorUserId,
                createdByParticipantId: actorParticipantId,
                type: 'settlement',
                status: 'recorded',
                title: 'Liquidación de saldo',
                amount: input.amount,
                currency: input.currency,
                reportingAmount: conversion.reportingAmount,
                exchangeRate: conversion.exchangeRate,
                date,
                dateKey,
                timezone: context.space.timezone,
                paidByParticipantId: payerParticipantId,
                sharedWithParticipantIds: [receiverParticipantId],
                splitMode: 'none',
                splitAllocations: [],
                revision: 0,
                operationId,
            }], { session })
            const entry = createdEntry.toObject() as ISpaceEntry
            const debts = await materializeSpaceDebtsV2({
                space: context.space,
                participants: context.participants,
                entries: [...entries, entry],
                operationId,
                triggeringEntryId: createdEntry._id,
                session,
            })

            const originSnapshot = buildSpaceImpactOriginSnapshotV2({ space: context.space, entry })
            const pendingImpactIds: Types.ObjectId[] = []
            let actorImpactId: Types.ObjectId | undefined
            let actorTransactionId: Types.ObjectId | undefined
            for (const participant of [payer, receiver]) {
                const participantId = participant._id.toString()
                const userId = extractId(participant.userId)
                if (!userId) continue
                const isPayer = participantId === payerParticipantId
                const isActorOwnDecision = !represented && userId === input.actorUserId
                const counterparty = isPayer ? receiver : payer
                const [impact] = await SpaceEntryPersonalImpact.create([{
                    contractVersion: 2,
                    spaceId: input.spaceId,
                    entryId: entry._id,
                    userId,
                    participantId,
                    impactKind: isPayer ? 'settlement_paid' : 'settlement_received',
                    amount: input.amount,
                    ownShareAmount: 0,
                    accountImpactAmount: input.amount,
                    operationalAmount: 0,
                    currency: input.currency,
                    status: isActorOwnDecision ? 'linked' : 'pending',
                    actionType: isPayer ? 'impact_space_payment' : 'impact_space_collect',
                    sourceType: isPayer ? 'debt_payment' : 'debt_collect',
                    actorUserId: input.actorUserId,
                    counterpartyParticipantId: counterparty._id,
                    counterpartyNameSnapshot: counterparty.displayName,
                    debtId: isActorOwnDecision ? actorDebt?._id : undefined,
                    originSnapshot,
                    revision: 0,
                    operationId,
                    ...(isActorOwnDecision ? { resolvedAt: new Date() } : {}),
                }], { session })
                if (!isActorOwnDecision) {
                    pendingImpactIds.push(impact._id)
                    continue
                }
                actorImpactId = impact._id
                const ownInput = input as Extract<SettleSpaceDebtV2Input, { mode?: 'own' }>
                const transactionInput = {
                    variant: isPayer ? 'settlement_paid' : 'settlement_received',
                    userId,
                    spaceId: input.spaceId,
                    spaceEntryId: entry._id.toString(),
                    spaceImpactId: impact._id.toString(),
                    spaceOperationId: operationId.toHexString(),
                    amount: input.amount,
                    operationalAmount: 0,
                    currency: input.currency as 'ARS' | 'USD',
                    date,
                    description: input.description?.trim() || `Liquidación · ${context.space.name}`,
                    spaceNameSnapshot: context.space.name,
                    ...(isPayer
                        ? { sourceAccountId: ownInput.accountId }
                        : { destinationAccountId: ownInput.accountId }),
                } as CreateInternalSpaceTransactionInput
                const transaction = await createInternalSpaceTransaction(transactionInput, session)
                const accountId = extractId(transaction.sourceAccountId) ?? extractId(transaction.destinationAccountId)
                await SpaceEntryPersonalImpact.updateOne(
                    { _id: impact._id, contractVersion: 2, revision: 0 },
                    { $set: { transactionId: transaction._id, accountId } },
                    { session }
                )
                actorTransactionId = transaction._id
            }
            const activity = await createSpaceActivityEventV2({
                spaceId: input.spaceId,
                actorUserId: input.actorUserId,
                actorParticipantId,
                operationId,
                type: 'settlement_created',
                entityType: 'settlement',
                entityId: entry._id.toString(),
                title: represented ? 'Liquidación representada registrada' : 'Saldo liquidado',
                metadata: { contractVersion: 2, originSurface: input.originSurface, represented },
                participants: context.participants,
                session,
            })
            return {
                value: {
                    spaceEntryId: entry._id.toString(),
                    remainingAmount: Math.max(0, balanceReporting - conversion.reportingAmount),
                    represented,
                },
                resultRefs: {
                    spaceEntryId: entry._id,
                    personalImpactId: actorImpactId,
                    transactionId: actorTransactionId,
                    debtId: actorDebt?._id,
                    pendingActionIds: pendingImpactIds,
                    debtIds: debts.debtIds.map((id) => new Types.ObjectId(id)),
                    debtMovementIds: debts.movementIds.map((id) => new Types.ObjectId(id)),
                    activityEventIds: [activity._id],
                },
            }
        },
    })
    return {
        ...execution,
        presentation: await reconcileSettlementPresentation(execution.resultRefs.pendingActionIds ?? []),
    }
}
