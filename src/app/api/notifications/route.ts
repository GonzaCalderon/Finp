import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Notification } from '@/lib/models'
import { Types } from 'mongoose'
import { NOTIFICATION_STATUSES, NOTIFICATION_ACTION_STATUSES } from '@/lib/constants'

const notActive = { $nin: [NOTIFICATION_STATUSES.DISMISSED, NOTIFICATION_STATUSES.ARCHIVED] }

function applySection(section: string, query: Record<string, unknown>) {
    switch (section) {
        case 'pending':
            query.actionStatus = NOTIFICATION_ACTION_STATUSES.PENDING
            query.status = notActive
            break
        case 'spaces':
            query['entityRefs.spaceId'] = { $exists: true }
            query.status = notActive
            break
        case 'debts':
            query['entityRefs.debtId'] = { $exists: true }
            query.status = notActive
            break
        case 'archived':
            query.status = NOTIFICATION_STATUSES.ARCHIVED
            break
        default: // 'all'
            query.status = notActive
    }
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const section = searchParams.get('section')
        const status = searchParams.get('status')
        const category = searchParams.get('category')
        const actionStatus = searchParams.get('actionStatus')
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
        const cursor = searchParams.get('cursor')

        await connectDB()

        const recipientUserId = new Types.ObjectId(session.user.id)
        const query: Record<string, unknown> = { recipientUserId }

        if (section) {
            applySection(section, query)
        } else {
            if (status) {
                query.status = status
            } else {
                query.status = notActive
            }
            if (category) query.category = category
            if (actionStatus) query.actionStatus = actionStatus
        }

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
                status: { $nin: [NOTIFICATION_STATUSES.DISMISSED, NOTIFICATION_STATUSES.ARCHIVED] },
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
