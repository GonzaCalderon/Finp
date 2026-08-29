import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'

import type { SpaceAuditFinding, SpaceAuditResult } from '@/lib/server/audits/space-legacy-audit-contract'
import {
    buildSpaceV2MigrationPlan,
    classifySpaceMigrationFinding,
} from '@/lib/server/migrations/space-v2-migration-classifier'
import { migrationFingerprint } from '@/lib/server/migrations/space-v2-migration-fingerprint'
import { sanitizeSpaceMigrationDocument } from '@/lib/server/migrations/space-v2-migration-sanitizer'
import {
    assertSpaceCutoverTarget,
    assertSpaceMigrationTargets,
    replaceMongoDatabaseName,
} from '@/lib/server/migrations/space-v2-migration-target'
import { parseSpaceMigrationCliArguments } from '@/lib/server/migrations/space-v2-migration-cli'
import { validateMigrationManifest } from '@/lib/server/migrations/space-v2-migration-runner'
import { enterLegacySpaceWriteFacade } from '@/lib/server/space-legacy-write-facade'

function finding(code: string, severity: SpaceAuditFinding['severity'] = 'high'): SpaceAuditFinding {
    return {
        code,
        severity,
        collection: 'spaceentries',
        recordIds: [new ObjectId().toHexString()],
        relatedIds: [],
        targetInvariant: 'invariante',
        evidence: {},
    }
}

