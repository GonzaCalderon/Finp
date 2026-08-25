import { createHash } from 'node:crypto'
import { ObjectId, type ClientSession, type Db, type Document } from 'mongodb'

import type { ISpace, ISpaceEntry, ISpaceEntryPersonalImpact, ISpaceParticipant } from '@/types'
import type { MigrationIssue } from '@/lib/server/migrations/space-v2-migration-contract'
import {
    SPACE_MIGRATION_HISTORY_COLLECTION,
    backupDocuments,
} from '@/lib/server/migrations/space-v2-migration-data'
import {
    adaptPersonalImpactToV2,
    adaptSpaceEntryToV2,
    selectCanonicalPersonalImpact,
    type SpaceEntryReadV2,
} from '@/lib/server/space-legacy-adapter'
import {
    calculateSpaceDebtProjectionsV2,
    derivePersonalImpactAmountsV2,
} from '@/lib/utils/space-financial-v2'
import {
    convertMoneyExact,
    moneyFromDecimal,
    moneyToNumber,
    type ConversionSnapshot,
} from '@/lib/utils/money'

function id(value: unknown) {
    if (!value) return undefined
    const maybe = value as { toHexString?: () => string }
    return typeof maybe.toHexString === 'function' ? maybe.toHexString() : String(value)
}

function deterministicObjectId(...parts: string[]) {
    return new ObjectId(createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 24))
}

function rateString(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error('SPACE_MIGRATION_LEGACY_RATE_INVALID')
    }
    return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 12 })
}

function legacySnapshot(entry: Document, reportingCurrency: string): ConversionSnapshot {
    const currency = String(entry.currency).toUpperCase()
    const observedAt = new Date(entry.date as Date).toISOString()
    const capturedAt = new Date((entry.createdAt ?? entry.date) as Date).toISOString()
    if (currency === reportingCurrency) {
        return {
            rate: '1',
            direction: 'multiply',
            source: 'identity',
            observedAt,
            capturedAt,
            path: [],
        }
    }
    const rate = rateString(entry.exchangeRate)
    return {
        rate,
        direction: 'multiply',
        source: 'legacy',
        observedAt,
        capturedAt,
        path: [{
            fromCurrency: currency,
            toCurrency: reportingCurrency,
            rate,
            source: 'legacy',
        }],
    }
}

function assertExactLegacyMoney(input: {
    amount: number
    currency: string
    reportingAmount: number
    reportingCurrency: string
    snapshot: ConversionSnapshot
}) {
    const original = moneyFromDecimal(input.currency, input.amount)
    const reporting = moneyFromDecimal(input.reportingCurrency, input.reportingAmount)
    if (moneyToNumber(original) !== input.amount || moneyToNumber(reporting) !== input.reportingAmount) {
        throw new Error('SPACE_MIGRATION_AMOUNT_NOT_ISO_REPRESENTABLE')
    }
    const converted = input.currency === input.reportingCurrency
        ? original
        : convertMoneyExact({
            money: original,
            targetCurrency: input.reportingCurrency,
            rate: input.snapshot.rate,
            direction: input.snapshot.direction,
        })
    if (converted.currency !== reporting.currency || BigInt(converted.minorUnits) - BigInt(reporting.minorUnits) > 1n || BigInt(reporting.minorUnits) - BigInt(converted.minorUnits) > 1n) {
        throw new Error('SPACE_MIGRATION_CONVERSION_EXCEEDS_MINOR_UNIT')
    }
    return { original, reporting }
}

function pendingAction(kind: string) {
    if (kind === 'settlement_paid') return 'impact_space_payment'
    if (kind === 'settlement_received') return 'impact_space_collect'
    return kind === 'advance' ? 'impact_space_payment' : 'impact_space_expense'
}

function isIssueFor(issue: MigrationIssue, recordId: string) {
    return issue.recordIds.includes(recordId) || issue.relatedIds.includes(recordId)
}

