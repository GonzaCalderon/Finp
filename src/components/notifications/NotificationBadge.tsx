'use client'

interface NotificationBadgeProps {
    count: number
    className?: string
}

export function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
    if (count <= 0) return null

    return (
        <span
            className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white ${className}`}
        >
            {count > 9 ? '9+' : count}
        </span>
    )
}
