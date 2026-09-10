import mongoose from 'mongoose'

import { resolveDevelopmentAuditTarget } from '@/lib/server/audits/space-legacy-audit-cli'
import {
    parseSpaceEntryLegacyCleanupArguments,
    SPACE_ENTRY_RETIRED_FIELDS,
} from '@/lib/server/space-entry-legacy-cleanup'
import { resolveE2EEnvironment } from '../tests/e2e/helpers/environment'

const HELP = `Limpieza de campos retirados de SpaceEntry

Uso:
  npm run cleanup:spaces:legacy-fields
  npm run cleanup:spaces:legacy-fields -- --apply
  npm run cleanup:spaces:legacy-fields -- --env development --confirm-database <nombre> --cutover
  npm run cleanup:spaces:legacy-fields -- --env development --confirm-database <nombre> --cutover --apply

El modo predeterminado es dry-run. Sólo limpia documentos del contrato v2;
la auditoría legacy permanece estrictamente de sólo lectura.`

async function main() {
    const options = parseSpaceEntryLegacyCleanupArguments(process.argv.slice(2))
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

    await mongoose.connect(target.uri, {
        dbName: target.databaseName,
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
    })
    try {
        const db = mongoose.connection.db
        if (!db) throw new Error('No se pudo seleccionar la base de destino.')
        const fieldsPresent = Object.fromEntries(await Promise.all(
            SPACE_ENTRY_RETIRED_FIELDS.map(async (field) => [
                field,
                await db.collection('spaceentries').countDocuments({ contractVersion: 2, [field]: { $exists: true } }),
            ])
        ))
        const filter = {
            contractVersion: 2,
            $or: SPACE_ENTRY_RETIRED_FIELDS.map((field) => ({ [field]: { $exists: true } })),
        }
        const candidates = await db.collection('spaceentries').countDocuments(filter)
        const result = options.apply
            ? await db.collection('spaceentries').updateMany(
                filter,
                { $unset: Object.fromEntries(SPACE_ENTRY_RETIRED_FIELDS.map((field) => [field, ''])) }
            )
            : undefined
        console.log(JSON.stringify({
            mode: options.apply ? 'apply' : 'dry-run',
            environment: options.env,
            database: target.databaseName,
            candidates,
            fieldsPresent,
            matchedCount: result?.matchedCount ?? 0,
            modifiedCount: result?.modifiedCount ?? 0,
        }))
    } finally {
        await mongoose.disconnect()
    }
}

main().catch((error: unknown) => {
    console.error(`No se pudieron limpiar los campos legacy de SpaceEntry (${error instanceof Error ? error.name : 'UnknownError'}).`)
    process.exitCode = 1
})
