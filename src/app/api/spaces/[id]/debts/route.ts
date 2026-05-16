import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Debt, Space, SpaceParticipant } from '@/lib/models'
import { DEBT_STATUSES, SPACE_DEBT_MODES } from '@/lib/constants'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        await connectDB()

        // Verificar que el usuario es participante del espacio
        const space = await Space.findById(id)
        if (!space) return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })

        const participant = await SpaceParticipant.findOne({
            spaceId: id,
            userId: session.user.id,
            isActive: true,
        })

        if (!participant) {
            return NextResponse.json(
                { error: 'No sos participante de este espacio' },
                { status: 403 }
            )
        }

        const debts = await Debt.find({
            userId: session.user.id,
            spaceId: id,
            status: { $in: [DEBT_STATUSES.ACTIVE, DEBT_STATUSES.PARTIALLY_PAID, DEBT_STATUSES.IGNORED] },
        }).sort({ createdAt: -1 })

        return NextResponse.json({
            debts,
            spaceDebtMode: space.debtMode ?? SPACE_DEBT_MODES.SIMPLIFIED,
        })
    } catch (error) {
        console.error('Error al obtener deudas del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
