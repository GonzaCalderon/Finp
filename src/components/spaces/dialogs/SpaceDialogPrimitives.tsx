'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export type DialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function formatDateInput(value?: Date | string) {
    if (!value) {
        return new Date().toISOString().slice(0, 10)
    }

    return new Date(value).toISOString().slice(0, 10)
}

export function normalizeDialogDate(value?: Date | string | null) {
    if (!value) return undefined
    if (value instanceof Date) return value

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function SpaceDialogSectionEyebrow({ children }: { children: ReactNode }) {
    return (
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {children}
        </p>
    )
}

export function SpaceDialogField({
    label,
    hint,
    error,
    children,
}: {
    label: string
    hint?: string
    error?: string
    children: ReactNode
}) {
    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">{label}</Label>
                {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
            </div>
            {children}
            {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        </div>
    )
}

export function SpaceDialogPanel({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                'rounded-[24px] border border-foreground/[0.07] bg-card/72 p-4 shadow-sm backdrop-blur-sm',
                className
            )}
        >
            {children}
        </div>
    )
}

export function SpaceDialogTextArea({
    className,
    ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className={cn(
                'min-h-[110px] w-full rounded-[16px] border border-border bg-background px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
                className
            )}
        />
    )
}

export function SpaceDialogChoice({
    active,
    onClick,
    children,
    disabled = false,
    className,
}: {
    active: boolean
    onClick: () => void
    children: ReactNode
    disabled?: boolean
    className?: string
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'rounded-full border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color,box-shadow] disabled:cursor-not-allowed disabled:opacity-45',
                active
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                className
            )}
        >
            {children}
        </button>
    )
}
