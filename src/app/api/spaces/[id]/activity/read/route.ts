import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { markSpaceActivityRead } from '@/lib/server/space-activity'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json().catch(() => ({})) as { eventIds?: string[] }

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        await markSpaceActivityRead(id, session.user.id, body.eventIds)
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al marcar actividad del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
