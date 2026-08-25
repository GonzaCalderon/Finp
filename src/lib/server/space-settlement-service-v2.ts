import { Types } from 'mongoose'

import { Debt, SpaceEntry, SpaceEntryPersonalImpact, Transaction } from '@/lib/models'
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
    assertConversionSnapshotConfirmable,
    buildManualConversionSnapshot,
    resolveSpaceReferenceQuote,
} from '@/lib/server/space-quote-service'
import {
    applySettlementLegsV2,
    type SettlementComponentInputV2,
    type SettlementLegInputV2,
} from '@/lib/server/space-settlement-allocator-v2'
import {
    createInternalSpaceTransaction,
    type CreateInternalSpaceTransactionInput,
} from '@/lib/server/transactions'
import {
    calculateSpaceDebtProjectionsV2,
    convertSpaceAmountV2,
    financialDateKeyToInstant,
    normalizeFinancialDateKey,
    type SpaceLedgerEntryV2,
} from '@/lib/utils/space-financial-v2'
import {
    assertMoneyDto,
    moneyFromDecimal,
    moneyToNumber,
    type ConversionSnapshot,
    type MoneyDto,
} from '@/lib/utils/money'
import { extractId } from '@/lib/utils/spaces'
import type { IDebt } from '@/types/debt'
import type { ISpaceEntry, ISpaceParticipant, ITransaction } from '@/types'

interface SettlementComponentRequest {
    debtId?: string
    currency: string
    amount?: number
    money?: MoneyDto
    order: number
}

interface SettlementConversionRequest {
    targetCurrency: string
    snapshot: ConversionSnapshot
    expectedQuoteFingerprint?: string
}

interface SettlementLegRequest {
    id: string
    currency: string
    amount?: number
    money?: MoneyDto
    accountId?: string
    linkedTransactionId?: string
    reportingSnapshot?: ConversionSnapshot
    expectedQuoteFingerprint?: string
    conversions?: SettlementConversionRequest[]
}

interface SettlementCommonInput {
    actorUserId: string
    spaceId: string
    idempotencyKey: string
    expectedRevision: number
    originSurface: 'spaces' | 'debts'
    amount?: number
    currency?: string
    exchangeRate?: number
    dateKey: string
    description?: string
    components?: SettlementComponentRequest[]
    legs?: SettlementLegRequest[]
}

