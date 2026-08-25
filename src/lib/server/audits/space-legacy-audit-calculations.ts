import type {
    AuditDocument,
    SpaceAuditBundle,
    SpaceAuditFinding,
} from '@/lib/server/audits/space-legacy-audit-contract'

export const SPACE_AUDIT_EPSILON = 0.011

export function auditId(value: unknown): string | undefined {
    if (!value) return undefined
    if (typeof value === 'string') return value.trim() || undefined
    if (typeof value === 'object') {
        const candidate = value as { _id?: unknown; toHexString?: () => string }
        if (typeof candidate.toHexString === 'function') {
            const resolved = candidate.toHexString()
            return resolved || undefined
        }
        if (candidate._id && candidate._id !== value) return auditId(candidate._id)
    }
    return undefined
}

export function auditIds(values: unknown): string[] {
    if (!Array.isArray(values)) return []
    return values.map(auditId).filter((value): value is string => Boolean(value))
}

export function auditNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function auditDate(value: unknown): Date | undefined {
    if (!value) return undefined
    const parsed = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function pushSpaceAuditFinding(
    findings: SpaceAuditFinding[],
    finding: Omit<SpaceAuditFinding, 'recordIds' | 'relatedIds' | 'evidence'> & {
        recordIds?: Array<string | undefined>
        relatedIds?: Array<string | undefined>
        evidence?: SpaceAuditFinding['evidence']
    }
) {
    findings.push({
        ...finding,
        recordIds: Array.from(new Set((finding.recordIds ?? []).filter(Boolean) as string[])).sort(),
        relatedIds: Array.from(new Set((finding.relatedIds ?? []).filter(Boolean) as string[])).sort(),
        evidence: finding.evidence ?? {},
    })
}

export function groupAuditItemsBy<T>(items: T[], key: (item: T) => string | undefined) {
    const groups = new Map<string, T[]>()
    for (const item of items) {
        const resolved = key(item)
        if (!resolved) continue
        groups.set(resolved, [...(groups.get(resolved) ?? []), item])
    }
    return groups
}

export function auditParticipantShare(entry: AuditDocument, participantId: string) {
    const amount = auditNumber(entry.amount)
    if (amount === undefined) return undefined
    const payerId = auditId(entry.paidByParticipantId)
    const sharedIds = auditIds(entry.sharedWithParticipantIds)
    const mode = entry.splitMode

    if (mode === 'none') {
        return (sharedIds[0] ?? payerId) === participantId ? amount : 0
    }
    if (mode === 'equal') {
        const targetIds = sharedIds.length > 0 ? sharedIds : payerId ? [payerId] : []
        return targetIds.includes(participantId) && targetIds.length > 0
            ? amount / targetIds.length
            : 0
    }

    const allocations = Array.isArray(entry.splitAllocations)
        ? (entry.splitAllocations as AuditDocument[])
        : []
    const allocation = allocations.find(
        (candidate) => auditId(candidate.participantId) === participantId
    )
    if (!allocation) return 0
    if (mode === 'percentage') {
        const percentage = auditNumber(allocation.percentage)
        return percentage === undefined ? undefined : amount * (percentage / 100)
    }
    if (mode === 'fixed') return auditNumber(allocation.amount)
    return undefined
}

function round(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

export interface ExpectedSpaceDebt {
    userId: string
    counterpartyParticipantId: string
    direction: 'payable' | 'receivable'
    currency: string
    amount: number
}

export function buildExpectedSpaceDebts(bundle: SpaceAuditBundle): ExpectedSpaceDebt[] {
    const activeParticipants = bundle.participants.filter((participant) => participant.isActive === true)
    const balances = new Map<string, number>(
        activeParticipants
            .map((participant) => auditId(participant._id))
            .filter((participantId): participantId is string => Boolean(participantId))
            .map((participantId) => [participantId, 0])
    )

    for (const entry of bundle.entries) {
        if (entry.isVoided === true || entry.status === 'rejected') continue
        if (entry.type === 'settlement' && entry.status === 'pending_confirmation') continue
        const payerId = auditId(entry.paidByParticipantId)
        const reportingAmount = auditNumber(entry.reportingAmount) ?? auditNumber(entry.amount)
        if (reportingAmount === undefined) continue
        const sign = entry.type === 'income' ? -1 : 1
        if (payerId && balances.has(payerId)) {
            balances.set(payerId, round((balances.get(payerId) ?? 0) + reportingAmount * sign))
        }
        for (const participant of activeParticipants) {
            const participantId = auditId(participant._id)
            if (!participantId) continue
            const share = auditParticipantShare(entry, participantId)
            if (share === undefined) continue
            const originalAmount = auditNumber(entry.amount)
            const reportingSnapshot = auditNumber(entry.reportingAmount)
            const reportingShare = originalAmount && reportingSnapshot !== undefined
                ? share * (reportingSnapshot / originalAmount)
                : share
            balances.set(
                participantId,
                round((balances.get(participantId) ?? 0) - reportingShare * sign)
            )
        }
    }

    const debtors = Array.from(balances)
        .filter(([, balance]) => balance < -SPACE_AUDIT_EPSILON)
        .map(([participantId, balance]) => ({ participantId, amount: Math.abs(balance) }))
    const creditors = Array.from(balances)
        .filter(([, balance]) => balance > SPACE_AUDIT_EPSILON)
        .map(([participantId, balance]) => ({ participantId, amount: balance }))
    const payments: Array<{ from: string; to: string; amount: number }> = []
    const mode = bundle.space.debtMode ?? (bundle.space.simplifyDebts === false ? 'direct' : 'simplified')

    if (mode === 'direct') {
        const totalCredit = creditors.reduce((sum, creditor) => sum + creditor.amount, 0)
        for (const debtor of debtors) {
            for (const creditor of creditors) {
                const amount = totalCredit > SPACE_AUDIT_EPSILON
                    ? round(debtor.amount * (creditor.amount / totalCredit))
                    : 0
                if (amount > SPACE_AUDIT_EPSILON) {
                    payments.push({ from: debtor.participantId, to: creditor.participantId, amount })
                }
            }
        }
    } else {
        const remainingDebtors = debtors.map((item) => ({ ...item }))
        const remainingCreditors = creditors.map((item) => ({ ...item }))
        let debtorIndex = 0
        let creditorIndex = 0
        while (debtorIndex < remainingDebtors.length && creditorIndex < remainingCreditors.length) {
            const debtor = remainingDebtors[debtorIndex]
            const creditor = remainingCreditors[creditorIndex]
            const amount = round(Math.min(debtor.amount, creditor.amount))
            if (amount > SPACE_AUDIT_EPSILON) {
                payments.push({ from: debtor.participantId, to: creditor.participantId, amount })
            }
            debtor.amount = round(debtor.amount - amount)
            creditor.amount = round(creditor.amount - amount)
            if (debtor.amount <= SPACE_AUDIT_EPSILON) debtorIndex += 1
            if (creditor.amount <= SPACE_AUDIT_EPSILON) creditorIndex += 1
        }
    }

    const participantsById = new Map(
        activeParticipants.map((participant) => [auditId(participant._id), participant])
    )
    const currency = String(bundle.space.reportingCurrency ?? '')
    const expected: ExpectedSpaceDebt[] = []
    for (const payment of payments) {
        const debtorUserId = auditId(participantsById.get(payment.from)?.userId)
        const creditorUserId = auditId(participantsById.get(payment.to)?.userId)
        if (debtorUserId) {
            expected.push({
                userId: debtorUserId,
                counterpartyParticipantId: payment.to,
                direction: 'payable',
                currency,
                amount: payment.amount,
            })
        }
        if (creditorUserId) {
            expected.push({
                userId: creditorUserId,
                counterpartyParticipantId: payment.from,
                direction: 'receivable',
                currency,
                amount: payment.amount,
            })
        }
    }
    return expected
}
