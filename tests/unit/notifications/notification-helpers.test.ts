import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

const mocks = vi.hoisted(() => {
    const Notification = {
        create: vi.fn(),
        findOneAndUpdate: vi.fn(),
        updateMany: vi.fn(),
        countDocuments: vi.fn(),
    }
    return { Notification }
})

vi.mock('@/lib/models', () => ({
    Notification: mocks.Notification,
}))

vi.mock('@/lib/constants', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/constants')>()
    return { ...actual }
})

const {
    upsertNotificationByDedupeKey,
    markAllNotificationsAsRead,
    dismissNotification,
    resolveNotificationsForTarget,
    buildNotificationFromPendingAction,
} = await import('@/lib/server/notifications')

const userId = new Types.ObjectId().toString()
const userBId = new Types.ObjectId().toString()
const spaceId = new Types.ObjectId().toString()
const entryId = new Types.ObjectId().toString()
const pendingId = new Types.ObjectId().toString()
const notifId = new Types.ObjectId().toString()

beforeEach(() => {
    vi.clearAllMocks()
})

// ─── upsertNotificationByDedupeKey ───────────────────────────────────────────

describe('upsertNotificationByDedupeKey', () => {
    it('llama a findOneAndUpdate con upsert:true sobre dedupeKey', async () => {
        const existing = { _id: notifId, dedupeKey: 'test-key' }
        mocks.Notification.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(existing) })

        const input = {
            dedupeKey: 'test-key',
            recipientUserId: new Types.ObjectId(userId),
            type: 'personal_impact_pending' as const,
            category: 'personal_impact' as const,
            priority: 'normal' as const,
            status: 'unread' as const,
            actionStatus: 'pending' as const,
            title: 'Test',
        }

        const result = await upsertNotificationByDedupeKey(input)

        expect(mocks.Notification.findOneAndUpdate).toHaveBeenCalledOnce()
        const [query, update, options] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(query).toEqual({ dedupeKey: 'test-key' })
        expect(options).toMatchObject({ upsert: true, new: true })
        expect(result).toBe(existing)
    })

    it('no crea duplicados — findOneAndUpdate con el mismo dedupeKey retorna el existente', async () => {
        const existing = { _id: notifId, dedupeKey: 'same-key', status: 'unread' }
        mocks.Notification.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(existing) })

        // Llamar dos veces con el mismo dedupeKey
        await upsertNotificationByDedupeKey({
            dedupeKey: 'same-key',
            recipientUserId: new Types.ObjectId(userId),
            type: 'personal_impact_pending' as const,
            category: 'personal_impact' as const,
            priority: 'normal' as const,
            status: 'unread' as const,
            title: 'Test 1',
        })
        await upsertNotificationByDedupeKey({
            dedupeKey: 'same-key',
            recipientUserId: new Types.ObjectId(userId),
            type: 'personal_impact_pending' as const,
            category: 'personal_impact' as const,
            priority: 'normal' as const,
            status: 'unread' as const,
            title: 'Test 2',
        })

        // findOneAndUpdate (con upsert) se llamó dos veces, pero la base de datos
        // solo tiene un registro por el índice único sparse en dedupeKey
        expect(mocks.Notification.findOneAndUpdate).toHaveBeenCalledTimes(2)
        // create nunca fue llamado
        expect(mocks.Notification.create).not.toHaveBeenCalled()
    })
})

// ─── markAllNotificationsAsRead ──────────────────────────────────────────────

describe('markAllNotificationsAsRead', () => {
    it('solo actualiza notificaciones del userId dado (filter por recipientUserId)', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 3 })

        const count = await markAllNotificationsAsRead(userId)

        expect(count).toBe(3)
        const [filter, update] = mocks.Notification.updateMany.mock.calls[0]
        expect(filter.recipientUserId.toString()).toBe(userId)
        expect(filter.status).toBe('unread')
        expect(update.$set.status).toBe('read')
        expect(update.$set.readAt).toBeInstanceOf(Date)
        // No toca actionStatus
        expect(update.$set.actionStatus).toBeUndefined()
    })

    it('no modifica notificaciones de otro usuario', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 0 })

        await markAllNotificationsAsRead(userBId)

        const [filter] = mocks.Notification.updateMany.mock.calls[0]
        expect(filter.recipientUserId.toString()).toBe(userBId)
        // El query siempre incluye recipientUserId — no puede tocar notificaciones de otros
    })
})

// ─── dismissNotification ─────────────────────────────────────────────────────

describe('dismissNotification', () => {
    it('marca como dismissed con dismissedAt', async () => {
        const notif = { _id: notifId, status: 'dismissed' }
        mocks.Notification.findOneAndUpdate = vi.fn().mockReturnValue({ lean: () => Promise.resolve(notif) })

        const result = await dismissNotification(userId, notifId)

        expect(result).toBe(notif)
        const [filter, update] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(filter._id.toString()).toBe(notifId)
        expect(filter.recipientUserId.toString()).toBe(userId)
        expect(update.$set.status).toBe('dismissed')
        expect(update.$set.dismissedAt).toBeInstanceOf(Date)
    })
})

