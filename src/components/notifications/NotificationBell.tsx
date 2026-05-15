'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { useNotifications } from '@/contexts/NotificationsContext'
import { NotificationBadge } from './NotificationBadge'
import { NotificationSheet } from './NotificationSheet'
import type { Tab } from './NotificationSheet'
import type { TabCounts } from '@/contexts/NotificationsContext'

function resolveDefaultTab(pathname: string, tabCounts: TabCounts): Tab {
    if (pathname.startsWith('/spaces') && tabCounts.spaces > 0) return 'space'
    if (pathname.startsWith('/debts') && tabCounts.debts > 0) return 'debt'
    if (tabCounts.pending > 0) return 'pending'
    return 'all'
}

export function NotificationBell() {
    const [open, setOpen] = useState(false)
    const [defaultTab, setDefaultTab] = useState<Tab>('all')
    const pathname = usePathname()
    const { unreadCount, pendingCount, tabCounts } = useNotifications()

    const ariaLabel = [
        'Notificaciones',
        unreadCount > 0 ? `${unreadCount} sin leer` : '',
        pendingCount > 0 ? `${pendingCount} pendientes` : '',
    ].filter(Boolean).join(', ')

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setDefaultTab(resolveDefaultTab(pathname, tabCounts))
        }
        setOpen(nextOpen)
    }

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetTrigger asChild>
                <button
                    type="button"
                    className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-foreground/[0.06] hover:text-foreground"
                    style={{ color: 'var(--muted-foreground)' }}
                    aria-label={ariaLabel}
                >
                    <div className="relative">
                        <Bell size={15} strokeWidth={1.8} />
                        {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
                        {unreadCount === 0 && pendingCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                        )}
                    </div>
                    {/* Desktop: texto + conteo */}
                    <span className="hidden md:inline">Notificaciones</span>
                    {unreadCount > 0 && (
                        <span className="hidden md:inline text-xs font-semibold text-sky-400">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </SheetTrigger>
            <NotificationSheet
                key={`${open ? 'open' : 'closed'}-${defaultTab}`}
                onClose={() => setOpen(false)}
                isOpen={open}
                defaultTab={defaultTab}
            />
        </Sheet>
    )
}
