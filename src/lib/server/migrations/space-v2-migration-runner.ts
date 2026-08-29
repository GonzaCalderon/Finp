import { ObjectId, type ClientSession, type Db, type Document } from 'mongodb'

import type {
    MigrationIssue,
    MigrationPlan,
    MigrationResolution,
    MigrationResolutionManifest,
    MigrationRun,
    MigrationVerificationResult,
} from '@/lib/server/migrations/space-v2-migration-contract'
import {
    SPACE_MIGRATION_BACKUP_COLLECTION,
    SPACE_MIGRATION_QUARANTINE_COLLECTION,
    SPACE_MIGRATION_RUN_COLLECTION,
    backupDocument,
    fingerprintPersonalLedger,
    fingerprintSpaceMigrationDatabase,
    rollbackSpaceMigrationRun,
} from '@/lib/server/migrations/space-v2-migration-data'
import { migrationFingerprint } from '@/lib/server/migrations/space-v2-migration-fingerprint'
import { migrateSpaceToV2 } from '@/lib/server/migrations/space-v2-migration-transform'
import { adaptSpaceEntryToV2 } from '@/lib/server/space-legacy-adapter'
import type { ISpace, ISpaceEntry, ISpaceParticipant } from '@/types'

function id(value: unknown) {
    if (!value) return undefined
    const maybe = value as { toHexString?: () => string }
    return typeof maybe.toHexString === 'function' ? maybe.toHexString() : String(value)
}

function asObjectId(value: string) {
    if (!ObjectId.isValid(value)) throw new Error('SPACE_MIGRATION_INVALID_RECORD_ID')
    return new ObjectId(value)
}

const ACTION_BY_CODE: Record<string, MigrationResolution['action'][]> = {
    SPACE_PERSONAL_TRANSACTION_CROSS_USER_OR_ENTRY: ['detach_preserve_personal_transaction'],
    SPACE_GLOBAL_ORPHAN: ['retain_legacy_quarantine'],
}

export function validateMigrationManifest(plan: MigrationPlan, manifest: MigrationResolutionManifest) {
    if (manifest.runId !== plan.runId || manifest.auditFingerprint !== plan.auditFingerprint) {
        throw new Error('SPACE_MIGRATION_MANIFEST_FINGERPRINT_MISMATCH')
    }
    const resolutions = new Map(manifest.resolutions.map((resolution) => [resolution.issueFingerprint, resolution]))
    for (const issue of plan.issues.filter((candidate) => candidate.disposition === 'manual')) {
        const resolution = resolutions.get(issue.fingerprint)
        if (!resolution) throw new Error('SPACE_MIGRATION_MANUAL_RESOLUTION_MISSING')
        if (
            resolution.auditFingerprint !== plan.auditFingerprint ||
            !resolution.justification.trim() ||
            !resolution.approvedBy.trim() ||
            !Number.isFinite(new Date(resolution.approvedAt).getTime())
        ) {
            throw new Error('SPACE_MIGRATION_MANUAL_RESOLUTION_INVALID')
        }
        const allowed = ACTION_BY_CODE[issue.code] ?? ['exclude_space_from_cutover']
        if (!allowed.includes(resolution.action)) {
            throw new Error('SPACE_MIGRATION_MANUAL_ACTION_NOT_ALLOWED')
        }
    }
    return resolutions
}

