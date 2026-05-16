import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getSpaceActivity } from '@/lib/server/space-activity'
import { getAccessibleSpaceContext } from '@/lib/server/spaces'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const { searchParams } = new URL(request.url)
        const limit = Number(searchParams.get('limit') ?? 20)
        const skip = Number(searchParams.get('skip') ?? 0)

        await connectDB()

        const context = await getAccessibleSpaceContext(id, session.user.id)
        if (!context) {
            return NextResponse.json({ error: 'Espacio no encontrado' }, { status: 404 })
        }

        const payload = await getSpaceActivity(id, session.user.id, { limit, skip })
        return NextResponse.json(payload)
    } catch (error) {
        console.error('Error al obtener actividad del espacio:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
