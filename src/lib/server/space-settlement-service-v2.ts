import { Types } from 'mongoose'

import {
    Debt,
    SpaceEntry,
    SpaceEntryPersonalImpact,
} from '@/lib/models'
import { CURRENCIES } from '@/lib/constants'
import { ServiceError } from '@/lib/server/errors'
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
    convertSpaceAmountV2,
    financialDateKeyToInstant,
    normalizeFinancialDateKey,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry } from '@/types'
import type { IDebt } from '@/types/debt'

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

/** Única operación de liquidación para las superficies Espacios y Deudas. */
export async function settleSpaceDebtV2(input: {
    actorUserId: string
    spaceId: string
    debtId: string
    idempotencyKey: string
    originSurface: 'spaces' | 'debts'
    amount: number
    currency: 'ARS' | 'USD'
    exchangeRate?: number
    dateKey: string
    accountId: string
    description?: string
}) {
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
            if (!context.space.timezone) {
                throw new ServiceError(409, 'SPACE_TIMEZONE_REQUIRED', 'El Espacio necesita una zona horaria.')
            }
            if (!Object.values(CURRENCIES).includes(input.currency)) {
                throw new ServiceError(400, 'PERSONAL_CURRENCY_UNSUPPORTED', 'Mi Finp no admite esa moneda personal.')
            }
            const debt = await Debt.findOne({
                _id: input.debtId,
                userId: input.actorUserId,
                spaceId: input.spaceId,
                sourceType: 'space',
                contractVersion: 2,
                status: { $in: ['active', 'partially_paid', 'ignored'] },
            }).session(session).lean<IDebt | null>()
            if (!debt || debt.remainingAmount <= 0.01) {
                throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'La obligación no existe o ya está saldada.')
            }
            const actorParticipantId = context.currentParticipant._id.toString()
            const counterpartyParticipantId = extractId(debt.counterpartyParticipantId)
            const counterparty = context.participants.find(
                (participant) => extractId(participant._id) === counterpartyParticipantId
            )
            if (!counterpartyParticipantId || !counterparty) {
                throw new ServiceError(409, 'SPACE_DEBT_COUNTERPARTY_MISSING', 'La contraparte histórica no está disponible.')
            }
            const dateKey = normalizeFinancialDateKey(input.dateKey)
            const date = financialDateKeyToInstant(dateKey, context.space.timezone)
            const conversion = convertSpaceAmountV2({
                amount: input.amount,
                currency: input.currency,
                reportingCurrency: context.space.reportingCurrency,
                exchangeRate: input.exchangeRate,
            })
            if (conversion.reportingAmount > debt.remainingAmount + 0.01) {
                throw new ServiceError(409, 'SPACE_SETTLEMENT_EXCEEDS_BALANCE', 'La liquidación supera el saldo vigente.')
            }
            const payerParticipantId = debt.direction === 'payable'
                ? actorParticipantId
                : counterpartyParticipantId
            const receiverParticipantId = debt.direction === 'receivable'
                ? actorParticipantId
                : counterpartyParticipantId
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
            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpaceEntry[]>()
            const debts = await materializeSpaceDebtsV2({
                space: context.space,
                participants: context.participants,
                entries,
                operationId,
                triggeringEntryId: createdEntry._id,
                session,
            })

            const originSnapshot = buildSpaceImpactOriginSnapshotV2({ space: context.space, entry })
            const actionImpactIds: Types.ObjectId[] = []
            let actorImpactId: Types.ObjectId | undefined
            let actorTransactionId: Types.ObjectId | undefined
            for (const participant of [context.currentParticipant, counterparty]) {
                const participantId = participant._id.toString()
                const userId = extractId(participant.userId)
                if (!userId) continue
                const isPayer = participantId === payerParticipantId
                const kind = isPayer ? 'settlement_paid' as const : 'settlement_received' as const
                const isActor = userId === input.actorUserId
                const [impact] = await SpaceEntryPersonalImpact.create([{
                    contractVersion: 2,
                    spaceId: input.spaceId,
                    entryId: entry._id,
                    userId,
                    participantId,
                    impactKind: kind,
                    amount: input.amount,
                    ownShareAmount: 0,
                    accountImpactAmount: input.amount,
                    operationalAmount: 0,
                    currency: input.currency,
                    status: isActor ? 'linked' : 'pending',
                    actionType: isPayer ? 'impact_space_payment' : 'impact_space_collect',
                    sourceType: isPayer ? 'debt_payment' : 'debt_collect',
                    actorUserId: input.actorUserId,
                    counterpartyParticipantId: isActor ? counterpartyParticipantId : actorParticipantId,
                    counterpartyNameSnapshot: isActor ? counterparty.displayName : context.currentParticipant.displayName,
                    debtId: isActor ? debt._id : undefined,
                    originSnapshot,
                    revision: 0,
                    operationId,
                    ...(isActor ? { resolvedAt: new Date() } : {}),
                }], { session })
                if (!isActor) {
                    actionImpactIds.push(impact._id)
                    continue
                }
                actorImpactId = impact._id
                const transactionInput = {
                    variant: isPayer ? 'settlement_paid' : 'settlement_received',
                    userId,
                    spaceId: input.spaceId,
                    spaceEntryId: entry._id.toString(),
                    spaceImpactId: impact._id.toString(),
                    spaceOperationId: operationId.toHexString(),
                    amount: input.amount,
                    operationalAmount: 0,
                    currency: input.currency,
                    date,
                    description: input.description?.trim() || `Liquidación · ${context.space.name}`,
                    spaceNameSnapshot: context.space.name,
                    ...(isPayer
                        ? { sourceAccountId: input.accountId }
                        : { destinationAccountId: input.accountId }),
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
                title: 'Saldo liquidado',
                metadata: { contractVersion: 2, originSurface: input.originSurface },
                participants: context.participants,
                session,
            })
            return {
                value: { spaceEntryId: entry._id.toString(), remainingAmount: Math.max(0, debt.remainingAmount - conversion.reportingAmount) },
                resultRefs: {
                    spaceEntryId: entry._id,
                    personalImpactId: actorImpactId,
                    transactionId: actorTransactionId,
                    debtId: debt._id,
                    pendingActionIds: actionImpactIds,
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
