import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Notification } from '@/lib/models'
import { Types } from 'mongoose'
import { NOTIFICATION_STATUSES, NOTIFICATION_ACTION_STATUSES } from '@/lib/constants'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const category = searchParams.get('category')
        const actionStatus = searchParams.get('actionStatus')
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
        const cursor = searchParams.get('cursor')

        await connectDB()

        const recipientUserId = new Types.ObjectId(session.user.id)

        const query: Record<string, unknown> = { recipientUserId }

        if (status) {
            query.status = status
        } else {
            query.status = { $ne: NOTIFICATION_STATUSES.DISMISSED }
        }
        if (category) query.category = category
        if (actionStatus) query.actionStatus = actionStatus
        if (cursor) query.createdAt = { $lt: new Date(cursor) }

        const [notifications, unreadCount, pendingCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(limit + 1)
                .lean(),
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

        const hasMore = notifications.length > limit
        const page = hasMore ? notifications.slice(0, limit) : notifications
        const nextCursor = hasMore ? page[page.length - 1]?.createdAt?.toISOString() : undefined

        return NextResponse.json({
            notifications: page,
            unreadCount,
            pendingCount,
            nextCursor,
        })
    } catch (err) {
        console.error('[GET /api/notifications]', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
