import { Types } from 'mongoose'

import { Debt, Space, SpaceEntry, SpaceParticipant, Transaction } from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import { getSpaceCapabilitiesV2 } from '@/lib/server/space-capabilities'
import {
    calculateSpaceSharesV2,
    calculateSpaceDebtProjectionsV2,
    convertSpaceAmountV2,
    derivePersonalImpactAmountsV2,
    type SpaceLedgerEntryV2,
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
import {
    assertConversionSnapshotConfirmable,
    buildManualConversionSnapshot,
} from '@/lib/server/space-quote-service'
import { convertMoneyExact, moneyFromDecimal, moneyMatchesDecimal, moneyToNumber, type ConversionSnapshot, type MoneyDto } from '@/lib/utils/money'
import { applySettlementLegsV2 } from '@/lib/server/space-settlement-allocator-v2'

function previewLedgerEntries(entries: ISpaceEntry[], reportingCurrency: string): SpaceLedgerEntryV2[] {
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
            reportingCurrency,
        }]
    })
}

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
    money?: MoneyDto
    currency: string
    exchangeRate?: number
    exchangeRateDecimal?: string
    conversionSnapshot?: ConversionSnapshot
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
    if (input.money) {
        if (!moneyMatchesDecimal(input.money, input.currency, input.amount)) {
            throw new ServiceError(400, 'SPACE_MONEY_MISMATCH', 'El monto exacto no coincide con el preview.')
        }
    }
    const snapshot = input.currency === context.space.reportingCurrency
        ? undefined
        : input.conversionSnapshot ?? buildManualConversionSnapshot({
            sourceCurrency: input.currency,
            targetCurrency: context.space.reportingCurrency,
            rate: input.exchangeRateDecimal ?? input.exchangeRate?.toString() ?? '',
            actorUserId: input.actorUserId,
        })
    if (snapshot) assertConversionSnapshotConfirmable(snapshot)
    const conversion = convertSpaceAmountV2({
        amount: input.amount,
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
        exchangeRate: input.exchangeRate,
        exchangeRateDecimal: input.exchangeRateDecimal ?? snapshot?.rate,
        direction: snapshot?.direction,
        snapshot,
    })
    const shares = calculateSpaceSharesV2({
        amount: input.amount,
        reportingAmount: conversion.reportingAmount,
        currency: input.currency,
        reportingCurrency: context.space.reportingCurrency,
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
        currency: input.currency,
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
        if (transaction && moneyFromDecimal(input.currency, transaction.amount).minorUnits !==
            moneyFromDecimal(input.currency, expectedAmount).minorUnits) issues.push('amount_mismatch')
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
        originalMoney: conversion.originalMoney,
        reportingMoney: conversion.reportingMoney,
        conversionSnapshot: snapshot,
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
            entries: previewLedgerEntries(entries, context.space.reportingCurrency),
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

export async function previewSpaceSettlementMultiV2(input: {
    actorUserId: string
    spaceId: string
    mode: 'own' | 'represented'
    payerParticipantId?: string
    receiverParticipantId?: string
    components: Array<{ debtId?: string; currency: string; amount?: number; money?: MoneyDto; order: number }>
    legs: Array<{
        id: string
        currency: string
        amount?: number
        money?: MoneyDto
        reportingSnapshot?: ConversionSnapshot
        conversions?: Array<{ targetCurrency: string; snapshot: ConversionSnapshot }>
    }>
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
    const requestedComponents = input.components.map((component) => ({
        ...component,
        amountMoney: component.money ?? moneyFromDecimal(component.currency, component.amount ?? 0),
    }))
    let payerParticipantId: string
    let receiverParticipantId: string
    if (input.mode === 'own') {
        const debtIds = requestedComponents.map((component) => component.debtId).filter(Boolean) as string[]
        const debts = await Debt.find({
            _id: { $in: debtIds },
            userId: input.actorUserId,
            spaceId: input.spaceId,
            contractVersion: 2,
            status: { $in: ['active', 'partially_paid', 'ignored'] },
        }).lean<IDebt[]>()
        if (debts.length !== debtIds.length || debts.length === 0) {
            throw new ServiceError(404, 'SPACE_DEBT_NOT_FOUND', 'La obligación no está disponible.')
        }
        const first = debts[0]
        const actorParticipantId = extractId(context.currentParticipant._id)!
        const counterpartyId = extractId(first.counterpartyParticipantId)
        if (!counterpartyId) throw new ServiceError(409, 'SPACE_DEBT_COUNTERPARTY_MISSING', 'Falta la contraparte histórica.')
        payerParticipantId = first.direction === 'payable' ? actorParticipantId : counterpartyId
        receiverParticipantId = first.direction === 'receivable' ? actorParticipantId : counterpartyId
        for (const component of requestedComponents) {
            const debt = debts.find((candidate) => candidate._id.toString() === component.debtId)
            if (!debt || debt.currency !== component.currency || BigInt(component.amountMoney.minorUnits) > BigInt(
                debt.remainingMoney?.minorUnits ?? moneyFromDecimal(debt.currency, debt.remainingAmount).minorUnits
            )) {
                throw new ServiceError(409, 'SPACE_SETTLEMENT_COMPONENT_STALE', 'Un componente cambió antes del preview.')
            }
        }
    } else {
        if (!capabilities.has('act_for_participant') || !input.payerParticipantId || !input.receiverParticipantId) {
            throw new ServiceError(403, 'SPACE_REPRESENTATION_DENIED', 'No podés liquidar en nombre de otras personas.')
        }
        payerParticipantId = input.payerParticipantId
        receiverParticipantId = input.receiverParticipantId
        const entries = await SpaceEntry.find({ spaceId: input.spaceId, contractVersion: 2 }).lean<ISpaceEntry[]>()
        const available = calculateSpaceDebtProjectionsV2({
            mode: context.space.debtMode ?? 'simplified',
            entries: previewLedgerEntries(entries, context.space.reportingCurrency),
            participants: context.participants.map((participant) => ({
                participantId: extractId(participant._id)!,
                displayName: participant.displayName,
                userId: extractId(participant.userId),
            })),
        }).filter((projection) =>
            projection.fromParticipantId === payerParticipantId &&
            projection.toParticipantId === receiverParticipantId
        )
        for (const component of requestedComponents) {
            const projection = available.find((candidate) => candidate.currency === component.currency)
            if (!projection || BigInt(component.amountMoney.minorUnits) > BigInt(
                moneyFromDecimal(component.currency, projection.amount).minorUnits
            )) {
                throw new ServiceError(409, 'SPACE_SETTLEMENT_COMPONENT_STALE', 'Un componente cambió antes del preview.')
            }
        }
    }
    const normalizedLegs = input.legs.map((leg) => ({
        ...leg,
        paid: leg.money ?? moneyFromDecimal(leg.currency, leg.amount ?? 0),
    }))
    const allocation = applySettlementLegsV2({
        components: requestedComponents.map((component) => ({
            debtId: component.debtId,
            currency: component.currency,
            amount: component.amountMoney,
            order: component.order,
        })),
        legs: normalizedLegs.map((leg) => ({
            id: leg.id,
            paid: leg.paid,
            conversions: leg.conversions,
        })),
    })
    const reportingAmounts = normalizedLegs.map((leg) => leg.currency === context.space.reportingCurrency
        ? leg.paid
        : convertSpaceAmountV2({
            amount: moneyToNumber(leg.paid),
            currency: leg.currency,
            reportingCurrency: context.space.reportingCurrency,
            exchangeRateDecimal: leg.reportingSnapshot?.rate,
            direction: leg.reportingSnapshot?.direction,
        }).reportingMoney
    )
    const totalReporting = reportingAmounts.reduce((sum, money) => sum + BigInt(money.minorUnits), BigInt(0))
    const remainingReporting = allocation.remaining.map((money) => {
        if (money.currency === context.space.reportingCurrency) return money
        const snapshot = normalizedLegs.find((leg) => leg.currency === money.currency)?.reportingSnapshot
        return snapshot ? convertMoneyExact({
            money,
            targetCurrency: context.space.reportingCurrency,
            rate: snapshot.rate,
            direction: snapshot.direction,
        }) : null
    })
    return {
        currency: normalizedLegs[0].currency,
        reportingCurrency: context.space.reportingCurrency,
        amount: moneyToNumber(normalizedLegs[0].paid),
        reportingAmount: moneyToNumber({ ...reportingAmounts[0], minorUnits: totalReporting.toString() }),
        payerParticipantId,
        receiverParticipantId,
        actorMovesPersonalAccount: input.mode === 'own',
        actorAccountImpactAmount: input.mode === 'own'
            ? normalizedLegs.reduce((sum, leg) => sum + moneyToNumber(leg.paid), 0)
            : 0,
        actorOperationalAmount: 0,
        remainingBalanceReporting: remainingReporting.every((money): money is MoneyDto => money !== null)
            ? moneyToNumber({
                currency: context.space.reportingCurrency,
                scale: reportingAmounts[0].scale,
                minorUnits: remainingReporting.reduce((sum, money) => sum + BigInt(money.minorUnits), BigInt(0)).toString(),
            })
            : undefined,
        components: requestedComponents.map((component) => ({
            debtId: component.debtId,
            currency: component.currency,
            amount: component.amountMoney,
            order: component.order,
        })),
        legs: normalizedLegs.map((leg, index) => ({
            id: leg.id,
            paid: leg.paid,
            reporting: reportingAmounts[index],
            conversionSnapshots: leg.reportingSnapshot ? [leg.reportingSnapshot] : [],
            applications: allocation.applications
                .filter((application) => application.legId === leg.id)
                .map((application) => ({
                    legId: application.legId,
                    debtCurrency: application.debtCurrency,
                    paid: application.paid,
                    applied: application.applied,
                    conversionSnapshot: application.conversionSnapshot,
                })),
        })),
        applications: allocation.applications.map((application) => ({
            legId: application.legId,
            debtCurrency: application.debtCurrency,
            paid: application.paid,
            applied: application.applied,
            conversionSnapshot: application.conversionSnapshot,
        })),
        remainingByCurrency: allocation.remaining,
    }
}
