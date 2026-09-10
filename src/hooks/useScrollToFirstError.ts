import { useEffect, useRef } from 'react'

/**
 * Scrolls to the first visible error message within a scrollable container
 * when a form submit attempt fails.
 *
 * Usage:
 *   const scrollRef = useRef<HTMLDivElement>(null)
 *   useScrollToFirstError(formState.submitCount, Object.keys(errors).length > 0, scrollRef)
 *   <div ref={scrollRef} className="overflow-y-auto ...">
 *
 * `focus` además mueve el foco al mensaje, que es lo que exige un diálogo
 * guiado: llevar el foco al primer error y no sólo mostrarlo (design.md §9,
 * espacios.md §11). Los mensajes de error del sistema de formularios ya se
 * renderizan con `tabIndex={-1}` para poder recibirlo.
 */
export function useScrollToFirstError(
    submitCount: number,
    hasErrors: boolean,
    scrollRef: { current: HTMLElement | null },
    options: { focus?: boolean; block?: ScrollLogicalPosition } = {},
) {
    const prevSubmitCount = useRef(0)
    const { focus = false, block = 'nearest' } = options

    useEffect(() => {
        if (submitCount === prevSubmitCount.current) return
        prevSubmitCount.current = submitCount

        if (!hasErrors) return

        const container = scrollRef.current
        if (!container) return

        // El error puede montarse en el mismo commit que incrementa el intento:
        // esperar un frame evita buscarlo antes de que exista.
        const frame = requestAnimationFrame(() => {
            const errorEl = scrollRef.current?.querySelector<HTMLElement>('p.text-destructive')
            if (!errorEl) return
            errorEl.scrollIntoView({ behavior: 'smooth', block })
            if (focus) errorEl.focus()
        })
        return () => cancelAnimationFrame(frame)
    }, [submitCount, hasErrors, scrollRef, focus, block])
}