async function applyResolution(input: {
    db: Db
    runId: string
    issue: MigrationIssue
    resolution: MigrationResolution
    session: ClientSession
}) {
    if (input.resolution.action === 'detach_preserve_personal_transaction') {
        for (const recordId of input.issue.recordIds) {
            const transactionId = asObjectId(recordId)
            await backupDocument({
                db: input.db,
                runId: input.runId,
                collection: 'transactions',
                documentId: transactionId,
                session: input.session,
            })
            await input.db.collection('transactions').updateOne(
                { _id: transactionId },
                {
                    $unset: { spaceId: '', spaceEntryId: '' },
                    $set: {
                        migrationResolution: {
                            runId: input.runId,
                            action: input.resolution.action,
                            preservesPersonalTransaction: true,
                        },
                    },
                },
                { session: input.session }
            )
        }
        const impactId = input.issue.relatedIds.find((value) => ObjectId.isValid(value))
        if (impactId) {
            const objectId = asObjectId(impactId)
            const impact = await input.db.collection('spaceentrypersonalimpacts').findOne(
                { _id: objectId },
                { session: input.session }
            )
            if (impact) {
                await backupDocument({
                    db: input.db,
                    runId: input.runId,
                    collection: 'spaceentrypersonalimpacts',
                    documentId: objectId,
                    session: input.session,
                })
                await input.db.collection('spaceentrypersonalimpacts').updateOne(
                    { _id: objectId },
                    {
                        $unset: { transactionId: '', accountId: '' },
                        $set: {
                            status: 'needs_review',
                            reviewRequestedAt: new Date(),
                            migrationReview: {
                                runId: input.runId,
                                action: input.resolution.action,
                                preservesPersonalTransaction: true,
                            },
                        },
                    },
                    { session: input.session }
                )
            }
        }
        return
    }

    if (input.resolution.action === 'retain_legacy_quarantine') {
        const sourceCollection = input.issue.collection
        for (const recordId of input.issue.recordIds) {
            const objectId = asObjectId(recordId)
            const document = await input.db.collection(sourceCollection).findOne(
                { _id: objectId },
                { session: input.session }
            )
            if (!document) continue
            const quarantineId = new ObjectId()
            await backupDocument({
                db: input.db,
                runId: input.runId,
                collection: sourceCollection as 'spaces',
                documentId: objectId,
                session: input.session,
            })
            await input.db.collection(SPACE_MIGRATION_QUARANTINE_COLLECTION).insertOne({
                _id: quarantineId,
                runId: input.runId,
                sourceCollection,
                sourceDocumentId: objectId,
                document,
                resolution: {
                    action: input.resolution.action,
                    approvedBy: input.resolution.approvedBy,
                    approvedAt: new Date(input.resolution.approvedAt),
                    justificationFingerprint: migrationFingerprint(input.resolution.justification),
                },
                quarantinedAt: new Date(),
            }, { session: input.session })
            await input.db.collection(sourceCollection).deleteOne({ _id: objectId }, { session: input.session })
        }
        return
    }
}

function newRun(input: {
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
    targetDatabaseName: string
    cloneFingerprint: string
    status: MigrationRun['status']
    rehearsal: boolean
}): MigrationRun {
    return {
        runId: input.plan.runId,
        migrationVersion: input.plan.migrationVersion,
        sourceFingerprint: input.plan.sourceDatabaseFingerprint,
        auditFingerprint: input.plan.auditFingerprint,
        planFingerprint: migrationFingerprint(input.plan),
        manifestFingerprint: migrationFingerprint(input.manifest),
        cloneFingerprint: input.cloneFingerprint,
        sourceCommit: input.plan.sourceCommit,
        targetDatabaseName: input.targetDatabaseName,
        rehearsal: input.rehearsal,
        status: input.status,
        startedAt: new Date(),
        counts: {
            spacesPlanned: input.plan.spacesAudited,
            spacesMigrated: 0,
            spacesBlocked: 0,
            documentsBackedUp: 0,
            documentsInserted: 0,
            documentsUpdated: 0,
        },
    }
}

export async function registerClonedMigrationRun(input: {
    db: Db
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
    targetDatabaseName: string
    cloneFingerprint: string
}) {
    const run = newRun({ ...input, status: 'cloned', rehearsal: true })
    await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).updateOne(
        { runId: input.plan.runId },
        { $setOnInsert: run },
        { upsert: true }
    )
    return run
}

/**
 * Registro equivalente para el cutover in-place de la decisión 0011. No hay
 * copia: la base ya es el destino, así que su fingerprint actual cumple el rol
 * de `cloneFingerprint` y `apply` sigue abortando si algo se mueve después.
 */
export async function registerInPlaceMigrationRun(input: {
    db: Db
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
    targetDatabaseName: string
    baselineFingerprint: string
}) {
    const run = newRun({
        plan: input.plan,
        manifest: input.manifest,
        targetDatabaseName: input.targetDatabaseName,
        cloneFingerprint: input.baselineFingerprint,
        status: 'cloned',
        rehearsal: false,
    })
    await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).updateOne(
        { runId: input.plan.runId },
        { $setOnInsert: run },
        { upsert: true }
    )
    return run
}

async function readAndAssertRun(input: {
    db: Db
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
}) {
    const run = await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).findOne({ runId: input.plan.runId })
    if (!run) throw new Error('SPACE_MIGRATION_CLONE_RUN_MISSING')
    if (
        run.sourceFingerprint !== input.plan.sourceDatabaseFingerprint ||
        run.auditFingerprint !== input.plan.auditFingerprint ||
        run.planFingerprint !== migrationFingerprint(input.plan) ||
        run.manifestFingerprint !== migrationFingerprint(input.manifest)
    ) {
        throw new Error('SPACE_MIGRATION_RUN_FINGERPRINT_MISMATCH')
    }
    return run
}

