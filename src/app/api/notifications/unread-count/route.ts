import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Notification } from '@/lib/models'
import { Types } from 'mongoose'
import { NOTIFICATION_STATUSES, NOTIFICATION_ACTION_STATUSES } from '@/lib/constants'

export async function GET() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const recipientUserId = new Types.ObjectId(session.user.id)

        const [unreadCount, pendingCount] = await Promise.all([
            Notification.countDocuments({
                recipientUserId,
                status: NOTIFICATION_STATUSES.UNREAD,
            }),
            Notification.countDocuments({
                recipientUserId,
                actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
                status: { $ne: NOTIFICATION_STATUSES.DISMISSED },
            }),
        ])

        return NextResponse.json({ unreadCount, pendingCount })
    } catch (err) {
        console.error('[GET /api/notifications/unread-count]', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
