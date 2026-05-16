import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { acceptSpaceInviteToken } from '@/lib/server/space-invites'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { token } = await params
        await connectDB()

        const result = await acceptSpaceInviteToken({ token, userId: session.user.id })
        if (!result.ok) {
            const statusCode = result.status === 'expired' || result.status === 'revoked' ? 410 : 404
            return NextResponse.json({ error: 'Invitación no disponible', status: result.status }, { status: statusCode })
        }

        return NextResponse.json({
            spaceId: result.spaceId,
            alreadyParticipant: result.alreadyParticipant,
            participant: result.participant,
        })
    } catch (error) {
        console.error('Error al aceptar invitación por link:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
