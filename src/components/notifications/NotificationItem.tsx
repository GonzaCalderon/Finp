'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, RotateCcw, Trash2 } from 'lucide-react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
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

const DRAG_THRESHOLD = 72
const VELOCITY_THRESHOLD = 500

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
    const router = useRouter()
    const { markAsRead, dismiss, archive, unarchive } = useNotifications()

    const x = useMotionValue(0)
    const hasDragged = useRef(false)

    const isUnread = notification.status === 'unread'
    const isPending = notification.actionStatus === 'pending'
    const isArchived = notification.status === 'archived'
    const href = notification.action?.href
    const id = notification._id.toString()

    // Background reveals
    const archiveBgOpacity = useTransform(x, [0, DRAG_THRESHOLD], [0, 1])
    const dismissBgOpacity = useTransform(x, [-DRAG_THRESHOLD, 0], [1, 0])

    const handleDragStart = () => {
        hasDragged.current = false
    }

    const handleDrag = (_: unknown, info: PanInfo) => {
        if (Math.abs(info.offset.x) > 5) hasDragged.current = true
    }

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        const dist = info.offset.x
        const vel = info.velocity.x

        const goRight = dist > DRAG_THRESHOLD || (dist > 30 && vel > VELOCITY_THRESHOLD)
        const goLeft = dist < -DRAG_THRESHOLD || (dist < -30 && vel < -VELOCITY_THRESHOLD)

        if (goRight) {
            void animate(x, 500, { duration: 0.2, ease: 'easeOut' })
            setTimeout(() => {
                if (isArchived) void unarchive(id)
                else void archive(id)
            }, 160)
        } else if (goLeft) {
            void animate(x, -500, { duration: 0.2, ease: 'easeOut' })
            setTimeout(() => void dismiss(id), 160)
        } else {
            void animate(x, 0, { type: 'spring', stiffness: 500, damping: 50 })
        }
    }

    const handleClick = async () => {
        if (hasDragged.current) {
            hasDragged.current = false
            return
        }
        if (isUnread) await markAsRead(id)
        if (href) {
            router.push(href)
            onClose?.()
        }
    }

    const handleArchive = (e: React.MouseEvent) => {
        e.stopPropagation()
        void archive(id)
    }

    const handleUnarchive = (e: React.MouseEvent) => {
        e.stopPropagation()
        void unarchive(id)
    }

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation()
        void dismiss(id)
    }

    return (
        <div className="relative overflow-hidden">
            {/* Background derecho (archivar / restaurar) */}
            <motion.div
                className="pointer-events-none absolute inset-0 flex items-center gap-2 px-4 bg-sky-500/10"
                style={{ opacity: archiveBgOpacity }}
            >
                {isArchived ? (
                    <>
                        <RotateCcw size={14} className="text-sky-400" />
                        <span className="text-xs font-medium text-sky-400">Restaurar</span>
                    </>
                ) : (
                    <>
                        <Archive size={14} className="text-sky-400" />
                        <span className="text-xs font-medium text-sky-400">Archivar</span>
                    </>
                )}
            </motion.div>

            {/* Background izquierdo (eliminar) */}
            <motion.div
                className="pointer-events-none absolute inset-0 flex items-center justify-end gap-2 px-4 bg-red-500/10"
                style={{ opacity: dismissBgOpacity }}
            >
                <span className="text-xs font-medium text-red-400">Eliminar</span>
                <Trash2 size={14} className="text-red-400" />
            </motion.div>

            {/* Card draggable */}
            <motion.div
                drag="x"
                dragDirectionLock
                dragMomentum={false}
                dragConstraints={{ left: -800, right: 800 }}
                dragElastic={0}
                style={{ x }}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                className={[
                    'group relative flex gap-3 p-3 transition-colors',
                    'bg-background',
                    href ? 'cursor-pointer hover:bg-white/5' : '',
                    isUnread ? 'border-l-2 border-sky-500 pl-2.5' : 'border-l-2 border-transparent pl-2.5',
                    isArchived ? 'opacity-55' : (!isUnread ? 'opacity-70' : ''),
                ].join(' ')}
                onClick={href ? () => void handleClick() : undefined}
                role={href ? 'button' : undefined}
                tabIndex={href ? 0 : undefined}
                onKeyDown={href ? (e) => { if (e.key === 'Enter') void handleClick() } : undefined}
            >
                {/* Dot indicador */}
                {isUnread ? (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
                ) : (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                            {notification.title}
                        </p>

                        {/* Botones de acción (desktop hover) */}
                        <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isArchived ? (
                                <button
                                    type="button"
                                    onClick={handleUnarchive}
                                    className="rounded p-1 text-muted-foreground hover:bg-sky-500/10 hover:text-sky-400 transition-colors"
                                    aria-label="Restaurar notificación"
                                >
                                    <RotateCcw size={13} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleArchive}
                                    className="rounded p-1 text-muted-foreground hover:bg-sky-500/10 hover:text-sky-400 transition-colors"
                                    aria-label="Archivar notificación"
                                >
                                    <Archive size={13} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                aria-label="Eliminar notificación"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
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

                    {/* CTA para pendientes accionables (no en archivadas) */}
                    {isPending && !isArchived && notification.action?.label && href && (
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
            </motion.div>
        </div>
    )
}
