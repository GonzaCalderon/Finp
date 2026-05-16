import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type {
    SpaceEntryType,
    SpaceInviteStatus,
    SpaceMode,
    SpaceParticipantRole,
    SpaceSplitMode,
    SpaceStatus,
    SpaceType,
} from '@/lib/constants'
import type {
    ISpace,
    ISpaceEntry,
    ISpaceParticipant,
    SpaceBalanceItem,
    SpaceCategoryBreakdownItem,
    SpaceCurrencyTotals,
    SpaceSummarySnapshot,
    SpaceTrendPoint,
} from '@/types'

type ShareAllocation = {
    participantId: string
    amount: number
    reportingAmount: number
}

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
    couple: 'Pareja',
    home: 'Grupo',
    travel: 'Viaje',
    project: 'Proyecto',
    event: 'Evento',
    personal: 'Personal',
    other: 'Otro',
}

export const SPACE_MODE_LABELS: Record<SpaceMode, string> = {
    solo: 'Solo',
    managed: 'Administrado',
    synchronized: 'Sincronizado',
}

export const SPACE_STATUS_LABELS: Record<SpaceStatus, string> = {
    active: 'Activo',
    paused: 'Pausado',
    closed: 'Cerrado',
    archived: 'Archivado',
}

export const SPACE_ENTRY_TYPE_LABELS: Record<SpaceEntryType, string> = {
    expense: 'Gasto',
    income: 'Ingreso',
    adjustment: 'Ajuste',
    settlement: 'Liquidación',
}

export const SPACE_SPLIT_MODE_LABELS: Record<SpaceSplitMode, string> = {
    none: 'Sin split',
    equal: 'Partes iguales',
    percentage: 'Porcentaje',
    fixed: 'Monto fijo',
}

export const SPACE_ROLE_LABELS: Record<SpaceParticipantRole, string> = {
    owner: 'Dueño',
    admin: 'Administrador',
    participant: 'Participante',
}

export const SPACE_INVITE_STATUS_LABELS: Record<SpaceInviteStatus, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptado',
    declined: 'Rechazado',
    active: 'Activo',
    revoked: 'Revocado',
    expired: 'Vencido',
}

export function createEmptySpaceTotals(): SpaceCurrencyTotals {
    return { ARS: 0, USD: 0 }
}

