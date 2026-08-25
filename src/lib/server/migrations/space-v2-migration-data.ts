import type { ClientSession, Db, Document, Filter, ObjectId } from 'mongodb'

import type { SpaceAuditFinding } from '@/lib/server/audits/space-legacy-audit-contract'
import { migrationFingerprint } from '@/lib/server/migrations/space-v2-migration-fingerprint'
import { sanitizeSpaceMigrationDocument } from '@/lib/server/migrations/space-v2-migration-sanitizer'

export const SPACE_MIGRATION_BUSINESS_COLLECTIONS = [
    'spaces',
    'spaceparticipants',
    'spaceentries',
    'spaceentrypersonalimpacts',
    'transactions',
    'debts',
    'debtmovements',
    'notifications',
    'spaceactivityevents',
    'spacecategories',
    'spaceinvites',
    'spaceoperations',
    'users',
    'accounts',
    'categories',
] as const

export const SPACE_MIGRATION_RUN_COLLECTION = '_space_v2_migration_runs'
export const SPACE_MIGRATION_BACKUP_COLLECTION = '_space_v2_migration_backups'
export const SPACE_MIGRATION_HISTORY_COLLECTION = '_space_v2_legacy_history'
export const SPACE_MIGRATION_QUARANTINE_COLLECTION = '_space_v2_quarantine'

type BusinessCollection = (typeof SPACE_MIGRATION_BUSINESS_COLLECTIONS)[number]
const sessionBackupCache = new WeakMap<ClientSession, Set<string>>()

function backupCache(session: ClientSession) {
    const current = sessionBackupCache.get(session) ?? new Set<string>()
    sessionBackupCache.set(session, current)
    return current
}

function backupKey(runId: string, collection: string, documentId: ObjectId) {
    return `${runId}:${collection}:${documentId.toHexString()}`
}

function id(value: unknown) {
    if (!value) return undefined
    const maybe = value as { toHexString?: () => string }
    return typeof maybe.toHexString === 'function' ? maybe.toHexString() : String(value)
}

function fingerprintProjection(collection: string, document: Document) {
    const sanitized = sanitizeSpaceMigrationDocument(collection, document)
    if (collection === 'spaces') {
        const stable = { ...sanitized }
        delete stable.migration
        delete stable.contractVersion
        return stable
    }
    return sanitized
}

export async function fingerprintSpaceMigrationDatabase(db: Db, session?: ClientSession) {
    const collectionFingerprints: Array<{ collection: string; documents: string[] }> = []
    for (const collection of SPACE_MIGRATION_BUSINESS_COLLECTIONS) {
        const documents: string[] = []
        const cursor = db.collection(collection).find({}, { batchSize: 100, session }).sort({ _id: 1 })
        for await (const document of cursor) {
            documents.push(migrationFingerprint(fingerprintProjection(collection, document)))
        }
        collectionFingerprints.push({ collection, documents })
    }
    return migrationFingerprint(collectionFingerprints)
}

export async function fingerprintPersonalLedger(db: Db, session?: ClientSession) {
    const rows: unknown[] = []
    const cursor = db.collection('transactions').find({}, {
        projection: {
            _id: 1,
            userId: 1,
            type: 1,
            amount: 1,
            operationalAmount: 1,
            currency: 1,
            date: 1,
            sourceAccountId: 1,
            destinationAccountId: 1,
            status: 1,
        },
        batchSize: 100,
        session,
    }).sort({ _id: 1 })
    for await (const document of cursor) rows.push(document)
    return migrationFingerprint(rows)
}

export async function countSpaceMigrationDocuments(db: Db) {
    return Object.fromEntries(await Promise.all(
        SPACE_MIGRATION_BUSINESS_COLLECTIONS.map(async (collection) => [
            collection,
            await db.collection(collection).countDocuments({}, { maxTimeMS: 30_000 }),
        ] as const)
    ))
}

export async function cloneSpaceMigrationDatabase(input: {
    source: Db
    target: Db
    session: ClientSession
    execute: boolean
}) {
    const existing = await Promise.all(
        SPACE_MIGRATION_BUSINESS_COLLECTIONS.map((collection) =>
            input.target.collection(collection).estimatedDocumentCount({ maxTimeMS: 30_000 })
        )
    )
    if (existing.some((count) => count > 0)) {
        throw new Error('SPACE_MIGRATION_TARGET_NOT_EMPTY')
    }

    const counts: Record<string, number> = {}
    for (const collection of SPACE_MIGRATION_BUSINESS_COLLECTIONS) {
        let count = 0
        let batch: Document[] = []
        const cursor = input.source.collection(collection).find({}, {
            session: input.session,
            batchSize: 100,
            maxTimeMS: 30_000,
        }).sort({ _id: 1 })
        for await (const document of cursor) {
            count += 1
            if (!input.execute) continue
            batch.push(sanitizeSpaceMigrationDocument(collection, document))
            if (batch.length === 100) {
                await input.target.collection(collection).insertMany(batch, { ordered: true })
                batch = []
            }
        }
        if (input.execute && batch.length > 0) {
            await input.target.collection(collection).insertMany(batch, { ordered: true })
        }
        counts[collection] = count
    }
    return counts
}

