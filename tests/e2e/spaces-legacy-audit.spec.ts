import { expect, test } from '@playwright/test'
import mongoose from 'mongoose'

import { runMongoSpaceLegacyAudit } from '@/lib/server/audits/space-legacy-audit-mongo'
import { resolveE2EEnvironment } from './helpers/environment'

test('la auditoría lee el seed aislado y caracteriza el huérfano conocido', async () => {
    const environment = resolveE2EEnvironment()
    await mongoose.connect(environment.variables.MONGODB_URI, {
        dbName: environment.databaseName,
        autoIndex: false,
        serverSelectionTimeoutMS: 10_000,
    })
    const session = await mongoose.startSession()

    try {
        session.startTransaction({ readConcern: { level: 'snapshot' } })
        const run = await runMongoSpaceLegacyAudit(mongoose.connection.db!, session)
        await session.abortTransaction()

        expect(run.snapshotRead).toBe(true)
        expect(run.result.migrationReadiness.spacesAudited).toBeGreaterThan(0)
        expect(run.result.countsByCode.SPACE_PERSONAL_TRANSACTION_ORPHAN).toBeGreaterThan(0)
    } finally {
        if (session.inTransaction()) await session.abortTransaction()
        await session.endSession()
        await mongoose.disconnect()
    }
})
