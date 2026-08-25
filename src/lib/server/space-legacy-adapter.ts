import { Types } from 'mongoose'

import type {
    ISpace,
    ISpaceEntry,
    ISpaceEntryPersonalImpact,
    ISpaceParticipant,
} from '@/types'
import type { IDebt } from '@/types/debt'
import {
    calculateSpaceSharesV2,
    derivePersonalImpactAmountsV2,
    financialDateKeyFromInstant,
    normalizeFinancialDateKey,
    type PersonalImpactAmountsV2,
    type SpaceShareV2,
} from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'

export type SpaceLegacyWarningCode =
    | 'LEGACY_ENTRY_STATUS_NORMALIZED'
    | 'LEGACY_TIMEZONE_FROM_OWNER'
    | 'LEGACY_PARTICIPANTS_INFERRED'
    | 'LEGACY_IMPACT_AMOUNT_RECOMPUTED'
    | 'LEGACY_IMPACT_DUPLICATE_IGNORED'
    | 'LEGACY_DEBT_BALANCE_MISMATCH'

export interface SpaceLegacyWarning {
    code: SpaceLegacyWarningCode
    recordType: 'space' | 'entry' | 'impact' | 'debt'
    recordId?: string
}

export class SpaceLegacyAdapterError extends Error {
    constructor(
        readonly code: 'LEGACY_TIMEZONE_MISSING' | 'LEGACY_ENTRY_INCOMPATIBLE' | 'LEGACY_IMPACT_INCOMPATIBLE',
        message: string
    ) {
        super(message)
        this.name = 'SpaceLegacyAdapterError'
    }
}

export interface SpaceEntryReadV2 {
    id: string
    contractVersion: 2
    spaceId: string
    createdByUserId: string
    type: ISpaceEntry['type']
    status: 'recorded' | 'voided'
    title: string
    description?: string
    amount: number
    currency: string
    reportingAmount: number
    reportingCurrency: string
    exchangeRate?: number
    dateKey: string
    timezone: string
    date: Date
    paidByParticipantId?: string
    sharedWithParticipantIds: string[]
    splitMode: ISpaceEntry['splitMode']
    splitAllocations: Array<{ participantId: string; percentage?: number; amount?: number }>
    shares: SpaceShareV2[]
    revision: number
    createdAt: Date
    updatedAt: Date
}

export interface SpacePersonalImpactReadV2 {
    id: string
    contractVersion: 2
    spaceId: string
    entryId: string
    userId: string
    participantId: string
    transactionId?: string
    accountId?: string
    categoryId?: string
    kind: 'personal_expense' | 'advance' | 'settlement_paid' | 'settlement_received'
    status: ISpaceEntryPersonalImpact['status']
    currency: string
    ownShareAmount: number
    accountImpactAmount: number
    operationalAmount: number
    recoverableAdvanceAmount: number
    revision: number
    createdAt: Date
    updatedAt: Date
}

function requiredId(value: unknown, code: SpaceLegacyAdapterError['code']) {
    const id = extractId(value)
    if (!id) throw new SpaceLegacyAdapterError(code, 'El registro legacy no tiene identidad compatible.')
    return id
}

function resolveTimezone(space: ISpace, ownerTimezone?: string) {
    if (space.timezone?.trim()) return { timezone: space.timezone.trim(), usedOwnerFallback: false }
    if (ownerTimezone?.trim()) return { timezone: ownerTimezone.trim(), usedOwnerFallback: true }
    throw new SpaceLegacyAdapterError(
        'LEGACY_TIMEZONE_MISSING',
        'El Espacio legacy no tiene zona horaria y su owner tampoco aporta una.'
    )
}

function resolveSharedParticipantIds(
    entry: ISpaceEntry,
    participants: ISpaceParticipant[]
) {
    const explicit = (entry.sharedWithParticipantIds ?? [])
        .map(extractId)
        .filter((participantId): participantId is string => Boolean(participantId))
    if (explicit.length > 0) return { participantIds: explicit, inferred: false }

    const allocated = (entry.splitAllocations ?? [])
        .map((allocation) => extractId(allocation.participantId))
        .filter((participantId): participantId is string => Boolean(participantId))
    if (allocated.length > 0) return { participantIds: allocated, inferred: true }

    if (entry.splitMode === 'none') {
        const payerId = extractId(entry.paidByParticipantId)
        if (payerId) return { participantIds: [payerId], inferred: true }
    }

    const historical = participants
        .filter((participant) => participant.inviteStatus !== 'declined')
        .map((participant) => extractId(participant._id))
        .filter((participantId): participantId is string => Boolean(participantId))
    return { participantIds: historical, inferred: true }
}