async function archiveDocuments(input: {
    db: Db
    runId: string
    sourceCollection: string
    documents: Document[]
    session: ClientSession
}) {
    if (!input.documents.length) return
    const now = new Date()
    await input.db.collection(SPACE_MIGRATION_HISTORY_COLLECTION).insertMany(
        input.documents.map((document) => ({
            _id: deterministicObjectId(input.runId, input.sourceCollection, id(document._id)!),
            runId: input.runId,
            sourceCollection: input.sourceCollection,
            sourceDocumentId: document._id,
            document,
            archivedAt: now,
        })),
        { session: input.session, ordered: true }
    )
}

function transformEntry(input: {
    space: Document
    entry: Document
    participants: Document[]
    ownerTimezone: string
}) {
    const adapted = adaptSpaceEntryToV2({
        space: input.space as unknown as ISpace,
        entry: input.entry as unknown as ISpaceEntry,
        participants: input.participants as unknown as ISpaceParticipant[],
        ownerTimezone: input.ownerTimezone,
    }).entry
    const snapshot = input.entry.conversionSnapshot as ConversionSnapshot | undefined
        ?? legacySnapshot(input.entry, String(input.space.reportingCurrency).toUpperCase())
    const exact = assertExactLegacyMoney({
        amount: adapted.amount,
        currency: adapted.currency,
        reportingAmount: adapted.reportingAmount,
        reportingCurrency: adapted.reportingCurrency,
        snapshot,
    })
    const settlementLegs = adapted.type === 'settlement' && !adapted.settlementLegs?.length
        ? [{
            legId: `legacy-${adapted.id}`,
            paidMoney: exact.original,
            reportingMoney: exact.reporting,
            conversionSnapshot: snapshot,
            applications: [{
                debtCurrency: exact.original.currency,
                paidMoney: exact.original,
                appliedMoney: exact.original,
            }],
        }]
        : adapted.settlementLegs
    return {
        adapted,
        update: {
            contractVersion: 2,
            status: adapted.status,
            originalMoney: exact.original,
            reportingMoney: exact.reporting,
            conversionSnapshot: snapshot,
            settlementLegs,
            dateKey: adapted.dateKey,
            timezone: adapted.timezone,
            sharedWithParticipantIds: adapted.sharedWithParticipantIds.map((value) => new ObjectId(value)),
            splitAllocations: adapted.splitAllocations.map((allocation) => ({
                ...allocation,
                participantId: new ObjectId(allocation.participantId),
            })),
            resolvedShares: adapted.shares.map((share) => ({
                participantId: share.participantId,
                amount: share.amount,
                reportingAmount: share.reportingAmount,
                amountMoney: moneyFromDecimal(adapted.currency, share.amount),
                reportingMoney: moneyFromDecimal(adapted.reportingCurrency, share.reportingAmount),
            })),
            revision: adapted.revision,
        },
    }
}

