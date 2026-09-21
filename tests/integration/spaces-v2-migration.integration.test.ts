import { MongoClient, ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MigrationPlan, MigrationResolutionManifest } from '@/lib/server/migrations/space-v2-migration-contract'
import { fingerprintSpaceMigrationDatabase } from '@/lib/server/migrations/space-v2-migration-data'
import {
    applySpaceMigrationRun,
    registerClonedMigrationRun,
    rollbackMigrationRun,
    verifySpaceMigrationRun,
} from '@/lib/server/migrations/space-v2-migration-runner'
import { replaceMongoDatabaseName } from '@/lib/server/migrations/space-v2-migration-target'
import { resolveE2EEnvironment } from '../e2e/helpers/environment'

describe.sequential('space v2 migration rehearsal — Mongo transaction integration', () => {
    const runId = `integration-${new ObjectId().toHexString()}`
    const databaseName = `finp-e2e-migration-${new ObjectId().toHexString().slice(0, 12)}`
    let client: MongoClient
    let plan: MigrationPlan
    let spaceId: ObjectId
    const manifest: MigrationResolutionManifest = {
        schemaVersion: '1.0.0',
        runId,
        auditFingerprint: 'audit-integration',
        resolutions: [],
    }
    let cloneFingerprint: string

    beforeAll(async () => {
        const environment = resolveE2EEnvironment()
        const uri = replaceMongoDatabaseName(environment.variables.MONGODB_URI, databaseName)
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 })
        await client.connect()
        const db = client.db(databaseName)
        const ownerId = new ObjectId()
        const memberId = new ObjectId()
        spaceId = new ObjectId()
        const ownerParticipantId = new ObjectId()
        const memberParticipantId = new ObjectId()
        const now = new Date('2026-08-25T12:00:00.000Z')
        await db.collection('users').insertMany([
            { _id: ownerId, timezone: 'America/Argentina/Buenos_Aires', email: 'owner@example.invalid' },
            { _id: memberId, timezone: 'America/Argentina/Buenos_Aires', email: 'member@example.invalid' },
        ])
        await db.collection('spaces').insertOne({
            _id: spaceId,
            ownerUserId: ownerId,
            name: 'Ensayo legacy',
            type: 'travel',
            mode: 'managed',
            status: 'active',
            currencies: ['ARS'],
            reportingCurrency: 'ARS',
            defaultSplitMode: 'equal',
            simplifyDebts: true,
            createdAt: now,
            updatedAt: now,
        })
        await db.collection('spaceparticipants').insertMany([
            {
                _id: ownerParticipantId,
                spaceId,
                kind: 'finp_user',
                userId: ownerId,
                displayName: 'Owner',
                role: 'owner',
                inviteStatus: 'accepted',
                isActive: true,
                createdAt: now,
                updatedAt: now,
            },
            {
                _id: memberParticipantId,
                spaceId,
                kind: 'finp_user',
                userId: memberId,
                displayName: 'Member',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                createdAt: now,
                updatedAt: now,
            },
        ])
        await db.collection('spaceentries').insertOne({
            _id: new ObjectId(),
            spaceId,
            createdByUserId: ownerId,
            createdByParticipantId: ownerParticipantId,
            type: 'expense',
            status: 'confirmed',
            title: 'Gasto legacy',
            amount: 100,
            currency: 'ARS',
            reportingAmount: 100,
            date: now,
            paidByParticipantId: ownerParticipantId,
            sharedWithParticipantIds: [ownerParticipantId, memberParticipantId],
            splitMode: 'equal',
            splitAllocations: [],
            createdAt: now,
            updatedAt: now,
        })
        cloneFingerprint = await fingerprintSpaceMigrationDatabase(db)
        plan = {
            schemaVersion: '1.0.0',
            migrationVersion: '2.0.0',
            runId,
            sourceEnvironment: 'rehearsal',
            sourceDatabaseFingerprint: cloneFingerprint,
            auditFingerprint: manifest.auditFingerprint,
            createdAt: now.toISOString(),
            sourceCommit: 'integration',
            spacesAudited: 1,
            counts: { findings: 0, criticalOrHigh: 0, automatic: 0, review: 0, manual: 0, advisory: 0, blocking: 0 },
            issues: [],
        }
        await registerClonedMigrationRun({
            db,
            plan,
            manifest,
            targetDatabaseName: databaseName,
            cloneFingerprint,
        })
    })

    afterAll(async () => {
        if (client) {
            await client.db(databaseName).dropDatabase()
            await client.close()
        }
    })

    it('aplica por Espacio, reintenta sin cambios, verifica y restaura el fingerprint exacto', async () => {
        const db = client.db(databaseName)
        const applied = await applySpaceMigrationRun({
            db,
            clientSession: () => client.startSession(),
            plan,
            manifest,
            execute: true,
        })
        expect(applied).toMatchObject({ replayed: false, spacesMigrated: 1, spacesBlocked: 0 })
        expect(await db.collection('spaces').countDocuments({ contractVersion: 2, 'migration.state': 'migrated' })).toBe(1)
        expect(await db.collection('spaceentries').countDocuments({ contractVersion: 2 })).toBe(1)
        expect(await db.collection('spaceentrypersonalimpacts').countDocuments({ contractVersion: 2 })).toBe(2)
        expect(await db.collection('debts').countDocuments({ contractVersion: 2 })).toBe(2)

        const replay = await applySpaceMigrationRun({
            db,
            clientSession: () => client.startSession(),
            plan,
            manifest,
            execute: true,
        })
        expect(replay.replayed).toBe(true)

        const verification = await verifySpaceMigrationRun({ db, plan, manifest, persist: true })
        expect(verification).toMatchObject({ valid: true, replayProducesChanges: false })
        expect(verification.spaces[0]).toMatchObject({ debtsMatch: true, crossUserLinks: 0 })

        const rolledBack = await rollbackMigrationRun({
            db,
            clientSession: () => client.startSession(),
            plan,
            manifest,
            execute: true,
        })
        expect(rolledBack.fingerprintRestored).toBe(true)
        expect(await fingerprintSpaceMigrationDatabase(db)).toBe(cloneFingerprint)
        expect(await db.collection('spaces').countDocuments({ contractVersion: 2 })).toBe(0)
    })

    it('procesa 1.000 movimientos por fase en menos de 30 segundos', async () => {
        const db = client.db(databaseName)
        const space = await db.collection('spaces').findOne({ _id: spaceId })
        const participants = await db.collection('spaceparticipants').find({ spaceId }).sort({ role: 1 }).toArray()
        const owner = participants.find((participant) => participant.role === 'owner')!
        const member = participants.find((participant) => participant.role !== 'owner')!
        const baseDate = new Date('2026-01-01T12:00:00.000Z')
        const documents = Array.from({ length: 999 }, (_, index) => ({
            _id: new ObjectId(),
            spaceId,
            createdByUserId: space!.ownerUserId,
            createdByParticipantId: owner._id,
            type: 'expense',
            status: 'confirmed',
            title: `Movimiento sintético ${index + 1}`,
            amount: 100,
            currency: 'ARS',
            reportingAmount: 100,
            date: new Date(baseDate.getTime() + index * 60_000),
            paidByParticipantId: owner._id,
            sharedWithParticipantIds: [owner._id, member._id],
            splitMode: 'equal',
            splitAllocations: [],
            createdAt: baseDate,
            updatedAt: baseDate,
        }))
        await db.collection('spaceentries').insertMany(documents, { ordered: true })
        const performanceRunId = `${runId}-1000`
        const performanceManifest: MigrationResolutionManifest = {
            schemaVersion: '1.0.0',
            runId: performanceRunId,
            auditFingerprint: 'audit-performance',
            resolutions: [],
        }
        const performanceFingerprint = await fingerprintSpaceMigrationDatabase(db)
        const performancePlan: MigrationPlan = {
            schemaVersion: '1.0.0',
            migrationVersion: '2.0.0',
            runId: performanceRunId,
            sourceEnvironment: 'rehearsal',
            sourceDatabaseFingerprint: performanceFingerprint,
            auditFingerprint: performanceManifest.auditFingerprint,
            createdAt: new Date().toISOString(),
            sourceCommit: 'integration-performance',
            spacesAudited: 1,
            counts: { findings: 0, criticalOrHigh: 0, automatic: 0, review: 0, manual: 0, advisory: 0, blocking: 0 },
            issues: [],
        }
        await registerClonedMigrationRun({
            db,
            plan: performancePlan,
            manifest: performanceManifest,
            targetDatabaseName: databaseName,
            cloneFingerprint: performanceFingerprint,
        })

        const applyStartedAt = Date.now()
        const applied = await applySpaceMigrationRun({
            db,
            clientSession: () => client.startSession(),
            plan: performancePlan,
            manifest: performanceManifest,
            execute: true,
        })
        const applyElapsedMs = Date.now() - applyStartedAt
        expect(applied.spacesMigrated).toBe(1)
        expect(applyElapsedMs).toBeLessThan(30_000)

        const verifyStartedAt = Date.now()
        const verification = await verifySpaceMigrationRun({
            db,
            plan: performancePlan,
            manifest: performanceManifest,
            persist: true,
        })
        expect(verification.valid).toBe(true)
        expect(Date.now() - verifyStartedAt).toBeLessThan(30_000)

        const rollbackStartedAt = Date.now()
        const rolledBack = await rollbackMigrationRun({
            db,
            clientSession: () => client.startSession(),
            plan: performancePlan,
            manifest: performanceManifest,
            execute: true,
        })
        expect(rolledBack.fingerprintRestored).toBe(true)
        expect(Date.now() - rollbackStartedAt).toBeLessThan(30_000)
    }, 120_000)
})