export async function buildFindingSpaceResolver(db: Db, session?: ClientSession) {
    const referenceToSpace = new Map<string, string>()
    const entryToSpace = new Map<string, string>()
    const debtToSpace = new Map<string, string>()

    for (const document of await db.collection('spaces').find({}, { projection: { _id: 1 }, session }).toArray()) {
        const spaceId = id(document._id)!
        referenceToSpace.set(spaceId, spaceId)
    }
    for (const collection of ['spaceparticipants', 'spaceentries', 'spaceentrypersonalimpacts', 'transactions', 'debts', 'debtmovements', 'spaceactivityevents'] as const) {
        const cursor = db.collection(collection).find({}, {
            projection: { _id: 1, spaceId: 1, entryId: 1, spaceEntryId: 1, debtId: 1 },
            batchSize: 100,
            session,
        })
        for await (const document of cursor) {
            const documentId = id(document._id)
            const spaceId = id(document.spaceId)
            if (documentId && spaceId) referenceToSpace.set(documentId, spaceId)
            if (collection === 'spaceentries' && documentId && spaceId) entryToSpace.set(documentId, spaceId)
            if (collection === 'debts' && documentId && spaceId) debtToSpace.set(documentId, spaceId)
            if (documentId && !spaceId) {
                const indirect = entryToSpace.get(id(document.entryId) ?? id(document.spaceEntryId) ?? '')
                    ?? debtToSpace.get(id(document.debtId) ?? '')
                if (indirect) referenceToSpace.set(documentId, indirect)
            }
        }
    }

    return (finding: SpaceAuditFinding) => {
        for (const reference of [...finding.recordIds, ...finding.relatedIds]) {
            const spaceId = referenceToSpace.get(reference)
            if (spaceId) return spaceId
        }
        return undefined
    }
}

export async function backupDocument(input: {
    db: Db
    runId: string
    collection: BusinessCollection | typeof SPACE_MIGRATION_HISTORY_COLLECTION | typeof SPACE_MIGRATION_QUARANTINE_COLLECTION
    documentId: ObjectId
    session: ClientSession
}) {
    const backups = input.db.collection(SPACE_MIGRATION_BACKUP_COLLECTION)
    const cache = backupCache(input.session)
    const cacheKey = backupKey(input.runId, input.collection, input.documentId)
    if (cache.has(cacheKey)) return
    const key = { runId: input.runId, collection: input.collection, documentId: input.documentId }
    if (await backups.findOne(key, { session: input.session, projection: { _id: 1 } })) {
        cache.add(cacheKey)
        return
    }
    const preimage = await input.db.collection(input.collection).findOne(
        { _id: input.documentId },
        { session: input.session }
    )
    await backups.insertOne({
        ...key,
        preimage,
        checksum: migrationFingerprint(preimage),
        capturedAt: new Date(),
    }, { session: input.session })
    cache.add(cacheKey)
}

export async function backupDocuments(input: {
    db: Db
    runId: string
    collection: BusinessCollection
    filter: Filter<Document>
    session: ClientSession
}) {
    const documents = await input.db.collection(input.collection).find(input.filter, {
        session: input.session,
        batchSize: 100,
    }).toArray()
    if (!documents.length) return 0
    const cache = backupCache(input.session)
    const documentIds = documents.map((document) => document._id as ObjectId)
    const existing = new Set((await input.db.collection(SPACE_MIGRATION_BACKUP_COLLECTION).find({
        runId: input.runId,
        collection: input.collection,
        documentId: { $in: documentIds },
    }, { session: input.session, projection: { documentId: 1 } }).toArray()).map((backup) => id(backup.documentId)))
    const pending = documents.filter((document) => !existing.has(id(document._id)))
    if (pending.length) {
        await input.db.collection(SPACE_MIGRATION_BACKUP_COLLECTION).insertMany(
            pending.map((document) => ({
                runId: input.runId,
                collection: input.collection,
                documentId: document._id,
                preimage: document,
                checksum: migrationFingerprint(document),
                capturedAt: new Date(),
            })),
            { session: input.session, ordered: true }
        )
    }
    for (const documentId of documentIds) cache.add(backupKey(input.runId, input.collection, documentId))
    return pending.length
}

export async function rollbackSpaceMigrationRun(db: Db, runId: string, session: ClientSession) {
    for (const collection of ['spaceentrypersonalimpacts', 'debts', 'debtmovements', 'spaceactivityevents']) {
        await db.collection(collection).deleteMany({ migrationRunId: runId }, { session })
    }
    await db.collection(SPACE_MIGRATION_HISTORY_COLLECTION).deleteMany({ runId }, { session })
    await db.collection(SPACE_MIGRATION_QUARANTINE_COLLECTION).deleteMany({ runId }, { session })
    const backups = await db.collection(SPACE_MIGRATION_BACKUP_COLLECTION)
        .find({ runId }, { session, batchSize: 100 })
        .sort({ capturedAt: -1, _id: -1 })
        .toArray()
    const byCollection = new Map<string, Document[]>()
    for (const backup of backups) {
        const collection = String(backup.collection)
        byCollection.set(collection, [...(byCollection.get(collection) ?? []), backup])
    }
    for (const [collectionName, collectionBackups] of byCollection) {
        const operations = collectionBackups.map((backup) => {
            if (backup.preimage === null) {
                return { deleteOne: { filter: { _id: backup.documentId } } }
            }
            if (migrationFingerprint(backup.preimage) !== backup.checksum) {
                throw new Error('SPACE_MIGRATION_BACKUP_CHECKSUM_MISMATCH')
            }
            return {
                replaceOne: {
                    filter: { _id: backup.documentId },
                    replacement: backup.preimage,
                    upsert: true,
                },
            }
        }
        )
        if (operations.length) {
            await db.collection(collectionName).bulkWrite(operations, { session, ordered: true })
        }
    }
    return backups.length
}
