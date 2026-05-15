'use client'

import { useEffect, useState } from 'react'
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

type Tab = 'all' | 'pending' | 'space' | 'debt'

const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'space', label: 'Espacios' },
    { key: 'debt', label: 'Deudas' },
]

function tabToFilters(tab: Tab): NotificationFilters {
    switch (tab) {
        case 'pending': return { actionStatus: 'pending' }
        case 'space': return { category: 'space' }
        case 'debt': return { category: 'debt' }
        default: return {}
    }
}

function emptyMessageFor(tab: Tab): string {
    switch (tab) {
        case 'pending': return 'No tenés acciones pendientes'
        case 'space': return 'No hay notificaciones de espacios'
        case 'debt': return 'No hay notificaciones de deudas'
        default: return 'No tenés notificaciones'
    }
}

interface NotificationSheetProps {
    onClose?: () => void
}

export function NotificationSheet({ onClose }: NotificationSheetProps) {
    const { notifications, unreadCount, loading, fetchNotifications, markAllAsRead } = useNotifications()
    const [activeTab, setActiveTab] = useState<Tab>('all')

    useEffect(() => {
        void fetchNotifications(tabToFilters(activeTab))
    }, [activeTab, fetchNotifications])

    const handleMarkAllRead = async () => {
        await markAllAsRead()
    }

    return (
        <SheetContent
            // !w-full override el data-[side=right]:w-3/4 del Radix Sheet (especificidad de atributo).
            // sm+: ancho fijo de panel lateral.
            className="!w-full sm:!w-[28rem] flex flex-col gap-0 p-0 overflow-hidden"
            showCloseButton
        >
            <SheetHeader
                className="px-4 pt-4 pb-3 border-b flex-shrink-0"
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

                {/* Tabs */}
                <div className="flex gap-1 mt-2 -mx-1">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key)}
                            className={[
                                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                activeTab === key
                                    ? 'bg-sky-500/15 text-sky-400'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                            ].join(' ')}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </SheetHeader>

            {/* Área scrollable — pb-20 deja espacio para la nav bar mobile */}
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
