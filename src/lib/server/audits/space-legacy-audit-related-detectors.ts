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
    auditParticipantShare as participantShare,
    buildExpectedSpaceDebts as buildExpectedDebts,
    groupAuditItemsBy as groupBy,
    pushSpaceAuditFinding as pushFinding,
} from '@/lib/server/audits/space-legacy-audit-calculations'

const ACTIVE_DEBT_STATUSES = new Set(['active', 'partially_paid'])

export function auditImpacts(bundle: SpaceAuditBundle, findings: SpaceAuditFinding[]) {
    const spaceId = id(bundle.space._id)
    const entriesById = new Map(bundle.entries.map((entry) => [id(entry._id), entry]))
    const participantsById = new Map(bundle.participants.map((participant) => [id(participant._id), participant]))
    const transactionsById = new Map(bundle.transactions.map((transaction) => [id(transaction._id), transaction]))
    const accountsById = new Map(bundle.accounts.map((account) => [id(account._id), account]))

    for (const [, duplicateImpacts] of groupBy(
        bundle.impacts,
        (impact) => `${id(impact.userId) ?? ''}:${id(impact.entryId) ?? ''}`
    )) {
        if (duplicateImpacts.length <= 1) continue
        pushFinding(findings, {
            code: 'SPACE_PERSONAL_IMPACT_DUPLICATE', severity: 'critical', collection: 'spaceentrypersonalimpacts',
            recordIds: duplicateImpacts.map((item) => id(item._id)), relatedIds: [id(duplicateImpacts[0].entryId)],
            targetInvariant: 'Existe un único impacto privado por usuario y movimiento, con estado propio.',
            evidence: { duplicates: duplicateImpacts.length },
        })
    }

    for (const impact of bundle.impacts) {
        const impactId = id(impact._id)
        const entryId = id(impact.entryId)
        const userId = id(impact.userId)
        const participantId = id(impact.participantId)
        const entry = entriesById.get(entryId)
        const participant = participantsById.get(participantId)
        if (!entry || id(entry.spaceId) !== spaceId || id(impact.spaceId) !== spaceId) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_IMPACT_ORPHAN', severity: 'critical', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [spaceId, entryId],
                targetInvariant: 'Todo impacto privado pertenece al mismo Espacio y movimiento existentes.',
            })
        }
        if (!participant || id(participant.userId) !== userId) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_IMPACT_CROSS_USER', severity: 'critical', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [participantId, userId],
                targetInvariant: 'El impacto privado sólo referencia al participante del usuario propietario.',
            })
        }

        const transactionId = id(impact.transactionId)
        const transaction = transactionsById.get(transactionId)
        if (impact.status === 'linked' && !transaction) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_IMPACT_TRANSACTION_MISSING', severity: 'critical', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [transactionId],
                targetInvariant: 'Un impacto vinculado referencia una transacción personal existente.',
            })
        }
        if (transaction && (id(transaction.userId) !== userId || id(transaction.spaceEntryId) !== entryId || id(transaction.spaceId) !== spaceId)) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_TRANSACTION_CROSS_USER_OR_ENTRY', severity: 'critical', collection: 'transactions',
                recordIds: [id(transaction._id)], relatedIds: [impactId, entryId, userId],
                targetInvariant: 'La transacción personal pertenece al usuario y al movimiento indicados por el impacto privado.',
            })
        }
        if (impact.status === 'pending' && transactionId) {
            pushFinding(findings, {
                code: 'SPACE_PENDING_WITH_TRANSACTION', severity: 'high', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [transactionId],
                targetInvariant: 'Una decisión pendiente todavía no referencia una transacción personal.',
            })
        }
        const accountId = id(impact.accountId)
        const account = accountsById.get(accountId)
        if (accountId && (!account || id(account.userId) !== userId)) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_IMPACT_ACCOUNT_INVALID', severity: 'critical', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [accountId],
                targetInvariant: 'La cuenta del impacto existe y pertenece al usuario propietario.',
                evidence: { accountExists: Boolean(account), sameUser: Boolean(account && id(account.userId) === userId) },
            })
        }

        const amount = number(impact.amount)
        const accountImpactAmount = number(impact.accountImpactAmount)
        const operationalAmount = number(impact.operationalAmount)
        const share = entry && participantId ? participantShare(entry, participantId) : undefined
        const payer = entry && id(entry.paidByParticipantId) === participantId
        const zeroShare = share !== undefined && Math.abs(share) <= EPSILON
        if (amount === undefined || amount < 0 || (accountImpactAmount !== undefined && accountImpactAmount < 0) || (operationalAmount !== undefined && operationalAmount < 0)) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_IMPACT_AMOUNTS_INVALID', severity: 'critical', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [entryId],
                targetInvariant: 'Parte propia, impacto de cuenta e impacto operacional son no negativos y explícitos.',
            })
        }
        if (entry && impact.status === 'linked') {
            const entryAmount = number(entry.amount)
            const expectedAccountImpact = payer || entry.type === 'settlement'
                ? entryAmount
                : 0
            const expectedOperational = entry.type === 'settlement' ? 0 : share
            const transactionAmount = number(transaction?.amount)
            const transactionOperational = number(transaction?.operationalAmount) ?? transactionAmount
            const semanticsComplete =
                share !== undefined && accountImpactAmount !== undefined && operationalAmount !== undefined
            const semanticsMatch =
                semanticsComplete && expectedAccountImpact !== undefined && expectedOperational !== undefined &&
                Math.abs(accountImpactAmount - expectedAccountImpact) <= EPSILON &&
                Math.abs(operationalAmount - expectedOperational) <= EPSILON &&
                (!transaction || (
                    transactionAmount !== undefined &&
                    Math.abs(transactionAmount - (payer || entry.type === 'settlement' ? entryAmount! : share)) <= EPSILON &&
                    transactionOperational !== undefined &&
                    Math.abs(transactionOperational - expectedOperational) <= EPSILON
                ))
            if (!semanticsComplete || !semanticsMatch) {
                pushFinding(findings, {
                    code: 'SPACE_PERSONAL_IMPACT_AMOUNT_SEMANTICS_LEGACY', severity: 'high', collection: 'spaceentrypersonalimpacts',
                    recordIds: [impactId], relatedIds: [entryId, transactionId],
                    targetInvariant: 'Parte propia, salida real y gasto operacional son explícitos y coinciden en impacto y transacción.',
                    evidence: { semanticsComplete, semanticsMatch, payer: Boolean(payer), settlement: entry.type === 'settlement' },
                })
            }
        }
        const timestampValid =
            (impact.status === 'linked' && Boolean(date(impact.resolvedAt))) ||
            (impact.status === 'ignored' && Boolean(date(impact.ignoredAt))) ||
            (impact.status === 'removed' && Boolean(date(impact.removedAt))) ||
            (impact.status === 'needs_review' && Boolean(date(impact.reviewRequestedAt))) ||
            ['pending', 'unlinked', 'cancelled'].includes(String(impact.status))
        if (!timestampValid) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_IMPACT_STATE_TIMESTAMP_INVALID', severity: 'medium', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [entryId],
                targetInvariant: 'Cada estado privado conserva el timestamp que explica su transición.',
                evidence: { status: String(impact.status) },
            })
        }
        if (entry && impact.status === 'pending' && zeroShare && !payer) {
            pushFinding(findings, {
                code: 'SPACE_PENDING_UNNEEDED_ZERO_SHARE', severity: 'high', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [entryId],
                targetInvariant: 'Un no pagador con parte propia cero no recibe una acción personal.',
            })
        }
        if (entry && impact.status === 'pending' && zeroShare && payer && impact.actionType !== 'impact_space_payment') {
            pushFinding(findings, {
                code: 'SPACE_PAYER_ZERO_SHARE_ACTION_MISCLASSIFIED', severity: 'high', collection: 'spaceentrypersonalimpacts',
                recordIds: [impactId], relatedIds: [entryId],
                targetInvariant: 'El pagador con parte propia cero registra adelanto, no gasto operacional.',
                evidence: { actionType: String(impact.actionType ?? '') },
            })
        }
    }

    const impactTransactionIds = new Set(bundle.impacts.map((impact) => id(impact.transactionId)))
    for (const transaction of bundle.transactions) {
        if (transaction.spaceEntryId && !impactTransactionIds.has(id(transaction._id))) {
            pushFinding(findings, {
                code: 'SPACE_PERSONAL_TRANSACTION_ORPHAN', severity: 'high', collection: 'transactions',
                recordIds: [id(transaction._id)], relatedIds: [id(transaction.spaceEntryId)],
                targetInvariant: 'Toda transacción derivada de Espacios tiene un impacto privado propietario.',
            })
        }
    }
}

