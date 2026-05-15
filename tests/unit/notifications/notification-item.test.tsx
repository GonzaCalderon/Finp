import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import type { INotification } from '@/types/notification'

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
    unarchive: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/contexts/NotificationsContext', () => ({
    useNotifications: () => ({
        markAsRead: mocks.markAsRead,
        dismiss: mocks.dismiss,
        archive: mocks.archive,
        unarchive: mocks.unarchive,
    }),
}))

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    },
    useMotionValue: () => 0,
    useTransform: () => 0,
    animate: vi.fn(),
}))

const { NotificationItem } = await import('@/components/notifications/NotificationItem')

function notification(overrides: Partial<INotification> = {}): INotification {
    return {
        _id: new Types.ObjectId(),
        recipientUserId: new Types.ObjectId(),
        type: 'personal_impact_pending',
        category: 'personal_impact',
        priority: 'normal',
        status: 'unread',
        actionStatus: 'pending',
        title: 'Nuevo gasto',
        body: 'Roro registró un gasto',
        action: {
            label: 'Ver gasto',
            href: '/spaces/space-1?entryId=entry-1',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

describe('NotificationItem', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('click marca read y navega si tiene href', async () => {
        render(<NotificationItem notification={notification()} />)

        const card = screen.getByText('Nuevo gasto').closest('[role="button"]')
        expect(card).not.toBeNull()
        fireEvent.click(card!)

        expect(mocks.markAsRead).toHaveBeenCalledOnce()
        await vi.waitFor(() => {
            expect(mocks.push).toHaveBeenCalledWith('/spaces/space-1?entryId=entry-1')
        })
    })

    it('CTA no propaga doble acción fuera del flujo de navegación', async () => {
        render(<NotificationItem notification={notification()} />)

        fireEvent.click(screen.getByText('Ver gasto →'))

        expect(mocks.markAsRead).toHaveBeenCalledOnce()
        await vi.waitFor(() => {
            expect(mocks.push).toHaveBeenCalledTimes(1)
        })
    })

    it('archive llama archive sin navegar', () => {
        const item = notification()
        render(<NotificationItem notification={item} />)

        fireEvent.click(screen.getByLabelText('Archivar notificación'))

        expect(mocks.archive).toHaveBeenCalledWith(item._id.toString())
        expect(mocks.push).not.toHaveBeenCalled()
    })

    it('dismiss llama dismiss sin navegar', () => {
        const item = notification()
        render(<NotificationItem notification={item} />)

        fireEvent.click(screen.getByLabelText('Eliminar notificación'))

        expect(mocks.dismiss).toHaveBeenCalledWith(item._id.toString())
        expect(mocks.push).not.toHaveBeenCalled()
    })

    it('unarchive llama unarchive si está archivada', () => {
        const item = notification({ status: 'archived', actionStatus: 'none' })
        render(<NotificationItem notification={item} />)

        fireEvent.click(screen.getByLabelText('Restaurar notificación'))

        expect(mocks.unarchive).toHaveBeenCalledWith(item._id.toString())
        expect(mocks.push).not.toHaveBeenCalled()
    })

    it.todo('swipe right archiva o restaura según estado')
    it.todo('swipe left elimina/dismiss sin resolver pending action')
})
