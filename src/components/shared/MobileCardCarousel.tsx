'use client'

import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface MobileCardCarouselProps {
    children: ReactNode
    className?: string
    itemClassName?: string
    hint?: string
    ariaLabel?: string
}

export function MobileCardCarousel({
    children,
    className,
    itemClassName,
    hint = 'Deslizá para ver más',
    ariaLabel = 'Resumen deslizable',
}: MobileCardCarouselProps) {
    const items = useMemo(() => Children.toArray(children), [children])
    const trackRef = useRef<HTMLDivElement>(null)
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        const track = trackRef.current
        if (!track) return

        const updateActiveIndex = () => {
            const itemWidth = track.clientWidth - 52
            if (itemWidth <= 0) return

            const nextIndex = Math.round(track.scrollLeft / (itemWidth + 12))
            setActiveIndex(Math.max(0, Math.min(items.length - 1, nextIndex)))
        }

        updateActiveIndex()
        track.addEventListener('scroll', updateActiveIndex, { passive: true })

        return () => {
            track.removeEventListener('scroll', updateActiveIndex)
        }
    }, [items.length])

    if (items.length === 0) return null

    return (
        <div className={cn('md:hidden space-y-2.5', className)}>
            <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Resumen
                </p>
                {items.length > 1 && (
                    <span className="text-[11px] text-muted-foreground">{hint}</span>
                )}
            </div>

            <div className="relative">
                <div
                    className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6"
                    style={{
                        background:
                            'linear-gradient(90deg, var(--background) 0%, color-mix(in srgb, var(--background) 0%, transparent) 100%)',
                    }}
                />
                <div
                    className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10"
                    style={{
                        background:
                            'linear-gradient(270deg, var(--background) 0%, color-mix(in srgb, var(--background) 0%, transparent) 100%)',
                    }}
                />

                <div
                    ref={trackRef}
                    aria-label={ariaLabel}
                    className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-0.5 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

            {items.length > 1 && (
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
