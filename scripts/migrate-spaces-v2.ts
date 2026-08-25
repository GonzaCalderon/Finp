import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { MongoClient, type ClientSession, type Db } from 'mongodb'

import { resolveDevelopmentAuditTarget } from '@/lib/server/audits/space-legacy-audit-cli'
import { runMongoSpaceLegacyAudit } from '@/lib/server/audits/space-legacy-audit-mongo'
import { parseSpaceMigrationCliArguments } from '@/lib/server/migrations/space-v2-migration-cli'
import {
    buildSafeResolutionTemplate,
    buildSpaceV2MigrationPlan,
} from '@/lib/server/migrations/space-v2-migration-classifier'
import type {
    MigrationPlan,
    MigrationResolutionManifest,
} from '@/lib/server/migrations/space-v2-migration-contract'
import {
    buildFindingSpaceResolver,
    cloneSpaceMigrationDatabase,
    fingerprintSpaceMigrationDatabase,
} from '@/lib/server/migrations/space-v2-migration-data'
import {
    applySpaceMigrationRun,
    registerClonedMigrationRun,
    rollbackMigrationRun,
    verifySpaceMigrationRun,
} from '@/lib/server/migrations/space-v2-migration-runner'
import {
    assertSpaceMigrationTargets,
    replaceMongoDatabaseName,
} from '@/lib/server/migrations/space-v2-migration-target'
import { resolveE2EEnvironment } from '../tests/e2e/helpers/environment'

const HELP = `Migración compatible v2 de Espacios (ensayo aislado)

Uso:
  npm run migrate:spaces:v2 -- plan --run-id <id> --confirm-database finm --target-database <e2e-migration-db>
  npm run migrate:spaces:v2 -- clone|apply|verify|rollback [opciones anteriores] [--execute]

Todos los subcomandos son dry-run por defecto. Sólo --execute habilita escrituras y las barreras
rechazan cualquier destino sin marcador e2e-migration. Development se abre read-only por snapshot.

Opciones:
  --approve-safe-defaults --approved-by <identidad>  Completa el manifiesto privado con las
                                                    resoluciones fijadas en el plan aprobado.
  --help                                            Mostrar ayuda.`

const MAX_PHASE_MS = 30_000

