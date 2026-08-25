import { Types } from 'mongoose'

import {
    Space,
    SpaceEntry,
    SpaceEntryPersonalImpact,
    SpaceParticipant,
    User,
} from '@/lib/models'
import { ServiceError } from '@/lib/server/errors'
import { getSpaceCapabilitiesV2 } from '@/lib/server/space-capabilities'
import {
    adaptPersonalImpactToV2,
    adaptSpaceEntryToV2,
    selectCanonicalPersonalImpact,
    SpaceLegacyAdapterError,
    type SpaceEntryReadV2,
    type SpacePersonalImpactReadV2,
} from '@/lib/server/space-legacy-adapter'
import { extractId } from '@/lib/utils/spaces'
import type {
    ISpace,
    ISpaceEntry,
    ISpaceEntryPersonalImpact,
    ISpaceParticipant,
    SpaceApiCapability,
    SpaceDetailDto,
    SpaceEntryDto,
    SpacePersonalImpactDto,
    SpaceSummaryDto,
} from '@/types'

const DEFAULT_MOVEMENT_LIMIT = 50
const MAX_MOVEMENT_LIMIT = 100

interface MovementCursor {
    dateKey: string
    id: string
}

function encodeCursor(cursor: MovementCursor) {
    return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function parseSpaceMovementCursor(value?: string | null): MovementCursor | undefined {
    if (!value) return undefined
    try {
        const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as MovementCursor
        if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.dateKey) || !Types.ObjectId.isValid(parsed.id)) {
            throw new Error('invalid')
        }
        return parsed
    } catch {
        throw new ServiceError(400, 'SPACE_CURSOR_INVALID', 'El cursor de movimientos no es válido.')
    }
}

export function normalizeSpaceMovementLimit(value?: string | number | null) {
    if (value === undefined || value === null || value === '') return DEFAULT_MOVEMENT_LIMIT
    const parsed = typeof value === 'number' ? value : Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new ServiceError(400, 'SPACE_LIMIT_INVALID', 'El límite de movimientos no es válido.')
    }
    return Math.min(parsed, MAX_MOVEMENT_LIMIT)
}

function sortParticipants(participants: ISpaceParticipant[]) {
    const priority = { owner: 0, admin: 1, participant: 2 }
    return [...participants].sort((left, right) => {
        if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
        const role = priority[left.role] - priority[right.role]
        return role || left.displayName.localeCompare(right.displayName, 'es')
    })
}

function primaryAction(impact: SpacePersonalImpactReadV2): SpacePersonalImpactDto['primaryAction'] {
    if (impact.status === 'pending' || impact.status === 'unlinked') return 'create_transaction'
    if (impact.status === 'needs_review') return 'review'
    if (impact.status === 'linked') return 'remove_transaction'
    return 'none'
}

function toImpactDto(impact: SpacePersonalImpactReadV2): SpacePersonalImpactDto {
    return {
        id: impact.id,
        entryId: impact.entryId,
        participantId: impact.participantId,
        transactionId: impact.transactionId,
        accountId: impact.accountId,
        categoryId: impact.categoryId,
        kind: impact.kind,
        status: impact.status,
        currency: impact.currency,
        ownShareAmount: impact.ownShareAmount,
        accountImpactAmount: impact.accountImpactAmount,
        operationalAmount: impact.operationalAmount,
        recoverableAdvanceAmount: impact.recoverableAdvanceAmount,
        primaryAction: primaryAction(impact),
        revision: impact.revision,
        updatedAt: impact.updatedAt.toISOString(),
    }
}

function toEntryDto(input: {
    entry: SpaceEntryReadV2
    impact?: SpacePersonalImpactReadV2
    actorUserId: string
    capabilities: ReadonlySet<string>
}): SpaceEntryDto {
    const { entry, impact } = input
    const canEdit = input.capabilities.has('edit_any_entry') || (
        input.capabilities.has('edit_own_entry') && entry.createdByUserId === input.actorUserId
    )
    const canVoid = input.capabilities.has('void_any_entry') || (
        input.capabilities.has('void_own_entry') && entry.createdByUserId === input.actorUserId
    )
    return {
        id: entry.id,
        type: entry.type,
        status: entry.status,
        title: entry.title,
        description: entry.description,
        amount: entry.amount,
        currency: entry.currency,
        reportingAmount: entry.reportingAmount,
        reportingCurrency: entry.reportingCurrency,
        exchangeRate: entry.exchangeRate,
        dateKey: entry.dateKey,
        timezone: entry.timezone,
        paidByParticipantId: entry.paidByParticipantId,
        sharedWithParticipantIds: entry.sharedWithParticipantIds,
        splitMode: entry.splitMode,
        splitAllocations: entry.splitAllocations,
        shares: entry.shares,
        currentUserImpact: impact ? toImpactDto(impact) : undefined,
        capabilities: [
            ...(canEdit && entry.status === 'recorded' ? ['edit' as const] : []),
            ...(canVoid && entry.status === 'recorded' ? ['void' as const] : []),
        ],
        revision: entry.revision,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
    }
}

