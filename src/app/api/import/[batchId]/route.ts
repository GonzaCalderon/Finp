import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ImportBatch, ImportRow } from '@/lib/models'

// GET /api/import/[batchId] — detalle del batch con sus filas
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ batchId: string }> }
) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { batchId } = await params
    await connectDB()

    const batch = await ImportBatch.findOne({ _id: batchId, userId: session.user.id }).lean()
    if (!batch) return NextResponse.json({ error: 'Importación no encontrada' }, { status: 404 })

    const rows = await ImportRow.find({ batchId }).sort({ rowNumber: 1 }).lean()

    return NextResponse.json({ batch, rows })
}

// DELETE /api/import/[batchId] — eliminar batch draft
export async function DELETE(
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
        return NextResponse.json({ error: 'Solo se pueden eliminar importaciones en borrador' }, { status: 400 })
    }

    await ImportRow.deleteMany({ batchId })
    await batch.deleteOne()

    return NextResponse.json({ ok: true })
}
