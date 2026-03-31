import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Category, ImportBatch, ImportRow, InstallmentPlan, Transaction } from '@/lib/models'
import { IMPORT_ROW_STATUS, IMPORT_SOURCE_TYPES } from '@/lib/constants'
import type { IAccount, ICategory, ImportParsedData } from '@/types'
import {
    evaluateImportRow,
    getImportFallbackDescription,
    mergeImportRawDataFallbacks,
    typeSupportsCategory,
} from '@/lib/utils/import-transactions'

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
    const preparedRows: Array<{
        row: (typeof rows)[number]
        data: ImportParsedData
        normalizedType: string
    }> = []

    for (const row of rows) {
        const sourceData = mergeImportRawDataFallbacks(
            ((row.reviewedData ?? row.parsedData) as ImportParsedData) ?? {},
            (row.rawData as Record<string, string | undefined> | undefined) ?? undefined
        )
        const evaluation = evaluateImportRow({
            data: sourceData,
            accounts: accounts as unknown as IAccount[],
            categories: categories as unknown as ICategory[],
        })
        const data = evaluation.data
        const normalizedType = evaluation.normalizedType

        if (evaluation.status !== IMPORT_ROW_STATUS.OK || !normalizedType) {
            const rowErrors =
                evaluation.errors.length > 0
                    ? evaluation.errors
                    : ['Faltan campos obligatorios para importar la fila.']

            await ImportRow.updateOne(
                { _id: row._id },
                {
                    status: IMPORT_ROW_STATUS.INVALID,
                    reviewedData: data,
                    errors: rowErrors,
                    warnings: evaluation.warnings,
                }
            )

            errors.push(`Fila ${row.rowNumber}: ${rowErrors[0]}`)
            continue
        }

        preparedRows.push({ row, data, normalizedType })
    }

    if (errors.length > 0) {
        const [total, valid, invalid, incomplete, possibleDuplicate, ignored, importedCount] = await Promise.all([
            ImportRow.countDocuments({ batchId }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.OK }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INVALID }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INCOMPLETE }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.POSSIBLE_DUPLICATE }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.IGNORED }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.IMPORTED }),
        ])

        batch.summary = { total, valid, invalid, incomplete, possibleDuplicate, ignored, imported: importedCount }
        await batch.save()

        return NextResponse.json(
            {
                error: 'Hay filas con errores de validación. Revisalas antes de confirmar la importación.',
                errors,
            },
            { status: 400 }
        )
    }

    for (const { row, data, normalizedType } of preparedRows) {
        try {
            const description = data.description?.trim() || getImportFallbackDescription(normalizedType)
            if (!description) {
                throw new Error('La descripción es obligatoria para crear la transacción.')
            }

            let tx

            // Gasto con TC: siempre crear InstallmentPlan (incluso 1 cuota)
            if (normalizedType === 'credit_card_expense') {
                const installmentCount = data.installmentCount ?? 1
                const installmentAmount = (data.amount as number) / installmentCount

                const plan = await InstallmentPlan.create({
                    userId: session.user.id,
                    accountId: data.sourceAccountId,
                    categoryId: typeSupportsCategory(normalizedType) ? data.categoryId : undefined,
                    description,
                    currency: data.currency,
                    totalAmount: data.amount,
                    installmentCount,
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
                    description,
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
                    description,
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

                if (['expense', 'credit_card_payment', 'transfer', 'adjustment'].includes(normalizedType)) {
                    txDoc.sourceAccountId = data.sourceAccountId
                }

                if (normalizedType === 'exchange') {
                    txDoc.sourceAccountId = data.sourceAccountId
                    txDoc.destinationAccountId = data.destinationAccountId
                    txDoc.destinationAmount = data.destinationAmount
                    txDoc.destinationCurrency = data.destinationCurrency
                    txDoc.exchangeRate = data.exchangeRate
                }

                if (normalizedType === 'income') {
                    txDoc.destinationAccountId = data.sourceAccountId
                }

                if (['credit_card_payment', 'transfer'].includes(normalizedType)) {
                    txDoc.destinationAccountId = data.destinationAccountId
                }

                tx = await Transaction.create(txDoc)
            }

            await ImportRow.updateOne(
                { _id: row._id },
                {
                    status: IMPORT_ROW_STATUS.IMPORTED,
                    createdTransactionId: tx._id,
                    reviewedData: { ...data, description },
                    errors: [],
                    warnings: [],
                }
            )

            imported++
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al crear la transacción.'
            errors.push(`Fila ${row.rowNumber}: ${message}`)
            await ImportRow.updateOne(
                { _id: row._id },
                {
                    status: IMPORT_ROW_STATUS.INVALID,
                    reviewedData: data,
                    errors: [message],
                }
            )
            console.error(`Import row ${row.rowNumber} error:`, err)
        }
    }

    if (errors.length > 0) {
        const [total, valid, invalid, incomplete, possibleDuplicate, ignored, importedCount] = await Promise.all([
            ImportRow.countDocuments({ batchId }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.OK }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INVALID }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INCOMPLETE }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.POSSIBLE_DUPLICATE }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.IGNORED }),
            ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.IMPORTED }),
        ])

        batch.summary = { total, valid, invalid, incomplete, possibleDuplicate, ignored, imported: importedCount }
        await batch.save()

        return NextResponse.json(
            {
                error: 'No se pudo completar la importación. Revisá las filas marcadas con error.',
                imported,
                errors,
            },
            { status: 400 }
        )
    }

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
