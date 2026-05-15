import { Types } from 'mongoose'
import {
    CommitmentApplication,
    Debt,
    ImportBatch,
    Notification,
    ScheduledCommitment,
    SpaceActivityEvent,
    SpaceEntryPersonalImpact,
    Transaction,
    Category,
} from '@/lib/models'
import {
    DEBT_STATUSES,
    IMPORT_BATCH_STATUS,
    NOTIFICATION_ACTION_STATUSES,
    NOTIFICATION_STATUSES,
    SPACE_PERSONAL_IMPACT_STATUSES,
    TRANSACTION_STATUS,
    TRANSACTION_TYPES,
} from '@/lib/constants'
import type { NavInsight, NavInsightsResponse } from '@/types/nav-insight'

type NavInsightSignals = {
    needsReviewCount?: number
    pendingActionsCount?: number
    pendingNotificationsCount?: number
    unreadNotificationsCount?: number
    activeDebtsCount?: number
    unreadSpacesActivityCount?: number
    draftImportsCount?: number
    duplicateCandidatesCount?: number
    topCurrentCategory?: { name: string; amount: number } | null
    topPreviousCategory?: { name: string; amount: number } | null
    creditCardTrend?: { direction: 'up' | 'down'; percent: number } | null
    nextCommitment?: {
        description: string
        count?: number
    } | null
}

function plural(count: number, singular: string, pluralText: string) {
    return count === 1 ? singular : pluralText
}

export function buildNavInsightsFromSignals(signals: NavInsightSignals): NavInsight[] {
    const insights: NavInsight[] = []

    if ((signals.needsReviewCount ?? 0) > 0) {
        const count = signals.needsReviewCount ?? 0
        insights.push({
            id: 'needs-review',
            type: 'pending',
            priority: 10,
            title: 'Revisa tu Finp',
            description: `${count} ${plural(count, 'movimiento cambio', 'movimientos cambiaron')} en espacios.`,
            href: '/spaces',
            icon: 'scan-search',
            tone: 'amber',
            count,
        })
    }

    if ((signals.pendingActionsCount ?? 0) > 0) {
        const count = signals.pendingActionsCount ?? 0
        insights.push({
            id: 'pending-actions',
            type: 'pending',
            priority: 20,
            title: 'Tenes pendientes',
            description: `${count} ${plural(count, 'movimiento espera', 'movimientos esperan')} decision.`,
            href: '/spaces',
            icon: 'clipboard-check',
            tone: 'amber',
            count,
        })
    }

    if ((signals.duplicateCandidatesCount ?? 0) > 0) {
        const count = signals.duplicateCandidatesCount ?? 0
        insights.push({
            id: 'possible-duplicates',
            type: 'pending',
            priority: 25,
            title: 'Posibles duplicados',
            description: `${count} ${plural(count, 'movimiento se parece', 'movimientos se parecen')} a otro.`,
            href: '/transactions',
            icon: 'scan-search',
            tone: 'amber',
            count,
        })
    }

    if ((signals.pendingNotificationsCount ?? 0) > 0) {
        const count = signals.pendingNotificationsCount ?? 0
        insights.push({
            id: 'pending-notifications',
            type: 'notification',
            priority: 30,
            title: 'Notificaciones pendientes',
            description: `${count} ${plural(count, 'aviso requiere', 'avisos requieren')} atencion.`,
            icon: 'bell',
            tone: 'sky',
            count,
        })
    } else if ((signals.unreadNotificationsCount ?? 0) > 0) {
        const count = signals.unreadNotificationsCount ?? 0
        insights.push({
            id: 'unread-notifications',
            type: 'notification',
            priority: 40,
            title: 'Hay novedades',
            description: `${count} ${plural(count, 'notificacion nueva', 'notificaciones nuevas')}.`,
            icon: 'bell',
            tone: 'sky',
            count,
        })
    }

    if ((signals.activeDebtsCount ?? 0) > 0) {
        const count = signals.activeDebtsCount ?? 0
        insights.push({
            id: 'active-debts',
            type: 'debt',
            priority: 50,
            title: 'Deudas activas',
            description: `${count} ${plural(count, 'saldo pendiente', 'saldos pendientes')} por revisar.`,
            href: '/debts',
            icon: 'hand-coins',
            tone: 'purple',
            count,
        })
    }

    if ((signals.unreadSpacesActivityCount ?? 0) > 0) {
        const count = signals.unreadSpacesActivityCount ?? 0
        insights.push({
            id: 'spaces-activity',
            type: 'space',
            priority: 60,
            title: 'Actividad en espacios',
            description: `${count} ${plural(count, 'movimiento nuevo', 'movimientos nuevos')}.`,
            href: '/spaces',
            icon: 'briefcase',
            tone: 'sky',
            count,
        })
    }

    if ((signals.draftImportsCount ?? 0) > 0) {
        const count = signals.draftImportsCount ?? 0
        insights.push({
            id: 'draft-imports',
            type: 'pending',
            priority: 65,
            title: 'Importacion pendiente',
            description: `${count} ${plural(count, 'archivo espera', 'archivos esperan')} revision.`,
            href: '/transactions/import',
            icon: 'upload',
            tone: 'amber',
            count,
        })
    }

    if (signals.nextCommitment) {
        insights.push({
            id: 'next-commitment',
            type: 'commitment',
            priority: 70,
            title: 'Proximo compromiso',
            description: signals.nextCommitment.count && signals.nextCommitment.count > 1
                ? `${signals.nextCommitment.description} y ${signals.nextCommitment.count - 1} mas.`
                : signals.nextCommitment.description,
            href: '/commitments',
            icon: 'calendar',
            tone: 'green',
            count: signals.nextCommitment.count,
        })
    }

    if (signals.topCurrentCategory) {
        insights.push({
            id: 'top-current-category',
            type: 'summary',
            priority: 80,
            title: 'Categoria fuerte del mes',
            description: `${signals.topCurrentCategory.name} lidera tus gastos.`,
            href: '/dashboard',
            icon: 'sparkles',
            tone: 'muted',
        })
    }

    if (signals.topPreviousCategory) {
        insights.push({
            id: 'top-previous-category',
            type: 'summary',
            priority: 85,
            title: 'Mayor gasto pasado',
            description: `El mes pasado fue ${signals.topPreviousCategory.name}.`,
            href: '/dashboard',
            icon: 'sparkles',
            tone: 'muted',
        })
    }

    if (signals.creditCardTrend) {
        insights.push({
            id: 'credit-card-trend',
            type: 'summary',
            priority: 90,
            title: 'Tarjeta en movimiento',
            description: `Tus gastos con TC ${signals.creditCardTrend.direction === 'up' ? 'subieron' : 'bajaron'} ${signals.creditCardTrend.percent}%.`,
            href: '/transactions/credit-card',
            icon: 'credit-card',
            tone: signals.creditCardTrend.direction === 'up' ? 'amber' : 'green',
        })
    }

    if (insights.length === 0) {
        insights.push({
            id: 'all-clear',
            type: 'empty',
            priority: 100,
            title: 'Todo al dia',
            description: 'No hay pendientes importantes.',
            href: '/dashboard',
            icon: 'check-circle',
            tone: 'green',
        })
    }

    return insights.sort((a, b) => a.priority - b.priority)
}

