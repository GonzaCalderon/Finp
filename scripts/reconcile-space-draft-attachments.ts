import mongoose from 'mongoose'

import { reconcileSpaceEntryDraftAttachments } from '../src/lib/server/space-entry-draft-attachment-service'
import { parseDraftAttachmentReconciliationArguments } from '../src/lib/server/space-entry-draft-attachment-reconciliation'
import { resolveE2EEnvironment } from '../tests/e2e/helpers/environment'

const HELP = `Reconciliación de adjuntos privados de borradores

Uso:
  npm run reconcile:space-draft-attachments
  npm run reconcile:space-draft-attachments -- --draft <id> --limit 50
  npm run reconcile:space-draft-attachments -- --apply [--draft <id>] [--limit 50]

El modo predeterminado es dry-run y el destino siempre es la base E2E aislada.`

async function main() {
    const options = parseDraftAttachmentReconciliationArguments(process.argv.slice(2))
    if (options.help) {
        console.log(HELP)
        return
    }
    const environment = resolveE2EEnvironment()
    await mongoose.connect(environment.variables.MONGODB_URI, {
        dbName: environment.databaseName,
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
    })
    try {
        const result = await reconcileSpaceEntryDraftAttachments({
            draftId: options.draftId,
            dryRun: !options.apply,
            limit: options.limit,
        })
        console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', ...result }))
        if (result.failures > 0) process.exitCode = 2
    } finally {
        await mongoose.disconnect()
    }
}

main().catch((error: unknown) => {
    console.error(`No se pudo reconciliar adjuntos (${error instanceof Error ? error.name : 'UnknownError'}).`)
    process.exitCode = 1
})
