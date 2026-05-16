import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { revokeSpaceInviteLink } from '@/lib/server/space-invites'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'

function canManageInvites(context: Awaited<ReturnType<typeof getAccessibleSpaceContext>>) {
    return Boolean(
        context &&
            (context.isOwner ||
                context.currentParticipant?.role === 'owner' ||
                context.currentParticipant?.role === 'admin')
    )
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id, inviteId } = await params
        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        if (!canManageInvites(context)) {
            return NextResponse.json(
                { error: 'No tenés permisos para revocar invitaciones.' },
                { status: 403 }
            )
        }

        const invite = await revokeSpaceInviteLink({
            spaceId: id,
            inviteId,
            userId: session.user.id,
        })

        if (!invite) {
            return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ invite })
    } catch (error) {
        console.error('Error al revocar invitación por link:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
