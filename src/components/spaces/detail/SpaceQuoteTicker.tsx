'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SpaceQuotesDto } from '@/types'

function quoteLabel(source: SpaceQuotesDto['quotes'][number]['source']) {
    if (source === 'dolarapi_official') return 'DolarAPI · oficial'
    if (source === 'frankfurter') return 'Frankfurter'
    if (source === 'manual') return 'Manual'
    return 'Sin conversión'
}

export function SpaceQuoteTicker({
    data,
    loading,
    error,
    onRefresh,
}: {
    data: SpaceQuotesDto | null
    loading: boolean
    error: string | null
    onRefresh: () => void
}) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const [hasOverflow, setHasOverflow] = useState(false)
    const [paused, setPaused] = useState(false)
    const updatedLabel = (() => {
        if (!data?.fetchedAt) return 'sin actualizar'
        return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })
            .format(new Date(data.fetchedAt))
    })()

    useEffect(() => {
        const viewport = viewportRef.current
        const content = contentRef.current
        if (!viewport || !content) return
        const measure = () => setHasOverflow(content.scrollWidth > viewport.clientWidth + 2)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(viewport)
        observer.observe(content)
        return () => observer.disconnect()
    }, [data?.quotes.length])

    if (!data?.quotes.length && !error && !loading) return null

    return (
        <section
            aria-label="Cotizaciones de referencia del espacio"
            className="rounded-2xl border border-foreground/[0.07] bg-card/68 px-3 py-2.5"
        >
            <div className="flex items-center justify-between gap-3">
                <p className="truncate text-xs font-medium text-muted-foreground">
                    Cotizaciones de referencia · actualizado {updatedLabel}
                </p>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Actualizar cotizaciones"
                    disabled={loading}
                    onClick={onRefresh}
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                </Button>
            </div>
            {error ? (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-warning-foreground">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>Referencia no disponible. Podés ingresar una cotización manual.</span>
                </div>
            ) : (
                <div
                    ref={viewportRef}
                    className="mt-1.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onPointerEnter={() => setPaused(true)}
                    onPointerLeave={() => setPaused(false)}
                    onPointerDown={() => setPaused(true)}
                    onFocusCapture={() => setPaused(true)}
                    onBlurCapture={() => setPaused(false)}
                >
                    <div
                        ref={contentRef}
                        className={cn(
                            'flex w-max min-w-full items-center gap-5 whitespace-nowrap pr-5 text-xs motion-reduce:transform-none motion-reduce:animate-none',
                            hasOverflow && 'animate-space-quotes-scroll'
                        )}
                        style={{ animationPlayState: paused ? 'paused' : 'running' }}
                    >
                        {data?.quotes.map((quote) => (
                            <span key={quote.fingerprint} className="inline-flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                    {quote.sourceCurrency}/{quote.targetCurrency}
                                </span>
                                <span className="tabular-nums text-foreground">{quote.rate}</span>
                                <span className={quote.status === 'stale' ? 'text-warning-foreground' : 'text-muted-foreground'}>
                                    {quote.status === 'stale' ? 'desactualizada' : quoteLabel(quote.source)}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    )
}