function monthBounds(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { start, end, period }
}

function previousMonthBounds(date = new Date()) {
    return monthBounds(new Date(date.getFullYear(), date.getMonth() - 1, 1))
}

async function getTopExpenseCategory(userId: Types.ObjectId, start: Date, end: Date) {
    const [top] = await Transaction.aggregate<{ _id: Types.ObjectId; amount: number }>([
        {
            $match: {
                userId,
                date: { $gte: start, $lte: end },
                type: { $in: [TRANSACTION_TYPES.EXPENSE, TRANSACTION_TYPES.CREDIT_CARD_EXPENSE] },
                categoryId: { $exists: true, $ne: null },
                $or: [
                    { status: { $exists: false } },
                    { status: TRANSACTION_STATUS.CONFIRMED },
                ],
            },
        },
        {
            $group: {
                _id: '$categoryId',
                amount: { $sum: { $ifNull: ['$operationalAmount', '$amount'] } },
            },
        },
        { $sort: { amount: -1 } },
        { $limit: 1 },
    ])

    if (!top?._id) return null

    const category = await Category.findById(top._id, { name: 1 }).lean<{ name: string } | null>()
    if (!category?.name) return null

    return { name: category.name, amount: top.amount }
}

async function getCreditCardTrend(userId: Types.ObjectId, start: Date, end: Date, previousStart: Date, previousEnd: Date) {
    const [current, previous] = await Promise.all([
        Transaction.aggregate<{ total: number }>([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end },
                    type: TRANSACTION_TYPES.CREDIT_CARD_EXPENSE,
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Transaction.aggregate<{ total: number }>([
            {
                $match: {
                    userId,
                    date: { $gte: previousStart, $lte: previousEnd },
                    type: TRANSACTION_TYPES.CREDIT_CARD_EXPENSE,
                },
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
    ])

    const currentTotal = current[0]?.total ?? 0
    const previousTotal = previous[0]?.total ?? 0
    if (currentTotal <= 0 || previousTotal <= 0) return null

    const percent = Math.round(Math.abs(((currentTotal - previousTotal) / previousTotal) * 100))
    if (percent < 10) return null

    return {
        direction: currentTotal > previousTotal ? 'up' as const : 'down' as const,
        percent,
    }
}

async function getDuplicateCandidatesCount(userId: Types.ObjectId) {
    const since = new Date()
    since.setDate(since.getDate() - 45)

    const duplicates = await Transaction.aggregate<{ count: number }>([
        {
            $match: {
                userId,
                date: { $gte: since },
                type: { $in: [TRANSACTION_TYPES.EXPENSE, TRANSACTION_TYPES.INCOME, TRANSACTION_TYPES.CREDIT_CARD_EXPENSE] },
            },
        },
        {
            $group: {
                _id: {
                    day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    amount: '$amount',
                    currency: '$currency',
                    categoryId: '$categoryId',
                    description: { $toLower: { $trim: { input: '$description' } } },
                },
                count: { $sum: 1 },
            },
        },
        { $match: { count: { $gt: 1 } } },
        { $count: 'count' },
    ])

    return duplicates[0]?.count ?? 0
}

export async function getNavInsightsForUser(userId: string): Promise<NavInsightsResponse> {
    const userObjectId = new Types.ObjectId(userId)
    const { start, end, period } = monthBounds()
    const previous = previousMonthBounds()

    const notActive = { $nin: [NOTIFICATION_STATUSES.DISMISSED, NOTIFICATION_STATUSES.ARCHIVED] }

    const appliedCommitmentIdsPromise = CommitmentApplication.distinct('commitmentId', {
        userId,
        period,
    })

    const [
        needsReviewCount,
        pendingActionsCount,
        pendingNotificationsCount,
        unreadNotificationsCount,
        activeDebtsCount,
        unreadSpacesActivityCount,
        draftImportsCount,
        appliedCommitmentIds,
        duplicateCandidatesCount,
        topCurrentCategory,
        topPreviousCategory,
        creditCardTrend,
    ] = await Promise.all([
        SpaceEntryPersonalImpact.countDocuments({
            userId: userObjectId,
            status: SPACE_PERSONAL_IMPACT_STATUSES.NEEDS_REVIEW,
        }),
        SpaceEntryPersonalImpact.countDocuments({
            userId: userObjectId,
            status: SPACE_PERSONAL_IMPACT_STATUSES.PENDING,
        }),
        Notification.countDocuments({
            recipientUserId: userObjectId,
            actionStatus: NOTIFICATION_ACTION_STATUSES.PENDING,
            status: notActive,
        }),
        Notification.countDocuments({
            recipientUserId: userObjectId,
            status: NOTIFICATION_STATUSES.UNREAD,
        }),
        Debt.countDocuments({
            userId,
            status: { $in: [DEBT_STATUSES.ACTIVE, DEBT_STATUSES.PARTIALLY_PAID] },
        }),
        SpaceActivityEvent.countDocuments({
            visibleToUserIds: userObjectId,
            readByUserIds: { $ne: userObjectId },
        }),
        ImportBatch.countDocuments({
            userId,
            status: IMPORT_BATCH_STATUS.DRAFT,
        }),
        appliedCommitmentIdsPromise,
        getDuplicateCandidatesCount(userObjectId),
        getTopExpenseCategory(userObjectId, start, end),
        getTopExpenseCategory(userObjectId, previous.start, previous.end),
        getCreditCardTrend(userObjectId, start, end, previous.start, previous.end),
    ])

    const commitmentQuery = {
        userId,
        isActive: true,
        _id: { $nin: appliedCommitmentIds },
        startDate: { $lte: end },
        $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: start } },
        ],
    }

    const [nextCommitment, pendingCommitmentsCount] = await Promise.all([
        ScheduledCommitment.findOne(commitmentQuery)
            .sort({ dayOfMonth: 1, createdAt: -1 })
            .select({ description: 1 })
            .lean<{ description: string } | null>(),
        ScheduledCommitment.countDocuments(commitmentQuery),
    ])

    const insights = buildNavInsightsFromSignals({
        needsReviewCount,
        pendingActionsCount,
        pendingNotificationsCount,
        unreadNotificationsCount,
        activeDebtsCount,
        unreadSpacesActivityCount,
        draftImportsCount,
        duplicateCandidatesCount,
        topCurrentCategory,
        topPreviousCategory,
        creditCardTrend,
        nextCommitment: nextCommitment
            ? {
                description: nextCommitment.description,
                count: pendingCommitmentsCount,
            }
            : null,
    })

    return {
        insights,
        generatedAt: new Date().toISOString(),
    }
}
