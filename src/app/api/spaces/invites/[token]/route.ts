import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getPublicSpaceInviteByToken } from '@/lib/server/space-invites'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const session = await auth()

        await connectDB()

        const invite = await getPublicSpaceInviteByToken(token, session?.user.id)
        return NextResponse.json(invite)
    } catch (error) {
        console.error('Error al obtener invitación pública:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
