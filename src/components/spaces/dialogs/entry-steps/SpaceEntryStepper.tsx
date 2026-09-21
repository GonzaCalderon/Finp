'use client'

import { cn } from '@/lib/utils'
import type { SpaceEntryStep } from './types'

/**
 * Stepper del alta guiada.
 *
 * Mobile resume el progreso en una sola línea `Paso N de M · Nombre` más una
 * barra compacta, como pide `design.md` §9: no se reservan columnas sin
 * contenido para representar el stepper en un viewport angosto. Desktop
 * conserva las píldoras navegables hacia atrás.
 *
 * El anuncio del cambio de paso vive en una única región `aria-live`
 * visualmente oculta (`espacios.md` §11); la línea mobile es contenido, no
 * región viva, para no anunciar dos veces lo mismo.
 */
export function SpaceEntryStepper({
    steps,
    currentIndex,
    onSelectStep,
}: {
    steps: SpaceEntryStep[]
    currentIndex: number
    onSelectStep: (index: number) => void
}) {
    const current = steps[currentIndex] ?? steps[0]
    const position = `Paso ${currentIndex + 1} de ${steps.length} · ${current.label}`
    const progress = ((currentIndex + 1) / steps.length) * 100

    return (
        <div role="group" aria-label="Pasos del gasto" className="mt-4">
            <p aria-live="polite" className="sr-only">
                {position}
            </p>

            {/* Mobile: una línea y una barra. */}
            <div className="sm:hidden">
                <p className="text-xs font-medium text-foreground">{position}</p>
                <div aria-hidden="true" className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Desktop: píldoras, navegables sólo hacia un paso ya completado. */}
            <ol
                className="hidden gap-2 sm:grid"
                style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
                {steps.map((step, index) => {
                    const active = index === currentIndex
                    const complete = index < currentIndex
                    return (
                        <li key={step.id}>
                            <button
                                type="button"
                                className={cn(
                                    'min-h-11 w-full rounded-xl border px-2 py-2 text-xs font-medium transition-colors',
                                    active
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : complete
                                            ? 'border-foreground/10 bg-muted/60 text-foreground'
                                            : 'border-foreground/10 text-muted-foreground'
                                )}
                                onClick={() => complete && onSelectStep(index)}
                                aria-current={active ? 'step' : undefined}
                                aria-disabled={!complete && !active ? true : undefined}
                            >
                                {index + 1}. {step.label}
                            </button>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}