export type SettleSpaceDebtV2Input = SettlementCommonInput & (
    | { mode?: 'own'; debtId?: string; accountId?: string }
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

function ledgerEntries(entries: ISpaceEntry[]): SpaceLedgerEntryV2[] {
    return entries.flatMap((entry) => {
        const base = {
            entryId: extractId(entry._id)!,
            status: entry.status === 'voided' ? 'voided' as const : 'recorded' as const,
            type: entry.type,
            paidByParticipantId: extractId(entry.paidByParticipantId),
            sharedWithParticipantIds: (entry.sharedWithParticipantIds ?? [])
                .map(extractId).filter((id): id is string => Boolean(id)),
            splitMode: entry.splitMode,
            splitAllocations: (entry.splitAllocations ?? []).map((allocation) => ({
                participantId: extractId(allocation.participantId)!,
                percentage: allocation.percentage,
                amount: allocation.amount,
            })),
        }
        if (entry.type === 'settlement' && entry.settlementLegs?.length) {
            return entry.settlementLegs.flatMap((leg) => leg.applications.map((application, index) => ({
                ...base,
                entryId: `${base.entryId}:${leg.legId}:${index}`,
                amount: moneyToNumber(application.appliedMoney),
                reportingAmount: moneyToNumber(application.appliedMoney),
                currency: application.debtCurrency,
                reportingCurrency: application.debtCurrency,
            })))
        }
        return [{
            ...base,
            amount: entry.amount,
            reportingAmount: entry.reportingAmount,
            currency: entry.currency,
            reportingCurrency: entry.reportingMoney?.currency,
        }]
    })
}

function normalizeRequestedMoney(input: { currency: string; amount?: number; money?: MoneyDto }) {
    const money = input.money ? assertMoneyDto(input.money) : moneyFromDecimal(input.currency, input.amount ?? 0)
    if (money.currency !== input.currency || BigInt(money.minorUnits) <= BigInt(0)) {
        throw new ServiceError(400, 'SPACE_SETTLEMENT_MONEY_INVALID', 'El tramo de liquidación no tiene un monto válido.')
    }
    if (input.amount !== undefined && moneyToNumber(money) !== input.amount) {
        throw new ServiceError(400, 'SPACE_MONEY_MISMATCH', 'El monto exacto no coincide con la liquidación.')
    }
    return money
}

async function validateSnapshot(input: {
    sourceCurrency: string
    targetCurrency: string
    snapshot: ConversionSnapshot
    expectedQuoteFingerprint?: string
}) {
    assertConversionSnapshotConfirmable(input.snapshot)
    if (input.snapshot.source === 'manual') return
    const current = await resolveSpaceReferenceQuote({
        sourceCurrency: input.sourceCurrency,
        targetCurrency: input.targetCurrency,
    })
    if (!current || !input.expectedQuoteFingerprint || current.fingerprint !== input.expectedQuoteFingerprint) {
        throw new ServiceError(409, 'SPACE_QUOTE_CHANGED', 'La cotización cambió. Revisá la liquidación antes de confirmar.', {
            currentQuote: current,
        })
    }
}

/** Operación única para Espacios y Deudas; todos los tramos se confirman o se revierten juntos. */
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
                throw new ServiceError(409, 'SPACE_VERSION_CONFLICT', 'El Espacio cambió. Revisá el saldo antes de liquidar.')
            }
            if (!context.space.timezone) {
                throw new ServiceError(409, 'SPACE_TIMEZONE_REQUIRED', 'El Espacio necesita una zona horaria.')
            }
            const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 })
                .session(session).lean<ISpaceEntry[]>()
            const actorParticipantId = context.currentParticipant._id.toString()
            const represented = input.mode === 'represented'
            let payerParticipantId: string
            let receiverParticipantId: string
            let actorDebts: IDebt[] = []
            let availableComponents: SettlementComponentInputV2[] = []

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
                const projections = calculateSpaceDebtProjectionsV2({
                    mode: context.space.debtMode ?? 'simplified',
                    entries: ledgerEntries(entries),
                    participants: context.participants.map((participant) => ({
                        participantId: extractId(participant._id)!,
                        displayName: participant.displayName,
                        userId: extractId(participant.userId),
                    })),
                }).filter((projection) =>
                    projection.fromParticipantId === payerParticipantId &&
                    projection.toParticipantId === receiverParticipantId
                )
                availableComponents = projections.map((projection, index) => ({
                    currency: projection.currency ?? context.space.reportingCurrency,
                    amount: moneyFromDecimal(projection.currency ?? context.space.reportingCurrency, projection.amount),
                    order: index,
                }))
            } else {
                const requestedDebtIds = Array.from(new Set([
                    ...((input.components ?? []).map((component) => component.debtId).filter(Boolean) as string[]),
                    ...(input.debtId ? [input.debtId] : []),
                ]))
                if (requestedDebtIds.length === 0) {
                    throw new ServiceError(400, 'SPACE_DEBT_REQUIRED', 'Elegí al menos un componente de deuda.')
                }
                actorDebts = await Debt.find({
                    _id: { $in: requestedDebtIds },
                    userId: input.actorUserId,
                    spaceId: input.spaceId,
                    sourceType: 'space',
                    contractVersion: 2,
                    status: { $in: ['active', 'partially_paid', 'ignored'] },
                }).session(session).lean<IDebt[]>()
                if (actorDebts.length !== requestedDebtIds.length) {
                    throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'Una obligación no existe o ya está saldada.')
                }
                const firstDebt = actorDebts[0]
                const counterpartyParticipantId = extractId(firstDebt.counterpartyParticipantId)
                if (!counterpartyParticipantId || actorDebts.some((debt) =>
                    extractId(debt.counterpartyParticipantId) !== counterpartyParticipantId ||
                    debt.direction !== firstDebt.direction
                )) {
                    throw new ServiceError(409, 'SPACE_SETTLEMENT_PARTIES_INVALID', 'Los componentes deben pertenecer a la misma relación.')
                }
                payerParticipantId = firstDebt.direction === 'payable' ? actorParticipantId : counterpartyParticipantId
                receiverParticipantId = firstDebt.direction === 'receivable' ? actorParticipantId : counterpartyParticipantId
                availableComponents = actorDebts.map((debt, index) => ({
                    debtId: debt._id.toString(),
                    currency: debt.currency,
                    amount: debt.remainingMoney ?? moneyFromDecimal(debt.currency, debt.remainingAmount),
                    order: index,
                }))
            }

            if (payerParticipantId === receiverParticipantId || availableComponents.length === 0) {
                throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'No existe un saldo vigente entre esas personas.')
            }
            const payer = participantById(context.participants, payerParticipantId)
            const receiver = participantById(context.participants, receiverParticipantId)
            if (!payer || !receiver) {
                throw new ServiceError(409, 'SPACE_DEBT_COUNTERPARTY_MISSING', 'Las contrapartes históricas no están disponibles.')
            }

            const requestedComponents = input.components?.length
                ? input.components.map((component) => {
                    const available = availableComponents.find((candidate) =>
                        component.debtId ? candidate.debtId === component.debtId : candidate.currency === component.currency
                    )
                    if (!available || available.currency !== component.currency) {
                        throw new ServiceError(409, 'SPACE_SETTLEMENT_COMPONENT_STALE', 'Un componente de deuda cambió.')
                    }
                    const amount = normalizeRequestedMoney(component)
                    if (BigInt(amount.minorUnits) > BigInt(available.amount.minorUnits)) {
                        throw new ServiceError(409, 'SPACE_SETTLEMENT_EXCEEDS_BALANCE', 'La liquidación supera el saldo vigente.')
                    }
                    return { ...available, amount, order: component.order }
                })
                : availableComponents

            const legacyCurrency = input.currency
            const legacyPaidMoney = legacyCurrency && input.amount !== undefined
                ? moneyFromDecimal(legacyCurrency, input.amount)
                : undefined
            const legacySameCurrencyUnits = legacyCurrency
                ? requestedComponents
                    .filter((component) => component.currency === legacyCurrency)
                    .reduce((sum, component) => sum + BigInt(component.amount.minorUnits), BigInt(0))
                : BigInt(0)
            const legacyNeedsCrossCurrency = legacyPaidMoney
                ? BigInt(legacyPaidMoney.minorUnits) > legacySameCurrencyUnits
                : false
            const requestedLegs: SettlementLegRequest[] = input.legs?.length
                ? input.legs
                : legacyCurrency && input.amount !== undefined
                    ? [{
                        id: 'leg-1',
                        currency: legacyCurrency,
                        amount: input.amount,
                        accountId: represented ? undefined : input.accountId,
                        reportingSnapshot: legacyCurrency === context.space.reportingCurrency
                            ? undefined
                            : buildManualConversionSnapshot({
                                sourceCurrency: legacyCurrency,
                                targetCurrency: context.space.reportingCurrency,
                                rate: input.exchangeRate?.toString() ?? '',
                                actorUserId: input.actorUserId,
                            }),
                        conversions: (legacyNeedsCrossCurrency ? requestedComponents : [])
                            .filter((component) => component.currency !== legacyCurrency)
                            .map((component) => ({
                                targetCurrency: component.currency,
                                snapshot: buildManualConversionSnapshot({
                                    sourceCurrency: legacyCurrency,
                                    targetCurrency: component.currency,
                                    rate: input.exchangeRate?.toString() ?? '',
                                    actorUserId: input.actorUserId,
                                }),
                            })),
                    }]
                    : []
            if (requestedLegs.length === 0) {
                throw new ServiceError(400, 'SPACE_SETTLEMENT_LEGS_REQUIRED', 'Agregá al menos un tramo de pago.')
            }

            const normalizedLegs: Array<{
                request: SettlementLegRequest
                paid: MoneyDto
                reportingMoney: MoneyDto
                reportingSnapshot?: ConversionSnapshot
            }> = []
            for (const leg of requestedLegs) {
                if (!context.space.currencies.includes(leg.currency)) {
                    throw new ServiceError(400, 'SPACE_CURRENCY_UNSUPPORTED', 'La moneda del tramo no está habilitada.')
                }
                const paid = normalizeRequestedMoney(leg)
                let reportingSnapshot = leg.reportingSnapshot
                if (leg.currency !== context.space.reportingCurrency) {
                    if (!reportingSnapshot) {
                        throw new ServiceError(400, 'SPACE_QUOTE_REQUIRED', 'El tramo necesita una cotización a moneda de reporte.')
                    }
                    await validateSnapshot({
                        sourceCurrency: leg.currency,
                        targetCurrency: context.space.reportingCurrency,
                        snapshot: reportingSnapshot,
                        expectedQuoteFingerprint: leg.expectedQuoteFingerprint,
                    })
                } else {
                    reportingSnapshot = undefined
                }
                for (const conversion of leg.conversions ?? []) {
                    await validateSnapshot({
                        sourceCurrency: leg.currency,
                        targetCurrency: conversion.targetCurrency,
                        snapshot: conversion.snapshot,
                        expectedQuoteFingerprint: conversion.expectedQuoteFingerprint,
                    })
                }
                const reportingMoney = leg.currency === context.space.reportingCurrency
                    ? paid
                    : convertSpaceAmountV2({
                        amount: moneyToNumber(paid),
                        currency: leg.currency,
                        reportingCurrency: context.space.reportingCurrency,
                        exchangeRateDecimal: reportingSnapshot!.rate,
                        direction: reportingSnapshot!.direction,
                    }).reportingMoney
                normalizedLegs.push({ request: leg, paid, reportingMoney, reportingSnapshot })
            }

            let allocation: ReturnType<typeof applySettlementLegsV2>
            try {
                allocation = applySettlementLegsV2({
                    components: requestedComponents,
                    legs: normalizedLegs.map((leg) => ({
                        id: leg.request.id,
                        paid: leg.paid,
                        conversions: leg.request.conversions,
                    }) satisfies SettlementLegInputV2),
                })
            } catch (error) {
                if (error instanceof Error && error.message === 'SPACE_SETTLEMENT_OVERPAYMENT') {
                    throw new ServiceError(409, 'SPACE_SETTLEMENT_EXCEEDS_BALANCE', 'La liquidación supera el saldo por más de una unidad menor.')
                }
                throw new ServiceError(400, 'SPACE_SETTLEMENT_ALLOCATION_INVALID', 'No se pudieron aplicar los tramos al saldo.')
            }

            const dateKey = normalizeFinancialDateKey(input.dateKey)
            const date = financialDateKeyToInstant(dateKey, context.space.timezone)
            const reportingScale = normalizedLegs[0].reportingMoney.scale
            const totalReportingMoney = {
                currency: context.space.reportingCurrency,
                minorUnits: normalizedLegs.reduce(
                    (sum, leg) => sum + BigInt(leg.reportingMoney.minorUnits),
                    BigInt(0)
                ).toString(),
                scale: reportingScale,
            }
            const firstLeg = normalizedLegs[0]
            const [createdEntry] = await SpaceEntry.create([{
                contractVersion: 2,
                spaceId: input.spaceId,
                createdByUserId: input.actorUserId,
                createdByParticipantId: actorParticipantId,
                type: 'settlement',
                status: 'recorded',
                title: 'Liquidación de saldo',
                amount: moneyToNumber(firstLeg.paid),
                currency: firstLeg.paid.currency,
                reportingAmount: moneyToNumber(totalReportingMoney),
                exchangeRate: firstLeg.reportingSnapshot ? Number(firstLeg.reportingSnapshot.rate) : undefined,
                originalMoney: firstLeg.paid,
                reportingMoney: totalReportingMoney,
                conversionSnapshot: firstLeg.reportingSnapshot,
                settlementLegs: normalizedLegs.map((leg) => ({
                    legId: leg.request.id,
                    paidMoney: leg.paid,
                    reportingMoney: leg.reportingMoney,
                    accountId: leg.request.accountId,
                    linkedTransactionId: leg.request.linkedTransactionId,
                    conversionSnapshot: leg.reportingSnapshot,
                    applications: allocation.applications
                        .filter((application) => application.legId === leg.request.id)
                        .map((application) => ({
                            debtId: application.debtId,
                            debtCurrency: application.debtCurrency,
                            paidMoney: application.paid,
                            appliedMoney: application.applied,
                            conversionSnapshot: application.conversionSnapshot,
                        })),
                })),
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
            const actorTransactionIds: Types.ObjectId[] = []
            for (const participant of [payer, receiver]) {
                const participantId = participant._id.toString()
                const userId = extractId(participant.userId)
                if (!userId) continue
                const isPayer = participantId === payerParticipantId
                const isActorOwnDecision = !represented && userId === input.actorUserId
                const counterparty = isPayer ? receiver : payer
                const financialLinks = normalizedLegs.map((leg) => ({
                    legId: leg.request.id,
                    currency: leg.paid.currency,
                    amountMoney: leg.paid,
                    accountId: leg.request.accountId ? new Types.ObjectId(leg.request.accountId) : undefined,
                    status: 'pending' as const,
                }))
                const [impact] = await SpaceEntryPersonalImpact.create([{
                    contractVersion: 2,
                    spaceId: input.spaceId,
                    entryId: entry._id,
                    userId,
                    participantId,
                    impactKind: isPayer ? 'settlement_paid' : 'settlement_received',
                    amount: moneyToNumber(firstLeg.paid),
                    amountMoney: firstLeg.paid,
                    ownShareAmount: 0,
                    accountImpactAmount: moneyToNumber(firstLeg.paid),
                    operationalAmount: 0,
                    currency: firstLeg.paid.currency,
                    status: 'pending',
                    financialLinks,
                    actionType: isPayer ? 'impact_space_payment' : 'impact_space_collect',
                    sourceType: isPayer ? 'debt_payment' : 'debt_collect',
                    actorUserId: input.actorUserId,
                    counterpartyParticipantId: counterparty._id,
                    counterpartyNameSnapshot: counterparty.displayName,
                    debtId: isActorOwnDecision ? actorDebts[0]?._id : undefined,
                    originSnapshot,
                    revision: 0,
                    operationId,
                }], { session })

                if (!isActorOwnDecision) {
                    pendingImpactIds.push(impact._id)
                    continue
                }
                actorImpactId = impact._id
                const resolvedLinks = []
                for (const leg of normalizedLegs) {
                    const personalCurrency = Object.values(CURRENCIES).includes(leg.paid.currency as 'ARS' | 'USD')
                    let transaction: ITransaction | null = null
                    if (leg.request.linkedTransactionId) {
                        transaction = await Transaction.findOne({
                            _id: leg.request.linkedTransactionId,
                            userId,
                            type: isPayer ? 'personal_debt_payment' : 'personal_debt_collect',
                            currency: leg.paid.currency,
                            amount: moneyToNumber(leg.paid),
                            $or: [{ spaceImpactId: { $exists: false } }, { spaceImpactId: impact._id }],
                        }).session(session).lean<ITransaction | null>()
                        if (!transaction) {
                            throw new ServiceError(409, 'SPACE_TRANSACTION_PREVIEW_STALE', 'La transacción elegida ya no coincide con el tramo.')
                        }
                        await Transaction.updateOne({ _id: transaction._id }, { $set: {
                            spaceId: input.spaceId,
                            spaceEntryId: entry._id,
                            spaceImpactId: impact._id,
                            spaceOperationId: operationId,
                            spaceContractVersion: 2,
                        } }, { session })
                    } else if (leg.request.accountId && personalCurrency) {
                        transaction = await createInternalSpaceTransaction({
                            variant: isPayer ? 'settlement_paid' : 'settlement_received',
                            userId,
                            spaceId: input.spaceId,
                            spaceEntryId: entry._id.toString(),
                            spaceImpactId: impact._id.toString(),
                            spaceOperationId: operationId.toHexString(),
                            amount: moneyToNumber(leg.paid),
                            operationalAmount: 0,
                            currency: leg.paid.currency as 'ARS' | 'USD',
                            date,
                            description: input.description?.trim() || `Liquidación · ${context.space.name}`,
                            spaceNameSnapshot: context.space.name,
                            ...(isPayer
                                ? { sourceAccountId: leg.request.accountId }
                                : { destinationAccountId: leg.request.accountId }),
                        } as CreateInternalSpaceTransactionInput, session)
                    }
                    if (transaction) actorTransactionIds.push(transaction._id)
                    resolvedLinks.push({
                        legId: leg.request.id,
                        currency: leg.paid.currency,
                        amountMoney: leg.paid,
                        accountId: leg.request.accountId ? new Types.ObjectId(leg.request.accountId) : undefined,
                        transactionId: transaction?._id,
                        status: transaction ? 'linked' as const : 'pending' as const,
                    })
                }
                const allLinked = resolvedLinks.every((link) => link.status === 'linked')
                await SpaceEntryPersonalImpact.updateOne({ _id: impact._id }, { $set: {
                    financialLinks: resolvedLinks,
                    status: allLinked ? 'linked' : 'pending',
                    transactionId: actorTransactionIds[0],
                    accountId: resolvedLinks[0]?.accountId,
                    ...(allLinked ? { resolvedAt: new Date() } : {}),
                } }, { session })
                if (!allLinked) pendingImpactIds.push(impact._id)
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
                metadata: {
                    contractVersion: 2,
                    originSurface: input.originSurface,
                    represented,
                    legCount: normalizedLegs.length,
                    currencies: normalizedLegs.map((leg) => leg.paid.currency),
                },
                participants: context.participants,
                session,
            })
            return {
                value: {
                    spaceEntryId: entry._id.toString(),
                    remainingByCurrency: allocation.remaining,
                    remainingAmount: allocation.remaining.length === 1
                        ? moneyToNumber(allocation.remaining[0])
                        : undefined,
                    represented,
                },
                resultRefs: {
                    spaceEntryId: entry._id,
                    personalImpactId: actorImpactId,
                    transactionId: actorTransactionIds[0],
                    debtId: actorDebts[0]?._id,
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
