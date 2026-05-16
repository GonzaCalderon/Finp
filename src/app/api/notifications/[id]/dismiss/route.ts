import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { dismissNotification } from '@/lib/server/notifications'

export async function PATCH(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        await connectDB()

        const notification = await dismissNotification(session.user.id, id)
        if (!notification) {
            return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ notification })
    } catch (err) {
        console.error('[PATCH /api/notifications/[id]/dismiss]', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
