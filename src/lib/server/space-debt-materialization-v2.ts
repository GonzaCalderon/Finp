import { Types, type ClientSession } from 'mongoose'

import { Debt, DebtMovement } from '@/lib/models'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'
import type { IDebt, IDebtMovement } from '@/types/debt'
import {
    calculateSpaceDebtProjectionsV2,
    type SpaceDebtProjectionV2,
    type SpaceLedgerEntryV2,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import { moneyFromDecimal, moneyToNumber } from '@/lib/utils/money'

function requireV2Entries(entry: ISpaceEntry): SpaceLedgerEntryV2[] {
    if (
        entry.contractVersion !== 2 ||
        (entry.status !== 'recorded' && entry.status !== 'voided')
    ) {
        throw new Error('SPACE_V2_DEBT_MATERIALIZATION_REQUIRES_V2_ENTRY')
    }
    const entryId = extractId(entry._id)
    if (!entryId) throw new Error('SPACE_V2_ENTRY_ID_MISSING')
    const base = {
        entryId,
        status: entry.status,
        type: entry.type,
        paidByParticipantId: extractId(entry.paidByParticipantId),
        sharedWithParticipantIds: (entry.sharedWithParticipantIds ?? [])
            .map(extractId)
            .filter((participantId): participantId is string => Boolean(participantId)),
        splitMode: entry.splitMode,
        splitAllocations: (entry.splitAllocations ?? []).map((allocation) => ({
            participantId: extractId(allocation.participantId) ?? '',
            percentage: allocation.percentage,
            amount: allocation.amount,
        })),
    }
    if (entry.type === 'settlement' && entry.settlementLegs?.length) {
        return entry.settlementLegs.flatMap((leg) => leg.applications.map((application, index) => ({
            ...base,
            entryId: `${entryId}:${leg.legId}:${index}`,
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
        reportingCurrency: inputReportingCurrency(entry),
    }]
}

function inputReportingCurrency(entry: ISpaceEntry) {
    return entry.reportingMoney?.currency ?? entry.currency
}

async function createDebtMovementDocuments(
    payloads: Array<Record<string, unknown>>,
    session: ClientSession
) {
    return DebtMovement.insertMany(payloads as unknown as IDebtMovement[], { session })
}

function buildDebtKey(input: {
    userId: string
    spaceId: string
    counterpartyParticipantId: string
    currency: string
    mode: 'direct' | 'simplified'
}) {
    return `${input.userId}:${input.spaceId}:${input.counterpartyParticipantId}:${input.currency}:${input.mode}`
}

interface MaterializedDebtItem {
    userId: string
    participantId: string
    counterpartyParticipantId: string
    counterpartyUserId?: string
    counterpartyNameSnapshot: string
    direction: 'payable' | 'receivable'
    amount: number
    currency: string
}

function expandProjections(
    projections: SpaceDebtProjectionV2[],
    participants: ISpaceParticipant[]
) {
    const participantsById = new Map(
        participants.map((participant) => [extractId(participant._id) ?? '', participant])
    )
    const items: MaterializedDebtItem[] = []
    for (const projection of projections) {
        const debtor = participantsById.get(projection.fromParticipantId)
        const creditor = participantsById.get(projection.toParticipantId)
        const debtorUserId = extractId(debtor?.userId)
        const creditorUserId = extractId(creditor?.userId)
        if (debtorUserId && creditor) {
            items.push({
                userId: debtorUserId,
                participantId: projection.fromParticipantId,
                counterpartyParticipantId: projection.toParticipantId,
                counterpartyUserId: creditorUserId,
                counterpartyNameSnapshot: creditor.displayName,
                direction: 'payable',
                amount: projection.amount,
                currency: projection.currency ?? '',
            })
        }
        if (creditorUserId && debtor) {
            items.push({
                userId: creditorUserId,
                participantId: projection.toParticipantId,
                counterpartyParticipantId: projection.fromParticipantId,
                counterpartyUserId: debtorUserId,
                counterpartyNameSnapshot: debtor.displayName,
                direction: 'receivable',
                amount: projection.amount,
                currency: projection.currency ?? '',
            })
        }
    }
    return items
}

export interface SpaceDebtMaterializationV2Result {
    created: number
    updated: number
    settled: number
    debtIds: string[]
    movementIds: string[]
}

/**
 * Materializa exactamente el saldo que ya surge del ledger compartido. Nunca
 * resta pagos históricos: cada settlement ya está incorporado en las entradas.
 */
export async function materializeSpaceDebtsV2(input: {
    space: ISpace
    participants: ISpaceParticipant[]
    entries: ISpaceEntry[]
    operationId: Types.ObjectId
    triggeringEntryId?: Types.ObjectId
    session: ClientSession
}): Promise<SpaceDebtMaterializationV2Result> {
    if (input.space.contractVersion !== 2) {
        throw new Error('SPACE_V2_DEBT_MATERIALIZATION_REQUIRES_V2_SPACE')
    }
    const spaceId = extractId(input.space._id)
    if (!spaceId) throw new Error('SPACE_V2_ID_MISSING')
    const mode = input.space.debtMode ?? 'simplified'
    const ledgerEntries = input.entries.flatMap(requireV2Entries)
    const ledgerParticipants = input.participants.map((participant) => ({
        participantId: extractId(participant._id) ?? '',
        userId: extractId(participant.userId),
        displayName: participant.displayName,
    }))
    const projections = calculateSpaceDebtProjectionsV2({
        mode,
        entries: ledgerEntries,
        participants: ledgerParticipants,
    })
    const desiredItems = expandProjections(projections, input.participants)
    const participantUserIds = Array.from(new Set(
        input.participants
            .map((participant) => extractId(participant.userId))
            .filter((userId): userId is string => Boolean(userId))
    ))
    const existing = await Debt.find({
        contractVersion: 2,
        sourceType: 'space',
        spaceId,
        userId: { $in: participantUserIds },
    }).session(input.session)
    const existingByKey = new Map(existing.map((debt) => [debt.spaceDebtKey ?? '', debt]))
    const desiredKeys = new Set<string>()
    const result: SpaceDebtMaterializationV2Result = {
        created: 0,
        updated: 0,
        settled: 0,
        debtIds: [],
        movementIds: [],
    }
    const calculatedAt = new Date()
    const sourceEntryIds = ledgerEntries.map((entry) => entry.entryId)
    const triggeringSettlement = input.triggeringEntryId
        ? input.entries.find((entry) => extractId(entry._id) === input.triggeringEntryId?.toString())
        : undefined
    const settlementApplications = triggeringSettlement?.settlementLegs?.flatMap((leg) =>
        leg.applications.map((application) => ({ ...application, leg }))
    ) ?? []

    for (const item of desiredItems) {
        const key = buildDebtKey({
            userId: item.userId,
            spaceId,
            counterpartyParticipantId: item.counterpartyParticipantId,
            currency: item.currency || input.space.reportingCurrency,
            mode,
        })
        desiredKeys.add(key)
        const current = existingByKey.get(key)
        if (!current) {
            const [debt] = await Debt.create([{
                contractVersion: 2,
                userId: item.userId,
                direction: item.direction,
                sourceType: 'space',
                spaceId,
                counterpartyParticipantId: item.counterpartyParticipantId,
                counterpartyUserId: item.counterpartyUserId,
                counterpartyNameSnapshot: item.counterpartyNameSnapshot,
                amount: item.amount,
                remainingAmount: item.amount,
                currency: item.currency || input.space.reportingCurrency,
                amountMoney: moneyFromDecimal(item.currency || input.space.reportingCurrency, item.amount),
                remainingMoney: moneyFromDecimal(item.currency || input.space.reportingCurrency, item.amount),
                status: 'active',
                originMode: mode,
                spaceDebtKey: key,
                spaceOperationId: input.operationId,
                spaceEntryId: input.triggeringEntryId,
                metadata: {
                    sourceEntryIds,
                    syncSnapshot: { debtMode: mode, calculatedAt: calculatedAt.toISOString() },
                    balanceSnapshot: {
                        operationId: input.operationId.toHexString(),
                        spaceRevision: input.space.revision ?? 0,
                        calculatedAt: calculatedAt.toISOString(),
                    },
                },
            }], { session: input.session })
            const [movement] = await DebtMovement.create([{
                userId: item.userId,
                debtId: debt._id,
                type: 'creation',
                amount: item.amount,
                currency: item.currency || input.space.reportingCurrency,
                appliedMoney: moneyFromDecimal(item.currency || input.space.reportingCurrency, item.amount),
                spaceId,
                spaceOperationId: input.operationId,
                spaceEntryId: input.triggeringEntryId,
                balanceBefore: 0,
                balanceAfter: item.amount,
                date: calculatedAt,
            }], { session: input.session })
            result.created += 1
            result.debtIds.push(debt._id.toString())
            result.movementIds.push(movement._id.toString())
            continue
        }

        const balanceBefore = current.remainingAmount
        const changed =
            Math.abs(balanceBefore - item.amount) > 0.01 ||
            current.direction !== item.direction ||
            current.counterpartyNameSnapshot !== item.counterpartyNameSnapshot
        const status: IDebt['status'] = current.status === 'ignored' ? 'ignored' : 'active'
        await Debt.updateOne(
            { _id: current._id, contractVersion: 2 },
            {
                $set: {
                    direction: item.direction,
                    counterpartyUserId: item.counterpartyUserId,
                    counterpartyNameSnapshot: item.counterpartyNameSnapshot,
                    amount: item.amount,
                    remainingAmount: item.amount,
                    amountMoney: moneyFromDecimal(item.currency || input.space.reportingCurrency, item.amount),
                    remainingMoney: moneyFromDecimal(item.currency || input.space.reportingCurrency, item.amount),
                    status,
                    spaceOperationId: input.operationId,
                    'metadata.sourceEntryIds': sourceEntryIds,
                    'metadata.syncSnapshot': { debtMode: mode, calculatedAt: calculatedAt.toISOString() },
                    'metadata.balanceSnapshot': {
                        operationId: input.operationId.toHexString(),
                        spaceRevision: input.space.revision ?? 0,
                        calculatedAt: calculatedAt.toISOString(),
                    },
                },
            },
            { session: input.session }
        )
        result.debtIds.push(current._id.toString())
        if (changed) {
            const applied = settlementApplications.filter((application) =>
                application.debtCurrency === (item.currency || input.space.reportingCurrency)
            )
            const movements = await createDebtMovementDocuments((applied.length ? applied.map((application) => ({
                userId: item.userId,
                debtId: current._id,
                type: current.direction === 'payable' ? 'payment' : 'collect',
                amount: moneyToNumber(application.appliedMoney),
                currency: application.debtCurrency,
                paymentMoney: application.paidMoney,
                appliedMoney: application.appliedMoney,
                conversionSnapshot: application.conversionSnapshot,
                spaceId,
                spaceOperationId: input.operationId,
                spaceEntryId: input.triggeringEntryId,
                balanceBefore,
                balanceAfter: item.amount,
                date: calculatedAt,
            })) : [{
                userId: item.userId,
                debtId: current._id,
                type: 'sync_update',
                amount: Math.abs(item.amount - balanceBefore),
                currency: item.currency || input.space.reportingCurrency,
                appliedMoney: moneyFromDecimal(item.currency || input.space.reportingCurrency, Math.abs(item.amount - balanceBefore)),
                spaceId,
                spaceOperationId: input.operationId,
                balanceBefore,
                balanceAfter: item.amount,
                date: calculatedAt,
            }]), input.session)
            result.movementIds.push(...movements.map((movement) => movement._id.toString()))
            result.updated += 1
        }
    }

    for (const debt of existing) {
        if (!debt.spaceDebtKey || desiredKeys.has(debt.spaceDebtKey) || debt.remainingAmount <= 0.01) continue
        const balanceBefore = debt.remainingAmount
        await Debt.updateOne(
            { _id: debt._id, contractVersion: 2 },
            {
                $set: {
                    amount: 0,
                    remainingAmount: 0,
                    amountMoney: moneyFromDecimal(debt.currency, 0),
                    remainingMoney: moneyFromDecimal(debt.currency, 0),
                    status: debt.status === 'ignored' ? 'ignored' : 'paid',
                    spaceOperationId: input.operationId,
                    'metadata.balanceSnapshot': {
                        operationId: input.operationId.toHexString(),
                        spaceRevision: input.space.revision ?? 0,
                        calculatedAt: calculatedAt.toISOString(),
                    },
                },
            },
            { session: input.session }
        )
        const applied = settlementApplications.filter((application) => application.debtCurrency === debt.currency)
        const movements = await createDebtMovementDocuments((applied.length ? applied.map((application) => ({
            userId: debt.userId,
            debtId: debt._id,
            type: debt.direction === 'payable' ? 'payment' : 'collect',
            amount: moneyToNumber(application.appliedMoney),
            currency: debt.currency,
            paymentMoney: application.paidMoney,
            appliedMoney: application.appliedMoney,
            conversionSnapshot: application.conversionSnapshot,
            spaceId,
            spaceOperationId: input.operationId,
            spaceEntryId: input.triggeringEntryId,
            balanceBefore,
            balanceAfter: 0,
            date: calculatedAt,
        })) : [{
            userId: debt.userId,
            debtId: debt._id,
            type: 'sync_update',
            amount: balanceBefore,
            currency: debt.currency,
            appliedMoney: moneyFromDecimal(debt.currency, balanceBefore),
            spaceId,
            spaceOperationId: input.operationId,
            spaceEntryId: input.triggeringEntryId,
            balanceBefore,
            balanceAfter: 0,
            date: calculatedAt,
        }]), input.session)
        result.debtIds.push(debt._id.toString())
        result.movementIds.push(...movements.map((movement) => movement._id.toString()))
        result.settled += 1
    }

    return result
}
