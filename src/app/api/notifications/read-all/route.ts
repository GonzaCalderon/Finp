import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { markAllNotificationsAsRead } from '@/lib/server/notifications'

export async function PATCH() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const updatedCount = await markAllNotificationsAsRead(session.user.id)

        return NextResponse.json({ updatedCount })
    } catch (err) {
        console.error('[PATCH /api/notifications/read-all]', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
