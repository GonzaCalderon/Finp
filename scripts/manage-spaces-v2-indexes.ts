import mongoose from 'mongoose'

import { resolveDevelopmentAuditTarget } from '@/lib/server/audits/space-legacy-audit-cli'
import {
    parseSpaceV2IndexCliArguments,
    SPACE_V2_INDEXES,
} from '@/lib/server/space-v2-indexes'
import { resolveE2EEnvironment } from '../tests/e2e/helpers/environment'

const HELP = `Índices compatibles de Espacios v2

Uso:
  npm run indexes:spaces:v2 -- --env test
  npm run indexes:spaces:v2 -- --env test --apply
  npm run indexes:spaces:v2 -- --env development --confirm-database <nombre>
  npm run indexes:spaces:v2 -- --env development --confirm-database <nombre> --apply --cutover

Sin --apply sólo valida el destino y muestra el plan. --apply se rechaza fuera de E2E
salvo con --cutover, la puerta explícita que abrió la decisión 0011 para development.`

async function main() {
    const options = parseSpaceV2IndexCliArguments(process.argv.slice(2))
    if (options.help) {
        console.log(HELP)
        return
    }
    const target = options.env === 'test'
        ? (() => {
            const environment = resolveE2EEnvironment()
            return { uri: environment.variables.MONGODB_URI, databaseName: environment.databaseName }
        })()
        : resolveDevelopmentAuditTarget({ confirmDatabase: options.confirmDatabase! })

    console.log(`Destino validado: ${options.env} / ${target.databaseName}${options.cutover ? ' (cutover)' : ''}.`)
    console.log(`Índices planificados: ${SPACE_V2_INDEXES.length}. Modo: ${options.apply ? 'apply' : 'dry-run'}.`)
    for (const definition of SPACE_V2_INDEXES) {
        console.log(`- ${definition.collection}.${definition.options.name}: ${definition.purpose}`)
    }
    if (!options.apply) return

    await mongoose.connect(target.uri, {
        dbName: target.databaseName,
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
    })
    try {
        const db = mongoose.connection.db
        if (!db) throw new Error('No se pudo seleccionar la base E2E.')
        for (const definition of SPACE_V2_INDEXES) {
            await db.collection(definition.collection).createIndex(
                definition.keys,
                definition.options
            )
        }
        console.log(`Índices v2 aplicados de forma idempotente: ${SPACE_V2_INDEXES.length}.`)
    } finally {
        await mongoose.disconnect()
    }
}

main().catch((error: unknown) => {
    console.error(`No se pudieron gestionar los índices v2 (${error instanceof Error ? error.name : 'UnknownError'}).`)
    process.exitCode = 1
})
