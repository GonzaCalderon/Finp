import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import { expectNoPrivateFields } from '../../helpers/assertions'

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
    archiveNotification,
    unarchiveNotification,
    dismissNotification,
    resolveNotificationsForTarget,
    buildNotificationFromPendingAction,
    buildReviewNotification,
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
        const [query, , options] = mocks.Notification.findOneAndUpdate.mock.calls[0]
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

    it('si reabre pending/unread limpia timestamps de estados anteriores', async () => {
        mocks.Notification.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ _id: notifId }) })

        await upsertNotificationByDedupeKey({
            dedupeKey: 'reopen-key',
            recipientUserId: new Types.ObjectId(userId),
            type: 'personal_impact_pending' as const,
            category: 'personal_impact' as const,
            priority: 'normal' as const,
            status: 'unread' as const,
            actionStatus: 'pending' as const,
            title: 'Reabierta',
        })

        const [, update] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(update.$unset).toEqual({
            readAt: '',
            dismissedAt: '',
            archivedAt: '',
            resolvedAt: '',
        })
    })

    it('si estaba archived y vuelve a pending queda visible nuevamente', async () => {
        mocks.Notification.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ _id: notifId }) })

        await upsertNotificationByDedupeKey({
            dedupeKey: 'archived-pending',
            recipientUserId: new Types.ObjectId(userId),
            type: 'personal_impact_pending' as const,
            category: 'personal_impact' as const,
            priority: 'normal' as const,
            status: 'unread' as const,
            actionStatus: 'pending' as const,
            title: 'Visible de nuevo',
            entityRefs: {
                spaceId: new Types.ObjectId(spaceId),
                spaceEntryId: new Types.ObjectId(entryId),
            },
            action: {
                label: 'Ver',
                href: `/spaces/${spaceId}?entryId=${entryId}`,
            },
        })

        const [, update] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(update.$set.status).toBe('unread')
        expect(update.$set.actionStatus).toBe('pending')
        expect(update.$unset.archivedAt).toBe('')
        expect(update.$set.entityRefs.spaceEntryId.toString()).toBe(entryId)
        expect(update.$set.action.href).toBe(`/spaces/${spaceId}?entryId=${entryId}`)
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
    it('marca como dismissed con dismissedAt sin resolver pending action', async () => {
        const notif = { _id: notifId, status: 'dismissed' }
        mocks.Notification.findOneAndUpdate = vi.fn().mockReturnValue({ lean: () => Promise.resolve(notif) })

        const result = await dismissNotification(userId, notifId)

        expect(result).toBe(notif)
        const [filter, update] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(filter._id.toString()).toBe(notifId)
        expect(filter.recipientUserId.toString()).toBe(userId)
        expect(update.$set.status).toBe('dismissed')
        expect(update.$set.dismissedAt).toBeInstanceOf(Date)
        expect(update.$set.actionStatus).toBeUndefined()
        expect(update.$set.pendingActionId).toBeUndefined()
    })
})

// ─── archive / unarchive ─────────────────────────────────────────────────────

describe('archiveNotification', () => {
    it('archiva solo la notificación del usuario actual sin tocar actionStatus ni pendingActionId', async () => {
        const notif = { _id: notifId, status: 'archived' }
        mocks.Notification.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(notif) })

        const result = await archiveNotification(userId, notifId)

        expect(result).toBe(notif)
        const [filter, update] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(filter._id.toString()).toBe(notifId)
        expect(filter.recipientUserId.toString()).toBe(userId)
        expect(update.$set.status).toBe('archived')
        expect(update.$set.archivedAt).toBeInstanceOf(Date)
        expect(update.$set.actionStatus).toBeUndefined()
        expect(update.$set.pendingActionId).toBeUndefined()
    })
})

describe('unarchiveNotification', () => {
    it('vuelve a read y limpia archivedAt sin tocar actionStatus ni pendingActionId', async () => {
        const notif = { _id: notifId, status: 'read' }
        mocks.Notification.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(notif) })

        const result = await unarchiveNotification(userId, notifId)

        expect(result).toBe(notif)
        const [filter, update] = mocks.Notification.findOneAndUpdate.mock.calls[0]
        expect(filter._id.toString()).toBe(notifId)
        expect(filter.recipientUserId.toString()).toBe(userId)
        expect(update.$set.status).toBe('read')
        expect(update.$unset.archivedAt).toBe('')
        expect(update.$set.actionStatus).toBeUndefined()
        expect(update.$set.pendingActionId).toBeUndefined()
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

    it('resuelve solo pending y no toca dismissed; archived sí puede resolverse para evitar acciones stale', async () => {
        mocks.Notification.updateMany.mockResolvedValue({ modifiedCount: 1 })

        await resolveNotificationsForTarget({
            spaceEntryId: entryId,
            actionStatus: 'cancelled',
        })

        const [filter, update] = mocks.Notification.updateMany.mock.calls[0]
        expect(filter.actionStatus).toBe('pending')
        expect(filter.status).toEqual({ $ne: 'dismissed' })
        expect(update.$set.actionStatus).toBe('cancelled')
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

    it('no expone cuenta ni categoría personal en la notificación pending', () => {
        const result = buildNotificationFromPendingAction(
            { ...baseTarget, counterpartyNameSnapshot: 'Ana' },
            baseEvent,
            pendingId
        )

        expectNoPrivateFields(result)
        expect(result.entityRefs?.spaceId?.toString()).toBe(spaceId)
        expect(result.entityRefs?.spaceEntryId?.toString()).toBe(entryId)
        expect(result.entityRefs?.personalImpactId?.toString()).toBe(pendingId)
    })
})

describe('buildReviewNotification', () => {
    it('construye review notification para entry_voided', () => {
        const impactId = new Types.ObjectId().toString()

        const result = buildReviewNotification({
            recipientUserId: userId,
            actorUserId: userBId,
            entryId,
            spaceId,
            entryTitle: 'Cena',
            reason: 'entry_voided',
            impactId,
        })

        expect(result.category).toBe('personal_impact')
        expect(result.actionStatus).toBe('pending')
        expect(result.action?.href).toBe(`/spaces/${spaceId}?entryId=${entryId}`)
        expect(result.dedupeKey).toBe(`review:entry_voided:${userId}:${entryId}`)
        expect(result.entityRefs?.spaceId?.toString()).toBe(spaceId)
        expect(result.entityRefs?.spaceEntryId?.toString()).toBe(entryId)
        expect(result.entityRefs?.personalImpactId?.toString()).toBe(impactId)
    })

    it('construye review notification para entry_edited con dedupe estable', () => {
        const impactId = new Types.ObjectId().toString()

        const result = buildReviewNotification({
            recipientUserId: userId,
            actorUserId: userBId,
            entryId,
            spaceId,
            entryTitle: 'Cena',
            reason: 'entry_edited',
            impactId,
            changedFields: ['monto', 'pagador'],
        })

        expect(result.type).toBe('space_entry_edited_review')
        expect(result.actionStatus).toBe('pending')
        expect(result.dedupeKey).toBe(`review:entry_edited:${userId}:${entryId}`)
        expect(result.body).toContain('monto')
        expect(result.body).toContain('pagador')
    })
})