export function auditDebts(bundle: SpaceAuditBundle, findings: SpaceAuditFinding[]) {
    const spaceId = id(bundle.space._id)
    const debtIds = new Set(bundle.debts.map((debt) => id(debt._id)))
    const transactionIds = new Set(bundle.transactions.map((transaction) => id(transaction._id)))
    const entryIds = new Set(bundle.entries.map((entry) => id(entry._id)))
    const expectedDebts = buildExpectedDebts(bundle)
    const expectedByRelation = new Map(expectedDebts.map((expected) => [
        `${expected.userId}:${expected.counterpartyParticipantId}:${expected.currency}:${expected.direction}`,
        expected,
    ]))
    const actualRelations = new Set<string>()

    for (const [, duplicateDebts] of groupBy(bundle.debts, (debt) => String(debt.spaceDebtKey ?? ''))) {
        if (!duplicateDebts[0]?.spaceDebtKey) continue
        if (duplicateDebts.length > 1) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_KEY_DUPLICATE', severity: 'critical', collection: 'debts',
                recordIds: duplicateDebts.map((item) => id(item._id)), relatedIds: [spaceId],
                targetInvariant: 'La clave de deuda derivada es única e idempotente.',
                evidence: { duplicates: duplicateDebts.length },
            })
        }
    }

    for (const debt of bundle.debts) {
        const debtId = id(debt._id)
        if (!debt.spaceDebtKey) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_KEY_MISSING', severity: 'high', collection: 'debts',
                recordIds: [debtId], relatedIds: [spaceId],
                targetInvariant: 'Toda deuda derivada conserva una clave de idempotencia estable.',
            })
        }
        const amount = number(debt.amount)
        const remaining = number(debt.remainingAmount)
        const relationKey = `${id(debt.userId) ?? ''}:${id(debt.counterpartyParticipantId) ?? ''}:${String(debt.currency ?? '')}:${String(debt.direction ?? '')}`
        actualRelations.add(relationKey)
        const expected = expectedByRelation.get(relationKey)
        if (ACTIVE_DEBT_STATUSES.has(String(debt.status)) && (!remaining || remaining <= EPSILON)) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_ACTIVE_ZERO', severity: 'high', collection: 'debts',
                recordIds: [debtId], relatedIds: [spaceId],
                targetInvariant: 'Una deuda activa conserva saldo material; saldo cero implica cierre.',
            })
        }
        if (amount === undefined || remaining === undefined || remaining < 0 || remaining - amount > EPSILON) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_BALANCE_INVALID', severity: 'critical', collection: 'debts',
                recordIds: [debtId], relatedIds: [spaceId],
                targetInvariant: 'El saldo derivado es no negativo y no supera el snapshot original.',
            })
        }
        if (
            (expected && (remaining === undefined || Math.abs(remaining - expected.amount) > EPSILON)) ||
            (!expected && ACTIVE_DEBT_STATUSES.has(String(debt.status)) && Boolean(remaining && remaining > EPSILON))
        ) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_BALANCE_DRIFT', severity: 'critical', collection: 'debts',
                recordIds: [debtId], relatedIds: [spaceId, id(debt.counterpartyParticipantId)],
                targetInvariant: 'Debt.remainingAmount materializa exactamente el balance vigente del Espacio.',
                evidence: { expectedRelation: Boolean(expected), remainingMatches: Boolean(expected && remaining !== undefined && Math.abs(remaining - expected.amount) <= EPSILON) },
            })
        }
        const snapshot = debt.metadata && typeof debt.metadata === 'object'
            ? (debt.metadata as AuditDocument).syncSnapshot as AuditDocument | undefined
            : undefined
        const currentMode = bundle.space.debtMode ?? (bundle.space.simplifyDebts === false ? 'direct' : 'simplified')
        if (snapshot?.debtMode && snapshot.debtMode !== currentMode) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_MODE_STALE', severity: 'high', collection: 'debts',
                recordIds: [debtId], relatedIds: [spaceId],
                targetInvariant: 'Las deudas derivadas reflejan el modo vigente del Espacio.',
                evidence: { snapshotMode: String(snapshot.debtMode), currentMode: String(currentMode) },
            })
        }
    }

    for (const [relationKey, expected] of expectedByRelation) {
        if (actualRelations.has(relationKey)) continue
        pushFinding(findings, {
            code: 'SPACE_DEBT_MATERIALIZATION_MISSING', severity: 'high', collection: 'debts',
            recordIds: [], relatedIds: [spaceId, expected.userId, expected.counterpartyParticipantId],
            targetInvariant: 'Todo balance material entre participantes registrados tiene su deuda privada derivada.',
            evidence: { direction: expected.direction, currency: expected.currency },
        })
    }

    for (const movement of bundle.debtMovements) {
        const movementId = id(movement._id)
        const missingDebt = !debtIds.has(id(movement.debtId))
        const missingEntry = Boolean(movement.spaceEntryId) && !entryIds.has(id(movement.spaceEntryId))
        const missingTransaction = Boolean(movement.transactionId) && !transactionIds.has(id(movement.transactionId))
        if (missingDebt || missingEntry || missingTransaction || id(movement.spaceId) !== spaceId) {
            pushFinding(findings, {
                code: 'SPACE_DEBT_MOVEMENT_LINKS_INVALID', severity: 'critical', collection: 'debtmovements',
                recordIds: [movementId], relatedIds: [id(movement.debtId), id(movement.spaceEntryId), id(movement.transactionId)],
                targetInvariant: 'Cada movimiento de deuda conserva vínculos íntegros con deuda, Espacio, entry y transacción.',
                evidence: { missingDebt, missingEntry, missingTransaction, sameSpace: id(movement.spaceId) === spaceId },
            })
        }
        const linkedEntry = bundle.entries.find((entry) => id(entry._id) === id(movement.spaceEntryId))
        const linkedDebt = bundle.debts.find((debt) => id(debt._id) === id(movement.debtId))
        const expected = linkedDebt
            ? expectedByRelation.get(`${id(linkedDebt.userId) ?? ''}:${id(linkedDebt.counterpartyParticipantId) ?? ''}:${String(linkedDebt.currency ?? '')}:${String(linkedDebt.direction ?? '')}`)
            : undefined
        const remaining = number(linkedDebt?.remainingAmount)
        if (
            linkedEntry?.type === 'settlement' &&
            ['payment', 'collect'].includes(String(movement.type)) &&
            expected && remaining !== undefined && remaining < expected.amount - EPSILON
        ) {
            pushFinding(findings, {
                code: 'SPACE_SETTLEMENT_DOUBLE_APPLIED', severity: 'critical', collection: 'debts',
                recordIds: [id(linkedDebt?._id)], relatedIds: [movementId, id(linkedEntry._id)],
                targetInvariant: 'Una liquidación incluida en el balance no vuelve a descontarse de la deuda materializada.',
                evidence: { balanceMatches: Math.abs(remaining - expected.amount) <= EPSILON },
            })
        }
    }

    const settlementIds = new Set(
        bundle.entries.filter((entry) => entry.type === 'settlement').map((entry) => id(entry._id))
    )
    const appliedSettlementIds = new Map<string, number>()
    for (const debt of bundle.debts) {
        const metadata = debt.metadata as AuditDocument | undefined
        const sourceIds = metadata ? ids(metadata.sourceSettlementIds) : []
        for (const settlementId of sourceIds) {
            appliedSettlementIds.set(settlementId, (appliedSettlementIds.get(settlementId) ?? 0) + 1)
        }
    }
    for (const [settlementId, count] of appliedSettlementIds) {
        if (!settlementIds.has(settlementId) || count > 2) {
            pushFinding(findings, {
                code: 'SPACE_SETTLEMENT_DEBT_APPLICATION_SUSPICIOUS', severity: 'high', collection: 'debts',
                recordIds: bundle.debts.filter((debt) => {
                    const metadata = debt.metadata as AuditDocument | undefined
                    return metadata && ids(metadata.sourceSettlementIds).includes(settlementId)
                }).map((debt) => id(debt._id)),
                relatedIds: [settlementId],
                targetInvariant: 'Una liquidación se aplica una sola vez por perspectiva privada y referencia un entry existente.',
                evidence: { applications: count, settlementExists: settlementIds.has(settlementId) },
            })
        }
    }
}

