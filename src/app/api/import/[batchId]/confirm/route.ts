import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ImportBatch, ImportRow, Transaction } from '@/lib/models'
import { IMPORT_ROW_STATUS, IMPORT_SOURCE_TYPES } from '@/lib/constants'
import type { ImportParsedData } from '@/types'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'

// POST /api/import/[batchId]/confirm — confirmar importación y crear transacciones
export async function POST(
    _request: Request,
    { params }: { params: Promise<{ batchId: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { batchId } = await params
    await connectDB()

    const batch = await ImportBatch.findOne({ _id: batchId, userId: session.user.id })
    if (!batch) return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    if (batch.status !== 'draft') {
        return NextResponse.json({ error: 'Esta importación ya fue procesada' }, { status: 400 })
    }

    // Filas importables: ok y possible_duplicate (no ignored, no invalid)
    const importableStatuses = [IMPORT_ROW_STATUS.OK, IMPORT_ROW_STATUS.POSSIBLE_DUPLICATE, IMPORT_ROW_STATUS.INCOMPLETE]
    const rows = await ImportRow.find({ batchId, status: { $in: importableStatuses }, ignored: false }).lean()

    const now = new Date()
    let imported = 0
    const errors: string[] = []

    for (const row of rows) {
        const data: ImportParsedData = (row.reviewedData ?? row.parsedData) as ImportParsedData
        const normalizedType = normalizeLegacyTransactionType(data.type)

        // Validación mínima para crear la transacción
        if (!data.date || !normalizedType || !data.description || !data.amount || !data.currency) {
            errors.push(`Fila ${row.rowNumber}: faltan campos obligatorios.`)
            continue
        }

        // Si se especificó una cuenta pero no fue resuelta, bloquear
        if (data.accountName && !data.sourceAccountId) {
            errors.push(`Fila ${row.rowNumber}: la cuenta "${data.accountName}" no fue asignada. Asigná una cuenta válida antes de confirmar.`)
            continue
        }

        try {
            const txDoc: Record<string, unknown> = {
                userId: session.user.id,
                type: normalizedType,
                amount: data.amount,
                currency: data.currency,
                date: data.date,
                description: data.description,
                createdFrom: 'web',
                importBatchId: batch._id,
                importedAt: now,
                importSourceType: IMPORT_SOURCE_TYPES.XLSX_TEMPLATE,
            }

            if (data.categoryId) txDoc.categoryId = data.categoryId
            if (data.notes) txDoc.notes = data.notes
            if (data.installmentCount) txDoc.tags = [`cuota ${data.installmentNumber ?? 1}/${data.installmentCount}`]

            // Asignar cuentas según tipo
            if (['expense', 'credit_card_payment'].includes(normalizedType)) {
                if (data.sourceAccountId) txDoc.sourceAccountId = data.sourceAccountId
            } else if (normalizedType === 'income') {
                if (data.destinationAccountId) txDoc.destinationAccountId = data.destinationAccountId
                else if (data.sourceAccountId) txDoc.destinationAccountId = data.sourceAccountId
            } else if (normalizedType === 'transfer') {
                if (data.sourceAccountId) txDoc.sourceAccountId = data.sourceAccountId
                if (data.destinationAccountId) txDoc.destinationAccountId = data.destinationAccountId
            }

            const tx = await Transaction.create(txDoc)

            // Actualizar fila con transacción creada
            await ImportRow.updateOne(
                { _id: row._id },
                { status: IMPORT_ROW_STATUS.IMPORTED, createdTransactionId: tx._id }
            )

            imported++
        } catch (err) {
            errors.push(`Fila ${row.rowNumber}: error al crear transacción.`)
            console.error(`Import row ${row.rowNumber} error:`, err)
        }
    }

    // Actualizar batch
    batch.status = 'confirmed'
    batch.confirmedAt = now
    batch.summary.imported = imported
    await batch.save()

    return NextResponse.json({
        imported,
        errors,
        batchId: batch._id.toString(),
    })
}