async function transformImpacts(input: {
    db: Db
    runId: string
    spaceId: ObjectId
    entries: SpaceEntryReadV2[]
    participants: Document[]
    issues: MigrationIssue[]
    session: ClientSession
}) {
    const impacts = await input.db.collection('spaceentrypersonalimpacts')
        .find({ spaceId: input.spaceId }, { session: input.session })
        .toArray()
    const byEntryUser = new Map<string, Document[]>()
    for (const impact of impacts) {
        const key = `${id(impact.entryId)}:${id(impact.userId)}`
        byEntryUser.set(key, [...(byEntryUser.get(key) ?? []), impact])
    }

    const inserts: Document[] = []
    const updates: Array<{ updateOne: { filter: Document; update: Document } }> = []
    const archived: Document[] = []
    const deleteIds: ObjectId[] = []
    for (const entry of input.entries) {
        if (entry.status === 'voided') continue
        for (const participant of input.participants) {
            const participantId = id(participant._id)!
            const userId = id(participant.userId)
            if (!userId) continue
            const share = entry.shares.find((candidate) => candidate.participantId === participantId)?.amount ?? 0
            const derived = derivePersonalImpactAmountsV2({
                entryType: entry.type,
                entryAmount: entry.amount,
                ownShareAmount: share,
                isPayer: entry.paidByParticipantId === participantId,
                isReceiver: entry.type === 'settlement' && entry.sharedWithParticipantIds[0] === participantId,
            })
            const key = `${entry.id}:${userId}`
            const candidates = byEntryUser.get(key) ?? []
            if (derived.action === 'none') {
                archived.push(...candidates)
                deleteIds.push(...candidates.map((candidate) => candidate._id as ObjectId))
                continue
            }

            const canonical = candidates.length
                ? selectCanonicalPersonalImpact(candidates as unknown as ISpaceEntryPersonalImpact[]).impact as unknown as Document
                : undefined
            const duplicates = candidates.filter((candidate) => id(candidate._id) !== id(canonical?._id))
            archived.push(...duplicates)
            deleteIds.push(...duplicates.map((duplicate) => duplicate._id as ObjectId))

            const reviewRequired = candidates.some((candidate) => input.issues.some(
                (issue) => issue.disposition === 'review' && isIssueFor(issue, id(candidate._id)!)
            )) || input.issues.some((issue) =>
                issue.disposition === 'review' && isIssueFor(issue, entry.id)
            )
            const now = new Date()
            if (canonical) {
                const adapted = adaptPersonalImpactToV2({
                    impact: canonical as unknown as ISpaceEntryPersonalImpact,
                    entry,
                }).impact
                updates.push({
                    updateOne: {
                        filter: { _id: canonical._id },
                        update: {
                        $set: {
                            contractVersion: 2,
                            impactKind: adapted.kind,
                            amountMoney: moneyFromDecimal(entry.currency, Number(canonical.amount ?? adapted.ownShareAmount)),
                            ownShareAmount: adapted.ownShareAmount,
                            accountImpactAmount: adapted.accountImpactAmount,
                            operationalAmount: adapted.operationalAmount,
                            actionType: pendingAction(adapted.kind),
                            sourceType: 'space_entry',
                            originSnapshot: {
                                entryRevision: entry.revision,
                                entryStatus: entry.status,
                                payerParticipantId: entry.paidByParticipantId ? new ObjectId(entry.paidByParticipantId) : undefined,
                                amount: entry.amount,
                                reportingAmount: entry.reportingAmount,
                                currency: entry.currency,
                                reportingCurrency: entry.reportingCurrency,
                                exchangeRate: entry.exchangeRate,
                                dateKey: entry.dateKey,
                                timezone: entry.timezone,
                            },
                            revision: Number(canonical.revision ?? 0),
                            ...(reviewRequired ? {
                                status: 'needs_review',
                                reviewRequestedAt: now,
                                migrationReview: { runId: input.runId, preservesLegacyDecision: true },
                            } : {}),
                        },
                        ...(reviewRequired ? { $unset: { transactionId: '', accountId: '' } } : {}),
                        },
                    },
                })
                continue
            }

            const impactId = deterministicObjectId(input.runId, 'impact', entry.id, userId)
            inserts.push({
                _id: impactId,
                migrationRunId: input.runId,
                contractVersion: 2,
                spaceId: input.spaceId,
                entryId: new ObjectId(entry.id),
                userId: new ObjectId(userId),
                participantId: participant._id,
                impactKind: derived.kind,
                amount: derived.ownShareAmount,
                amountMoney: moneyFromDecimal(entry.currency, derived.ownShareAmount),
                ownShareAmount: derived.ownShareAmount,
                accountImpactAmount: derived.accountImpactAmount,
                operationalAmount: derived.operationalAmount,
                currency: entry.currency,
                status: reviewRequired ? 'needs_review' : 'pending',
                actionType: pendingAction(derived.kind),
                sourceType: 'space_entry',
                actorUserId: new ObjectId(userId),
                revision: 0,
                ...(reviewRequired
                    ? { reviewRequestedAt: now, migrationReview: { runId: input.runId, preservesLegacyDecision: true } }
                    : {}),
                createdAt: now,
                updatedAt: now,
            })
        }
    }
    await archiveDocuments({
        db: input.db,
        runId: input.runId,
        sourceCollection: 'spaceentrypersonalimpacts',
        documents: archived,
        session: input.session,
    })
    if (deleteIds.length) {
        await input.db.collection('spaceentrypersonalimpacts').deleteMany(
            { _id: { $in: deleteIds } },
            { session: input.session }
        )
    }
    if (updates.length) {
        await input.db.collection('spaceentrypersonalimpacts').bulkWrite(updates, {
            session: input.session,
            ordered: true,
        })
    }
    if (inserts.length) {
        await input.db.collection('spaceentrypersonalimpacts').insertMany(inserts, {
            session: input.session,
            ordered: true,
        })
    }
    return { inserted: inserts.length, updated: updates.length }
}

