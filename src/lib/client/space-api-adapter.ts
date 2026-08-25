'use client'

import type {
    ISpaceDetailPayload,
    ISpaceEntry,
    ISpaceEntryPersonalImpact,
    ISpaceEntryPersonalImpactByEntry,
    SpaceDetailDto,
    SpaceEntryDto,
} from '@/types'

export type SpaceDetailUiPayload = ISpaceDetailPayload & {
    api: SpaceDetailDto
    capabilities: SpaceDetailDto['capabilities']
}

export function dateKeyToClientDate(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number)
    return new Date(year, month - 1, day, 12, 0, 0)
}

export function clientDateToDateKey(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function adaptSpaceEntryDtoForUi(
    entry: SpaceEntryDto,
    detail: Pick<SpaceDetailDto, 'space' | 'currentUserId'>
): ISpaceEntry {
    const currentUserCanMutate = entry.capabilities.length > 0
    return {
        _id: entry.id,
        spaceId: detail.space.id,
        createdByUserId: currentUserCanMutate ? detail.currentUserId : '',
        type: entry.type,
        status: entry.status,
        contractVersion: 2,
        title: entry.title,
        description: entry.description,
        amount: entry.amount,
        currency: entry.currency,
        reportingAmount: entry.reportingAmount,
        exchangeRate: entry.exchangeRate,
        date: dateKeyToClientDate(entry.dateKey),
        dateKey: entry.dateKey,
        timezone: entry.timezone,
        paidByParticipantId: entry.paidByParticipantId,
        sharedWithParticipantIds: entry.sharedWithParticipantIds,
        splitMode: entry.splitMode,
        splitAllocations: entry.splitAllocations,
        isVoided: entry.status === 'voided',
        revision: entry.revision,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
    } as unknown as ISpaceEntry
}

function adaptImpact(entry: SpaceEntryDto): ISpaceEntryPersonalImpact | undefined {
    const impact = entry.currentUserImpact
    if (!impact) return undefined
    return {
        _id: impact.id,
        spaceId: '',
        entryId: impact.entryId,
        userId: '',
        participantId: impact.participantId,
        transactionId: impact.transactionId,
        accountId: impact.accountId,
        categoryId: impact.categoryId,
        impactKind: impact.kind,
        amount: impact.accountImpactAmount || impact.ownShareAmount,
        contractVersion: 2,
        ownShareAmount: impact.ownShareAmount,
        accountImpactAmount: impact.accountImpactAmount,
        operationalAmount: impact.operationalAmount,
        currency: impact.currency,
        status: impact.status,
        revision: impact.revision,
        createdAt: new Date(impact.updatedAt),
        updatedAt: new Date(impact.updatedAt),
    } as unknown as ISpaceEntryPersonalImpact
}

export function adaptSpaceDetailDtoForUi(detail: SpaceDetailDto): SpaceDetailUiPayload {
    const entries = detail.movements.items.map((entry) => adaptSpaceEntryDtoForUi(entry, detail))
    const personalImpactsByEntryId: Record<string, ISpaceEntryPersonalImpactByEntry> = {}
    for (const entry of detail.movements.items) {
        const impact = adaptImpact(entry)
        if (!impact) continue
        personalImpactsByEntryId[entry.id] = {
            linkedImpact: impact.status === 'linked' ? impact : undefined,
            pendingActions: impact.status === 'pending' || impact.status === 'unlinked' ? [impact] : [],
            reviewImpact: impact.status === 'needs_review' ? impact : undefined,
        }
    }
    return {
        api: detail,
        capabilities: detail.capabilities,
        currentUserId: detail.currentUserId,
        space: {
            _id: detail.space.id,
            ownerUserId: detail.space.ownerUserId,
            name: detail.space.name,
            description: detail.space.description,
            type: detail.space.type,
            mode: detail.space.mode,
            status: detail.space.status,
            startDate: detail.space.startDate ? new Date(detail.space.startDate) : undefined,
            endDate: detail.space.endDate ? new Date(detail.space.endDate) : undefined,
            currencies: detail.space.currencies,
            reportingCurrency: detail.space.reportingCurrency,
            defaultSplitMode: detail.space.defaultSplitMode,
            simplifyDebts: detail.space.simplifyDebts,
            debtMode: detail.space.debtMode,
            contractVersion: detail.sourceContract === 'v2' ? 2 : undefined,
            timezone: detail.space.timezone,
            revision: detail.space.revision,
            createdAt: new Date(detail.space.createdAt),
            updatedAt: new Date(detail.space.updatedAt),
        } as unknown as ISpaceDetailPayload['space'],
        participants: detail.participants.map((participant) => ({
            _id: participant.id,
            spaceId: detail.space.id,
            kind: participant.kind,
            userId: participant.userId,
            displayName: participant.displayName,
            role: participant.role,
            inviteStatus: participant.inviteStatus,
            isActive: participant.isActive,
            revision: participant.revision,
            createdAt: new Date(detail.space.createdAt),
            updatedAt: new Date(detail.space.updatedAt),
        })) as unknown as ISpaceDetailPayload['participants'],
        entries,
        personalImpactsByEntryId,
        summary: detail.summary ?? {
            totalByCurrency: {},
            totalReporting: 0,
            yourShareReporting: 0,
            yourBalanceReporting: 0,
            pendingToPayReporting: 0,
            pendingToCollectReporting: 0,
            participantCount: detail.participants.filter((participant) => participant.isActive).length,
            pendingEntryCount: 0,
            totalEntryCount: 0,
            balances: [],
            categoryBreakdown: [],
            monthlyTrend: [],
        },
        pendingActions: [],
    }
}
