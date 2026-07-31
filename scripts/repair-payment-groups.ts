/**
 * Detecta referencias huérfanas de pagos duales.
 *
 * Uso:
 *   npm run repair:payment-groups
 *   npm run repair:payment-groups -- --apply
 *
 * El modo predeterminado es dry-run. Sólo `--apply` limpia `paymentGroupId`.
 */

import 'dotenv/config'
import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'

config({ path: resolve(process.cwd(), '.env.local'), override: false })

const mongoUri = process.env.MONGODB_URI
if (!mongoUri) {
    console.error('MONGODB_URI no definido.')
    process.exit(1)
}

const apply = process.argv.includes('--apply')

async function main() {
    await mongoose.connect(mongoUri as string)
    const db = mongoose.connection.db
    if (!db) throw new Error('No se pudo obtener la conexión a la base.')

    const transactions = db.collection('transactions')
    const orphanGroups = await transactions.aggregate<{
        _id: string
        transactionIds: mongoose.Types.ObjectId[]
        count: number
    }>([
        { $match: { paymentGroupId: { $type: 'string', $ne: '' } } },
        {
            $group: {
                _id: '$paymentGroupId',
                transactionIds: { $push: '$_id' },
                count: { $sum: 1 },
            },
        },
        { $match: { count: { $lt: 2 } } },
    ]).toArray()

    const transactionIds = orphanGroups.flatMap((group) => group.transactionIds)
    console.info(apply ? 'Aplicando reparación.' : 'Dry-run: no se escribirán cambios.')
    console.info(`Grupos huérfanos: ${orphanGroups.length}`)
    console.info(`Transacciones a normalizar: ${transactionIds.length}`)

    if (apply && transactionIds.length > 0) {
        await transactions.updateMany(
            { _id: { $in: transactionIds } },
            { $unset: { paymentGroupId: '' } }
        )
        console.info('Referencias huérfanas eliminadas.')
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await mongoose.disconnect()
    })
