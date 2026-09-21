import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import mongoose from 'mongoose'

import {
    parseSpaceAuditCliArguments,
    resolveDevelopmentAuditTarget,
    shouldFailSpaceAudit,
} from '@/lib/server/audits/space-legacy-audit-cli'
import {
    runMongoSpaceLegacyAudit,
    SPACE_AUDIT_COLLECTIONS,
} from '@/lib/server/audits/space-legacy-audit-mongo'
import type {
    SpaceAuditResult,
    SpaceAuditSeverity,
} from '@/lib/server/audits/space-legacy-audit'
import { resolveE2EEnvironment } from '../tests/e2e/helpers/environment'

const HELP = `Auditoría legacy read-only de Espacios

Uso:
  npm run audit:spaces:legacy -- --env test
  npm run audit:spaces:legacy -- --env development --confirm-database <nombre>

Opciones:
  --env test|development       Entorno a auditar (default: test)
  --confirm-database <nombre>  Confirmación exacta obligatoria para development
  --fail-on never|high|critical
                               Umbral de salida no cero (default: never)
  --help                       Mostrar esta ayuda

No existe modo apply: la herramienta sólo realiza lecturas snapshot.`

function currentCommit(cwd: string) {
    try {
        const safeDirectory = cwd.replace(/\\/g, '/')
        return execFileSync('git', [
            '-c',
            `safe.directory=${safeDirectory}`,
            'rev-parse',
            'HEAD',
        ], {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
    } catch {
        return 'unknown'
    }
}

function severityLabel(severity: SpaceAuditSeverity) {
    return severity === 'critical'
        ? 'Crítica'
        : severity === 'high'
            ? 'Alta'
            : severity === 'medium'
                ? 'Media'
                : 'Informativa'
}

function buildSummary(environment: string, result: SpaceAuditResult) {
    const codeRows = Object.entries(result.countsByCode)
        .map(([code, count]) => `| ${code} | ${count} |`)
        .join('\n') || '| Sin hallazgos | 0 |'
    const severityRows = Object.entries(result.countsBySeverity)
        .map(([severity, count]) => `| ${severityLabel(severity as SpaceAuditSeverity)} | ${count} |`)
        .join('\n')
    const decision = result.migrationReadiness.readyForAutomaticMigration
        ? 'GO técnico para preparar la migración; todavía requiere revisión funcional antes de ejecutar cambios.'
        : 'NO-GO para migración automática hasta resolver o clasificar los hallazgos críticos y altos.'

    return `# Auditoría legacy de Espacios

> Resumen sanitizado. No contiene identificadores técnicos, datos personales ni montos.

- Entorno: ${environment}
- Versión de esquema: ${result.schemaVersion}
- Espacios auditados: ${result.migrationReadiness.spacesAudited}
- Hallazgos: ${result.migrationReadiness.findings}
- Decisión: ${decision}

## Severidad

| Severidad | Cantidad |
|---|---:|
${severityRows}

## Códigos

| Código estable | Cantidad |
|---|---:|
${codeRows}
`
}

async function writeReports(input: {
    cwd: string
    environment: 'test' | 'development'
    databaseName: string
    startedAt: Date
    finishedAt: Date
    result: SpaceAuditResult
    collectionCounts: Record<string, number>
    snapshotRead: true
}) {
    const timestamp = input.finishedAt.toISOString().replace(/[:.]/g, '-')
    const outputDirectory = resolve(
        input.cwd,
        'test-results',
        'audits',
        'spaces',
        `${input.environment}-${timestamp}`
    )
    await mkdir(outputDirectory, { recursive: true })
    await Promise.all([
        writeFile(
            resolve(outputDirectory, 'summary.md'),
            buildSummary(input.environment, input.result),
            'utf8'
        ),
        writeFile(
            resolve(outputDirectory, 'details.json'),
            `${JSON.stringify(input.result, null, 2)}\n`,
            'utf8'
        ),
        writeFile(
            resolve(outputDirectory, 'manifest.json'),
            `${JSON.stringify({
                schemaVersion: input.result.schemaVersion,
                environment: input.environment,
                databaseName: input.databaseName,
                commit: currentCommit(input.cwd),
                startedAt: input.startedAt.toISOString(),
                finishedAt: input.finishedAt.toISOString(),
                mode: 'read-only',
                snapshotRead: input.snapshotRead,
                collections: SPACE_AUDIT_COLLECTIONS,
                collectionCounts: input.collectionCounts,
            }, null, 2)}\n`,
            'utf8'
        ),
    ])
    return outputDirectory
}

async function main() {
    const cwd = process.cwd()
    const options = parseSpaceAuditCliArguments(process.argv.slice(2))
    if (options.help) {
        console.log(HELP)
        return
    }

    const target = options.env === 'test'
        ? (() => {
            const environment = resolveE2EEnvironment({ cwd })
            return {
                uri: environment.variables.MONGODB_URI,
                databaseName: environment.databaseName,
            }
        })()
        : resolveDevelopmentAuditTarget({
            cwd,
            confirmDatabase: options.confirmDatabase!,
        })

    const startedAt = new Date()
    await mongoose.connect(target.uri, {
        dbName: target.databaseName,
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
    })
    const session = await mongoose.startSession()

    try {
        session.startTransaction({ readConcern: { level: 'snapshot' } })
        const run = await runMongoSpaceLegacyAudit(mongoose.connection.db!, session)
        await session.abortTransaction()
        const finishedAt = new Date()
        const outputDirectory = await writeReports({
            cwd,
            environment: options.env,
            databaseName: target.databaseName,
            startedAt,
            finishedAt,
            ...run,
        })

        console.log(`Auditoría completada: ${run.result.migrationReadiness.spacesAudited} Espacios, ${run.result.migrationReadiness.findings} hallazgos.`)
        console.log(`Críticos: ${run.result.countsBySeverity.critical}; altos: ${run.result.countsBySeverity.high}; medios: ${run.result.countsBySeverity.medium}; informativos: ${run.result.countsBySeverity.info}.`)
        console.log(`Reportes locales: ${outputDirectory}`)

        if (shouldFailSpaceAudit(options.failOn, run.result.countsBySeverity)) {
            process.exitCode = 2
        }
    } finally {
        if (session.inTransaction()) await session.abortTransaction()
        await session.endSession()
        await mongoose.disconnect()
    }
}

main().catch((error: unknown) => {
    const errorName = error instanceof Error ? error.name : 'UnknownError'
    console.error(`La auditoría no pudo completarse de forma segura (${errorName}).`)
    process.exitCode = 1
})
