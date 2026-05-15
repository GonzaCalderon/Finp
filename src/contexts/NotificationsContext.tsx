'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, NOTIFICATION_INVALIDATION_TAGS } from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { INotification } from '@/types/notification'

export interface NotificationFilters {
    status?: string
    category?: string
    actionStatus?: string
    limit?: number
    cursor?: string
}

interface NotificationsContextValue {
    notifications: INotification[]
    unreadCount: number
    pendingCount: number
    loading: boolean
    fetchNotifications: (filters?: NotificationFilters) => Promise<void>
    fetchUnreadCount: () => Promise<void>
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    dismiss: (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<INotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [pendingCount, setPendingCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await apiJson<{ unreadCount: number; pendingCount: number }>(
                '/api/notifications/unread-count'
            )
            setUnreadCount(data.unreadCount ?? 0)
            setPendingCount(data.pendingCount ?? 0)
        } catch {
            // silencioso — el badge queda en el último valor conocido
        }
    }, [])

    const fetchNotifications = useCallback(async (filters?: NotificationFilters) => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filters?.status) params.set('status', filters.status)
            if (filters?.category) params.set('category', filters.category)
            if (filters?.actionStatus) params.set('actionStatus', filters.actionStatus)
            if (filters?.limit) params.set('limit', String(filters.limit))
            if (filters?.cursor) params.set('cursor', filters.cursor)

            const qs = params.toString()
            const data = await apiJson<{
                notifications: INotification[]
                unreadCount: number
                pendingCount: number
                nextCursor?: string
            }>(`/api/notifications${qs ? `?${qs}` : ''}`)
            setNotifications(data.notifications ?? [])
            setUnreadCount(data.unreadCount ?? 0)
            setPendingCount(data.pendingCount ?? 0)
        } catch (err) {
            console.error('[notifications] fetchNotifications:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    const markAsRead = useCallback(async (id: string) => {
        try {
            await apiJson(`/api/notifications/${id}/read`, { method: 'PATCH' })
            setNotifications((prev) =>
                prev.map((n) => (n._id.toString() === id ? { ...n, status: 'read' as const } : n))
            )
            setUnreadCount((prev) => Math.max(0, prev - 1))
            invalidateData(NOTIFICATION_INVALIDATION_TAGS)
        } catch (err) {
            console.error('[notifications] markAsRead:', err)
        }
    }, [])

    const markAllAsRead = useCallback(async () => {
        try {
            await apiJson('/api/notifications/read-all', { method: 'PATCH' })
            setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' as const })))
            setUnreadCount(0)
            invalidateData(NOTIFICATION_INVALIDATION_TAGS)
        } catch (err) {
            console.error('[notifications] markAllAsRead:', err)
        }
    }, [])

    const dismiss = useCallback(async (id: string) => {
        try {
            await apiJson(`/api/notifications/${id}/dismiss`, { method: 'PATCH' })
            setNotifications((prev) => prev.filter((n) => n._id.toString() !== id))
            invalidateData(NOTIFICATION_INVALIDATION_TAGS)
        } catch (err) {
            console.error('[notifications] dismiss:', err)
        }
    }, [])

    // Auto-refresh via invalidación de datos
    useDataInvalidation(['notifications'], fetchUnreadCount)

    // Polling liviano — solo unreadCount, solo cuando la pestaña está visible
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') void fetchUnreadCount()
        }, 60_000)
        return () => clearInterval(id)
    }, [fetchUnreadCount])

    // Carga inicial
    useEffect(() => {
        void fetchUnreadCount()
    }, [fetchUnreadCount])

    return (
        <NotificationsContext.Provider
            value={{
                notifications,
                unreadCount,
                pendingCount,
                loading,
                fetchNotifications,
                fetchUnreadCount,
                markAsRead,
                markAllAsRead,
                dismiss,
            }}
        >
            {children}
        </NotificationsContext.Provider>
    )
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext)
    if (!ctx) throw new Error('useNotifications debe usarse dentro de NotificationsProvider')
    return ctx
}
