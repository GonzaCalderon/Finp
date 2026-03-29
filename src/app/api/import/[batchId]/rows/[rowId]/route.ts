import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ImportBatch, ImportRow } from '@/lib/models'
import { IMPORT_ROW_STATUS } from '@/lib/constants'

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

    // Always recalculate status when data or ignored changes
    if (row.ignored) {
        row.status = IMPORT_ROW_STATUS.IGNORED
    } else {
        const effectiveData = row.reviewedData ?? row.parsedData
        row.status = recalculateStatus(effectiveData, row.errors)
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

function recalculateStatus(data: Record<string, unknown>, errors: string[]): string {
    if (errors.length > 0) return IMPORT_ROW_STATUS.INVALID

    const missingRequired =
        !data.date || !data.type || !data.description || !data.amount || !data.currency
    if (missingRequired) return IMPORT_ROW_STATUS.INCOMPLETE

    // Cuenta especificada pero no resuelta: es un error bloqueante —
    // la transacción no puede imputarse a una cuenta inexistente en Finp
    if (data.accountName && !data.sourceAccountId) return IMPORT_ROW_STATUS.INVALID

    return IMPORT_ROW_STATUS.OK
}