describe('space v2 migration core', () => {
    it('clasifica los códigos actuales y falla cerrado para un código alto desconocido', () => {
        expect(classifySpaceMigrationFinding(finding('SPACE_DEBT_BALANCE_DRIFT', 'critical')))
            .toEqual({ disposition: 'automatic' })
        expect(classifySpaceMigrationFinding(finding('SPACE_PERSONAL_IMPACT_DUPLICATE', 'critical')))
            .toEqual({ disposition: 'review' })
        expect(classifySpaceMigrationFinding(finding(
            'SPACE_PERSONAL_TRANSACTION_CROSS_USER_OR_ENTRY',
            'critical'
        ))).toEqual({
            disposition: 'manual',
            proposedResolution: 'detach_preserve_personal_transaction',
        })
        expect(classifySpaceMigrationFinding(finding('SPACE_NEW_UNCLASSIFIED'))).toEqual({
            disposition: 'manual',
            proposedResolution: 'exclude_space_from_cutover',
        })
    })

    it('reproduce la clasificación sanitizada 56/33/8 del snapshot actual', () => {
        const counts: Array<[string, number, SpaceAuditFinding['severity']]> = [
            ['SPACE_DEBT_BALANCE_DRIFT', 6, 'critical'],
            ['SPACE_DEBT_MATERIALIZATION_MISSING', 2, 'high'],
            ['SPACE_ENTRY_VOID_STATE_CONFLICT', 5, 'high'],
            ['SPACE_PAYER_ZERO_SHARE_ACTION_MISCLASSIFIED', 6, 'high'],
            ['SPACE_PENDING_ACTION_MISSING', 34, 'high'],
            ['SPACE_SETTLEMENT_DOUBLE_APPLIED', 3, 'critical'],
            ['SPACE_ENTRY_GLOBAL_PERSONAL_LINK', 3, 'high'],
            ['SPACE_PERSONAL_IMPACT_AMOUNT_SEMANTICS_LEGACY', 24, 'high'],
            ['SPACE_PERSONAL_IMPACT_DUPLICATE', 2, 'critical'],
            ['SPACE_PERSONAL_IMPACT_TRANSACTION_MISSING', 1, 'critical'],
            ['SPACE_PERSONAL_TRANSACTION_ORPHAN', 3, 'high'],
            ['SPACE_PERSONAL_TRANSACTION_CROSS_USER_OR_ENTRY', 7, 'critical'],
            ['SPACE_GLOBAL_ORPHAN', 1, 'critical'],
        ]
        const findings = counts.flatMap(([code, count, severity]) =>
            Array.from({ length: count }, () => finding(code, severity))
        )
        const audit: SpaceAuditResult = {
            schemaVersion: '1.0.0',
            findings,
            countsBySeverity: { critical: 20, high: 77, medium: 0, info: 0 },
            countsByCode: Object.fromEntries(counts.map(([code, count]) => [code, count])),
            migrationReadiness: {
                spacesAudited: 11,
                findings: 97,
                critical: 20,
                high: 77,
                readyForAutomaticMigration: false,
            },
        }
        const plan = buildSpaceV2MigrationPlan({
            runId: 'run-test',
            audit,
            sourceDatabaseFingerprint: 'source',
            sourceCommit: 'commit',
            createdAt: new Date('2026-08-25T00:00:00.000Z'),
        })
        expect(plan.counts).toMatchObject({ findings: 97, automatic: 56, review: 33, manual: 8 })
    })

    it('calcula fingerprints estables sin depender del orden de las claves', () => {
        expect(migrationFingerprint({ b: 2, a: { d: 4, c: 3 } }))
            .toBe(migrationFingerprint({ a: { c: 3, d: 4 }, b: 2 }))
    })

    it('anonimiza identidad y texto pero conserva dinero, fechas y referencias', () => {
        const id = new ObjectId()
        const date = new Date('2026-08-25T12:00:00.000Z')
        const sanitized = sanitizeSpaceMigrationDocument('transactions', {
            _id: id,
            userId: id,
            email: 'private@example.invalid',
            description: 'texto financiero',
            passwordHash: 'hash-real',
            storageKey: 'adjunto-secreto',
            receiptUrl: 'https://private.example/receipt',
            amount: 123.45,
            currency: 'ARS',
            date,
        })
        expect(sanitized._id).toBe(id)
        expect(sanitized.userId).toBe(id)
        expect(sanitized.amount).toBe(123.45)
        expect(sanitized.currency).toBe('ARS')
        expect(sanitized.date).toBe(date)
        expect(sanitized.email).toMatch(/@example\.invalid$/)
        expect(sanitized.description).not.toBe('texto financiero')
        expect(sanitized.passwordHash).not.toBe('hash-real')
        expect(sanitized.storageKey).not.toBe('adjunto-secreto')
        expect(sanitized.receiptUrl).toBeUndefined()
    })

    it('sólo admite un destino e2e-migration distinto de development', () => {
        const baseUri = 'mongodb://migration-test.invalid:27017/finp-e2e?replicaSet=rs0'
        const targetUri = replaceMongoDatabaseName(baseUri, 'finp-e2e-migration-run-1')
        expect(targetUri).toContain('/finp-e2e-migration-run-1?')
        expect(assertSpaceMigrationTargets({
            sourceUri: 'mongodb://migration-test.invalid:27017/finm',
            sourceDatabaseName: 'finm',
            targetUri,
            targetDatabaseName: 'finp-e2e-migration-run-1',
        }).target.databaseName).toBe('finp-e2e-migration-run-1')
        expect(() => replaceMongoDatabaseName(baseUri, 'finm')).toThrow(/e2e-migration/)
    })

    it('el cutover in-place exige la misma base y rechaza nombres productivos', () => {
        expect(assertSpaceCutoverTarget({
            sourceUri: 'mongodb://migration-test.invalid:27017/finm',
            sourceDatabaseName: 'finm',
            targetDatabaseName: 'finm',
        }).target.databaseName).toBe('finm')
        expect(() => assertSpaceCutoverTarget({
            sourceUri: 'mongodb://migration-test.invalid:27017/finm',
            sourceDatabaseName: 'finm',
            targetDatabaseName: 'finp-e2e-migration-run-1',
        })).toThrow(/in-place/)
        expect(() => assertSpaceCutoverTarget({
            sourceUri: 'mongodb://migration-test.invalid:27017/finm-production',
            sourceDatabaseName: 'finm-production',
            targetDatabaseName: 'finm-production',
        })).toThrow(/productivo/)
        expect(() => assertSpaceCutoverTarget({
            sourceUri: 'mongodb://migration-test.invalid:27017/otra',
            sourceDatabaseName: 'finm',
            targetDatabaseName: 'finm',
        })).toThrow(/no coincide/)
    })

    it('el modo cutover exige repetir el nombre, reemplaza clone por prepare y sigue en dry-run', () => {
        const cutover = ['--run-id', 'cutover-test', '--confirm-database', 'finm', '--target-database', 'finm']
        expect(parseSpaceMigrationCliArguments(['prepare', ...cutover, '--cutover'])).toMatchObject({
            command: 'prepare', cutover: true, execute: false,
        })
        expect(() => parseSpaceMigrationCliArguments(['prepare', ...cutover]))
            .toThrow(/--cutover/)
        expect(() => parseSpaceMigrationCliArguments(['clone', ...cutover, '--cutover']))
            .toThrow(/no clona/)
        expect(() => parseSpaceMigrationCliArguments([
            'apply', '--run-id', 'cutover-test', '--confirm-database', 'finm',
            '--target-database', 'finp-e2e-migration-test', '--cutover',
        ])).toThrow(/in-place/)
        expect(parseSpaceMigrationCliArguments(['apply', ...cutover]).cutover).toBe(false)
    })

    it('mantiene todos los subcomandos en dry-run salvo --execute explícito', () => {
        const base = ['--run-id', 'run-test', '--confirm-database', 'finm', '--target-database', 'finp-e2e-migration-test']
        expect(parseSpaceMigrationCliArguments(['apply', ...base]).execute).toBe(false)
        expect(parseSpaceMigrationCliArguments(['apply', ...base, '--execute']).execute).toBe(true)
        expect(() => parseSpaceMigrationCliArguments(['plan', ...base, '--execute']))
            .toThrow(/read-only/)
    })

    it('permite consultar la ayuda sin abrir conexiones ni exigir parámetros', () => {
        expect(parseSpaceMigrationCliArguments(['--help'])).toMatchObject({
            command: 'plan',
            execute: false,
            help: true,
        })
    })

    it('exige aprobación, justificación y fingerprint para cada manual', () => {
        const audit: SpaceAuditResult = {
            schemaVersion: '1.0.0',
            findings: [finding('SPACE_GLOBAL_ORPHAN', 'critical')],
            countsBySeverity: { critical: 1, high: 0, medium: 0, info: 0 },
            countsByCode: { SPACE_GLOBAL_ORPHAN: 1 },
            migrationReadiness: {
                spacesAudited: 1,
                findings: 1,
                critical: 1,
                high: 0,
                readyForAutomaticMigration: false,
            },
        }
        const plan = buildSpaceV2MigrationPlan({
            runId: 'run-test',
            audit,
            sourceDatabaseFingerprint: 'source',
            sourceCommit: 'commit',
        })
        expect(() => validateMigrationManifest(plan, {
            schemaVersion: '1.0.0',
            runId: plan.runId,
            auditFingerprint: plan.auditFingerprint,
            resolutions: [],
        })).toThrow('SPACE_MIGRATION_MANUAL_RESOLUTION_MISSING')
    })

    it('impide que un Espacio bloqueado o migrado caiga en escrituras legacy', () => {
        expect(() => enterLegacySpaceWriteFacade({ migration: { state: 'blocked' } }))
            .toThrow('sólo para consulta')
        expect(() => enterLegacySpaceWriteFacade({ contractVersion: 2 }))
            .toThrow('no puede usar el camino de escritura legacy')
        expect(() => enterLegacySpaceWriteFacade({})).not.toThrow()
    })
})
