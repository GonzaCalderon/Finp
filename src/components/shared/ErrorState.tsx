import { useEffect, useRef } from 'react'
import { LucideIcon, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
    icon: LucideIcon
    title: string
    description?: string
    retryLabel?: string
    onRetry?: () => void
}

/**
 * Primitiva compartida para un error de lectura (design.md §10). Espejo de
 * `EmptyState` más recuperación: dice qué no se completó, no afirma ni niega
 * impacto financiero por sí sola —eso lo decide quien la usa vía `description`—
 * y ofrece reintentar cuando hay una acción real para eso. Recibe el foco al
 * montarse para que un lector de pantalla lo anuncie de inmediato.
 */
export function ErrorState({
                                icon: Icon,
                                title,
                                description,
                                retryLabel = 'Reintentar',
                                onRetry,
                            }: ErrorStateProps) {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        containerRef.current?.focus()
    }, [])

    return (
        <div
            ref={containerRef}
            role="alert"
            tabIndex={-1}
            className="flex flex-col items-center justify-center py-16 px-4 text-center outline-none"
        >
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'color-mix(in srgb, var(--destructive) 12%, transparent)' }}
            >
                <Icon size={24} style={{ color: 'var(--destructive)' }} />
            </div>
            <p className="text-sm font-medium mb-1">{title}</p>
            {description && (
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">{description}</p>
            )}
            {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    {retryLabel}
                </Button>
            )}
        </div>
    )
}