function buildSummary(input: {
    entries: SpaceEntryReadV2[]
    participants: ISpaceParticipant[]
    currentParticipantId: string
}): SpaceSummaryDto {
    const paid = new Map<string, number>()
    const shares = new Map<string, number>()
    const totalByCurrency: Record<string, number> = {}
    let totalReporting = 0

    for (const entry of input.entries) {
        if (entry.status === 'voided') continue
        const payerId = entry.paidByParticipantId
        if (entry.type === 'expense') {
            totalByCurrency[entry.currency] = (totalByCurrency[entry.currency] ?? 0) + entry.amount
            totalReporting += entry.reportingAmount
            if (payerId) paid.set(payerId, (paid.get(payerId) ?? 0) + entry.reportingAmount)
            for (const share of entry.shares) {
                shares.set(
                    share.participantId,
                    (shares.get(share.participantId) ?? 0) + share.reportingAmount
                )
            }
        } else if (entry.type === 'settlement' && payerId) {
            const receiverId = entry.sharedWithParticipantIds[0]
            paid.set(payerId, (paid.get(payerId) ?? 0) + entry.reportingAmount)
            if (receiverId) shares.set(receiverId, (shares.get(receiverId) ?? 0) + entry.reportingAmount)
        }
    }

    const ownPaid = paid.get(input.currentParticipantId) ?? 0
    const ownShare = shares.get(input.currentParticipantId) ?? 0
    const balance = ownPaid - ownShare
    const balances = input.participants.map((participant) => {
        const participantId = extractId(participant._id)!
        const participantPaid = paid.get(participantId) ?? 0
        const participantShare = shares.get(participantId) ?? 0
        return {
            participantId,
            displayName: participant.displayName,
            kind: participant.kind,
            role: participant.role,
            inviteStatus: participant.inviteStatus,
            userId: extractId(participant.userId),
            paidReporting: participantPaid,
            shareReporting: participantShare,
            balanceReporting: participantPaid - participantShare,
        }
    })
    return {
        totalByCurrency,
        totalReporting,
        yourShareReporting: ownShare,
        yourBalanceReporting: balance,
        pendingToPayReporting: Math.max(0, -balance),
        pendingToCollectReporting: Math.max(0, balance),
        participantCount: input.participants.filter((participant) => participant.isActive).length,
        pendingEntryCount: 0,
        totalEntryCount: input.entries.length,
        balances,
        categoryBreakdown: [],
        monthlyTrend: [],
    }
}

