import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SpaceEntryDialog } from '@/components/spaces/dialogs/SpaceEntryDialog'
import type { ISpaceParticipant } from '@/types'

const apiJsonMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/client/auth-client', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/client/auth-client')>()),
    apiJson: apiJsonMock,
}))

vi.mock('@/hooks/useAccounts', () => ({
    useAccounts: () => ({ accounts: [], loading: false }),
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

Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
})

function participant(): ISpaceParticipant {
    return {
        _id: '507f1f77bcf86cd799439011',
        spaceId: '507f1f77bcf86cd799439012',
        kind: 'member',
        userId: '507f1f77bcf86cd799439013',
        displayName: 'Gonzalo',
        role: 'owner',
        inviteStatus: 'accepted',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as unknown as ISpaceParticipant
}

function renderDialog(onOpenChange = vi.fn()) {
    render(
        <SpaceEntryDialog
            open
            onOpenChange={onOpenChange}
            onSubmit={vi.fn()}
            spaceId="507f1f77bcf86cd799439012"
            participants={[participant()]}
            currentUserId="507f1f77bcf86cd799439013"
            defaultCurrency="ARS"
            reportingCurrency="ARS"
            spaceCurrencies={['ARS', 'USD']}
            defaultSplitMode="equal"
            spaceMode="solo"
            contractVersion={2}
            draftKey="507f1f77bcf86cd799439012"
        />
    )
    return onOpenChange
}

describe('SpaceEntryDialog — borrador elegido al cancelar', () => {
    beforeEach(() => {
        apiJsonMock.mockReset()
        apiJsonMock.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
            if (init?.method === 'PUT') {
                const request = JSON.parse(String(init.body)) as { step: 1 | 2 | 3 | 4; fields: object }
                return Promise.resolve({
                    data: {
                        id: '507f1f77bcf86cd799439014',
                        spaceId: '507f1f77bcf86cd799439012',
                        revision: 1,
                        step: request.step,
                        fields: request.fields,
                        attachments: [],
                        status: 'active',
                    },
                })
            }
            return Promise.resolve({ data: null })
        })
    })

    it('no persiste mientras se edita y ofrece guardar recién al cancelar', async () => {
        const onOpenChange = renderDialog()

        await waitFor(() => expect(apiJsonMock).toHaveBeenCalledTimes(1))
        fireEvent.change(screen.getByRole('textbox', { name: 'Descripción' }), {
            target: { value: 'Cena compartida' },
        })
        fireEvent.click(screen.getByRole('radio', { name: /USD/ }))

        await new Promise((resolve) => window.setTimeout(resolve, 900))
        expect(apiJsonMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        const prompt = await screen.findByRole('alertdialog', {
            name: '¿Querés guardar este movimiento para después?',
        })
        expect(onOpenChange).not.toHaveBeenCalledWith(false)

        fireEvent.click(within(prompt).getByRole('button', { name: 'Guardar borrador' }))
        await waitFor(() => {
            expect(apiJsonMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1)
            expect(onOpenChange).toHaveBeenCalledWith(false)
        })
    })

    it('permite salir sin crear un borrador cuando hay cambios', async () => {
        const onOpenChange = renderDialog()
        await waitFor(() => expect(apiJsonMock).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByRole('textbox', { name: 'Descripción' }), {
            target: { value: 'No conservar' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
        const prompt = await screen.findByRole('alertdialog')
        fireEvent.click(within(prompt).getByRole('button', { name: 'Salir sin guardar' }))

        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
        expect(apiJsonMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)
    })

    it('cierra directamente si no hubo cambios', async () => {
        const onOpenChange = renderDialog()
        await waitFor(() => expect(apiJsonMock).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(apiJsonMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(0)
    })
})