export async function applySpaceMigrationRun(input: {
    db: Db
    clientSession: () => ClientSession
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
    execute: boolean
}) {
    const resolutions = validateMigrationManifest(input.plan, input.manifest)
    const run = await readAndAssertRun(input)
    if (run.status === 'applied' || run.status === 'verified') {
        return { replayed: true, spacesMigrated: Number(run.counts?.spacesMigrated ?? 0), spacesBlocked: Number(run.counts?.spacesBlocked ?? 0) }
    }
    const currentFingerprint = await fingerprintSpaceMigrationDatabase(input.db)
    if (currentFingerprint !== run.cloneFingerprint) {
        throw new Error('SPACE_MIGRATION_CLONE_FINGERPRINT_CHANGED')
    }
    if (!input.execute) {
        return { replayed: false, dryRun: true, spacesMigrated: 0, spacesBlocked: 0 }
    }

    const preApplyPersonalLedgerFingerprint = await fingerprintPersonalLedger(input.db)
    await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).updateOne(
        { runId: input.plan.runId },
        {
            $set: {
                status: 'applying',
                preApplyFingerprint: currentFingerprint,
                preApplyPersonalLedgerFingerprint,
            },
        }
    )

    const spaces = await input.db.collection('spaces').find({}, { projection: { _id: 1 } }).sort({ _id: 1 }).toArray()
    const existingSpaceIds = new Set(spaces.map((space) => id(space._id)!))

    /**
     * El recorrido por Espacio sólo visita los que existen, así que un manual
     * cuyo `spaceId` referencia un Espacio inexistente —el caso del huérfano
     * global— quedaría sin aplicar en silencio. Se resuelve junto a los que no
     * tienen `spaceId`, que comparten exactamente el mismo problema.
     */
    const detachedManualIssues = input.plan.issues.filter((issue) =>
        issue.disposition === 'manual' && (!issue.spaceId || !existingSpaceIds.has(issue.spaceId))
    )
    if (detachedManualIssues.length) {
        const session = input.clientSession()
        try {
            await session.withTransaction(async () => {
                for (const issue of detachedManualIssues) {
                    await applyResolution({
                        db: input.db,
                        runId: input.plan.runId,
                        issue,
                        resolution: resolutions.get(issue.fingerprint)!,
                        session,
                    })
                }
            })
        } finally {
            await session.endSession()
        }
    }

    let spacesMigrated = 0
    let spacesBlocked = 0
    let documentsInserted = 0
    let documentsUpdated = 0
    for (const space of spaces) {
        const spaceId = id(space._id)!
        const issues = input.plan.issues.filter((issue) => issue.spaceId === spaceId)
        const exclusion = issues.find((issue) =>
            issue.disposition === 'manual' && resolutions.get(issue.fingerprint)?.action === 'exclude_space_from_cutover'
        )
        const session = input.clientSession()
        try {
            await session.withTransaction(async () => {
                if (exclusion) {
                    await backupDocument({
                        db: input.db,
                        runId: input.plan.runId,
                        collection: 'spaces',
                        documentId: space._id as ObjectId,
                        session,
                    })
                    await input.db.collection('spaces').updateOne(
                        { _id: space._id },
                        {
                            $set: {
                                migration: {
                                    state: 'blocked',
                                    runId: input.plan.runId,
                                    sourceFingerprint: input.plan.sourceDatabaseFingerprint,
                                    reason: 'manual_review_required',
                                },
                            },
                        },
                        { session }
                    )
                    spacesBlocked += 1
                    return
                }
                for (const issue of issues.filter((candidate) => candidate.disposition === 'manual')) {
                    await applyResolution({
                        db: input.db,
                        runId: input.plan.runId,
                        issue,
                        resolution: resolutions.get(issue.fingerprint)!,
                        session,
                    })
                }
                const result = await migrateSpaceToV2({
                    db: input.db,
                    runId: input.plan.runId,
                    spaceId: space._id as ObjectId,
                    sourceFingerprint: input.plan.sourceDatabaseFingerprint,
                    issues,
                    session,
                })
                spacesMigrated += 1
                documentsInserted += result.impacts + result.debts + result.activity
                documentsUpdated += result.entries + result.impacts + result.debts + 1
            })
        } catch (error) {
            const blockSession = input.clientSession()
            try {
                await blockSession.withTransaction(async () => {
                    await backupDocument({
                        db: input.db,
                        runId: input.plan.runId,
                        collection: 'spaces',
                        documentId: space._id as ObjectId,
                        session: blockSession,
                    })
                    await input.db.collection('spaces').updateOne(
                        { _id: space._id },
                        {
                            $set: {
                                migration: {
                                    state: 'blocked',
                                    runId: input.plan.runId,
                                    sourceFingerprint: input.plan.sourceDatabaseFingerprint,
                                    reason: 'verification_failed',
                                },
                            },
                        },
                        { session: blockSession }
                    )
                })
            } finally {
                await blockSession.endSession()
            }
            spacesBlocked += 1
            if (error instanceof Error && error.message.startsWith('SPACE_MIGRATION_')) continue
            throw error
        } finally {
            await session.endSession()
        }
    }

    const documentsBackedUp = await input.db.collection(SPACE_MIGRATION_BACKUP_COLLECTION).countDocuments({ runId: input.plan.runId })
    await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).updateOne(
        { runId: input.plan.runId },
        {
            $set: {
                status: 'applied',
                finishedAt: new Date(),
                counts: {
                    spacesPlanned: input.plan.spacesAudited,
                    spacesMigrated,
                    spacesBlocked,
                    documentsBackedUp,
                    documentsInserted,
                    documentsUpdated,
                },
            },
        }
    )
    return { replayed: false, spacesMigrated, spacesBlocked, documentsBackedUp }
}

