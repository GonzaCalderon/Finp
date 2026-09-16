import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SpaceEntryStepper } from '@/components/spaces/dialogs/entry-steps/SpaceEntryStepper'
import {
    buildSpaceEntrySteps,
    SPACE_ENTRY_STEP_NUMBER,
    stepIndexFromNumber,
} from '@/components/spaces/dialogs/entry-steps/types'

describe('pasos del alta de un movimiento de Espacio', () => {
    it('un Espacio compartido reparte y un Espacio solo no', () => {
        expect(buildSpaceEntrySteps('synchronized').map((step) => step.id)).toEqual([
            'data',
            'split',
            'extras',
            'review',
        ])
        // Sin este filtro el paso «Reparto» se monta vacío y pide «Continuar»
        // sobre una pantalla en blanco.
        expect(buildSpaceEntrySteps('solo').map((step) => step.id)).toEqual([
            'data',
            'extras',
            'review',
        ])
    })

    it('el número persistido del borrador es canónico y no depende de cuántos pasos haya', () => {
        expect(SPACE_ENTRY_STEP_NUMBER).toEqual({ data: 1, split: 2, extras: 3, review: 4 })

        const shared = buildSpaceEntrySteps('synchronized')
        expect(stepIndexFromNumber(shared, 3)).toBe(2)
        expect(stepIndexFromNumber(shared, 4)).toBe(3)

        const solo = buildSpaceEntrySteps('solo')
        // Un borrador guardado en «Reparto» que ya no tiene ese paso cae en el
        // siguiente disponible, no fuera de rango.
        expect(stepIndexFromNumber(solo, 2)).toBe(1)
        expect(stepIndexFromNumber(solo, 3)).toBe(1)
        expect(stepIndexFromNumber(solo, 9)).toBe(solo.length - 1)
    })
})

describe('SpaceEntryStepper', () => {
    const steps = buildSpaceEntrySteps('synchronized')

    it('mobile resume el progreso en una línea y desktop marca el paso actual', () => {
        render(<SpaceEntryStepper steps={steps} currentIndex={1} onSelectStep={vi.fn()} />)

        const group = screen.getByRole('group', { name: 'Pasos del gasto' })
        expect(group).toBeInTheDocument()
        // `design.md` §9: en mobile el progreso es `Paso N de M · Nombre`, no
        // cuatro columnas reservadas.
        expect(screen.getAllByText('Paso 2 de 4 · Reparto').length).toBeGreaterThan(0)
        expect(screen.getByRole('button', { name: '2. Reparto' })).toHaveAttribute(
            'aria-current',
            'step'
        )
    })

    it('sólo deja volver a un paso ya completado', () => {
        const onSelectStep = vi.fn()
        render(<SpaceEntryStepper steps={steps} currentIndex={2} onSelectStep={onSelectStep} />)

        fireEvent.click(screen.getByRole('button', { name: '1. Datos' }))
        expect(onSelectStep).toHaveBeenCalledWith(0)

        onSelectStep.mockClear()
        fireEvent.click(screen.getByRole('button', { name: '4. Revisión' }))
        expect(onSelectStep).not.toHaveBeenCalled()
    })
})
