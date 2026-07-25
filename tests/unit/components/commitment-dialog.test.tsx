import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommitmentDialog } from '@/components/shared/CommitmentDialog'
import { ApiError } from '@/lib/client/auth-client'

Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
})

vi.mock('@/hooks/useRankedCommitmentCategories', () => ({
    useRankedCommitmentCategories: ({
        categories,
    }: {
        categories: unknown[]
    }) => categories,
}))

describe('CommitmentDialog', () => {
    it('limpia el error de descripción cuando el usuario corrige el campo', async () => {
        render(
            <CommitmentDialog
                open
                onOpenChange={() => undefined}
                commitment={null}
                categories={[]}
                accounts={[]}
                onSubmit={vi.fn()}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        expect(
            await screen.findByText('La descripción es requerida')
        ).toBeVisible()

        fireEvent.change(screen.getByLabelText('Descripción'), {
            target: { value: 'Alquiler' },
        })

        await waitFor(() =>
            expect(
                screen.queryByText('La descripción es requerida')
            ).not.toBeInTheDocument()
        )
    })

    it('vuelve al paso del campo rechazado por el servidor', async () => {
        const onSubmit = vi.fn().mockRejectedValue(
            new ApiError('Datos inválidos', 400, {
                code: 'INVALID_COMMITMENT_DATA',
                details: [
                    {
                        path: ['description'],
                        message: 'La descripción ya no es válida.',
                    },
                ],
            })
        )

        render(
            <CommitmentDialog
                open
                onOpenChange={() => undefined}
                commitment={null}
                categories={[]}
                accounts={[]}
                initialDraft={{
                    version: 1,
                    draftId: 'draft-1',
                    intent: 'create_commitment',
                    origin: {
                        surface: 'commitments',
                        sessionId: 'session-1',
                        createdAt: new Date().toISOString(),
                    },
                    expiresAt: new Date(Date.now() + 60_000).toISOString(),
                    fields: {
                        description: 'Alquiler',
                        amount: 100,
                        currency: 'ARS',
                        recurrence: 'monthly',
                        dayOfMonth: 5,
                        startDate: new Date().toISOString(),
                    },
                    provenance: {},
                    confidence: 1,
                }}
                onSubmit={onSubmit}
            />
        )

        await waitFor(() =>
            expect(screen.getByLabelText('Descripción')).toHaveValue('Alquiler')
        )
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        await screen.findByText(/Paso 2 de 3/)
        fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
        await screen.findByText(/Paso 3 de 3/)
        const dialog = screen.getByRole('dialog')
        const form = dialog.querySelector('form')
        const createButton = screen.getByRole('button', {
            name: 'Crear compromiso',
        })

        expect(dialog).toHaveClass('sm:max-w-4xl', 'overflow-hidden')
        expect(form).toHaveClass('min-h-0', 'flex-1', 'overflow-hidden')
        expect(createButton).toHaveClass('min-h-11', 'w-full')
        expect(createButton.parentElement).toHaveClass('shrink-0')

        fireEvent.click(createButton)

        expect(
            await screen.findByText('La descripción ya no es válida.')
        ).toBeVisible()
        expect(screen.getByText(/Paso 1 de 3/)).toBeVisible()
    })
})
