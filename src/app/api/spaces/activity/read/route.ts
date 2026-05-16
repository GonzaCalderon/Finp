import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { markUserSpacesActivityRead } from '@/lib/server/space-activity'

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({})) as { eventIds?: string[] }

        await connectDB()

        await markUserSpacesActivityRead(session.user.id, body.eventIds)
        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error al marcar actividad global de espacios:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
