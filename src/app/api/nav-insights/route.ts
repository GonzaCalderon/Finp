import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getNavInsightsForUser } from '@/lib/server/nav-insights'

export async function GET() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const payload = await getNavInsightsForUser(session.user.id)
        return NextResponse.json(payload)
    } catch (error) {
        console.error('[GET /api/nav-insights]', error)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
