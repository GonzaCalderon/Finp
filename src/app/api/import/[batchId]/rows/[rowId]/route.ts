import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Category, ImportBatch, ImportRow, Transaction } from '@/lib/models'
import { IMPORT_ROW_STATUS } from '@/lib/constants'
import type { IAccount, ICategory, ImportParsedData } from '@/types'
import { evaluateImportRow } from '@/lib/utils/import-transactions'

// PATCH /api/import/[batchId]/rows/[rowId] — editar fila de revisión
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ batchId: string; rowId: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { batchId, rowId } = await params
    await connectDB()

    const batch = await ImportBatch.findOne({ _id: batchId, userId: session.user.id })
    if (!batch) return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })
    if (batch.status !== 'draft') {
        return NextResponse.json({ error: 'Solo se pueden editar importaciones en borrador' }, { status: 400 })
    }

    const row = await ImportRow.findOne({ _id: rowId, batchId })
    if (!row) return NextResponse.json({ error: 'Fila no encontrada' }, { status: 404 })

    const body = await request.json()

    if (body.reviewedData !== undefined) {
        row.reviewedData = { ...row.parsedData, ...body.reviewedData }
    }

    if (body.ignored !== undefined) {
        row.ignored = Boolean(body.ignored)
    }

    const [accounts, categories, recentTransactions] = await Promise.all([
        Account.find({ userId: session.user.id, isActive: true }).lean(),
        Category.find({ userId: session.user.id, isArchived: false }).lean(),
        Transaction.find({
            userId: session.user.id,
            date: {
                $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            },
        })
            .select('date amount description')
            .lean(),
    ])

    const effectiveData = {
        ...(row.parsedData?.toObject?.() ?? row.parsedData ?? {}),
        ...(row.reviewedData?.toObject?.() ?? row.reviewedData ?? {}),
        ignored: row.ignored,
    } as ImportParsedData

    const evaluation = evaluateImportRow({
        data: effectiveData,
        accounts: accounts as unknown as IAccount[],
        categories: categories as unknown as ICategory[],
    })

    row.reviewedData = evaluation.data
    row.errors = evaluation.errors
    row.warnings = evaluation.warnings

    if (row.ignored) {
        row.status = IMPORT_ROW_STATUS.IGNORED
        row.possibleDuplicateId = undefined
    } else {
        const possibleDuplicateId = detectDuplicate(
            evaluation.data,
            recentTransactions as unknown as Array<{
                date: Date
                amount: number
                description: string
                _id: unknown
            }>
        )
        row.possibleDuplicateId = possibleDuplicateId
        row.status =
            possibleDuplicateId && evaluation.status === IMPORT_ROW_STATUS.OK
                ? IMPORT_ROW_STATUS.POSSIBLE_DUPLICATE
                : evaluation.status
    }

    await row.save()

    // Recalcular summary del batch
    const [total, valid, invalid, incomplete, possibleDuplicate, ignored] = await Promise.all([
        ImportRow.countDocuments({ batchId }),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.OK }),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INVALID }),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.INCOMPLETE }),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.POSSIBLE_DUPLICATE }),
        ImportRow.countDocuments({ batchId, status: IMPORT_ROW_STATUS.IGNORED }),
    ])

    batch.summary = { total, valid, invalid, incomplete, possibleDuplicate, ignored, imported: batch.summary.imported }
    await batch.save()

    return NextResponse.json({ row, summary: batch.summary })
}

function detectDuplicate(
    parsedData: ImportParsedData,
    recentTransactions: Array<{ date: Date; amount: number; description: string; _id: unknown }>
): string | undefined {
    if (!parsedData.date || !parsedData.amount) return undefined

    const rowDate = new Date(parsedData.date).toISOString().slice(0, 10)
    const match = recentTransactions.find((transaction) => {
        const txDate = new Date(transaction.date).toISOString().slice(0, 10)
        if (txDate !== rowDate) return false
        if (Math.abs(transaction.amount - (parsedData.amount ?? 0)) > 0.01) return false

        const desc1 = transaction.description.toLowerCase().trim()
        const desc2 = (parsedData.description ?? '').toLowerCase().trim()
        return desc1 === desc2 || desc1.includes(desc2) || desc2.includes(desc1)
    })

    return match ? String(match._id) : undefined
}
