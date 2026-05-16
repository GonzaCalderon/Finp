import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Notification, SpaceEntryPersonalImpact } from '@/lib/models'
import { Types } from 'mongoose'
import { NOTIFICATION_STATUSES, NOTIFICATION_ACTION_STATUSES, SPACE_PERSONAL_IMPACT_STATUSES } from '@/lib/constants'

export async function GET() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const recipientUserId = new Types.ObjectId(session.user.id)
        const notActive = { $nin: [NOTIFICATION_STATUSES.DISMISSED, NOTIFICATION_STATUSES.ARCHIVED] }

        const userId = session.user.id

        const [unreadCount, pendingCount, allCount, spacesCount, debtsCount, archivedCount, transactionReviewCount] = await Promise.all([
            Notification.countDocuments({
                recipientUserId,
                status: NOTIFICATION_STATUSES.UNREAD,
            }),
            Notification.countDocuments({
                recipientUserId,
                actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
                status: notActive,
            }),
            Notification.countDocuments({
                recipientUserId,
                status: notActive,
            }),
            Notification.countDocuments({
                recipientUserId,
                status: notActive,
                'entityRefs.spaceId': { $exists: true },
            }),
            Notification.countDocuments({
                recipientUserId,
                status: notActive,
                'entityRefs.debtId': { $exists: true },
            }),
            Notification.countDocuments({
                recipientUserId,
                status: NOTIFICATION_STATUSES.ARCHIVED,
            }),
            SpaceEntryPersonalImpact.countDocuments({
                userId,
                status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
            }),
        ])

        return NextResponse.json({
            unreadCount,
            pendingCount,
            transactionReviewCount,
            tabCounts: {
                all: allCount,
                pending: pendingCount,
                spaces: spacesCount,
                debts: debtsCount,
                archived: archivedCount,
            },
        })
    } catch (err) {
        console.error('[GET /api/notifications/unread-count]', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}
