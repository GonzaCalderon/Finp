import type { ClientSession } from 'mongoose'
import type { Db, Document } from 'mongodb'

import {
    auditSpaceBundle,
    buildSpaceAuditResult,
    findingsFromGlobalOrphans,
    type AuditDocument,
    type SpaceAuditBundle,
    type SpaceAuditGlobalOrphan,
} from '@/lib/server/audits/space-legacy-audit'

export const SPACE_AUDIT_COLLECTIONS = [
    'spaces',
    'spaceparticipants',
    'spaceentries',
    'spaceentrypersonalimpacts',
    'transactions',
    'debts',
    'debtmovements',
    'notifications',
    'spaceactivityevents',
    'users',
    'accounts',
] as const

export interface MongoSpaceAuditRun {
    result: ReturnType<typeof buildSpaceAuditResult>
    collectionCounts: Record<string, number>
    snapshotRead: true
}

const PROJECTIONS: Record<string, Document> = {
    spaces: {
        _id: 1, ownerUserId: 1, status: 1, closedAt: 1, currencies: 1,
        reportingCurrency: 1, debtMode: 1, simplifyDebts: 1, timezone: 1,
    },
    spaceparticipants: {
        _id: 1, spaceId: 1, userId: 1, role: 1, kind: 1, inviteStatus: 1,
        isActive: 1, createdAt: 1, updatedAt: 1,
    },
    spaceentries: {
        _id: 1, spaceId: 1, createdByUserId: 1, createdByParticipantId: 1,
        type: 1, status: 1, amount: 1, currency: 1, reportingAmount: 1,
        exchangeRate: 1, date: 1, dateKey: 1, paidByParticipantId: 1,
        sharedWithParticipantIds: 1, splitMode: 1, splitAllocations: 1,
        linkedTransactionId: 1, confirmationRequired: 1, confirmedByUserId: 1,
        confirmedAt: 1, rejectedAt: 1, isVoided: 1, voidedAt: 1,
        editedAt: 1, createdAt: 1, updatedAt: 1,
    },
    spaceentrypersonalimpacts: {
        _id: 1, spaceId: 1, entryId: 1, userId: 1, participantId: 1,
        transactionId: 1, accountId: 1, impactKind: 1, amount: 1,
        accountImpactAmount: 1, operationalAmount: 1, currency: 1, status: 1,
        actionType: 1, sourceType: 1, actorUserId: 1,
        counterpartyParticipantId: 1, debtId: 1, debtMovementId: 1,
        resolvedAt: 1, ignoredAt: 1, removedAt: 1, reviewReason: 1,
        reviewRequestedAt: 1, reviewedAt: 1, reviewedResolution: 1,
        createdAt: 1, updatedAt: 1,
    },
    transactions: {
        _id: 1, userId: 1, type: 1, amount: 1, operationalAmount: 1,
        currency: 1, date: 1, sourceAccountId: 1, destinationAccountId: 1,
        status: 1, createdFrom: 1, spaceId: 1, spaceEntryId: 1,
        createdAt: 1, updatedAt: 1,
    },
    debts: {
        _id: 1, userId: 1, direction: 1, sourceType: 1, spaceId: 1,
        counterpartyParticipantId: 1, counterpartyUserId: 1, amount: 1,
        remainingAmount: 1, currency: 1, status: 1, originMode: 1,
        spaceDebtKey: 1, metadata: 1, createdAt: 1, updatedAt: 1,
    },
    debtmovements: {
        _id: 1, userId: 1, debtId: 1, type: 1, amount: 1, currency: 1,
        accountId: 1, transactionId: 1, spaceId: 1, spaceEntryId: 1,
        date: 1, createdAt: 1,
    },
    notifications: {
        _id: 1, recipientUserId: 1, actorUserId: 1, type: 1, category: 1,
        status: 1, actionStatus: 1, pendingActionId: 1, entityRefs: 1,
        dedupeKey: 1, resolvedAt: 1, createdAt: 1, updatedAt: 1,
    },
    spaceactivityevents: {
        _id: 1, spaceId: 1, actorUserId: 1, actorParticipantId: 1, type: 1,
        entityType: 1, entityId: 1, visibleToUserIds: 1, readByUserIds: 1,
        createdAt: 1,
    },
    users: { _id: 1 },
    accounts: { _id: 1, userId: 1 },
}

function uniqueReferences(values: unknown[]) {
    const references = new Map<string, unknown>()
    for (const value of values) {
        if (!value) continue
        const key = String(value)
        if (key) references.set(key, value)
    }
    return Array.from(references.values())
}

async function readMany(
    db: Db,
    collectionName: string,
    filter: Document,
    session: ClientSession
) {
    return db
        .collection(collectionName)
        .find(filter, {
            projection: PROJECTIONS[collectionName],
            session,
            maxTimeMS: 30_000,
        })
        .toArray() as Promise<AuditDocument[]>
}

