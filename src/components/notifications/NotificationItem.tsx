'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationsContext'
import type { INotification } from '@/types/notification'

const CATEGORY_LABELS: Record<string, string> = {
    personal_impact: 'Impacto',
    space: 'Espacio',
    debt: 'Deuda',
    system: 'Sistema',
    insight: 'Insight',
}

const CATEGORY_COLORS: Record<string, string> = {
    personal_impact: 'bg-sky-500/15 text-sky-400',
    space: 'bg-sky-500/15 text-sky-400',
    debt: 'bg-amber-500/15 text-amber-400',
    system: 'bg-zinc-500/15 text-zinc-400',
    insight: 'bg-purple-500/15 text-purple-400',
}

function formatRelativeDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    const diffHr = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHr / 24)

    if (diffMin < 1) return 'ahora'
    if (diffMin < 60) return `hace ${diffMin}m`
    if (diffHr < 24) return `hace ${diffHr}h`
    if (diffDays === 1) return 'ayer'
    if (diffDays < 7) return `hace ${diffDays}d`
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

interface NotificationItemProps {
    notification: INotification
    onClose?: () => void
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
    const router = useRouter()
    const { markAsRead, dismiss } = useNotifications()

    const isUnread = notification.status === 'unread'
    const isPending = notification.actionStatus === 'pending'
    const href = notification.action?.href

    const handleClick = async () => {
        if (isUnread) await markAsRead(notification._id.toString())
        if (href) {
            router.push(href)
            onClose?.()
        }
    }

    const handleDismiss = async (e: React.MouseEvent) => {
        e.stopPropagation()
        await dismiss(notification._id.toString())
    }

    return (
        <div
            className={[
                'group relative flex gap-3 rounded-lg p-3 transition-colors',
                href ? 'cursor-pointer hover:bg-white/5' : '',
                isUnread ? 'border-l-2 border-sky-500 pl-2.5' : 'border-l-2 border-transparent pl-2.5',
                !isUnread ? 'opacity-70' : '',
            ].join(' ')}
            onClick={href ? handleClick : undefined}
            role={href ? 'button' : undefined}
            tabIndex={href ? 0 : undefined}
            onKeyDown={href ? (e) => e.key === 'Enter' && handleClick() : undefined}
        >
            {/* Dot indicador no leído */}
            {isUnread && (
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
            )}
            {!isUnread && <span className="mt-1.5 h-2 w-2 flex-shrink-0" />}

            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                        {notification.title}
                    </p>
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="flex-shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                        aria-label="Descartar notificación"
                    >
                        <X size={13} className="text-muted-foreground" />
                    </button>
                </div>

                {notification.body && (
                    <p className="text-xs text-muted-foreground leading-snug">{notification.body}</p>
                )}

                <div className="flex items-center gap-2 pt-0.5">
                    <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            CATEGORY_COLORS[notification.category] ?? CATEGORY_COLORS.system
                        }`}
                    >
                        {CATEGORY_LABELS[notification.category] ?? notification.category}
                    </span>

                    {notification.amount != null && notification.currency && (
                        <span className="text-[10px] text-muted-foreground">
                            {notification.amount.toLocaleString('es-AR')} {notification.currency}
                        </span>
                    )}

                    <span className="ml-auto text-[10px] text-muted-foreground">
                        {formatRelativeDate(notification.createdAt)}
                    </span>
                </div>

                {/* CTA principal para pendientes accionables */}
                {isPending && notification.action?.label && href && (
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleClick() }}
                            className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            {notification.action.label} →
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
