'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Sheet, SheetTrigger } from '@/components/ui/sheet'
import { useNotifications } from '@/contexts/NotificationsContext'
import { NotificationBadge } from './NotificationBadge'
import { NotificationSheet } from './NotificationSheet'

export function NotificationBell() {
    const [open, setOpen] = useState(false)
    const { unreadCount } = useNotifications()

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button
                    type="button"
                    className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-foreground/[0.06] hover:text-foreground"
                    style={{ color: 'var(--muted-foreground)' }}
                    aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
                >
                    <div className="relative">
                        <Bell size={15} strokeWidth={1.8} />
                        {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
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
            <NotificationSheet onClose={() => setOpen(false)} />
        </Sheet>
    )
}