async function loadBundle(
    db: Db,
    space: AuditDocument,
    session: ClientSession
): Promise<SpaceAuditBundle> {
    const spaceId = space._id
    const [participants, entries, impacts, debts, activityEvents] = await Promise.all([
        readMany(db, 'spaceparticipants', { spaceId }, session),
        readMany(db, 'spaceentries', { spaceId }, session),
        readMany(db, 'spaceentrypersonalimpacts', { spaceId }, session),
        readMany(db, 'debts', { spaceId }, session),
        readMany(db, 'spaceactivityevents', { spaceId }, session),
    ])

    const entryIds = uniqueReferences(entries.map((entry) => entry._id))
    const impactTransactionIds = uniqueReferences(impacts.map((impact) => impact.transactionId))
    const debtIds = uniqueReferences(debts.map((debt) => debt._id))
    const transactionFilter: Document = {
        $or: [
            { spaceId },
            ...(entryIds.length > 0 ? [{ spaceEntryId: { $in: entryIds } }] : []),
            ...(impactTransactionIds.length > 0 ? [{ _id: { $in: impactTransactionIds } }] : []),
        ],
    }
    const [transactions, debtMovements] = await Promise.all([
        readMany(db, 'transactions', transactionFilter, session),
        readMany(
            db,
            'debtmovements',
            {
                $or: [
                    { spaceId },
                    ...(debtIds.length > 0 ? [{ debtId: { $in: debtIds } }] : []),
                ],
            },
            session
        ),
    ])

    const pendingImpactIds = uniqueReferences(
        impacts.filter((impact) => impact.status === 'pending').map((impact) => impact._id)
    )
    const notifications = await readMany(
        db,
        'notifications',
        {
            $or: [
                { 'entityRefs.spaceId': spaceId },
                ...(pendingImpactIds.length > 0
                    ? [{ pendingActionId: { $in: pendingImpactIds } }]
                    : []),
            ],
        },
        session
    )

    const userIds = uniqueReferences([
        space.ownerUserId,
        ...participants.map((participant) => participant.userId),
        ...impacts.map((impact) => impact.userId),
    ])
    const accountIds = uniqueReferences([
        ...impacts.map((impact) => impact.accountId),
        ...transactions.map((transaction) => transaction.sourceAccountId),
        ...transactions.map((transaction) => transaction.destinationAccountId),
    ])
    const [users, accounts] = await Promise.all([
        userIds.length > 0
            ? readMany(db, 'users', { _id: { $in: userIds } }, session)
            : Promise.resolve([]),
        accountIds.length > 0
            ? readMany(db, 'accounts', { _id: { $in: accountIds } }, session)
            : Promise.resolve([]),
    ])

    return {
        space,
        participants,
        entries,
        impacts,
        transactions,
        debts,
        debtMovements,
        notifications,
        activityEvents,
        users,
        accounts,
    }
}

async function findGlobalOrphans(db: Db, session: ClientSession) {
    const relations = [
        { collection: 'spaceparticipants', field: 'spaceId', from: 'spaces', relation: 'spaceId' },
        { collection: 'spaceentries', field: 'spaceId', from: 'spaces', relation: 'spaceId' },
        { collection: 'spaceentrypersonalimpacts', field: 'spaceId', from: 'spaces', relation: 'spaceId' },
        { collection: 'spaceentrypersonalimpacts', field: 'entryId', from: 'spaceentries', relation: 'entryId' },
        { collection: 'transactions', field: 'spaceId', from: 'spaces', relation: 'spaceId' },
        { collection: 'transactions', field: 'spaceEntryId', from: 'spaceentries', relation: 'spaceEntryId' },
        { collection: 'debts', field: 'spaceId', from: 'spaces', relation: 'spaceId' },
        { collection: 'debtmovements', field: 'debtId', from: 'debts', relation: 'debtId' },
    ] as const
    const orphans: SpaceAuditGlobalOrphan[] = []

    for (const relation of relations) {
        const rows = await db.collection(relation.collection).aggregate([
            { $match: { [relation.field]: { $exists: true, $ne: null } } },
            {
                $lookup: {
                    from: relation.from,
                    localField: relation.field,
                    foreignField: '_id',
                    as: '__auditTarget',
                },
            },
            { $match: { __auditTarget: { $size: 0 } } },
            { $project: { _id: 1, relatedId: `$${relation.field}` } },
        ], { session, maxTimeMS: 30_000 }).toArray()

        for (const row of rows) {
            orphans.push({
                collection: relation.collection,
                recordId: String(row._id),
                relatedId: row.relatedId ? String(row.relatedId) : undefined,
                relation: relation.relation,
            })
        }
    }

    return orphans
}

/**
 * Sólo recibe una sesión snapshot ya iniciada. Esta capa no expone ni invoca
 * primitivas de escritura; el abort del snapshot queda a cargo del caller.
 */
export async function runMongoSpaceLegacyAudit(
    db: Db,
    session: ClientSession
): Promise<MongoSpaceAuditRun> {
    if (!session.inTransaction()) {
        throw new Error('La auditoría exige una transacción de lectura snapshot activa.')
    }

    const collectionCounts = Object.fromEntries(
        await Promise.all(
            SPACE_AUDIT_COLLECTIONS.map(async (collectionName) => [
                collectionName,
                await db.collection(collectionName).countDocuments({}, { session, maxTimeMS: 30_000 }),
            ] as const)
        )
    )
    const findings = []
    let spacesAudited = 0
    const cursor = db.collection('spaces').find(
        {},
        {
            projection: PROJECTIONS.spaces,
            session,
            batchSize: 50,
            maxTimeMS: 30_000,
        }
    )

    for await (const rawSpace of cursor) {
        const bundle = await loadBundle(db, rawSpace as AuditDocument, session)
        findings.push(...auditSpaceBundle(bundle))
        spacesAudited += 1
    }

    findings.push(...findingsFromGlobalOrphans(await findGlobalOrphans(db, session)))

    return {
        result: buildSpaceAuditResult(findings, spacesAudited),
        collectionCounts,
        snapshotRead: true,
    }
}
