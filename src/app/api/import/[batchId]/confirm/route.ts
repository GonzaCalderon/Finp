import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Category, ImportBatch, ImportRow, InstallmentPlan, Transaction } from '@/lib/models'
import { IMPORT_ROW_STATUS, IMPORT_SOURCE_TYPES } from '@/lib/constants'
import type { IAccount, ICategory, ImportParsedData } from '@/types'
import { evaluateImportRow, typeSupportsCategory } from '@/lib/utils/import-transactions'

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

    const importableStatuses = [IMPORT_ROW_STATUS.OK, IMPORT_ROW_STATUS.POSSIBLE_DUPLICATE]
    const [rows, pendingCount, invalidCount, accounts, categories] = await Promise.all([
        ImportRow.find({ batchId, status: { $in: importableStatuses }, ignored: false }).lean(),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INCOMPLETE, ignored: false }),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INVALID, ignored: false }),
        Account.find({ userId: session.user.id, isActive: true }).lean(),
        Category.find({ userId: session.user.id, isArchived: false }).lean(),
    ])

    if (invalidCount > 0 || pendingCount > 0) {
        return NextResponse.json(
            { error: 'Todavía hay filas pendientes o con error. Revisalas antes de confirmar la importación.' },
            { status: 400 }
        )
    }

    if (rows.length === 0) {
        return NextResponse.json(
            { error: 'No hay filas listas para importar en este batch.' },
            { status: 400 }
        )
    }

    const now = new Date()
    let imported = 0
    const errors: string[] = []

    for (const row of rows) {
        const sourceData: ImportParsedData = (row.reviewedData ?? row.parsedData) as ImportParsedData
        const evaluation = evaluateImportRow({
            data: sourceData,
            accounts: accounts as unknown as IAccount[],
            categories: categories as unknown as ICategory[],
        })
        const data = evaluation.data
        const normalizedType = evaluation.normalizedType

        if (evaluation.status !== IMPORT_ROW_STATUS.OK || !normalizedType) {
            errors.push(`Fila ${row.rowNumber}: faltan campos obligatorios.`)
            continue
        }

        try {
            let tx

            if (normalizedType === 'credit_card_expense' && (data.installmentCount ?? 1) > 1) {
                const installmentAmount = (data.amount as number) / (data.installmentCount as number)

                const plan = await InstallmentPlan.create({
                    userId: session.user.id,
                    accountId: data.sourceAccountId,
                    categoryId: typeSupportsCategory(normalizedType) ? data.categoryId : undefined,
                    description: data.description,
                    currency: data.currency,
                    totalAmount: data.amount,
                    installmentCount: data.installmentCount,
                    installmentAmount,
                    purchaseDate: data.date,
                    firstClosingMonth: data.firstClosingMonth,
                })

                tx = await Transaction.create({
                    userId: session.user.id,
                    type: normalizedType,
                    amount: data.amount,
                    currency: data.currency,
                    date: data.date,
                    description: data.description,
                    categoryId: typeSupportsCategory(normalizedType) ? data.categoryId : undefined,
                    sourceAccountId: data.sourceAccountId,
                    notes: data.notes,
                    installmentPlanId: plan._id,
                    status: 'confirmed',
                    createdFrom: 'web',
                    importBatchId: batch._id,
                    importedAt: now,
                    importSourceType: IMPORT_SOURCE_TYPES.XLSX_TEMPLATE,
                })
            } else {
                const txDoc: Record<string, unknown> = {
                    userId: session.user.id,
                    type: normalizedType,
                    amount: data.amount,
                    currency: data.currency,
                    date: data.date,
                    description: data.description,
                    createdFrom: 'web',
                    status: 'confirmed',
                    importBatchId: batch._id,
                    importedAt: now,
                    importSourceType: IMPORT_SOURCE_TYPES.XLSX_TEMPLATE,
                }

                if (typeSupportsCategory(normalizedType) && data.categoryId) {
                    txDoc.categoryId = data.categoryId
                }
                if (data.notes) txDoc.notes = data.notes

                if (['expense', 'credit_card_expense', 'credit_card_payment', 'transfer', 'adjustment'].includes(normalizedType)) {
                    txDoc.sourceAccountId = data.sourceAccountId
                }

                if (['income', 'credit_card_payment', 'transfer'].includes(normalizedType)) {
                    txDoc.destinationAccountId = data.destinationAccountId
                }

                tx = await Transaction.create(txDoc)
            }

            // Actualizar fila con transacción creada
            await ImportRow.updateOne(
                { _id: row._id },
                {
                    status: IMPORT_ROW_STATUS.IMPORTED,
                    createdTransactionId: tx._id,
                    reviewedData: data,
                    errors: [],
                    warnings: [],
                }
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
