import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description?: string
    actionLabel?: string
    onAction?: () => void
}

export function EmptyState({
                               icon: Icon,
                               title,
                               description,
                               actionLabel,
                               onAction,
                           }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'var(--sky-light)' }}
            >
                <Icon size={24} style={{ color: 'var(--sky)' }} />
            </div>
            <p className="text-sm font-medium mb-1">{title}</p>
            {description && (
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">{description}</p>
            )}
            {actionLabel && onAction && (
                <Button size="sm" onClick={onAction}>
                    {actionLabel}
                </Button>
            )}
        </div>
    )
}