'use client'

import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileCardCarouselProps {
    children: ReactNode
    className?: string
    itemClassName?: string
    viewportClassName?: string
    hint?: string
    ariaLabel?: string
    showHeader?: boolean
    showIndicators?: boolean
    overlayHint?: boolean
    showEdgeFade?: boolean
    onActiveIndexChange?: (index: number) => void
}

export function MobileCardCarousel({
    children,
    className,
    itemClassName,
    viewportClassName,
    hint = 'Deslizá para ver más',
    ariaLabel = 'Resumen deslizable',
    showHeader = true,
    showIndicators = true,
    overlayHint = false,
    showEdgeFade = true,
    onActiveIndexChange,
}: MobileCardCarouselProps) {
    const items = useMemo(() => Children.toArray(children), [children])
    const trackRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    const canScrollPrev = activeIndex > 0
    const canScrollNext = activeIndex < items.length - 1

    const scrollToIndex = (index: number) => {
        const track = trackRef.current
        if (!track) return

        const item = track.children[index] as HTMLElement | undefined
        if (!item) return

        track.scrollTo({
            left: item.offsetLeft,
            behavior: 'smooth',
        })
    }

    useEffect(() => {
        const track = trackRef.current
        if (!track) return

        const updateActiveIndex = () => {
            const nextIndex = Array.from(track.children).reduce((closestIndex, child, index) => {
                const element = child as HTMLElement
                const currentDistance = Math.abs(track.scrollLeft - element.offsetLeft)
                const closestElement = track.children[closestIndex] as HTMLElement | undefined
                const closestDistance = closestElement
                    ? Math.abs(track.scrollLeft - closestElement.offsetLeft)
                    : Number.POSITIVE_INFINITY

                return currentDistance < closestDistance ? index : closestIndex
            }, 0)

            setActiveIndex(Math.max(0, Math.min(items.length - 1, nextIndex)))
        }

        updateActiveIndex()
        track.addEventListener('scroll', updateActiveIndex, { passive: true })

        return () => {
            track.removeEventListener('scroll', updateActiveIndex)
        }
    }, [items.length])

    useEffect(() => {
        onActiveIndexChange?.(activeIndex)
    }, [activeIndex, onActiveIndexChange])

    if (items.length === 0) return null

    return (
        <div className={cn('md:hidden space-y-2.5', className)}>
            {showHeader && (
                <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Resumen
                    </p>
                    {items.length > 1 && (
                        <span className="text-[11px] text-muted-foreground">{hint}</span>
                    )}
                </div>
            )}

            <div className="relative">
                {showEdgeFade && canScrollPrev && (
                    <div
                        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5"
                        style={{
                            background:
                                'linear-gradient(90deg, color-mix(in srgb, var(--background) 72%, transparent) 0%, transparent 100%)',
                        }}
                    />
                )}
                {showEdgeFade && canScrollNext && (
                    <div
                        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5"
                        style={{
                            background:
                                'linear-gradient(270deg, color-mix(in srgb, var(--background) 72%, transparent) 0%, transparent 100%)',
                        }}
                    />
                )}
                {overlayHint && items.length > 1 && (
                    <button
                        type="button"
                        onClick={() => scrollToIndex(canScrollNext ? activeIndex + 1 : activeIndex - 1)}
                        aria-label={canScrollNext ? 'Ver siguiente bloque' : 'Ver bloque anterior'}
                        className={cn(
                            'absolute inset-y-0 z-20 flex items-center px-1.5 transition-opacity',
                            canScrollNext ? 'right-1' : 'left-1'
                        )}
                        style={{
                            color: 'var(--muted-foreground)',
                            opacity: 0.42,
                        }}
                    >
                        <ChevronRight
                            className="h-4 w-4"
                            style={{
                                transform: canScrollNext ? 'rotate(0deg)' : 'rotate(180deg)',
                            }}
                        />
                    </button>
                )}

                <div
                    ref={trackRef}
                    aria-label={ariaLabel}
                    className={cn(
                        'flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-0.5 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                        viewportClassName
                    )}
                >
                    {items.map((item, index) => (
                        <div
                            key={index}
                            className={cn(
                                'min-w-0 shrink-0 snap-start basis-[calc(100%-3.25rem)]',
                                itemClassName
                            )}
                        >
                            {item}
                        </div>
                    ))}
                </div>
            </div>

            {showIndicators && items.length > 1 && (
                <div className="flex items-center justify-center gap-1.5">
                    {items.map((_, index) => (
                        <motion.span
                            key={index}
                            animate={{
                                width: activeIndex === index ? 18 : 6,
                                opacity: activeIndex === index ? 1 : 0.45,
                            }}
                            transition={{ duration: 0.18 }}
                            className="h-1.5 rounded-full"
                            style={{ background: 'var(--sky)' }}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
