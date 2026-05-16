import type { IDebt } from '@/types/debt'
import type { ISpaceEntryPersonalImpact } from '@/types'

export type DebtFilterOption =
    | 'all'
    | 'payable'
    | 'receivable'
    | 'space'
    | 'manual'
    | 'pending'
    | 'needs_review'
    | 'paid'
    | 'ignored'
    | 'cancelled'
    | 'partially_paid'

export type DebtSortOption =
    | 'net'
    | 'payable'
    | 'receivable'
    | 'updated'
    | 'name'
    | 'spaces_first'

export interface DebtRelationship {
    key: string
    name: string
    counterpartyUserId?: string
    counterpartyParticipantId?: string
    debts: IDebt[]
    pendingActions: ISpaceEntryPersonalImpact[]
    needsReviewActions: ISpaceEntryPersonalImpact[]
    payable: Record<string, number>
    receivable: Record<string, number>
    netByCurrency: Record<string, number>
    hasPendingActions: boolean
    hasNeedsReview: boolean
    pendingCount: number
    needsReviewCount: number
    sourceTypes: ('manual' | 'space')[]
    spaceIds: string[]
    spaceNames: string[]
    lastActivityAt: Date
    primaryCurrency: string
    primaryAction: 'pay' | 'collect' | 'detail'
    overallStatus: 'active' | 'needs_review' | 'pending' | 'mixed' | 'settled'
}

function idToString(id: unknown): string | undefined {
    if (!id) return undefined
    if (typeof id === 'string') return id
    if (typeof id === 'object' && id !== null && 'toString' in id) return id.toString()
    return undefined
}

function relationshipKeyFromDebt(debt: IDebt): string {
    return (
        idToString(debt.counterpartyUserId) ??
        idToString(debt.counterpartyParticipantId) ??
        debt.counterpartyNameSnapshot.toLowerCase().trim()
    )
}

function relationshipKeyFromAction(action: ISpaceEntryPersonalImpact): string {
    return (
        idToString(action.counterpartyParticipantId) ??
        action.counterpartyNameSnapshot?.toLowerCase().trim() ??
        idToString(action.participantId) ??
        idToString(action._id) ??
        'pending'
    )
}

function addAmount(target: Record<string, number>, currency: string, amount: number) {
    target[currency] = (target[currency] ?? 0) + amount
}

function isActiveStatus(debt: IDebt) {
    return debt.status === 'active' || debt.status === 'partially_paid'
}

function maxDate(a: Date, value: unknown) {
    const next = value ? new Date(value as string | Date) : null
    if (!next || Number.isNaN(next.getTime())) return a
    return next > a ? next : a
}

function getActionName(action: ISpaceEntryPersonalImpact) {
    return action.counterpartyNameSnapshot?.trim() || 'Pendiente'
}

export function formatNetAmount(netByCurrency: Record<string, number>): {
    primary: { currency: string; amount: number }
    others: { currency: string; amount: number }[]
} {
    const entries = Object.entries(netByCurrency)
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))

    return {
        primary: entries[0] ?? { currency: 'ARS', amount: 0 },
        others: entries.slice(1),
    }
}

export function getDebtOriginBadges(rel: DebtRelationship): string[] {
    const spaceBadges =
        rel.spaceNames.length > 2
            ? [rel.spaceNames[0], `+${rel.spaceNames.length - 1}`]
            : rel.spaceNames
    const badges = [...spaceBadges]

    if (rel.sourceTypes.includes('space') && badges.length === 0) {
        badges.push('Espacio')
    }
    if (rel.sourceTypes.includes('manual')) {
        badges.push('Manual')
    }

    return badges.length > 0 ? badges : ['Manual']
}

