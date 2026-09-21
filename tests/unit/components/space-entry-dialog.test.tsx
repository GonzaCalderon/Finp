import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SpaceEntryDialog } from '@/components/spaces/dialogs/SpaceEntryDialog'
import type { ISpaceParticipant } from '@/types'

Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
})

const accounts = [
    { _id: 'acc-1', name: 'Efectivo', type: 'cash', currency: 'ARS', isActive: true },
    { _id: 'acc-2', name: 'Tarjeta', type: 'credit_card', currency: 'ARS', isActive: true },
]

vi.mock('@/hooks/useAccounts', () => ({
    useAccounts: () => ({ accounts, loading: false }),
}))
vi.mock('@/hooks/useCategories', () => ({
    useCategories: () => ({ categories: [] }),
}))
vi.mock('@/hooks/useSpaceCategories', () => ({
    useSpaceCategories: () => ({ categories: [] }),
}))
vi.mock('@/hooks/useToast', () => ({
    useToast: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/hooks/useSpaceEntryDraft', () => ({
    useSpaceEntryDraft: () => ({
        draft: null,
        loading: false,
        saveState: 'idle',
        error: null,
        load: vi.fn().mockResolvedValue(null),
        save: vi.fn().mockResolvedValue(null),
        discard: vi.fn().mockResolvedValue(undefined),
        uploadAttachment: vi.fn().mockResolvedValue(undefined),
        removeAttachment: vi.fn().mockResolvedValue(undefined),
        setDraft: vi.fn(),
    }),
}))

function participant(id: string, displayName: string, userId?: string): ISpaceParticipant {
    return {
        _id: id,
        spaceId: 'space-1',
        kind: 'member',
        userId,
        displayName,
        role: 'member',
        inviteStatus: 'accepted',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as unknown as ISpaceParticipant
}

const participants = [
    participant('p-1', 'Gonzalo', 'user-1'),
    participant('p-2', 'Ana', 'user-2'),
]

function renderDialog(overrides: Record<string, unknown> = {}) {
    return render(
        <SpaceEntryDialog
            open
            onOpenChange={vi.fn()}
            onSubmit={vi.fn()}
            spaceId="space-1"
            participants={participants}
            currentUserId="user-1"
            defaultCurrency="ARS"
            reportingCurrency="ARS"
            spaceCurrencies={['ARS']}
            defaultSplitMode="equal"
            spaceMode="synchronized"
            {...overrides}
        />
    )
}

/** Avanza del paso «Datos» completando lo mínimo que exige la validación. */
function fillDataStep() {
    fireEvent.change(screen.getByRole('textbox', { name: 'Descripción' }), {
        target: { value: 'Almuerzo' },
    })
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '1000' } })
}

