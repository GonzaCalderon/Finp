import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { SpaceParticipant } from '@/lib/models'
import { syncSpaceDebtsForUser } from '@/lib/server/debt-sync'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        await connectDB()

        // Verificar que el usuario es participante activo del espacio
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

        const result = await syncSpaceDebtsForUser(id, session.user.id)

        return NextResponse.json({ synced: result.created + result.updated + result.paid, ...result })
    } catch (error) {
        console.error('Error al sincronizar deudas del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
