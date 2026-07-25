/**
 * Backfill de compromisos y procedencia de sus transacciones.
 *
 * Uso:
 *   npx tsx scripts/backfill-commitments.ts              # dry-run, no escribe
 *   npx tsx scripts/backfill-commitments.ts --apply      # escribe
 *   MONGODB_URI=... npx tsx scripts/backfill-commitments.ts --apply
 *
 * Qué hace:
 *   1. ScheduledCommitment: completa amountPolicy, estimationMode, createdFrom,
 *      aliases, normalizedDescription y un tramo inicial de amountSchedule.
 *   2. CommitmentApplication: completa status y origin, y reconstruye el snapshot
 *      desde la transacción vinculada.
 *   3. Transaction: escribe la procedencia (commitmentId, commitmentApplicationId,
 *      commitmentPeriod, commitmentNameSnapshot) de cada aplicación registrada.
 *
 * El proyecto no tiene tooling de migraciones: este script es la pieza de backfill.
 * Es idempotente — reejecutarlo no vuelve a cambiar nada y no pisa valores ya
 * presentes. Opera sobre las colecciones crudas para no depender de la caché de
 * modelos de Mongoose.
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'
import type { ObjectId } from 'mongodb'
import { normalizeRuleText } from '../src/lib/utils/rules'

config({ path: resolve(process.cwd(), '.env.local'), override: false })

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
    console.error('❌  MONGODB_URI no definido (ni en el entorno ni en .env.local)')
    process.exit(1)
}

const APPLY = process.argv.includes('--apply')

type CommitmentDoc = {
    _id: ObjectId
    description?: string
    amount?: number
    startDate?: Date
    amountPolicy?: string
    estimationMode?: string
    createdFrom?: string
    aliases?: string[]
    normalizedDescription?: string
    amountSchedule?: unknown[]
}

type ApplicationDoc = {
    _id: ObjectId
    userId: ObjectId
    commitmentId: ObjectId
    period: string
    transactionId?: ObjectId
    status?: string
    origin?: string
    snapshot?: Record<string, unknown>
}

type TransactionDoc = {
    _id: ObjectId
    amount?: number
    currency?: string
    description?: string
    categoryId?: ObjectId
    sourceAccountId?: ObjectId
    date?: Date
    commitmentApplicationId?: ObjectId
}

async function main() {
    await mongoose.connect(MONGODB_URI as string)
    const db = mongoose.connection.db
    if (!db) throw new Error('No se pudo obtener la conexión a la base')

    const commitments = db.collection<CommitmentDoc>('scheduledcommitments')
    const applications = db.collection<ApplicationDoc>('commitmentapplications')
    const transactions = db.collection<TransactionDoc>('transactions')

    const now = new Date()
    const stats = {
        commitmentsUpdated: 0,
        applicationsUpdated: 0,
        transactionsUpdated: 0,
        applicationsWithoutTransaction: 0,
        applicationsWithMissingTransaction: 0,
    }

    // ── 1. Compromisos ────────────────────────────────────────────────────────
    for await (const commitment of commitments.find({})) {
        const set: Record<string, unknown> = {}

        if (commitment.amountPolicy === undefined) set.amountPolicy = 'fixed'
        if (commitment.estimationMode === undefined) set.estimationMode = 'template'
        if (commitment.createdFrom === undefined) set.createdFrom = 'web'
        if (commitment.aliases === undefined) set.aliases = []

        const normalized = normalizeRuleText(commitment.description ?? '')
        if (normalized && commitment.normalizedDescription !== normalized) {
            set.normalizedDescription = normalized
        }

        // Tramo inicial: el monto de la plantilla vigente desde su fecha de inicio.
        const hasSchedule = Array.isArray(commitment.amountSchedule) && commitment.amountSchedule.length > 0
        if (!hasSchedule && typeof commitment.amount === 'number' && commitment.startDate) {
            set.amountSchedule = [
                {
                    effectiveFrom: commitment.startDate,
                    amount: commitment.amount,
                    source: 'initial',
                    createdAt: now,
                },
            ]
        }

        if (Object.keys(set).length === 0) continue

        stats.commitmentsUpdated += 1
        if (APPLY) {
            await commitments.updateOne({ _id: commitment._id }, { $set: set })
        }
    }

    // ── 2. Aplicaciones y 3. procedencia en la transacción ────────────────────
    for await (const application of applications.find({})) {
        if (!application.transactionId) {
            // Anomalía: una aplicación sin movimiento. No se toca; se reporta.
            stats.applicationsWithoutTransaction += 1
            continue
        }

        const transaction = await transactions.findOne({ _id: application.transactionId })
        if (!transaction) {
            stats.applicationsWithMissingTransaction += 1
            continue
        }

        const applicationSet: Record<string, unknown> = {}
        if (application.status === undefined) applicationSet.status = 'registered'
        if (application.origin === undefined) applicationSet.origin = 'manual'
        if (application.snapshot === undefined) {
            applicationSet.snapshot = {
                amount: transaction.amount,
                currency: transaction.currency,
                description: transaction.description,
                categoryId: transaction.categoryId,
                accountId: transaction.sourceAccountId,
                // No se puede saber retroactivamente de dónde salió el monto.
                amountSource: 'manual',
                computedAt: transaction.date ?? now,
            }
        }

        if (Object.keys(applicationSet).length > 0) {
            stats.applicationsUpdated += 1
            if (APPLY) {
                await applications.updateOne({ _id: application._id }, { $set: applicationSet })
            }
        }

        if (transaction.commitmentApplicationId) continue

        const commitment = await commitments.findOne({ _id: application.commitmentId })

        stats.transactionsUpdated += 1
        if (APPLY) {
            await transactions.updateOne(
                { _id: transaction._id },
                {
                    $set: {
                        commitmentId: application.commitmentId,
                        commitmentApplicationId: application._id,
                        commitmentPeriod: application.period,
                        commitmentNameSnapshot: commitment?.description ?? transaction.description,
                    },
                }
            )
        }
    }

    console.log(APPLY ? '✅  Backfill aplicado' : 'ℹ️   Dry-run (usá --apply para escribir)')
    console.log(`   Compromisos actualizados:            ${stats.commitmentsUpdated}`)
    console.log(`   Aplicaciones actualizadas:           ${stats.applicationsUpdated}`)
    console.log(`   Transacciones con procedencia nueva: ${stats.transactionsUpdated}`)

    if (stats.applicationsWithoutTransaction > 0) {
        console.warn(`   ⚠️  Aplicaciones sin transacción:      ${stats.applicationsWithoutTransaction} (revisar a mano)`)
    }
    if (stats.applicationsWithMissingTransaction > 0) {
        console.warn(`   ⚠️  Aplicaciones con transacción borrada: ${stats.applicationsWithMissingTransaction} (revisar a mano)`)
    }

    await mongoose.disconnect()
}

main().catch(async (error) => {
    console.error('❌  Backfill falló:', error)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
})