export function roundAmount(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

export function extractId(value: unknown): string | undefined {
    if (!value) return undefined

    if (typeof value === 'string') {
        return value
    }

    if (typeof value === 'object' && value !== null) {
        if ('toString' in value && typeof value.toString === 'function') {
            const resolved = value.toString()
            if (resolved && resolved !== '[object Object]') return resolved
        }

        if ('_id' in value) {
            return extractId((value as { _id?: unknown })._id)
        }
    }

    return undefined
}

export function normalizeSpaceCurrencies(
    currencies: string[] | undefined,
    reportingCurrency: string
) {
    const normalized = Array.from(
        new Set([...(currencies ?? []), reportingCurrency])
    )

    return normalized.length > 0 ? normalized : [reportingCurrency]
}

export function calculateReportingAmount({
    amount,
    currency,
    reportingCurrency,
    exchangeRate,
}: {
    amount: number
    currency: string
    reportingCurrency: string
    exchangeRate?: number
}) {
    if (currency === reportingCurrency) return roundAmount(amount)
    if (!exchangeRate || exchangeRate <= 0) return roundAmount(amount)

    if (currency === 'USD' && reportingCurrency === 'ARS') {
        return roundAmount(amount * exchangeRate)
    }

    if (currency === 'ARS' && reportingCurrency === 'USD') {
        return roundAmount(amount / exchangeRate)
    }

    return roundAmount(amount)
}

function normalizeAllocations(items: ShareAllocation[], totalAmount: number, totalReporting: number) {
    if (items.length === 0) return items

    const rounded = items.map((item) => ({
        ...item,
        amount: roundAmount(item.amount),
        reportingAmount: roundAmount(item.reportingAmount),
    }))

    const amountDifference = roundAmount(
        totalAmount - rounded.reduce((acc, item) => acc + item.amount, 0)
    )
    const reportingDifference = roundAmount(
        totalReporting - rounded.reduce((acc, item) => acc + item.reportingAmount, 0)
    )

    const lastItem = rounded[rounded.length - 1]
    lastItem.amount = roundAmount(lastItem.amount + amountDifference)
    lastItem.reportingAmount = roundAmount(lastItem.reportingAmount + reportingDifference)

    return rounded
}

function getSharedParticipantIds(entry: ISpaceEntry, participants: ISpaceParticipant[]) {
    const explicitIds = (entry.sharedWithParticipantIds ?? [])
        .map((participantId) => extractId(participantId))
        .filter((participantId): participantId is string => Boolean(participantId))

    if (explicitIds.length > 0) return explicitIds

    return participants
        .filter((participant) => participant.isActive && participant.inviteStatus !== 'declined')
        .map((participant) => extractId(participant._id))
        .filter((participantId): participantId is string => Boolean(participantId))
}

export function buildEntryShares(entry: ISpaceEntry, participants: ISpaceParticipant[]) {
    const totalAmount = roundAmount(entry.amount)
    const totalReporting = roundAmount(entry.reportingAmount ?? totalAmount)
    const payerId = extractId(entry.paidByParticipantId)
    const sharedIds = getSharedParticipantIds(entry, participants)

    if (totalAmount <= 0) return [] as ShareAllocation[]

    if (entry.splitMode === 'none') {
        const responsibleId = (entry.sharedWithParticipantIds ?? [])
            .map((participantId) => extractId(participantId))
            .find((participantId): participantId is string => Boolean(participantId))
        const targetId = responsibleId ?? payerId
        return targetId
            ? [{ participantId: targetId, amount: totalAmount, reportingAmount: totalReporting }]
            : []
    }

    if (entry.splitMode === 'equal') {
        const ids = sharedIds.length > 0 ? sharedIds : payerId ? [payerId] : []
        if (ids.length === 0) return []

        return normalizeAllocations(
            ids.map((participantId) => ({
                participantId,
                amount: totalAmount / ids.length,
                reportingAmount: totalReporting / ids.length,
            })),
            totalAmount,
            totalReporting
        )
    }

    if (entry.splitMode === 'percentage') {
        const allocations = (entry.splitAllocations ?? [])
            .map((allocation) => {
                const participantId = extractId(allocation.participantId)
                if (!participantId) return null
                const percentage = allocation.percentage ?? 0

                return {
                    participantId,
                    amount: totalAmount * (percentage / 100),
                    reportingAmount: totalReporting * (percentage / 100),
                }
            })
            .filter((allocation): allocation is ShareAllocation => Boolean(allocation))

        if (allocations.length === 0) {
            return buildEntryShares({ ...entry, splitMode: 'equal' }, participants)
        }

        return normalizeAllocations(allocations, totalAmount, totalReporting)
    }

    if (entry.splitMode === 'fixed') {
        const allocations = (entry.splitAllocations ?? [])
            .map((allocation) => {
                const participantId = extractId(allocation.participantId)
                const amount = allocation.amount ?? 0
                if (!participantId) return null

                return {
                    participantId,
                    amount,
                    reportingAmount: totalAmount === 0 ? 0 : totalReporting * (amount / totalAmount),
                }
            })
            .filter((allocation): allocation is ShareAllocation => Boolean(allocation))

        if (allocations.length === 0) {
            return buildEntryShares({ ...entry, splitMode: 'equal' }, participants)
        }

        return normalizeAllocations(allocations, totalAmount, totalReporting)
    }

    return []
}

export function buildSpaceBalances(entries: ISpaceEntry[], participants: ISpaceParticipant[]) {
    const activeParticipants = participants.filter((participant) => participant.isActive)
    const rows = new Map<string, SpaceBalanceItem>()

    activeParticipants.forEach((participant) => {
        const participantId = extractId(participant._id)
        if (!participantId) return

        rows.set(participantId, {
            participantId,
            displayName: participant.displayName,
            kind: participant.kind,
            role: participant.role,
            inviteStatus: participant.inviteStatus,
            paidReporting: 0,
            shareReporting: 0,
            balanceReporting: 0,
            userId: extractId(participant.userId),
        })
    })

    entries
        .filter((entry) => {
            if (entry.isVoided) return false
            if (entry.status === 'rejected') return false
            if (entry.type === 'settlement' && entry.status === 'pending_confirmation') return false
            return true
        })
        .forEach((entry) => {
            const payerId = extractId(entry.paidByParticipantId)
            const reportingAmount = roundAmount(entry.reportingAmount ?? entry.amount)
            const shares = buildEntryShares(entry, activeParticipants)

            if (payerId && rows.has(payerId)) {
                const payer = rows.get(payerId)!
                payer.paidReporting = roundAmount(
                    payer.paidReporting +
                        (entry.type === 'income' ? reportingAmount * -1 : reportingAmount)
                )
            }

            shares.forEach((share) => {
                const row = rows.get(share.participantId)
                if (!row) return

                row.shareReporting = roundAmount(
                    row.shareReporting +
                        (entry.type === 'income'
                            ? share.reportingAmount * -1
                            : share.reportingAmount)
                )
            })
        })

    return Array.from(rows.values())
        .map((row) => ({
            ...row,
            balanceReporting: roundAmount(row.paidReporting - row.shareReporting),
        }))
        .sort((left, right) => right.balanceReporting - left.balanceReporting)
}

function resolveCategoryInfo(entry: ISpaceEntry) {
    if (
        entry.spaceCategoryId &&
        typeof entry.spaceCategoryId === 'object' &&
        entry.spaceCategoryId !== null &&
        'name' in entry.spaceCategoryId
    ) {
        const category = entry.spaceCategoryId as { _id?: unknown; name?: unknown; color?: unknown }
        return {
            categoryId: extractId(category._id),
            label: typeof category.name === 'string' ? category.name : 'Sin categoría',
            color: typeof category.color === 'string' ? category.color : undefined,
        }
    }

    if (
        extractId(entry.spaceCategoryId) === 'legacy-personal-category-disabled' &&
        entry.categoryId &&
        typeof entry.categoryId === 'object' &&
        entry.categoryId !== null &&
        'name' in entry.categoryId
    ) {
        const category = entry.categoryId as { _id?: unknown; name?: unknown; color?: unknown }
        return {
            categoryId: extractId(category._id),
            label: typeof category.name === 'string' ? category.name : 'Sin categoría',
            color: typeof category.color === 'string' ? category.color : undefined,
        }
    }

    return {
        categoryId: undefined,
        label: 'Sin categoría',
        color: undefined,
    }
}

export function buildSpaceSummary({
    entries,
    participants,
    currentUserId,
}: {
    space: ISpace
    entries: ISpaceEntry[]
    participants: ISpaceParticipant[]
    currentUserId?: string
}): SpaceSummarySnapshot {
    const relevantEntries = entries.filter((entry) => !entry.isVoided && entry.status !== 'rejected')
    const spendingEntries = relevantEntries.filter(
        (entry) => entry.type === 'expense' || entry.type === 'adjustment'
    )
    const balances = buildSpaceBalances(relevantEntries, participants)
    const currentParticipantIds = participants
        .filter((participant) => extractId(participant.userId) === currentUserId)
        .map((participant) => extractId(participant._id))
        .filter((participantId): participantId is string => Boolean(participantId))
    const shareByParticipant = new Map<string, number>()

    const totals = spendingEntries.reduce<SpaceCurrencyTotals>((acc, entry) => {
        acc[entry.currency] = roundAmount(acc[entry.currency] + entry.amount)
        return acc
    }, createEmptySpaceTotals())

    const totalReporting = roundAmount(
        spendingEntries.reduce(
            (acc, entry) => acc + roundAmount(entry.reportingAmount ?? entry.amount),
            0
        )
    )

    spendingEntries.forEach((entry) => {
        buildEntryShares(entry, participants).forEach((share) => {
            shareByParticipant.set(
                share.participantId,
                roundAmount(
                    (shareByParticipant.get(share.participantId) ?? 0) + share.reportingAmount
                )
            )
        })
    })

    const balanceByParticipant = new Map(
        balances.map((balance) => [balance.participantId, balance])
    )

    const yourBalanceReporting = roundAmount(
        currentParticipantIds.reduce(
            (acc, participantId) =>
                acc + (balanceByParticipant.get(participantId)?.balanceReporting ?? 0),
            0
        )
    )

    const yourShareReporting = roundAmount(
        currentParticipantIds.reduce(
            (acc, participantId) =>
                acc + (shareByParticipant.get(participantId) ?? 0),
            0
        )
    )

    const categoryBuckets = new Map<
        string,
        { categoryId?: string; label: string; color?: string; amount: number }
    >()

    spendingEntries.forEach((entry) => {
        const { categoryId, label, color } = resolveCategoryInfo(entry)
        const key = categoryId ?? 'uncategorized'
        const bucket = categoryBuckets.get(key)

        if (bucket) {
            bucket.amount = roundAmount(bucket.amount + roundAmount(entry.reportingAmount ?? entry.amount))
            return
        }

        categoryBuckets.set(key, {
            categoryId,
            label,
            color,
            amount: roundAmount(entry.reportingAmount ?? entry.amount),
        })
    })

    const categoryBreakdown = Array.from(categoryBuckets.values())
        .sort((left, right) => right.amount - left.amount)
        .map<SpaceCategoryBreakdownItem>((bucket) => ({
            ...bucket,
            percentage: totalReporting > 0 ? roundAmount((bucket.amount / totalReporting) * 100) : 0,
        }))

    const trendMap = new Map<string, number>()
    spendingEntries.forEach((entry) => {
        const date = new Date(entry.date)
        const monthKey = format(date, 'yyyy-MM')
        trendMap.set(
            monthKey,
            roundAmount((trendMap.get(monthKey) ?? 0) + roundAmount(entry.reportingAmount ?? entry.amount))
        )
    })

    const monthlyTrend = Array.from(trendMap.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .slice(-6)
        .map<SpaceTrendPoint>(([month, amount]) => ({
            month,
            label: format(new Date(`${month}-01T00:00:00`), 'MMM yyyy', { locale: es }),
            amount,
        }))

    return {
        totalByCurrency: totals,
        totalReporting,
        yourShareReporting,
        yourBalanceReporting,
        pendingToPayReporting: yourBalanceReporting < 0 ? Math.abs(yourBalanceReporting) : 0,
        pendingToCollectReporting: yourBalanceReporting > 0 ? yourBalanceReporting : 0,
        participantCount: participants.filter((participant) => participant.isActive).length,
        pendingEntryCount: relevantEntries.filter((entry) => entry.status === 'pending_confirmation').length,
        totalEntryCount: relevantEntries.length,
        categoryBreakdown,
        balances,
        monthlyTrend,
    }
}

export function formatSpaceDateRange(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) return 'Sin período definido'
    if (startDate && endDate) {
        return `${format(new Date(startDate), 'dd MMM yyyy', { locale: es })} - ${format(new Date(endDate), 'dd MMM yyyy', { locale: es })}`
    }
    if (startDate) {
        return `Desde ${format(new Date(startDate), 'dd MMM yyyy', { locale: es })}`
    }
    return `Hasta ${format(new Date(endDate!), 'dd MMM yyyy', { locale: es })}`
}

export function formatSpaceDate(date?: Date) {
    if (!date) return 'Sin fecha'
    return format(new Date(date), 'dd MMM yyyy', { locale: es })
}

export function formatCurrencyAmount(amount: number, currency: string, options?: Intl.NumberFormatOptions) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency,
        maximumFractionDigits: currency === 'ARS' ? 0 : 2,
        ...options,
    }).format(amount)
}

