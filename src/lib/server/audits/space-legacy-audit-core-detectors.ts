import type {
    AuditDocument,
    SpaceAuditBundle,
    SpaceAuditFinding,
} from '@/lib/server/audits/space-legacy-audit-contract'
import {
    SPACE_AUDIT_EPSILON as EPSILON,
    auditDate as date,
    auditId as id,
    auditIds as ids,
    auditNumber as number,
    groupAuditItemsBy as groupBy,
    pushSpaceAuditFinding as pushFinding,
} from '@/lib/server/audits/space-legacy-audit-calculations'

const LEGACY_ENTRY_STATUSES = new Set([
    'recorded',
    'pending_confirmation',
    'confirmed',
    'linked',
    'rejected',
])

export function auditParticipants(bundle: SpaceAuditBundle, findings: SpaceAuditFinding[]) {
    const spaceId = id(bundle.space._id)
    const ownerUserId = id(bundle.space.ownerUserId)
    const active = bundle.participants.filter((participant) => participant.isActive === true)
    const ownerParticipants = active.filter((participant) => participant.role === 'owner')
    const ownerByUser = active.filter(
        (participant) => id(participant.userId) === ownerUserId
    )

    if (!ownerUserId || ownerByUser.length !== 1) {
        pushFinding(findings, {
            code: 'SPACE_OWNER_PARTICIPANT_INVALID', severity: 'critical', collection: 'spaces',
            recordIds: [spaceId], relatedIds: ownerByUser.map((item) => id(item._id)),
            targetInvariant: 'El owner del Espacio tiene un único participante activo.',
            evidence: { matchingActiveParticipants: ownerByUser.length },
        })
    }
    if (ownerParticipants.length !== 1 || id(ownerParticipants[0]?.userId) !== ownerUserId) {
        pushFinding(findings, {
            code: 'SPACE_OWNER_ROLE_INVALID', severity: 'high', collection: 'spaceparticipants',
            recordIds: ownerParticipants.map((item) => id(item._id)), relatedIds: [spaceId],
            targetInvariant: 'Existe un único rol owner y pertenece al ownerUserId del Espacio.',
            evidence: { activeOwnerRoles: ownerParticipants.length },
        })
    }

    for (const [, duplicateParticipants] of groupBy(
        bundle.participants,
        (participant) => id(participant.userId)
    )) {
        if (duplicateParticipants.length <= 1) continue
        pushFinding(findings, {
            code: 'SPACE_PARTICIPANT_USER_DUPLICATE', severity: 'high', collection: 'spaceparticipants',
            recordIds: duplicateParticipants.map((item) => id(item._id)), relatedIds: [spaceId],
            targetInvariant: 'Un usuario tiene un único participante por Espacio.',
            evidence: { duplicates: duplicateParticipants.length },
        })
    }

    const userIds = new Set(bundle.users.map((user) => id(user._id)))
    for (const participant of bundle.participants) {
        const userId = id(participant.userId)
        if (userId && !userIds.has(userId)) {
            pushFinding(findings, {
                code: 'SPACE_PARTICIPANT_USER_MISSING', severity: 'high', collection: 'spaceparticipants',
                recordIds: [id(participant._id)], relatedIds: [spaceId, userId],
                targetInvariant: 'Todo participante asociado a un usuario referencia un usuario existente.',
            })
        }
    }

    const lifecycleLockedAt = date(bundle.space.closedAt)
    if (bundle.space.status !== 'active' && lifecycleLockedAt) {
        const lateRecords = [...bundle.participants, ...bundle.entries].filter((record) => {
            const changedAt = date(record.updatedAt) ?? date(record.createdAt)
            return changedAt && changedAt > lifecycleLockedAt
        })
        if (lateRecords.length > 0) {
            pushFinding(findings, {
                code: 'SPACE_WRITE_AFTER_LIFECYCLE_LOCK', severity: 'high', collection: 'spaces',
                recordIds: [spaceId], relatedIds: lateRecords.map((item) => id(item._id)),
                targetInvariant: 'Un Espacio cerrado o archivado no acepta mutaciones financieras.',
                evidence: { recordsAfterLock: lateRecords.length },
            })
        }
    }

    if (typeof bundle.space.timezone !== 'string' || !bundle.space.timezone) {
        pushFinding(findings, {
            code: 'SPACE_TIMEZONE_MISSING', severity: 'medium', collection: 'spaces',
            recordIds: [spaceId],
            targetInvariant: 'El Espacio conserva una zona horaria explícita para sus reglas de fecha.',
        })
    }
}
export function auditEntries(bundle: SpaceAuditBundle, findings: SpaceAuditFinding[]) {
    const spaceId = id(bundle.space._id)
    const participantsById = new Map(
        bundle.participants.map((participant) => [id(participant._id), participant])
    )
    const transactionIds = new Set(bundle.transactions.map((transaction) => id(transaction._id)))

    for (const entry of bundle.entries) {
        const entryId = id(entry._id)
        if (LEGACY_ENTRY_STATUSES.has(String(entry.status))) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_LEGACY_SHARED_STATE', severity: 'info', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [spaceId],
                targetInvariant: 'El estado compartido no expresa decisiones privadas del Finp personal.',
                evidence: { legacyStatus: String(entry.status) },
            })
        }
        if (entry.linkedTransactionId) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_GLOBAL_PERSONAL_LINK', severity: 'high', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [id(entry.linkedTransactionId)],
                targetInvariant: 'Los vínculos con transacciones personales pertenecen al impacto privado de cada usuario.',
                evidence: { referencedTransactionExists: transactionIds.has(id(entry.linkedTransactionId)) },
            })
        }
        if (entry.isVoided === true && ['linked', 'confirmed'].includes(String(entry.status))) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_VOID_STATE_CONFLICT', severity: 'high', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [spaceId],
                targetInvariant: 'Un movimiento anulado no permanece en un estado compartido vigente.',
            })
        }

        const payerId = id(entry.paidByParticipantId)
        if (!payerId || !participantsById.has(payerId)) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_PAYER_INVALID', severity: 'critical', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [payerId],
                targetInvariant: 'Todo movimiento financiero identifica un pagador válido del mismo Espacio.',
            })
        }

        const sharedIds = ids(entry.sharedWithParticipantIds)
        const invalidSharedIds = sharedIds.filter((participantId) => !participantsById.has(participantId))
        if (invalidSharedIds.length > 0 || new Set(sharedIds).size !== sharedIds.length) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_SHARED_PARTICIPANTS_INVALID', severity: 'high', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: invalidSharedIds,
                targetInvariant: 'El reparto contiene participantes únicos y pertenecientes al Espacio.',
                evidence: { invalidReferences: invalidSharedIds.length, duplicateReferences: sharedIds.length - new Set(sharedIds).size },
            })
        }

        const allocations = Array.isArray(entry.splitAllocations)
            ? (entry.splitAllocations as AuditDocument[])
            : []
        const allocationIds = allocations.map((allocation) => id(allocation.participantId)).filter(Boolean)
        const hasInvalidAllocation = allocationIds.some(
            (participantId) => !participantsById.has(participantId)
        ) || new Set(allocationIds).size !== allocationIds.length
        const total = entry.splitMode === 'percentage'
            ? allocations.reduce((sum, allocation) => sum + (number(allocation.percentage) ?? 0), 0)
            : entry.splitMode === 'fixed'
                ? allocations.reduce((sum, allocation) => sum + (number(allocation.amount) ?? 0), 0)
                : undefined
        const expectedTotal = entry.splitMode === 'percentage' ? 100 : number(entry.amount)
        if (
            hasInvalidAllocation ||
            ((entry.splitMode === 'percentage' || entry.splitMode === 'fixed') &&
                (allocations.length === 0 || total === undefined || expectedTotal === undefined || Math.abs(total - expectedTotal) > EPSILON))
        ) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_SPLIT_INVALID', severity: 'critical', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: allocationIds,
                targetInvariant: 'El reparto es completo, suma el total requerido y sólo referencia participantes válidos.',
                evidence: { mode: String(entry.splitMode), allocationCount: allocations.length, totalMatches: total !== undefined && expectedTotal !== undefined && Math.abs(total - expectedTotal) <= EPSILON },
            })
        }

        const amount = number(entry.amount)
        const reportingAmount = number(entry.reportingAmount)
        const currencies = Array.isArray(bundle.space.currencies) ? bundle.space.currencies : []
        const currencyAllowed = currencies.includes(entry.currency) && Boolean(entry.currency)
        const exchangeRequired = entry.currency !== bundle.space.reportingCurrency
        const exchangeRate = number(entry.exchangeRate)
        if (
            amount === undefined || amount < 0 || reportingAmount === undefined || reportingAmount < 0 ||
            !currencyAllowed || (exchangeRequired && (!exchangeRate || exchangeRate <= 0)) || !date(entry.date)
        ) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_FINANCIAL_SNAPSHOT_INVALID', severity: 'critical', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [spaceId],
                targetInvariant: 'Monto, moneda, conversión y fecha forman un snapshot financiero válido.',
                evidence: { amountValid: amount !== undefined && amount >= 0, reportingAmountValid: reportingAmount !== undefined && reportingAmount >= 0, currencyAllowed, exchangeRateValid: !exchangeRequired || Boolean(exchangeRate && exchangeRate > 0), dateValid: Boolean(date(entry.date)) },
            })
        }
        if (typeof entry.dateKey !== 'string' || !entry.dateKey) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_DATE_KEY_MISSING', severity: 'medium', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [spaceId],
                targetInvariant: 'El movimiento conserva una fecha civil estable en la zona horaria del Espacio.',
            })
        }
        if (entry.type === 'settlement' && (sharedIds.length !== 1 || !payerId || sharedIds[0] === payerId)) {
            pushFinding(findings, {
                code: 'SPACE_SETTLEMENT_RELATION_INVALID', severity: 'critical', collection: 'spaceentries',
                recordIds: [entryId], relatedIds: [payerId, ...sharedIds],
                targetInvariant: 'Una liquidación tiene pagador y receptor distintos y válidos.',
            })
        }
    }
}