describe('SpaceEntryDialog — alta guiada', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('monta sólo el paso actual: los anteriores no quedan ocultos en el DOM', async () => {
        renderDialog()

        expect(screen.getByTestId('space-entry-step-data')).toBeInTheDocument()
        expect(screen.queryByTestId('space-entry-step-extras')).not.toBeInTheDocument()
        // Notas y resumen viven en pasos posteriores: no deben existir todavía.
        expect(screen.queryByLabelText('Notas del movimiento')).not.toBeInTheDocument()
        expect(screen.queryByText('Vista rápida antes de guardar')).not.toBeInTheDocument()

        fillDataStep()
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        // Los campos del paso anterior salen del DOM; antes seguían presentes
        // con `hidden` y quedaban en el orden de lectura y de tabulación.
        expect(await screen.findByTestId('space-entry-step-split')).toBeInTheDocument()
        expect(screen.queryByLabelText('Monto')).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: 'Descripción' })).not.toBeInTheDocument()
        expect(screen.queryByRole('combobox', { name: 'Pagó' })).not.toBeInTheDocument()
    })

    it('el nombre accesible de un control es su label, sin el valor elegido', () => {
        renderDialog()

        // `aria-labelledby="entry-paid-by-label entry-paid-by"` metía el nombre
        // del participante dentro del nombre accesible del combobox.
        expect(screen.getByRole('combobox', { name: 'Pagó' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Descripción' })).toBeInTheDocument()
    })

    it('avanzar con el paso incompleto lleva el foco al primer error', async () => {
        renderDialog()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        const firstError = await screen.findByText('Ingresá un monto mayor a cero.')
        await waitFor(() => expect(firstError).toHaveFocus())
        expect(screen.getByTestId('space-entry-step-data')).toBeInTheDocument()
    })

    it('cambiar de paso anuncia la posición y lleva el foco al encabezado', async () => {
        renderDialog()
        fillDataStep()

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        const heading = await screen.findByRole('heading', { name: 'Quiénes participan' })
        await waitFor(() => expect(heading).toHaveFocus())
        expect(
            within(screen.getByRole('group', { name: 'Pasos del gasto' })).getAllByText(
                'Paso 2 de 4 · Reparto'
            ).length
        ).toBeGreaterThan(0)
    })

    it('un Espacio solo no ofrece un paso de reparto vacío', () => {
        renderDialog({ spaceMode: 'solo' })

        expect(
            within(screen.getByRole('group', { name: 'Pasos del gasto' })).queryByRole('button', {
                name: /Reparto/,
            })
        ).not.toBeInTheDocument()
        expect(screen.getAllByText('Paso 1 de 3 · Datos').length).toBeGreaterThan(0)
    })

    it('las tres formas de impacto personal son excluyentes', async () => {
        renderDialog({ spaceMode: 'solo' })
        fillDataStep()
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        const group = await screen.findByRole('radiogroup', { name: 'Efecto en tu Finp personal' })
        const spaceOnly = within(group).getByRole('radio', { name: 'Sólo en el Espacio' })
        const create = within(group).getByRole('radio', { name: 'Crear en Mi Finp' })
        const link = within(group).getByRole('radio', { name: 'Vincular existente' })

        expect(spaceOnly).toHaveAttribute('aria-checked', 'true')
        expect(screen.queryByRole('combobox', { name: 'Cuenta o tarjeta' })).not.toBeInTheDocument()

        fireEvent.click(create)
        expect(create).toHaveAttribute('aria-checked', 'true')
        expect(spaceOnly).toHaveAttribute('aria-checked', 'false')
        expect(screen.getByRole('combobox', { name: 'Cuenta o tarjeta' })).toBeInTheDocument()

        fireEvent.click(link)
        expect(link).toHaveAttribute('aria-checked', 'true')
        expect(create).toHaveAttribute('aria-checked', 'false')
        // Elegir el vínculo retira la cuenta personal: el servidor nunca acepta
        // las dos a la vez.
        expect(screen.queryByRole('combobox', { name: 'Cuenta o tarjeta' })).not.toBeInTheDocument()
        expect(screen.getByText('Transacción compatible')).toBeInTheDocument()
    })

    it('no deja confirmar una intención que el servidor no podría aceptar', async () => {
        renderDialog({ spaceMode: 'solo' })
        fillDataStep()
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        const group = await screen.findByRole('radiogroup', { name: 'Efecto en tu Finp personal' })
        fireEvent.click(within(group).getByRole('radio', { name: 'Vincular existente' }))
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        expect(
            await screen.findByText('Elegí una transacción compatible o cambiá la opción.')
        ).toBeInTheDocument()
        expect(screen.getByTestId('space-entry-step-extras')).toBeInTheDocument()
    })

    it('muestra cuotas y primera cuota al elegir una tarjeta', async () => {
        renderDialog({ spaceMode: 'solo' })
        fillDataStep()
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

        const group = await screen.findByRole('radiogroup', { name: 'Efecto en tu Finp personal' })
        fireEvent.click(within(group).getByRole('radio', { name: 'Crear en Mi Finp' }))
        fireEvent.click(screen.getByRole('combobox', { name: 'Cuenta o tarjeta' }))
        fireEvent.click(await screen.findByRole('option', { name: /Tarjeta/ }))

        expect(await screen.findByText('Plan de la tarjeta')).toBeInTheDocument()
        expect(screen.getByLabelText('Cuotas')).toHaveValue(1)
        expect(screen.getByText('Primera cuota')).toBeInTheDocument()
        expect(screen.getByText(/1 cuota ×/)).toBeInTheDocument()
    })
})