async function verifySpace(db: Db, space: Document) {
    const participants = await db.collection('spaceparticipants').find({ spaceId: space._id }).toArray()
    const owner = await db.collection('users').findOne({ _id: space.ownerUserId }, { projection: { timezone: 1 } })
    const rawEntries = await db.collection('spaceentries').find({ spaceId: space._id }).toArray()
    let compatible = space.contractVersion === 2 && space.migration?.state === 'migrated'
    for (const entry of rawEntries) {
        try {
            const adapted = adaptSpaceEntryToV2({
                space: space as unknown as ISpace,
                entry: entry as unknown as ISpaceEntry,
                participants: participants as unknown as ISpaceParticipant[],
                ownerTimezone: String(owner?.timezone ?? ''),
            }).entry
            compatible &&= entry.contractVersion === 2 && Boolean(entry.originalMoney) && Boolean(entry.reportingMoney)
            compatible &&= adapted.status === entry.status && Boolean(adapted.dateKey) && Boolean(adapted.timezone)
        } catch {
            compatible = false
        }
    }
    const impacts = await db.collection('spaceentrypersonalimpacts').find({ spaceId: space._id }).toArray()
    const impactKeys = impacts.map((impact) => `${id(impact.userId)}:${id(impact.entryId)}`)
    const crossUserLinks = (await Promise.all(impacts.filter((impact) => impact.transactionId).map(async (impact) => {
        const transaction = await db.collection('transactions').findOne({ _id: impact.transactionId }, { projection: { userId: 1, spaceEntryId: 1 } })
        return !transaction || id(transaction.userId) !== id(impact.userId) || id(transaction.spaceEntryId) !== id(impact.entryId)
    }))).filter(Boolean).length
    const debts = await db.collection('debts').find({ spaceId: space._id }).toArray()
    const debtsMatch = debts.every((debt) =>
        debt.contractVersion === 2 && debt.amountMoney?.minorUnits === debt.remainingMoney?.minorUnits && debt.spaceDebtKey
    ) && new Set(debts.map((debt) => debt.spaceDebtKey)).size === debts.length
    return {
        spaceId: id(space._id)!,
        state: compatible ? 'migrated' as const : 'blocked' as const,
        balancesMatch: compatible,
        debtsMatch,
        personalLedgerUnchanged: true,
        crossUserLinks: crossUserLinks + impactKeys.length - new Set(impactKeys).size,
    }
}

/**
 * Comprueba el efecto de una resolución contra la base, no su presencia en el
 * manifiesto: una aprobación registrada no demuestra que la escritura ocurrió.
 */
async function resolutionPending(db: Db, issue: MigrationIssue, resolution: MigrationResolution) {
    if (resolution.action === 'retain_legacy_quarantine') {
        for (const recordId of issue.recordIds) {
            if (!ObjectId.isValid(recordId)) continue
            const remaining = await db.collection(issue.collection).findOne(
                { _id: new ObjectId(recordId) },
                { projection: { _id: 1 } }
            )
            if (remaining) return true
        }
        return false
    }
    if (resolution.action === 'detach_preserve_personal_transaction') {
        for (const recordId of issue.recordIds) {
            if (!ObjectId.isValid(recordId)) continue
            const attached = await db.collection('transactions').findOne(
                {
                    _id: new ObjectId(recordId),
                    $or: [{ spaceId: { $exists: true } }, { spaceEntryId: { $exists: true } }],
                },
                { projection: { _id: 1 } }
            )
            if (attached) return true
        }
        return false
    }
    if (resolution.action === 'exclude_space_from_cutover') {
        if (!issue.spaceId || !ObjectId.isValid(issue.spaceId)) return false
        const space = await db.collection('spaces').findOne(
            { _id: new ObjectId(issue.spaceId) },
            { projection: { migration: 1 } }
        )
        return Boolean(space) && space?.migration?.state !== 'blocked'
    }
    return false
}