export function adaptSpaceEntryToV2(input: {
    space: ISpace
    entry: ISpaceEntry
    participants: ISpaceParticipant[]
    ownerTimezone?: string
}): { entry: SpaceEntryReadV2; warnings: SpaceLegacyWarning[] } {
    const warnings: SpaceLegacyWarning[] = []
    const entryId = requiredId(input.entry._id, 'LEGACY_ENTRY_INCOMPATIBLE')
    const spaceId = requiredId(input.entry.spaceId, 'LEGACY_ENTRY_INCOMPATIBLE')
    const { timezone, usedOwnerFallback } = resolveTimezone(input.space, input.ownerTimezone)
    if (usedOwnerFallback) {
        warnings.push({ code: 'LEGACY_TIMEZONE_FROM_OWNER', recordType: 'space', recordId: spaceId })
    }

    const isV2 = input.entry.contractVersion === 2
    const status = input.entry.isVoided || input.entry.status === 'voided' ? 'voided' : 'recorded'
    if (!isV2 && input.entry.status !== 'recorded') {
        warnings.push({ code: 'LEGACY_ENTRY_STATUS_NORMALIZED', recordType: 'entry', recordId: entryId })
    }
    const dateKey = input.entry.dateKey
        ? normalizeFinancialDateKey(input.entry.dateKey)
        : financialDateKeyFromInstant(new Date(input.entry.date), timezone)
    const shared = resolveSharedParticipantIds(input.entry, input.participants)
    if (shared.inferred) {
        warnings.push({ code: 'LEGACY_PARTICIPANTS_INFERRED', recordType: 'entry', recordId: entryId })
    }
    const splitAllocations = (input.entry.splitAllocations ?? []).map((allocation) => ({
        participantId: requiredId(allocation.participantId, 'LEGACY_ENTRY_INCOMPATIBLE'),
        percentage: allocation.percentage,
        amount: allocation.amount,
    }))
    let shares: SpaceShareV2[]
    try {
        shares = calculateSpaceSharesV2({
            amount: input.entry.amount,
            reportingAmount: input.entry.reportingAmount,
            splitMode: input.entry.splitMode,
            participantIds: shared.participantIds,
            allocations: splitAllocations,
        })
    } catch (error) {
        throw new SpaceLegacyAdapterError(
            'LEGACY_ENTRY_INCOMPATIBLE',
            error instanceof Error ? error.message : 'El reparto legacy no es compatible.'
        )
    }

    return {
        entry: {
            id: entryId,
            contractVersion: 2,
            spaceId,
            createdByUserId: requiredId(input.entry.createdByUserId, 'LEGACY_ENTRY_INCOMPATIBLE'),
            type: input.entry.type,
            status,
            title: input.entry.title,
            description: input.entry.description,
            amount: input.entry.amount,
            currency: input.entry.currency,
            reportingAmount: input.entry.reportingAmount,
            reportingCurrency: input.space.reportingCurrency,
            exchangeRate: input.entry.exchangeRate,
            dateKey,
            timezone,
            date: new Date(input.entry.date),
            paidByParticipantId: extractId(input.entry.paidByParticipantId),
            sharedWithParticipantIds: shared.participantIds,
            splitMode: input.entry.splitMode,
            splitAllocations,
            shares,
            revision: input.entry.revision ?? input.entry.editCount ?? 0,
            createdAt: input.entry.createdAt,
            updatedAt: input.entry.updatedAt,
        },
        warnings,
    }
}

const IMPACT_STATUS_PRECEDENCE: Record<ISpaceEntryPersonalImpact['status'], number> = {
    needs_review: 7,
    linked: 6,
    pending: 5,
    ignored: 4,
    removed: 3,
    cancelled: 2,
    unlinked: 1,
}

export function selectCanonicalPersonalImpact(
    impacts: ISpaceEntryPersonalImpact[]
): { impact?: ISpaceEntryPersonalImpact; warnings: SpaceLegacyWarning[] } {
    const sorted = [...impacts].sort((left, right) => {
        const statusDifference = IMPACT_STATUS_PRECEDENCE[right.status] - IMPACT_STATUS_PRECEDENCE[left.status]
        if (statusDifference !== 0) return statusDifference
        const updatedDifference = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        if (updatedDifference !== 0) return updatedDifference
        return requiredId(left._id, 'LEGACY_IMPACT_INCOMPATIBLE')
            .localeCompare(requiredId(right._id, 'LEGACY_IMPACT_INCOMPATIBLE'))
    })
    return {
        impact: sorted[0],
        warnings: sorted.slice(1).map((impact) => ({
            code: 'LEGACY_IMPACT_DUPLICATE_IGNORED',
            recordType: 'impact',
            recordId: extractId(impact._id),
        })),
    }
}

