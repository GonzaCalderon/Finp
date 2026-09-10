'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { ErrorState } from '@/components/shared/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyAmount } from '@/lib/utils/currency-format'
import type { SpaceLinkCandidateDto } from '@/types'

export type DialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function formatDateInput(value?: Date | string) {
    if (!value) {
        value = new Date()
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function normalizeDialogDate(value?: Date | string | null) {
    if (!value) return undefined
    if (value instanceof Date) return value

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day, 12, 0, 0)
    }

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
    id,
    label,
    hint,
    error,
    children,
}: {
    id?: string
    label: string
    hint?: string
    error?: string
    children: ReactNode
}) {
    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <Label htmlFor={id} id={id ? `${id}-label` : undefined} className="text-sm font-medium text-foreground">
                    {label}
                </Label>
                {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
            </div>
            {children}
            {error ? <p className="text-xs font-medium text-destructive" tabIndex={-1}>{error}</p> : null}
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

/**
 * Lista de candidatos resueltos por el servidor para vincular una
 * transacción personal existente (arquitectura.md §8). Todo lo que aparece
 * acá ya es compatible: `resolve` lo acepta sin volver a evaluar nada. El
 * vacío explica cuántos quedaron afuera y por qué, en vez de leerse como "no
 * tenés transacciones".
 */
export function SpaceLinkCandidateList({
    candidates,
    loading,
    error,
    excludedCount,
    selectedId,
    onSelect,
    onRetry,
}: {
    candidates: SpaceLinkCandidateDto[]
    loading: boolean
    error: string | null
    excludedCount: number
    selectedId?: string
    onSelect: (transactionId: string) => void
    onRetry: () => void
}) {
    if (loading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
            </div>
        )
    }
    if (error) {
        return (
            <ErrorState
                icon={AlertTriangle}
                title="No pudimos buscar tus transacciones"
                description={error}
                onRetry={onRetry}
            />
        )
    }
    if (candidates.length === 0) {
        return (
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm text-muted-foreground">
                <Inbox className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                    {excludedCount > 0
                        ? `No encontramos una transacción compatible entre las revisadas. ${excludedCount} ${excludedCount === 1 ? 'quedó afuera' : 'quedaron afuera'} por monto, cuenta u otro criterio del reparto.`
                        : 'No encontramos ninguna transacción tuya que coincida con este monto y fecha.'}
                </p>
            </div>
        )
    }
    return (
        <div className="space-y-2" role="radiogroup" aria-label="Transacción compatible">
            {candidates.map((candidate) => {
                const active = selectedId === candidate.transactionId
                return (
                    <button
                        key={candidate.transactionId}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onSelect(candidate.transactionId)}
                        className={cn(
                            'flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                            active
                                ? 'border-primary/30 bg-primary/8'
                                : 'border-border bg-background/70 hover:border-foreground/20'
                        )}
                    >
                        <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">{candidate.description}</span>
                            <span className="text-xs text-muted-foreground">
                                {new Date(candidate.date).toLocaleDateString('es-AR')}
                                {candidate.accountName ? ` · ${candidate.accountName}` : ''}
                            </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {formatCurrencyAmount(candidate.amount, candidate.currency)}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
