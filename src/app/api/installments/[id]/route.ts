import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { InstallmentPlan, Transaction } from '@/lib/models'

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        await connectDB()

        const plan = await InstallmentPlan.findOneAndDelete({
            _id: id,
            userId: session.user.id,
        })

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        // Eliminar transacción madre asociada
        await Transaction.deleteOne({ installmentPlanId: id, userId: session.user.id })

        return NextResponse.json({ message: 'Plan eliminado correctamente' })
    } catch (error) {
        console.error('Error al eliminar plan:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}