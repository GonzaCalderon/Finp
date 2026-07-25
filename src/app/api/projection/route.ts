import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getProjectionForUser, type ProjectionMode } from '@/lib/server/projection'

function parseIntParam(value: string | null): number | undefined {
    if (!value) return undefined
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const mode: ProjectionMode = searchParams.get('mode') === 'monthly' ? 'monthly' : 'annual'

        await connectDB()

        const { projection, currentPeriod } = await getProjectionForUser(session.user.id, {
            mode,
            year: parseIntParam(searchParams.get('year')),
            monthCount: parseIntParam(searchParams.get('months')),
        })

        return NextResponse.json({ projection, currentPeriod })
    } catch (error) {
        console.error('Error en proyección:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
