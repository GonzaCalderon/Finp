import { MongoClient, ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MigrationPlan, MigrationResolutionManifest } from '@/lib/server/migrations/space-v2-migration-contract'
import {
    SPACE_MIGRATION_QUARANTINE_COLLECTION,
    fingerprintSpaceMigrationDatabase,
} from '@/lib/server/migrations/space-v2-migration-data'
import {
    applySpaceMigrationRun,
    registerClonedMigrationRun,
    verifySpaceMigrationRun,
} from '@/lib/server/migrations/space-v2-migration-runner'
import { replaceMongoDatabaseName } from '@/lib/server/migrations/space-v2-migration-target'
import { resolveE2EEnvironment } from '../e2e/helpers/environment'

/**
 * Regresión del cutover del 2026-08-29: un manual cuyo `spaceId` referencia un
 * Espacio inexistente quedaba sin aplicar, porque el recorrido de apply sólo
 * visita los Espacios que existen y la vía de manuales globales sólo atrapaba
 * los que no tienen `spaceId`. Verify tampoco lo notaba, porque contaba
 * cobertura del manifiesto en lugar del efecto en la base.
 */
describe.sequential('space v2 migration — manual sobre un Espacio inexistente', () => {
    const runId = `orphan-${new ObjectId().toHexString()}`
    const databaseName = `finp-e2e-migration-${new ObjectId().toHexString().slice(0, 12)}`
    const auditFingerprint = 'audit-orphan-integration'
    const missingSpaceId = new ObjectId()
    const orphanParticipantId = new ObjectId()
    const issueFingerprint = 'issue-orphan-integration'
    let client: MongoClient
    let plan: MigrationPlan

    const manifest: MigrationResolutionManifest = {
        schemaVersion: '1.0.0',
        runId,
        auditFingerprint,
        resolutions: [{
            issueFingerprint,
            action: 'retain_legacy_quarantine',
            justification: 'Se conserva el documento huérfano sin inventar un Espacio padre.',
            approvedBy: 'integración',
            approvedAt: new Date('2026-08-29T12:00:00.000Z').toISOString(),
            auditFingerprint,
        }],
    }

    beforeAll(async () => {
        const environment = resolveE2EEnvironment()
        const uri = replaceMongoDatabaseName(environment.variables.MONGODB_URI, databaseName)
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 })
        await client.connect()
        const db = client.db(databaseName)
        const ownerId = new ObjectId()
        const spaceId = new ObjectId()
        const ownerParticipantId = new ObjectId()
        const now = new Date('2026-08-29T12:00:00.000Z')

        await db.collection('users').insertOne({
            _id: ownerId,
            timezone: 'America/Argentina/Buenos_Aires',
            email: 'owner@example.invalid',
        })
        await db.collection('spaces').insertOne({
            _id: spaceId,
            ownerUserId: ownerId,
            name: 'Espacio sano',
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
            // El huérfano: apunta a un Espacio que no existe en `spaces`.
            {
                _id: orphanParticipantId,
                spaceId: missingSpaceId,
                kind: 'finp_user',
                userId: ownerId,
                displayName: 'Huérfano',
                role: 'participant',
                inviteStatus: 'accepted',
                isActive: true,
                createdAt: now,
                updatedAt: now,
            },
        ])

        const cloneFingerprint = await fingerprintSpaceMigrationDatabase(db)
        plan = {
            schemaVersion: '1.0.0',
            migrationVersion: '2.0.0',
            runId,
            sourceEnvironment: 'rehearsal',
            sourceDatabaseFingerprint: cloneFingerprint,
            auditFingerprint,
            createdAt: now.toISOString(),
            sourceCommit: 'integration',
            spacesAudited: 1,
            counts: { findings: 1, criticalOrHigh: 1, automatic: 0, review: 0, manual: 1, advisory: 0, blocking: 0 },
            issues: [{
                fingerprint: issueFingerprint,
                code: 'SPACE_GLOBAL_ORPHAN',
                severity: 'critical',
                disposition: 'manual',
                state: 'planned',
                spaceId: missingSpaceId.toHexString(),
                collection: 'spaceparticipants',
                recordIds: [orphanParticipantId.toHexString()],
                relatedIds: [],
                targetInvariant: 'ningún documento activo sin Espacio padre',
                proposedResolution: 'retain_legacy_quarantine',
            }],
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

    it('aplica la resolución aunque su Espacio no exista, y verify detecta si el efecto falta', async () => {
        const db = client.db(databaseName)
        const applied = await applySpaceMigrationRun({
            db,
            clientSession: () => client.startSession(),
            plan,
            manifest,
            execute: true,
        })
        expect(applied).toMatchObject({ replayed: false, spacesMigrated: 1, spacesBlocked: 0 })

        // El huérfano salió del conjunto activo y quedó en cuarentena legacy.
        expect(await db.collection('spaceparticipants').countDocuments({ _id: orphanParticipantId })).toBe(0)
        expect(await db.collection(SPACE_MIGRATION_QUARANTINE_COLLECTION).countDocuments({
            sourceDocumentId: orphanParticipantId,
        })).toBe(1)

        const verification = await verifySpaceMigrationRun({ db, plan, manifest, persist: false })
        expect(verification).toMatchObject({ valid: true, unresolvedManualIssues: 0, unappliedResolutions: 0 })

        // Si el efecto no está en la base, verify no puede darlo por resuelto
        // sólo porque el manifiesto lo apruebe.
        const quarantined = await db.collection(SPACE_MIGRATION_QUARANTINE_COLLECTION).findOne({
            sourceDocumentId: orphanParticipantId,
        })
        await db.collection('spaceparticipants').insertOne({
            ...(quarantined!.document as Record<string, unknown>),
            _id: orphanParticipantId,
        })

        const regression = await verifySpaceMigrationRun({ db, plan, manifest, persist: false })
        expect(regression).toMatchObject({ valid: false, unresolvedManualIssues: 0, unappliedResolutions: 1 })
    })
})
