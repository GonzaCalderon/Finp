import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

/**
 * Leer, archivar, restaurar y descartar cambian el estado de presentación del
 * aviso. Ninguno resuelve la acción que el aviso pedía: `actionStatus` sólo lo
 * mueve quien atiende el pendiente. Si una de estas transiciones lo tocara, un
 * swipe accidental daría por resuelto un impacto que el usuario nunca registró.
 */

const mocks = vi.hoisted(() => ({
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
}))

vi.mock('@/lib/models', () => ({
    Notification: {
        findOneAndUpdate: mocks.findOneAndUpdate,
        updateMany: mocks.updateMany,
    },
}))

const {
    markNotificationAsRead,
    archiveNotification,
    unarchiveNotification,
    dismissNotification,
    markAllNotificationsAsRead,
} = await import('@/lib/server/notifications')

const USER_ID = '64b7f9c2e4b0a1d2c3e4f5a6'
const NOTIFICATION_ID = '74b7f9c2e4b0a1d2c3e4f5b7'

const transitions = [
    { name: 'leer', run: markNotificationAsRead, status: 'read' },
    { name: 'archivar', run: archiveNotification, status: 'archived' },
    { name: 'restaurar', run: unarchiveNotification, status: 'read' },
    { name: 'descartar', run: dismissNotification, status: 'dismissed' },
] as const

describe('transiciones de estado de una notificación', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({}) })
        mocks.updateMany.mockResolvedValue({ modifiedCount: 0 })
    })

    it.each(transitions)('$name no resuelve la acción pendiente', async ({ run, status }) => {
        await run(USER_ID, NOTIFICATION_ID)

        const [, update] = mocks.findOneAndUpdate.mock.calls[0]
        expect(update.$set.status).toBe(status)
        expect(update.$set).not.toHaveProperty('actionStatus')
        expect(update.$set).not.toHaveProperty('resolvedAt')
        expect(update.$unset ?? {}).not.toHaveProperty('actionStatus')
    })

    it.each(transitions)('$name sólo alcanza avisos del propio usuario', async ({ run }) => {
        await run(USER_ID, NOTIFICATION_ID)

        const [filter] = mocks.findOneAndUpdate.mock.calls[0]
        expect(String(filter.recipientUserId)).toBe(USER_ID)
        expect(String(filter._id)).toBe(NOTIFICATION_ID)
        expect(filter.recipientUserId).toBeInstanceOf(Types.ObjectId)
    })

    it('restaurar deja el aviso leído y borra la marca de archivo', async () => {
        await unarchiveNotification(USER_ID, NOTIFICATION_ID)

        const [, update] = mocks.findOneAndUpdate.mock.calls[0]
        expect(update.$set.status).toBe('read')
        expect(update.$unset).toEqual({ archivedAt: '' })
    })

    it('marcar todo como leído no toca acciones pendientes ni otros usuarios', async () => {
        mocks.updateMany.mockResolvedValue({ modifiedCount: 3 })

        const modified = await markAllNotificationsAsRead(USER_ID)

        expect(modified).toBe(3)
        const [filter, update] = mocks.updateMany.mock.calls[0]
        expect(String(filter.recipientUserId)).toBe(USER_ID)
        // Sólo las no leídas: no reabre ni pisa archivadas o descartadas.
        expect(filter.status).toBe('unread')
        expect(update.$set).not.toHaveProperty('actionStatus')
    })

    it('devuelve null si el aviso no es del usuario', async () => {
        mocks.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })

        await expect(dismissNotification(USER_ID, NOTIFICATION_ID)).resolves.toBeNull()
    })
})