function currentCommit(cwd: string) {
    try {
        return execFileSync('git', [
            '-c', `safe.directory=${cwd.replace(/\\/g, '/')}`,
            'rev-parse', 'HEAD',
        ], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
        return 'unknown'
    }
}

function artifactDirectory(cwd: string, runId: string) {
    return resolve(cwd, 'test-results', 'migrations', 'spaces', runId)
}

async function writeJson(path: string, value: unknown) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function readArtifacts(cwd: string, runId: string) {
    const directory = artifactDirectory(cwd, runId)
    const [plan, manifest] = await Promise.all([
        readFile(resolve(directory, 'plan.private.json'), 'utf8').then((value) => JSON.parse(value) as MigrationPlan),
        readFile(resolve(directory, 'resolutions.private.json'), 'utf8').then((value) => JSON.parse(value) as MigrationResolutionManifest),
    ])
    return { directory, plan, manifest }
}

async function inspectSource(input: {
    db: Db
    session: ClientSession
    runId: string
    commit: string
}) {
    const [auditRun, sourceFingerprint, resolveSpaceId] = await Promise.all([
        runMongoSpaceLegacyAudit(input.db, input.session),
        fingerprintSpaceMigrationDatabase(input.db, input.session),
        buildFindingSpaceResolver(input.db, input.session),
    ])
    return {
        auditRun,
        sourceFingerprint,
        plan: buildSpaceV2MigrationPlan({
            runId: input.runId,
            audit: auditRun.result,
            sourceDatabaseFingerprint: sourceFingerprint,
            sourceCommit: input.commit,
            sourceEnvironment: 'development',
            resolveSpaceId,
        }),
    }
}

function approveManifest(plan: MigrationPlan, approvedBy: string): MigrationResolutionManifest {
    const now = new Date().toISOString()
    const template = buildSafeResolutionTemplate(plan)
    return {
        ...template,
        resolutions: template.resolutions.map((resolution) => ({
            ...resolution,
            justification: resolution.action === 'detach_preserve_personal_transaction'
                ? 'Se conserva la transacción con su propietario y se elimina sólo el vínculo cross-user incompatible.'
                : resolution.action === 'retain_legacy_quarantine'
                    ? 'Se conserva el documento huérfano en cuarentena legacy sin inventar un Espacio padre.'
                    : 'El Espacio queda excluido del cutover hasta una resolución verificable.',
            approvedBy,
            approvedAt: now,
        })),
    }
}

function assertSamePlan(expected: MigrationPlan, current: MigrationPlan) {
    if (
        expected.runId !== current.runId ||
        expected.sourceDatabaseFingerprint !== current.sourceDatabaseFingerprint ||
        expected.auditFingerprint !== current.auditFingerprint ||
        expected.sourceCommit !== current.sourceCommit
    ) {
        throw new Error('SPACE_MIGRATION_SOURCE_OR_PLAN_CHANGED')
    }
}

async function main() {
    const cwd = process.cwd()
    const options = parseSpaceMigrationCliArguments(process.argv.slice(2))
    if (options.help) {
        console.log(HELP)
        return
    }
    const sourceTarget = resolveDevelopmentAuditTarget({
        cwd,
        confirmDatabase: options.confirmDatabase,
    })
    const e2e = resolveE2EEnvironment({ cwd })
    const targetUri = replaceMongoDatabaseName(e2e.variables.MONGODB_URI, options.targetDatabase)
    assertSpaceMigrationTargets({
        sourceUri: sourceTarget.uri,
        sourceDatabaseName: sourceTarget.databaseName,
        targetUri,
        targetDatabaseName: options.targetDatabase,
    })

    const sourceClient = new MongoClient(sourceTarget.uri, { serverSelectionTimeoutMS: 10_000 })
    const targetClient = new MongoClient(targetUri, { serverSelectionTimeoutMS: 10_000 })
    const phaseStartedAt = Date.now()
    try {
        if (options.command === 'rollback') {
            const { plan, manifest } = await readArtifacts(cwd, options.runId)
            await targetClient.connect()
            const result = await rollbackMigrationRun({
                db: targetClient.db(options.targetDatabase),
                clientSession: () => targetClient.startSession(),
                plan,
                manifest,
                execute: options.execute,
            })
            console.log(`Rollback ${options.execute ? 'ejecutado' : 'simulado'}: ${result.documents ?? result.restored ?? 0} documentos; fingerprint restaurado: ${'fingerprintRestored' in result ? result.fingerprintRestored : 'pendiente'}.`)
            return
        }

        await sourceClient.connect()
        const sourceDb = sourceClient.db(sourceTarget.databaseName)
        const sourceSession = sourceClient.startSession()
        let sourceInspection: Awaited<ReturnType<typeof inspectSource>>
        try {
            sourceSession.startTransaction({ readConcern: { level: 'snapshot' } })
            sourceInspection = await inspectSource({
                db: sourceDb,
                session: sourceSession,
                runId: options.runId,
                commit: currentCommit(cwd),
            })

            if (options.command === 'plan') {
                const directory = artifactDirectory(cwd, options.runId)
                await mkdir(directory, { recursive: true })
                const manifest = options.approveSafeDefaults
                    ? approveManifest(sourceInspection.plan, options.approvedBy!)
                    : buildSafeResolutionTemplate(sourceInspection.plan)
                await Promise.all([
                    writeJson(resolve(directory, 'plan.private.json'), sourceInspection.plan),
                    writeJson(resolve(directory, 'resolutions.private.json'), manifest),
                    writeJson(resolve(directory, 'summary.json'), {
                        schemaVersion: sourceInspection.plan.schemaVersion,
                        runId: options.runId,
                        spaces: sourceInspection.plan.spacesAudited,
                        counts: sourceInspection.plan.counts,
                        sourceSnapshot: true,
                        containsFinancialData: false,
                    }),
                ])
                await sourceSession.abortTransaction()
                console.log(`Plan creado: ${sourceInspection.plan.spacesAudited} Espacios; ${sourceInspection.plan.counts.automatic} automáticos, ${sourceInspection.plan.counts.review} de revisión y ${sourceInspection.plan.counts.manual} manuales.`)
                return
            }

            const { plan, manifest } = await readArtifacts(cwd, options.runId)
            assertSamePlan(plan, sourceInspection.plan)
            await targetClient.connect()
            const targetDb = targetClient.db(options.targetDatabase)

            if (options.command === 'clone') {
                const counts = await cloneSpaceMigrationDatabase({
                    source: sourceDb,
                    target: targetDb,
                    session: sourceSession,
                    execute: options.execute,
                })
                await sourceSession.abortTransaction()
                if (options.execute) {
                    const cloneFingerprint = await fingerprintSpaceMigrationDatabase(targetDb)
                    if (cloneFingerprint !== plan.sourceDatabaseFingerprint) {
                        throw new Error('SPACE_MIGRATION_CLONE_EXACTNESS_MISMATCH')
                    }
                    await registerClonedMigrationRun({
                        db: targetDb,
                        plan,
                        manifest,
                        targetDatabaseName: options.targetDatabase,
                        cloneFingerprint,
                    })
                }
                const documents = Object.values(counts).reduce((sum, count) => sum + count, 0)
                console.log(`Copia ${options.execute ? 'creada' : 'simulada'}: ${documents} documentos en lotes de hasta 100; contenido sensible sanitizado.`)
                return
            }

            await sourceSession.abortTransaction()
            if (options.command === 'apply') {
                const result = await applySpaceMigrationRun({
                    db: targetDb,
                    clientSession: () => targetClient.startSession(),
                    plan,
                    manifest,
                    execute: options.execute,
                })
                console.log(`Apply ${options.execute ? 'ejecutado' : 'simulado'}: ${result.spacesMigrated} migrados, ${result.spacesBlocked} bloqueados; replay: ${result.replayed}.`)
                return
            }
            const verification = await verifySpaceMigrationRun({
                db: targetDb,
                plan,
                manifest,
                persist: options.execute,
            })
            console.log(`Verify: válido=${verification.valid}; Espacios=${verification.spaces.length}; replay con cambios=${verification.replayProducesChanges}; duración=${verification.elapsedMs}ms.`)
            console.log(`Detalle seguro: bloqueados=${verification.spaces.filter((space) => space.state === 'blocked').length}; balances incompatibles=${verification.spaces.filter((space) => !space.balancesMatch).length}; deudas incompatibles=${verification.spaces.filter((space) => !space.debtsMatch).length}; vínculos privados incompatibles=${verification.spaces.reduce((sum, space) => sum + space.crossUserLinks, 0)}; ledger personal invariante=${verification.spaces.every((space) => space.personalLedgerUnchanged)}.`)
            if (!verification.valid) process.exitCode = 2
        } finally {
            if (sourceSession.inTransaction()) await sourceSession.abortTransaction()
            await sourceSession.endSession()
        }
    } finally {
        await Promise.allSettled([sourceClient.close(), targetClient.close()])
        const elapsedMs = Date.now() - phaseStartedAt
        if (elapsedMs > MAX_PHASE_MS && process.exitCode !== 1) {
            console.error(`La fase excedió el objetivo de ${MAX_PHASE_MS}ms (${elapsedMs}ms).`)
            process.exitCode = 3
        }
    }
}

main().catch((error: unknown) => {
    const code = error instanceof Error ? error.message : 'SPACE_MIGRATION_UNKNOWN_ERROR'
    console.error(`La migración se detuvo de forma segura (${code.startsWith('SPACE_MIGRATION_') ? code : 'SPACE_MIGRATION_INTERNAL_ERROR'}).`)
    process.exitCode = 1
})