export async function verifySpaceMigrationRun(input: {
    db: Db
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
    persist: boolean
}): Promise<MigrationVerificationResult> {
    validateMigrationManifest(input.plan, input.manifest)
    const startedAt = Date.now()
    const run = await readAndAssertRun(input)
    if (run.status !== 'applied' && run.status !== 'verified' && run.status !== 'failed') {
        throw new Error('SPACE_MIGRATION_RUN_NOT_APPLIED')
    }
    const spaces = await input.db.collection('spaces').find({}).sort({ _id: 1 }).toArray()
    const results = []
    for (const space of spaces) results.push(await verifySpace(input.db, space))
    const personalFingerprint = await fingerprintPersonalLedger(input.db)
    const personalLedgerUnchanged = personalFingerprint === run.preApplyPersonalLedgerFingerprint
    for (const result of results) result.personalLedgerUnchanged = personalLedgerUnchanged
    const unresolvedManualIssues = input.plan.issues.filter((issue) =>
        issue.disposition === 'manual' && !input.manifest.resolutions.some((resolution) => resolution.issueFingerprint === issue.fingerprint)
    ).length
    const approvedByFingerprint = new Map(
        input.manifest.resolutions.map((resolution) => [resolution.issueFingerprint, resolution])
    )
    let unappliedResolutions = 0
    for (const issue of input.plan.issues) {
        if (issue.disposition !== 'manual') continue
        const resolution = approvedByFingerprint.get(issue.fingerprint)
        if (!resolution) continue
        if (await resolutionPending(input.db, issue, resolution)) unappliedResolutions += 1
    }
    const unapprovedCriticalOrHigh = input.plan.issues.filter((issue) =>
        (issue.severity === 'critical' || issue.severity === 'high') && issue.disposition === 'manual' &&
        !input.manifest.resolutions.some((resolution) => resolution.issueFingerprint === issue.fingerprint)
    ).length
    const replayProducesChanges = results.some((result) =>
        result.state !== 'migrated' || !result.balancesMatch || !result.debtsMatch || result.crossUserLinks > 0
    )
    const result: MigrationVerificationResult = {
        runId: input.plan.runId,
        valid: !replayProducesChanges && personalLedgerUnchanged && unresolvedManualIssues === 0
            && unappliedResolutions === 0 && unapprovedCriticalOrHigh === 0,
        sourceFingerprintMatches: run.sourceFingerprint === input.plan.sourceDatabaseFingerprint,
        replayProducesChanges,
        unresolvedManualIssues,
        unappliedResolutions,
        unapprovedCriticalOrHigh,
        spaces: results,
        elapsedMs: Date.now() - startedAt,
    }
    if (input.persist) {
        await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).updateOne(
            { runId: input.plan.runId },
            { $set: { status: result.valid ? 'verified' : 'failed', finishedAt: new Date() } }
        )
    }
    return result
}

export async function rollbackMigrationRun(input: {
    db: Db
    clientSession: () => ClientSession
    plan: MigrationPlan
    manifest: MigrationResolutionManifest
    execute: boolean
}) {
    const run = await readAndAssertRun(input)
    if (!input.execute) return { dryRun: true, documents: await input.db.collection(SPACE_MIGRATION_BACKUP_COLLECTION).countDocuments({ runId: input.plan.runId }) }
    const session = input.clientSession()
    let restored = 0
    try {
        await session.withTransaction(async () => {
            restored = await rollbackSpaceMigrationRun(input.db, input.plan.runId, session)
        })
    } finally {
        await session.endSession()
    }
    const fingerprint = await fingerprintSpaceMigrationDatabase(input.db)
    if (fingerprint !== run.preApplyFingerprint) {
        throw new Error('SPACE_MIGRATION_ROLLBACK_FINGERPRINT_MISMATCH')
    }
    await input.db.collection(SPACE_MIGRATION_RUN_COLLECTION).updateOne(
        { runId: input.plan.runId },
        { $set: { status: 'rolled_back', finishedAt: new Date() } }
    )
    return { dryRun: false, restored, fingerprintRestored: true }
}