export async function getSpaceDetailV2(input: {
    spaceId: string
    actorUserId: string
    cursor?: string | null
    limit?: string | number | null
}): Promise<SpaceDetailDto> {
    if (!Types.ObjectId.isValid(input.spaceId)) {
        throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    const limit = normalizeSpaceMovementLimit(input.limit)
    const cursor = parseSpaceMovementCursor(input.cursor)
    const [space, participants] = await Promise.all([
        Space.findById(input.spaceId).lean<ISpace | null>(),
        SpaceParticipant.find({ spaceId: input.spaceId }).lean<ISpaceParticipant[]>(),
    ])
    if (!space) throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    const sortedParticipants = sortParticipants(participants)
    const currentParticipant = sortedParticipants.find(
        (participant) => extractId(participant.userId) === input.actorUserId
    )
    if (!currentParticipant) {
        throw new ServiceError(404, 'SPACE_NOT_FOUND', 'El Espacio no existe o no está disponible.')
    }
    const owner = space.timezone
        ? null
        : await User.findById(space.ownerUserId, { timezone: 1 }).lean<{ timezone?: string } | null>()
    const rawEntries = await SpaceEntry.find({ spaceId: input.spaceId })
        .sort({ dateKey: -1, _id: -1, date: -1 })
        .lean<ISpaceEntry[]>()
    const warnings: SpaceDetailDto['warnings'] = []
    let readMode: SpaceDetailDto['readMode'] = 'full'
    let readOnlyReason: string | undefined
    let normalizedEntries: SpaceEntryReadV2[] = []
    try {
        normalizedEntries = rawEntries.map((entry) => {
            const adapted = adaptSpaceEntryToV2({
                space,
                entry,
                participants: sortedParticipants,
                ownerTimezone: owner?.timezone,
            })
            warnings.push(...adapted.warnings)
            return adapted.entry
        }).sort((left, right) =>
            right.dateKey.localeCompare(left.dateKey) || right.id.localeCompare(left.id)
        )
    } catch (error) {
        if (!(error instanceof SpaceLegacyAdapterError)) throw error
        readMode = 'legacy_incompatible'
        readOnlyReason = error.code
        normalizedEntries = []
    }

    const afterCursor = cursor
        ? normalizedEntries.filter((entry) =>
            entry.dateKey < cursor.dateKey ||
            (entry.dateKey === cursor.dateKey && entry.id < cursor.id)
        )
        : normalizedEntries
    const pageEntries = afterCursor.slice(0, limit + 1)
    const hasMore = pageEntries.length > limit
    const visibleEntries = pageEntries.slice(0, limit)
    const entryIds = visibleEntries.map((entry) => entry.id)
    const rawImpacts = entryIds.length
        ? await SpaceEntryPersonalImpact.find({
            spaceId: input.spaceId,
            userId: input.actorUserId,
            entryId: { $in: entryIds },
        }).lean<ISpaceEntryPersonalImpact[]>()
        : []
    const impactsByEntry = new Map<string, SpacePersonalImpactReadV2>()
    for (const entry of visibleEntries) {
        const candidates = rawImpacts.filter((impact) => extractId(impact.entryId) === entry.id)
        if (!candidates.length) continue
        const selected = selectCanonicalPersonalImpact(candidates)
        warnings.push(...selected.warnings)
        if (!selected.impact) continue
        try {
            const adapted = adaptPersonalImpactToV2({ impact: selected.impact, entry })
            warnings.push(...adapted.warnings)
            impactsByEntry.set(entry.id, adapted.impact)
        } catch (error) {
            if (!(error instanceof SpaceLegacyAdapterError)) throw error
            warnings.push({ code: error.code, recordType: 'impact', recordId: extractId(selected.impact._id) })
        }
    }

    const isOwnerRecord = extractId(space.ownerUserId) === input.actorUserId
    const capabilitySet = readMode === 'legacy_incompatible'
        ? new Set(['view'])
        : getSpaceCapabilitiesV2({
            status: space.status,
            role: currentParticipant.role,
            isActiveParticipant: currentParticipant.isActive,
            isOwnerRecord,
        })
    const capabilities = Array.from(capabilitySet)
    const lastVisible = visibleEntries.at(-1)
    return {
        contractVersion: 2,
        sourceContract: space.contractVersion === 2 ? 'v2' : 'legacy',
        readMode,
        readOnlyReason,
        warnings,
        currentUserId: input.actorUserId,
        currentParticipantId: extractId(currentParticipant._id)!,
        capabilities: capabilities as SpaceApiCapability[],
        space: {
            id: extractId(space._id)!,
            ownerUserId: extractId(space.ownerUserId)!,
            name: space.name,
            description: space.description,
            type: space.type,
            mode: space.mode,
            status: space.status,
            startDate: space.startDate?.toISOString(),
            endDate: space.endDate?.toISOString(),
            currencies: space.currencies,
            reportingCurrency: space.reportingCurrency,
            defaultSplitMode: space.defaultSplitMode,
            debtMode: space.debtMode ?? (space.simplifyDebts === false ? 'direct' : 'simplified'),
            simplifyDebts: space.simplifyDebts,
            timezone: space.timezone ?? owner?.timezone ?? 'UTC',
            revision: space.revision ?? 0,
            createdAt: space.createdAt.toISOString(),
            updatedAt: space.updatedAt.toISOString(),
        },
        participants: sortedParticipants.map((participant) => ({
            id: extractId(participant._id)!,
            kind: participant.kind,
            userId: extractId(participant.userId),
            displayName: participant.displayName,
            role: participant.role,
            inviteStatus: participant.inviteStatus,
            isActive: participant.isActive,
            revision: participant.revision ?? 0,
        })),
        movements: {
            items: visibleEntries.map((entry) => toEntryDto({
                entry,
                impact: impactsByEntry.get(entry.id),
                actorUserId: input.actorUserId,
                capabilities: capabilitySet,
            })),
            nextCursor: hasMore && lastVisible
                ? encodeCursor({ dateKey: lastVisible.dateKey, id: lastVisible.id })
                : null,
            limit,
        },
        summary: readMode === 'legacy_incompatible'
            ? null
            : buildSummary({
                entries: normalizedEntries,
                participants: sortedParticipants,
                currentParticipantId: extractId(currentParticipant._id)!,
            }),
    }
}
