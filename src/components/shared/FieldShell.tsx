import type { ReactNode } from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type FieldShellProps = {
    children: ReactNode
    id?: string
    label?: ReactNode
    error?: string
    helperText?: ReactNode
    labelAction?: ReactNode
    className?: string
    labelClassName?: string
}

export function FieldShell({
    children,
    id,
    label,
    error,
    helperText,
    labelAction,
    className,
    labelClassName,
}: FieldShellProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label ? (
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={id} className={cn('min-w-0', labelClassName)}>
                        {label}
                    </Label>
                    {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
                </div>
            ) : null}
            {children}
            {helperText ? <div className="text-xs text-muted-foreground">{helperText}</div> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    )
}
