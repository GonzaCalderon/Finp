import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getUnreadActivityCount } from '@/lib/server/space-activity'
import { getPendingSpaceActions } from '@/lib/server/spaces'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const [pendingActions, unreadActivityCount] = await Promise.all([
            getPendingSpaceActions(session.user.id),
            getUnreadActivityCount(session.user.id),
        ])

        return NextResponse.json({
            pendingActions,
            total: pendingActions.length,
            invitations: pendingActions.filter((action) => action.kind === 'invite').length,
            confirmations: pendingActions.filter((action) => action.kind === 'confirmation').length,
            unreadActivityCount,
        })
    } catch (error) {
        console.error('Error al obtener pendientes de espacios:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