function debtRows(input: {
    space: Document
    participants: Document[]
    entries: SpaceEntryReadV2[]
}) {
    const participantRows = input.participants.map((participant) => ({
        participantId: id(participant._id)!,
        userId: id(participant.userId),
        displayName: String(participant.displayName ?? ''),
    }))
    const projections = calculateSpaceDebtProjectionsV2({
        mode: (input.space.debtMode ?? (input.space.simplifyDebts === false ? 'direct' : 'simplified')) as 'direct' | 'simplified',
        participants: participantRows,
        entries: input.entries.flatMap((entry) => entry.type === 'settlement' && entry.settlementLegs?.length
            ? entry.settlementLegs.flatMap((leg) => leg.applications.map((application, index) => ({
                entryId: `${entry.id}:${leg.legId}:${index}`,
                status: entry.status,
                type: entry.type,
                amount: moneyToNumber(application.appliedMoney),
                reportingAmount: moneyToNumber(application.appliedMoney),
                currency: application.debtCurrency,
                reportingCurrency: application.debtCurrency,
                paidByParticipantId: entry.paidByParticipantId,
                sharedWithParticipantIds: entry.sharedWithParticipantIds,
                splitMode: entry.splitMode,
                splitAllocations: entry.splitAllocations,
            })))
            : [{
                entryId: entry.id,
                status: entry.status,
                type: entry.type,
                amount: entry.amount,
                reportingAmount: entry.reportingAmount,
                currency: entry.currency,
                reportingCurrency: entry.reportingCurrency,
                paidByParticipantId: entry.paidByParticipantId,
                sharedWithParticipantIds: entry.sharedWithParticipantIds,
                splitMode: entry.splitMode,
                splitAllocations: entry.splitAllocations,
            }]),
    })
    const byId = new Map(input.participants.map((participant) => [id(participant._id)!, participant]))
    return projections.flatMap((projection) => {
        const debtor = byId.get(projection.fromParticipantId)
        const creditor = byId.get(projection.toParticipantId)
        const currency = projection.currency ?? String(input.space.reportingCurrency)
        return [
            debtor?.userId ? {
                userId: debtor.userId,
                participantId: debtor._id,
                counterparty: creditor,
                direction: 'payable',
                amount: projection.amount,
                currency,
            } : undefined,
            creditor?.userId ? {
                userId: creditor.userId,
                participantId: creditor._id,
                counterparty: debtor,
                direction: 'receivable',
                amount: projection.amount,
                currency,
            } : undefined,
        ].filter((row): row is NonNullable<typeof row> => Boolean(row))
    })
}

