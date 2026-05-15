'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/contexts/NotificationsContext'
import { NotificationItem } from './NotificationItem'
import type { NotificationFilters } from '@/contexts/NotificationsContext'

export type Tab = 'all' | 'pending' | 'space' | 'debt' | 'archived'

const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'space', label: 'Espacios' },
    { key: 'debt', label: 'Deudas' },
    { key: 'archived', label: 'Archivadas' },
]

function tabToFilters(tab: Tab): NotificationFilters {
    switch (tab) {
        case 'pending': return { section: 'pending' }
        case 'space': return { section: 'spaces' }
        case 'debt': return { section: 'debts' }
        case 'archived': return { section: 'archived' }
        default: return { section: 'all' }
    }
}

function emptyMessageFor(tab: Tab): string {
    switch (tab) {
        case 'pending': return 'No tenés acciones pendientes'
        case 'space': return 'No hay notificaciones de espacios'
        case 'debt': return 'No hay notificaciones de deudas'
        case 'archived': return 'No tenés notificaciones archivadas'
        default: return 'No tenés notificaciones'
    }
}

interface NotificationSheetProps {
    onClose?: () => void
    isOpen?: boolean
    defaultTab?: Tab
}

export function NotificationSheet({ onClose, isOpen, defaultTab = 'all' }: NotificationSheetProps) {
    const { notifications, unreadCount, tabCounts, loading, fetchNotifications, markAllAsRead } = useNotifications()
    const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
    const prevIsOpen = useRef(false)

    // Resetear tab al abrir (solo en la transición cerrado→abierto)
    useEffect(() => {
        if (isOpen && !prevIsOpen.current) {
            setActiveTab(defaultTab)
        }
        prevIsOpen.current = isOpen ?? false
    }, [isOpen, defaultTab])

    // Cargar notificaciones al cambiar de tab
    useEffect(() => {
        void fetchNotifications(tabToFilters(activeTab))
    }, [activeTab, fetchNotifications])

    // Polling cada 15s mientras el sheet esté abierto
    useEffect(() => {
        if (!isOpen) return
        const id = setInterval(() => {
            void fetchNotifications(tabToFilters(activeTab))
        }, 15_000)
        return () => clearInterval(id)
    }, [isOpen, activeTab, fetchNotifications])

    function tabCount(key: Tab): number {
        switch (key) {
            case 'all': return tabCounts.all
            case 'pending': return tabCounts.pending
            case 'space': return tabCounts.spaces
            case 'debt': return tabCounts.debts
            case 'archived': return tabCounts.archived
        }
    }

    const handleMarkAllRead = async () => {
        await markAllAsRead()
    }

    return (
        <SheetContent
            className="!w-full sm:!w-[28rem] flex flex-col gap-0 p-0 overflow-hidden"
            showCloseButton
        >
            <SheetHeader
                className="px-4 pt-4 pb-2 border-b flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
            >
                <div className="flex items-center justify-between">
                    <SheetTitle className="text-base">Notificaciones</SheetTitle>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground h-auto py-1 mr-8"
                            onClick={handleMarkAllRead}
                        >
                            Marcar todo como leído
                        </Button>
                    )}
                </div>
                <SheetDescription className="sr-only">
                    Lista de notificaciones del usuario
                </SheetDescription>

                {/* Tabs con contadores — scroll horizontal en mobile */}
                <div
                    className="flex gap-1 mt-2 -mx-1 overflow-x-auto"
                    style={{ scrollbarWidth: 'none' }}
                >
                    {TABS.map(({ key, label }) => {
                        const count = tabCount(key)
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setActiveTab(key)}
                                className={[
                                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                    activeTab === key
                                        ? 'bg-sky-500/15 text-sky-400'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                                ].join(' ')}
                            >
                                {label}
                                {count > 0 && (
                                    <span
                                        className={[
                                            'inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.125rem] h-[1.125rem] text-[10px] font-semibold leading-none',
                                            activeTab === key
                                                ? 'bg-sky-500/20 text-sky-400'
                                                : 'bg-muted text-muted-foreground',
                                        ].join(' ')}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* Hint mobile — solo visible en touch devices */}
                {notifications.length > 0 && activeTab !== 'archived' && (
                    <p className="md:hidden pt-1 text-[10px] text-muted-foreground/50 text-center select-none">
                        Deslizá para archivar o eliminar
                    </p>
                )}
            </SheetHeader>

            {/* Área scrollable */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                        <p className="text-sm text-muted-foreground">{emptyMessageFor(activeTab)}</p>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {notifications.map((notification) => (
                            <NotificationItem
                                key={notification._id.toString()}
                                notification={notification}
                                onClose={onClose}
                            />
                        ))}
                    </div>
                )}
            </div>
        </SheetContent>
    )
}
