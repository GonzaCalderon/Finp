'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { invalidateData, NOTIFICATION_INVALIDATION_TAGS } from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'
import type { INotification } from '@/types/notification'

export interface TabCounts {
    all: number
    pending: number
    spaces: number
    debts: number
}

export interface NotificationFilters {
    status?: string
    category?: string
    actionStatus?: string
    section?: 'all' | 'pending' | 'spaces' | 'debts'
    limit?: number
    cursor?: string
}

interface NotificationsContextValue {
    notifications: INotification[]
    unreadCount: number
    pendingCount: number
    tabCounts: TabCounts
    loading: boolean
    fetchNotifications: (filters?: NotificationFilters) => Promise<void>
    fetchUnreadCount: () => Promise<void>
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    dismiss: (id: string) => Promise<void>
}

const DEFAULT_TAB_COUNTS: TabCounts = { all: 0, pending: 0, spaces: 0, debts: 0 }

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<INotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [pendingCount, setPendingCount] = useState(0)
    const [tabCounts, setTabCounts] = useState<TabCounts>(DEFAULT_TAB_COUNTS)
    const [loading, setLoading] = useState(false)

    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await apiJson<{
                unreadCount: number
                pendingCount: number
                tabCounts: TabCounts
            }>('/api/notifications/unread-count')
            setUnreadCount(data.unreadCount ?? 0)
            setPendingCount(data.pendingCount ?? 0)
            setTabCounts(data.tabCounts ?? DEFAULT_TAB_COUNTS)
        } catch {
            // silencioso — el badge queda en el último valor conocido
        }
    }, [])

    const fetchNotifications = useCallback(async (filters?: NotificationFilters) => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filters?.section) {
                params.set('section', filters.section)
            } else {
                if (filters?.status) params.set('status', filters.status)
                if (filters?.category) params.set('category', filters.category)
                if (filters?.actionStatus) params.set('actionStatus', filters.actionStatus)
            }
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

    // Polling cada 20s mientras la pestaña esté visible
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') void fetchUnreadCount()
        }, 20_000)
        return () => clearInterval(id)
    }, [fetchUnreadCount])

    // Refresh inmediato en focus de ventana y visibilitychange
    useEffect(() => {
        const onFocus = () => void fetchUnreadCount()
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void fetchUnreadCount()
        }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisibility)
        }
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
                tabCounts,
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