export function auditTracking(bundle: SpaceAuditBundle, findings: SpaceAuditFinding[]) {
    const spaceId = id(bundle.space._id)
    const impactsById = new Map(bundle.impacts.map((impact) => [id(impact._id), impact]))
    const notificationsByPending = groupBy(bundle.notifications, (notification) => id(notification.pendingActionId))
    const impactsByUserEntry = new Set(
        bundle.impacts.map((impact) => `${id(impact.userId) ?? ''}:${id(impact.entryId) ?? ''}`)
    )

    for (const entry of bundle.entries) {
        if (entry.isVoided === true || entry.status === 'rejected') continue
        for (const participant of bundle.participants.filter((candidate) => candidate.isActive === true && candidate.userId)) {
            const participantId = id(participant._id)
            const userId = id(participant.userId)
            const entryId = id(entry._id)
            if (!participantId || !userId || !entryId) continue
            const share = participantShare(entry, participantId)
            const isPayer = id(entry.paidByParticipantId) === participantId
            const actionable = isPayer || (share !== undefined && share > EPSILON)
            if (actionable && !impactsByUserEntry.has(`${userId}:${entryId}`)) {
                pushFinding(findings, {
                    code: 'SPACE_PENDING_ACTION_MISSING', severity: 'high', collection: 'spaceentrypersonalimpacts',
                    recordIds: [], relatedIds: [id(bundle.space._id), entryId, userId, participantId],
                    targetInvariant: 'Cada parte propia positiva o adelanto real conserva un impacto privado accionable.',
                    evidence: { payer: isPayer, positiveShare: Boolean(share && share > EPSILON) },
                })
            }
        }
    }

    for (const impact of bundle.impacts.filter((candidate) => candidate.status === 'pending')) {
        const impactId = id(impact._id)
        const notifications = notificationsByPending.get(impactId ?? '') ?? []
        if (notifications.length !== 1) {
            pushFinding(findings, {
                code: 'SPACE_PENDING_NOTIFICATION_MISMATCH', severity: 'medium', collection: 'notifications',
                recordIds: notifications.map((item) => id(item._id)), relatedIds: [impactId],
                targetInvariant: 'Cada acción pendiente tiene una única notificación accionable y deduplicada.',
                evidence: { notifications: notifications.length },
            })
        }
    }
    for (const notification of bundle.notifications) {
        const pendingId = id(notification.pendingActionId)
        if (pendingId && !impactsById.has(pendingId)) {
            pushFinding(findings, {
                code: 'SPACE_NOTIFICATION_ORPHAN', severity: 'medium', collection: 'notifications',
                recordIds: [id(notification._id)], relatedIds: [pendingId],
                targetInvariant: 'Una notificación de Espacios referencia una acción privada existente.',
            })
        }
        const impact = impactsById.get(pendingId)
        if (impact && id(notification.recipientUserId) !== id(impact.userId)) {
            pushFinding(findings, {
                code: 'SPACE_NOTIFICATION_CROSS_USER', severity: 'critical', collection: 'notifications',
                recordIds: [id(notification._id)], relatedIds: [pendingId],
                targetInvariant: 'La notificación privada sólo se entrega al propietario del impacto.',
            })
        }
    }

    const activityEntryIds = new Set(
        bundle.activityEvents.filter((event) => event.entityType === 'entry').map((event) => id(event.entityId))
    )
    for (const entry of bundle.entries) {
        if (!activityEntryIds.has(id(entry._id))) {
            pushFinding(findings, {
                code: 'SPACE_ENTRY_ACTIVITY_MISSING', severity: 'medium', collection: 'spaceactivityevents',
                recordIds: [], relatedIds: [spaceId, id(entry._id)],
                targetInvariant: 'Cada mutación financiera compartida deja actividad trazable.',
            })
        }
    }
}