async function rebuildDebts(input: {
    db: Db
    runId: string
    space: Document
    participants: Document[]
    entries: SpaceEntryReadV2[]
    session: ClientSession
}) {
    const spaceId = input.space._id as ObjectId
    const oldDebts = await input.db.collection('debts').find({ spaceId }, { session: input.session }).toArray()
    const oldDebtIds = oldDebts.map((debt) => debt._id)
    const oldMovements = await input.db.collection('debtmovements').find({
        $or: [{ spaceId }, ...(oldDebtIds.length ? [{ debtId: { $in: oldDebtIds } }] : [])],
    }, { session: input.session }).toArray()
    for (const [collection, documents] of [['debts', oldDebts], ['debtmovements', oldMovements]] as const) {
        await backupDocuments({
            db: input.db,
            runId: input.runId,
            collection,
            filter: { _id: { $in: documents.map((document) => document._id) } },
            session: input.session,
        })
        await archiveDocuments({
            db: input.db,
            runId: input.runId,
            sourceCollection: collection,
            documents,
            session: input.session,
        })
        if (documents.length) {
            await input.db.collection(collection).deleteMany(
                { _id: { $in: documents.map((document) => document._id) } },
                { session: input.session }
            )
        }
    }

    const now = new Date()
    const rows = debtRows(input)
    const debtDocuments: Document[] = []
    const movementDocuments: Document[] = []
    for (const row of rows) {
        const mode = String(input.space.debtMode ?? (input.space.simplifyDebts === false ? 'direct' : 'simplified'))
        const key = `${id(row.userId)}:${id(spaceId)}:${id(row.counterparty?._id)}:${row.currency}:${mode}`
        const debtId = deterministicObjectId(input.runId, 'debt', key)
        const movementId = deterministicObjectId(input.runId, 'debt-movement', key)
        const money = moneyFromDecimal(row.currency, row.amount)
        debtDocuments.push({
            _id: debtId,
            migrationRunId: input.runId,
            contractVersion: 2,
            userId: row.userId,
            direction: row.direction,
            sourceType: 'space',
            spaceId,
            counterpartyParticipantId: row.counterparty?._id,
            counterpartyUserId: row.counterparty?.userId,
            counterpartyNameSnapshot: row.counterparty?.displayName ?? 'Participante migrado',
            amount: row.amount,
            remainingAmount: row.amount,
            amountMoney: money,
            remainingMoney: money,
            currency: row.currency,
            status: 'active',
            originMode: mode,
            spaceDebtKey: key,
            metadata: {
                sourceEntryIds: input.entries.map((entry) => entry.id),
                sourceSettlementIds: input.entries.filter((entry) => entry.type === 'settlement').map((entry) => entry.id),
                syncSnapshot: { debtMode: mode, calculatedAt: now.toISOString() },
                balanceSnapshot: { operationId: input.runId, spaceRevision: Number(input.space.revision ?? 0), calculatedAt: now.toISOString() },
            },
            createdAt: now,
            updatedAt: now,
        })
        movementDocuments.push({
            _id: movementId,
            userId: row.userId,
            debtId,
            type: 'creation',
            amount: row.amount,
            currency: row.currency,
            appliedMoney: money,
            spaceId,
            balanceBefore: 0,
            balanceAfter: row.amount,
            date: now,
            migrationRunId: input.runId,
            createdAt: now,
        })
    }
    if (debtDocuments.length) {
        await input.db.collection('debts').insertMany(debtDocuments, { session: input.session, ordered: true })
        await input.db.collection('debtmovements').insertMany(movementDocuments, { session: input.session, ordered: true })
    }
    return rows.length
}

async function addMigrationActivity(input: {
    db: Db
    runId: string
    spaceId: ObjectId
    entries: SpaceEntryReadV2[]
    participants: Document[]
    session: ClientSession
}) {
    const existingEntryIds = new Set((await input.db.collection('spaceactivityevents').find(
        { spaceId: input.spaceId, entityType: 'entry' },
        { session: input.session, projection: { entityId: 1 } }
    ).toArray()).map((event) => id(event.entityId)))
    const visibleToUserIds = input.participants.map((participant) => participant.userId).filter(Boolean)
    const documents: Document[] = []
    for (const entry of input.entries) {
        if (existingEntryIds.has(entry.id)) continue
        const activityId = deterministicObjectId(input.runId, 'activity', entry.id)
        documents.push({
            _id: activityId,
            migrationRunId: input.runId,
            spaceId: input.spaceId,
            type: 'migration_imported',
            entityType: 'entry',
            entityId: new ObjectId(entry.id),
            title: 'Movimiento incorporado a la historia compatible',
            metadata: { migrationRunId: input.runId, historicalActionInferred: false },
            visibleToUserIds,
            readByUserIds: [],
            createdAt: new Date(),
        })
    }
    if (documents.length) {
        await input.db.collection('spaceactivityevents').insertMany(documents, {
            session: input.session,
            ordered: true,
        })
    }
    return documents.length
}

