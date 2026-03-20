import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, ScheduledCommitment } from '@/lib/models'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        await connectDB()

        const [transactions, commitments] = await Promise.all([
            Transaction.countDocuments({ userId: session.user.id, categoryId: id }),
            ScheduledCommitment.countDocuments({ userId: session.user.id, categoryId: id }),
        ])

        return NextResponse.json({ count: transactions + commitments })
    } catch (error) {
        console.error('Error al obtener uso de categoría:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}