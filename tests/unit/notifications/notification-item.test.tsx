import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import type { INotification } from '@/types/notification'

type PanInfoLike = {
    offset: { x: number; y: number }
    velocity: { x: number; y: number }
}
type DragHandler = (event: unknown, info: PanInfoLike) => void

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    dismiss: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(undefined),
    unarchive: vi.fn().mockResolvedValue(undefined),
    // El mock de framer-motion descarta los handlers de drag al renderizar un div
    // plano, así que se capturan acá para poder disparar el gesto.
    drag: {} as {
        onDragStart?: (event: unknown, info: PanInfoLike) => void
        onDrag?: (event: unknown, info: PanInfoLike) => void
        onDragEnd?: (event: unknown, info: PanInfoLike) => void
    },
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
        div: (props: Record<string, unknown>) => {
            if (props.drag) {
                mocks.drag.onDragStart = props.onDragStart as DragHandler
                mocks.drag.onDrag = props.onDrag as DragHandler
                mocks.drag.onDragEnd = props.onDragEnd as DragHandler
            }
            // `drag*`, `onDrag*` y `style` con MotionValue no son props del DOM:
            // se descartan para que quede un div plano y sin warnings de React.
            const domProps = Object.fromEntries(
                Object.entries(props).filter(
                    ([key]) =>
                        key !== 'children' &&
                        key !== 'style' &&
                        !key.startsWith('drag') &&
                        !key.startsWith('onDrag')
                )
            )
            return <div {...domProps}>{props.children as React.ReactNode}</div>
        },
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

    describe('swipe', () => {
        // El componente resuelve el gesto 160 ms después de la animación de salida.
        const RESOLVE_DELAY = 200

        beforeEach(() => {
            mocks.drag.onDragStart = undefined
            mocks.drag.onDrag = undefined
            mocks.drag.onDragEnd = undefined
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        function swipe(offsetX: number, velocityX = 0) {
            const info: PanInfoLike = {
                offset: { x: offsetX, y: 0 },
                velocity: { x: velocityX, y: 0 },
            }
            mocks.drag.onDragStart?.(null, info)
            mocks.drag.onDrag?.(null, info)
            mocks.drag.onDragEnd?.(null, info)
            vi.advanceTimersByTime(RESOLVE_DELAY)
        }

        it('swipe right archiva una notificación activa', () => {
            const item = notification()
            render(<NotificationItem notification={item} />)

            swipe(100)

            expect(mocks.archive).toHaveBeenCalledWith(item._id.toString())
            expect(mocks.unarchive).not.toHaveBeenCalled()
            expect(mocks.dismiss).not.toHaveBeenCalled()
            expect(mocks.push).not.toHaveBeenCalled()
        })

        it('swipe right restaura una notificación archivada', () => {
            const item = notification({ status: 'archived', actionStatus: 'none' })
            render(<NotificationItem notification={item} />)

            swipe(100)

            expect(mocks.unarchive).toHaveBeenCalledWith(item._id.toString())
            expect(mocks.archive).not.toHaveBeenCalled()
        })

        it('swipe left descarta sin tocar la acción pendiente', () => {
            const item = notification({ actionStatus: 'pending' })
            render(<NotificationItem notification={item} />)

            swipe(-100)

            expect(mocks.dismiss).toHaveBeenCalledWith(item._id.toString())
            // Descartar el aviso no es resolver lo que el aviso pedía.
            expect(mocks.archive).not.toHaveBeenCalled()
            expect(mocks.markAsRead).not.toHaveBeenCalled()
            expect(mocks.push).not.toHaveBeenCalled()
        })

        it('un gesto corto no resuelve nada', () => {
            render(<NotificationItem notification={notification()} />)

            swipe(40)

            expect(mocks.archive).not.toHaveBeenCalled()
            expect(mocks.dismiss).not.toHaveBeenCalled()
        })

        it('un gesto corto pero rápido sí resuelve', () => {
            const item = notification()
            render(<NotificationItem notification={item} />)

            swipe(40, 800)

            expect(mocks.archive).toHaveBeenCalledWith(item._id.toString())
        })

        it('arrastrar no abre la notificación al soltar', () => {
            render(<NotificationItem notification={notification()} />)

            const info: PanInfoLike = { offset: { x: 40, y: 0 }, velocity: { x: 0, y: 0 } }
            mocks.drag.onDragStart?.(null, info)
            mocks.drag.onDrag?.(null, info)
            fireEvent.click(screen.getByText('Nuevo gasto').closest('[role="button"]')!)

            expect(mocks.markAsRead).not.toHaveBeenCalled()
            expect(mocks.push).not.toHaveBeenCalled()
        })
    })
})
