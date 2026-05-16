import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getUserSpacesActivity } from '@/lib/server/space-activity'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const limit = Number(searchParams.get('limit') ?? 20)
        const skip = Number(searchParams.get('skip') ?? 0)

        await connectDB()

        const payload = await getUserSpacesActivity(session.user.id, { limit, skip })
        return NextResponse.json(payload)
    } catch (error) {
        console.error('Error al obtener actividad global de espacios:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