export async function migrateSpaceToV2(input: {
    db: Db
    runId: string
    spaceId: ObjectId
    sourceFingerprint: string
    issues: MigrationIssue[]
    session: ClientSession
}) {
    const space = await input.db.collection('spaces').findOne({ _id: input.spaceId }, { session: input.session })
    if (!space) throw new Error('SPACE_MIGRATION_SPACE_MISSING')
    if (space.contractVersion === 2 && space.migration?.runId === input.runId) {
        return { replayed: true, entries: 0, impacts: 0, debts: 0, activity: 0, backups: 0 }
    }
    const participants = await input.db.collection('spaceparticipants')
        .find({ spaceId: input.spaceId }, { session: input.session }).toArray()
    const owner = await input.db.collection('users').findOne({ _id: space.ownerUserId }, {
        session: input.session,
        projection: { timezone: 1 },
    })
    const timezone = String(space.timezone ?? owner?.timezone ?? '').trim()
    try {
        new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date())
    } catch {
        throw new Error('SPACE_MIGRATION_TIMEZONE_UNRESOLVED')
    }

    let backups = await backupDocuments({
        db: input.db,
        runId: input.runId,
        collection: 'spaces',
        filter: { _id: input.spaceId },
        session: input.session,
    })
    const rawEntries = await input.db.collection('spaceentries')
        .find({ spaceId: input.spaceId }, { session: input.session })
        .sort({ date: 1, _id: 1 })
        .toArray()
    backups += await backupDocuments({
        db: input.db,
        runId: input.runId,
        collection: 'spaceentries',
        filter: { spaceId: input.spaceId },
        session: input.session,
    })
    backups += await backupDocuments({
        db: input.db,
        runId: input.runId,
        collection: 'spaceentrypersonalimpacts',
        filter: { spaceId: input.spaceId },
        session: input.session,
    })
    const transformedEntries: SpaceEntryReadV2[] = []
    const entryUpdates: Array<{ updateOne: { filter: Document; update: Document } }> = []
    for (const rawEntry of rawEntries) {
        const transformed = transformEntry({ space: { ...space, timezone }, entry: rawEntry, participants, ownerTimezone: timezone })
        entryUpdates.push({
            updateOne: {
                filter: { _id: rawEntry._id },
                update: { $set: transformed.update, $unset: { linkedTransactionId: '' } },
            },
        })
        transformedEntries.push({
            ...transformed.adapted,
            conversionSnapshot: transformed.update.conversionSnapshot,
            settlementLegs: transformed.update.settlementLegs,
        })
    }
    if (entryUpdates.length) {
        await input.db.collection('spaceentries').bulkWrite(entryUpdates, {
            session: input.session,
            ordered: true,
        })
    }

    const impacts = await transformImpacts({
        db: input.db,
        runId: input.runId,
        spaceId: input.spaceId,
        entries: transformedEntries,
        participants,
        issues: input.issues,
        session: input.session,
    })
    const debts = await rebuildDebts({
        db: input.db,
        runId: input.runId,
        space: { ...space, timezone },
        participants,
        entries: transformedEntries,
        session: input.session,
    })
    const activity = await addMigrationActivity({
        db: input.db,
        runId: input.runId,
        spaceId: input.spaceId,
        entries: transformedEntries,
        participants,
        session: input.session,
    })

    await input.db.collection('spaces').updateOne(
        { _id: input.spaceId },
        {
            $set: {
                contractVersion: 2,
                timezone,
                debtMode: space.debtMode ?? (space.simplifyDebts === false ? 'direct' : 'simplified'),
                revision: Number(space.revision ?? 0),
                migration: {
                    state: 'migrated',
                    runId: input.runId,
                    sourceFingerprint: input.sourceFingerprint,
                    reason: 'migration_verified',
                    migratedAt: new Date(),
                },
            },
        },
        { session: input.session }
    )
    return {
        replayed: false,
        entries: transformedEntries.length,
        impacts: impacts.inserted + impacts.updated,
        debts,
        activity,
        backups,
    }
}

export function expectedDebtRows(input: {
    space: Document
    participants: Document[]
    entries: SpaceEntryReadV2[]
}) {
    return debtRows(input)
}