// ─── resolveNotificationsForTarget ───────────────────────────────────────────

describe('resolveNotificationsForTarget', () => {
    it('resuelve por pendingActionId con recipientUserId', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 })

        await resolveNotificationsForTarget({
            recipientUserId: userId,
            pendingActionId: pendingId,
            actionStatus: 'completed',
        })

        const [filter, update] = mocks.Notification.updateMany.mock.calls[0]
        expect(filter.recipientUserId.toString()).toBe(userId)
        expect(filter.pendingActionId.toString()).toBe(pendingId)
        expect(filter.actionStatus).toBe('pending')
        expect(filter.status).toEqual({ $ne: 'dismissed' })
        expect(update.$set.actionStatus).toBe('completed')
        expect(update.$set.resolvedAt).toBeInstanceOf(Date)
    })

    it('resuelve por spaceEntryId sin recipientUserId (void route)', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 2 })

        await resolveNotificationsForTarget({
            spaceEntryId: entryId,
            actionStatus: 'cancelled',
        })

        const [filter] = mocks.Notification.updateMany.mock.calls[0]
        // Sin recipientUserId — afecta a todos los usuarios del entry
        expect(filter.recipientUserId).toBeUndefined()
        expect(filter['entityRefs.spaceEntryId'].toString()).toBe(entryId)
        expect(filter.actionStatus).toBe('pending')
    })

    it('no toca notificaciones de otro usuario cuando recipientUserId está dado', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 })

        await resolveNotificationsForTarget({
            recipientUserId: userId,
            pendingActionId: pendingId,
            actionStatus: 'ignored',
        })

        const [filter] = mocks.Notification.updateMany.mock.calls[0]
        expect(filter.recipientUserId.toString()).toBe(userId)
        // El query con recipientUserId garantiza que no afecta a otros
    })

    it('no hace updateMany si no hay identificador de entidad', async () => {
        await resolveNotificationsForTarget({
            recipientUserId: userId,
            actionStatus: 'completed',
            // Sin pendingActionId, spaceEntryId, debtId, personalImpactId
        })

        expect(mocks.Notification.updateMany).not.toHaveBeenCalled()
    })
})

// ─── buildNotificationFromPendingAction ──────────────────────────────────────

describe('buildNotificationFromPendingAction', () => {
    const baseTarget = {
        userId,
        actionType: 'impact_space_expense' as const,
        amount: 500,
        currency: 'ARS',
    }

    const baseEvent = {
        actorUserId: new Types.ObjectId().toString(),
        spaceId,
        entryId,
        sourceType: 'space_entry' as const,
    }

    it('usa counterpartyNameSnapshot cuando está disponible', () => {
        const result = buildNotificationFromPendingAction(
            { ...baseTarget, counterpartyNameSnapshot: 'Roro' },
            baseEvent,
            pendingId
        )

        expect(result.body).toContain('Roro')
        expect(result.title).toBe('Nuevo gasto compartido')
    })

    it('usa "Alguien" cuando counterpartyNameSnapshot es undefined', () => {
        const result = buildNotificationFromPendingAction(baseTarget, baseEvent, pendingId)

        expect(result.body).toContain('Alguien')
    })

    it('genera dedupeKey estable con formato pending-action:{userId}:{entryId}:{actionType}', () => {
        const result = buildNotificationFromPendingAction(baseTarget, baseEvent, pendingId)

        expect(result.dedupeKey).toBe(
            `pending-action:${userId}:${entryId}:impact_space_expense`
        )
    })

    it('incluye action.href con spaceId y entryId', () => {
        const result = buildNotificationFromPendingAction(baseTarget, baseEvent, pendingId)

        expect(result.action?.href).toBe(`/spaces/${spaceId}?entryId=${entryId}`)
    })

    it('setea category como personal_impact y actionStatus como pending', () => {
        const result = buildNotificationFromPendingAction(baseTarget, baseEvent, pendingId)

        expect(result.category).toBe('personal_impact')
        expect(result.actionStatus).toBe('pending')
        expect(result.status).toBe('unread')
    })

    it('copy correcto para impact_space_payment', () => {
        const result = buildNotificationFromPendingAction(
            { ...baseTarget, actionType: 'impact_space_payment', counterpartyNameSnapshot: 'Miguel' },
            baseEvent,
            pendingId
        )

        expect(result.title).toBe('Registraron un pago tuyo')
        expect(result.body).toContain('Miguel')
    })

    it('copy correcto para impact_space_collect', () => {
        const result = buildNotificationFromPendingAction(
            { ...baseTarget, actionType: 'impact_space_collect', counterpartyNameSnapshot: 'Ana' },
            baseEvent,
            pendingId
        )

        expect(result.title).toBe('Registraron un cobro para vos')
        expect(result.body).toContain('Ana')
    })
})
