import { useEffect, useRef } from 'react'

/**
 * Scrolls to the first visible error message within a scrollable container
 * when a form submit attempt fails.
 *
 * Usage:
 *   const scrollRef = useRef<HTMLDivElement>(null)
 *   useScrollToFirstError(formState.submitCount, Object.keys(errors).length > 0, scrollRef)
 *   <div ref={scrollRef} className="overflow-y-auto ...">
 */
export function useScrollToFirstError(
    submitCount: number,
    hasErrors: boolean,
    scrollRef: { current: HTMLElement | null },
) {
    const prevSubmitCount = useRef(0)

    useEffect(() => {
        if (submitCount === prevSubmitCount.current) return
        prevSubmitCount.current = submitCount

        if (!hasErrors) return

        const container = scrollRef.current
        if (!container) return

        const errorEl = container.querySelector<HTMLElement>('p.text-destructive')
        if (errorEl) {
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [submitCount, hasErrors, scrollRef])
}