export function buildDebtRelationships(
    debts: IDebt[],
    pendingActions: ISpaceEntryPersonalImpact[],
    spaceNameMap: Record<string, string>
): DebtRelationship[] {
    const byKey = new Map<string, DebtRelationship>()

    function ensureRelationship(key: string, name: string): DebtRelationship {
        const existing = byKey.get(key)
        if (existing) return existing

        const rel: DebtRelationship = {
            key,
            name,
            debts: [],
            pendingActions: [],
            needsReviewActions: [],
            payable: {},
            receivable: {},
            netByCurrency: {},
            hasPendingActions: false,
            hasNeedsReview: false,
            pendingCount: 0,
            needsReviewCount: 0,
            sourceTypes: [],
            spaceIds: [],
            spaceNames: [],
            lastActivityAt: new Date(0),
            primaryCurrency: 'ARS',
            primaryAction: 'detail',
            overallStatus: 'settled',
        }
        byKey.set(key, rel)
        return rel
    }

    for (const debt of debts) {
        const key = relationshipKeyFromDebt(debt)
        const rel = ensureRelationship(key, debt.counterpartyNameSnapshot)
        rel.counterpartyUserId = rel.counterpartyUserId ?? idToString(debt.counterpartyUserId)
        rel.counterpartyParticipantId = rel.counterpartyParticipantId ?? idToString(debt.counterpartyParticipantId)
        rel.debts.push(debt)
        rel.lastActivityAt = maxDate(rel.lastActivityAt, debt.updatedAt ?? debt.createdAt)

        if (!rel.sourceTypes.includes(debt.sourceType)) {
            rel.sourceTypes.push(debt.sourceType)
        }

        const spaceId = idToString(debt.spaceId)
        if (spaceId && !rel.spaceIds.includes(spaceId)) {
            rel.spaceIds.push(spaceId)
            rel.spaceNames.push(spaceNameMap[spaceId] ?? 'Espacio')
        }

        if (isActiveStatus(debt)) {
            const target = debt.direction === 'payable' ? rel.payable : rel.receivable
            addAmount(target, debt.currency, debt.remainingAmount)
        }
    }

    for (const action of pendingActions) {
        const preferredKey = relationshipKeyFromAction(action)
        const name = getActionName(action)
        const matchingByName = Array.from(byKey.values()).find(
            (rel) => rel.name.toLowerCase().trim() === name.toLowerCase().trim()
        )
        const rel = matchingByName ?? ensureRelationship(preferredKey, name)

        if (!rel.sourceTypes.includes('space')) rel.sourceTypes.push('space')

        const spaceId = idToString(action.spaceId)
        if (spaceId && !rel.spaceIds.includes(spaceId)) {
            rel.spaceIds.push(spaceId)
            rel.spaceNames.push(spaceNameMap[spaceId] ?? 'Espacio')
        }

        if (action.status === 'needs_review') {
            rel.needsReviewActions.push(action)
        } else {
            rel.pendingActions.push(action)
        }
        rel.lastActivityAt = maxDate(rel.lastActivityAt, action.updatedAt ?? action.createdAt)
    }

    for (const rel of byKey.values()) {
        const currencies = new Set([...Object.keys(rel.payable), ...Object.keys(rel.receivable)])
        for (const currency of currencies) {
            rel.netByCurrency[currency] = (rel.receivable[currency] ?? 0) - (rel.payable[currency] ?? 0)
        }

        rel.pendingCount = rel.pendingActions.length
        rel.needsReviewCount = rel.needsReviewActions.length
        rel.hasPendingActions = rel.pendingCount > 0
        rel.hasNeedsReview = rel.needsReviewCount > 0

        const formatted = formatNetAmount(rel.netByCurrency)
        const actionCurrency =
            formatted.primary.amount !== 0
                ? formatted.primary.currency
                : rel.pendingActions[0]?.currency ?? rel.needsReviewActions[0]?.currency ?? rel.debts[0]?.currency ?? 'ARS'
        rel.primaryCurrency = actionCurrency

        const primaryNet = rel.netByCurrency[rel.primaryCurrency] ?? formatted.primary.amount
        rel.primaryAction = primaryNet < 0 ? 'pay' : primaryNet > 0 ? 'collect' : 'detail'

        const hasActiveDebt = rel.debts.some(isActiveStatus)
        const hasOnlySettledDebts = rel.debts.length > 0 && rel.debts.every((debt) => !isActiveStatus(debt))

        if (rel.hasNeedsReview && (hasActiveDebt || rel.hasPendingActions)) {
            rel.overallStatus = 'mixed'
        } else if (rel.hasNeedsReview) {
            rel.overallStatus = 'needs_review'
        } else if (rel.hasPendingActions && hasActiveDebt) {
            rel.overallStatus = 'mixed'
        } else if (rel.hasPendingActions) {
            rel.overallStatus = 'pending'
        } else if (hasActiveDebt) {
            rel.overallStatus = 'active'
        } else if (hasOnlySettledDebts) {
            rel.overallStatus = 'settled'
        }
    }

    return Array.from(byKey.values())
}

function absoluteTotal(values: Record<string, number>) {
    return Object.values(values).reduce((sum, amount) => sum + Math.abs(amount), 0)
}

export function sortRelationships(
    rels: DebtRelationship[],
    sort: DebtSortOption
): DebtRelationship[] {
    const copy = [...rels]
    return copy.sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'es')
        if (sort === 'updated') return b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
        if (sort === 'payable') return absoluteTotal(b.payable) - absoluteTotal(a.payable)
        if (sort === 'receivable') return absoluteTotal(b.receivable) - absoluteTotal(a.receivable)
        if (sort === 'spaces_first') {
            const sourceDiff = Number(b.sourceTypes.includes('space')) - Number(a.sourceTypes.includes('space'))
            return sourceDiff || b.lastActivityAt.getTime() - a.lastActivityAt.getTime()
        }
        return absoluteTotal(b.netByCurrency) - absoluteTotal(a.netByCurrency)
    })
}

export function filterRelationships(
    rels: DebtRelationship[],
    filter: DebtFilterOption,
    search: string
): DebtRelationship[] {
    const normalized = search.toLowerCase().trim()

    return rels.filter((rel) => {
        if (filter === 'payable' && absoluteTotal(rel.payable) <= 0) return false
        if (filter === 'receivable' && absoluteTotal(rel.receivable) <= 0) return false
        if (filter === 'space' && !rel.sourceTypes.includes('space')) return false
        if (filter === 'manual' && !rel.sourceTypes.includes('manual')) return false
        if (filter === 'pending' && !rel.hasPendingActions) return false
        if (filter === 'needs_review' && !rel.hasNeedsReview) return false
        if (filter === 'paid' && !rel.debts.some((debt) => debt.status === 'paid')) return false
        if (filter === 'ignored' && !rel.debts.some((debt) => debt.status === 'ignored')) return false
        if (filter === 'cancelled' && !rel.debts.some((debt) => debt.status === 'cancelled')) return false
        if (filter === 'partially_paid' && !rel.debts.some((debt) => debt.status === 'partially_paid')) return false

        if (!normalized) return true

        const haystack = [
            rel.name,
            ...rel.spaceNames,
            ...rel.debts.map((debt) => debt.notes ?? ''),
            ...rel.pendingActions.map((action) => action.counterpartyNameSnapshot ?? ''),
            ...rel.needsReviewActions.map((action) => action.counterpartyNameSnapshot ?? ''),
        ].join(' ').toLowerCase()

        return haystack.includes(normalized)
    })
}