export function resolveSpaceStatusTone(status: SpaceStatus) {
    switch (status) {
        case 'active':
            return {
                background: 'rgba(16,185,129,0.12)',
                color: '#10B981',
            }
        case 'paused':
            return {
                background: 'rgba(245,158,11,0.14)',
                color: '#D97706',
            }
        case 'closed':
            return {
                background: 'rgba(107,114,128,0.14)',
                color: '#6B7280',
            }
        case 'archived':
            return {
                background: 'rgba(99,102,241,0.12)',
                color: '#6366F1',
            }
    }
}

export function resolveSpaceTypeAccent(type: SpaceType) {
    switch (type) {
        case 'couple':
            return { background: 'rgba(59,130,246,0.12)', color: '#3B82F6' }
        case 'home':
            return { background: 'rgba(249,115,22,0.12)', color: '#F97316' }
        case 'travel':
            return { background: 'rgba(37,99,235,0.12)', color: '#2563EB' }
        case 'project':
            return { background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }
        case 'event':
            return { background: 'rgba(168,85,247,0.12)', color: '#A855F7' }
        case 'personal':
            return { background: 'rgba(6,182,212,0.12)', color: '#0891B2' }
        case 'other':
            return { background: 'rgba(16,185,129,0.12)', color: '#10B981' }
    }
}