function deriveImpactFromEntry(
    entry: SpaceEntryReadV2,
    participantId: string
): PersonalImpactAmountsV2 {
    const ownShareAmount = entry.shares.find((share) => share.participantId === participantId)?.amount ?? 0
    return derivePersonalImpactAmountsV2({
        entryType: entry.type,
        entryAmount: entry.amount,
        ownShareAmount,
        isPayer: entry.paidByParticipantId === participantId,
        isReceiver: entry.type === 'settlement' && entry.sharedWithParticipantIds[0] === participantId,
    })
}

export function adaptPersonalImpactToV2(input: {
    impact: ISpaceEntryPersonalImpact
    entry: SpaceEntryReadV2
}): { impact: SpacePersonalImpactReadV2; warnings: SpaceLegacyWarning[] } {
    const impactId = requiredId(input.impact._id, 'LEGACY_IMPACT_INCOMPATIBLE')
    const participantId = requiredId(input.impact.participantId, 'LEGACY_IMPACT_INCOMPATIBLE')
    const derived = deriveImpactFromEntry(input.entry, participantId)
    if (derived.action === 'none') {
        throw new SpaceLegacyAdapterError(
            'LEGACY_IMPACT_INCOMPATIBLE',
            'El impacto legacy no representa una acción financiera vigente.'
        )
    }

    const isCompleteV2 =
        input.impact.contractVersion === 2 &&
        input.impact.ownShareAmount !== undefined &&
        input.impact.accountImpactAmount !== undefined &&
        input.impact.operationalAmount !== undefined
    const amounts = isCompleteV2
        ? {
            ...derived,
            ownShareAmount: input.impact.ownShareAmount!,
            accountImpactAmount: input.impact.accountImpactAmount!,
            operationalAmount: input.impact.operationalAmount!,
            recoverableAdvanceAmount: Math.max(
                0,
                input.impact.accountImpactAmount! - input.impact.operationalAmount!
            ),
        }
        : derived
    const warnings = isCompleteV2 ? [] : [{
        code: 'LEGACY_IMPACT_AMOUNT_RECOMPUTED' as const,
        recordType: 'impact' as const,
        recordId: impactId,
    }]

    return {
        impact: {
            id: impactId,
            contractVersion: 2,
            spaceId: requiredId(input.impact.spaceId, 'LEGACY_IMPACT_INCOMPATIBLE'),
            entryId: requiredId(input.impact.entryId, 'LEGACY_IMPACT_INCOMPATIBLE'),
            userId: requiredId(input.impact.userId, 'LEGACY_IMPACT_INCOMPATIBLE'),
            participantId,
            transactionId: extractId(input.impact.transactionId),
            accountId: extractId(input.impact.accountId),
            categoryId: extractId(input.impact.categoryId),
            kind: amounts.kind,
            status: input.impact.status,
            currency: input.impact.currency,
            ownShareAmount: amounts.ownShareAmount,
            accountImpactAmount: amounts.accountImpactAmount,
            operationalAmount: amounts.operationalAmount,
            recoverableAdvanceAmount: amounts.recoverableAdvanceAmount,
            revision: input.impact.revision ?? 0,
            createdAt: input.impact.createdAt,
            updatedAt: input.impact.updatedAt,
        },
        warnings,
    }
}

export function adaptSpaceDebtBalanceV2(input: {
    debt: IDebt
    calculatedBalance: number
}) {
    const delta = Math.round((input.debt.remainingAmount - input.calculatedBalance) * 100) / 100
    return {
        debtId: requiredId(input.debt._id, 'LEGACY_IMPACT_INCOMPATIBLE'),
        materializedBalance: input.debt.remainingAmount,
        calculatedBalance: input.calculatedBalance,
        consistent: Math.abs(delta) <= 0.01,
        delta,
        warnings: Math.abs(delta) <= 0.01 ? [] : [{
            code: 'LEGACY_DEBT_BALANCE_MISMATCH' as const,
            recordType: 'debt' as const,
            recordId: extractId(input.debt._id),
        }],
    }
}

export function objectIdFromReadId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
        throw new SpaceLegacyAdapterError('LEGACY_ENTRY_INCOMPATIBLE', 'El identificador no es ObjectId.')
    }
    return new Types.ObjectId(value)
}
