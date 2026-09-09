import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SpaceDraftAttachmentsUploader } from '@/components/spaces/dialogs/SpaceDraftAttachmentsUploader'

describe('SpaceDraftAttachmentsUploader', () => {
    it('expone estado textual, límite y acciones accesibles por fila', async () => {
        const remove = vi.fn().mockResolvedValue(undefined)
        render(<SpaceDraftAttachmentsUploader
            attachments={[
                {
                    id: 'ready-1',
                    fileName: 'ticket.png',
                    mimeType: 'image/png',
                    size: 1200,
                    status: 'ready',
                    createdAt: '2026-09-09T12:00:00.000Z',
                },
                {
                    id: 'failed-1',
                    fileName: 'factura.pdf',
                    mimeType: 'application/pdf',
                    size: 2200,
                    status: 'upload_failed',
                    errorCode: 'UPLOAD_FAILED',
                    createdAt: '2026-09-09T12:00:00.000Z',
                },
            ]}
            onUpload={vi.fn().mockResolvedValue(undefined)}
            onRemove={remove}
        />)

        expect(screen.getByText(/Hasta 5 archivos/)).toBeInTheDocument()
        expect(screen.getByText(/ticket\.png/).parentElement).toHaveTextContent('Listo')
        expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveClass('min-h-11')
        fireEvent.click(screen.getByRole('button', { name: 'Quitar ticket.png' }))
        await waitFor(() => expect(remove).toHaveBeenCalledWith('ready-1'))
    })

    it('informa al formulario cuando una fila bloquea publicación', () => {
        const blocking = vi.fn()
        render(<SpaceDraftAttachmentsUploader
            attachments={[{
                id: 'preparing-1',
                fileName: 'foto.webp',
                mimeType: 'image/webp',
                size: 100,
                status: 'preparing',
                createdAt: '2026-09-09T12:00:00.000Z',
            }]}
            onUpload={vi.fn().mockResolvedValue(undefined)}
            onRemove={vi.fn().mockResolvedValue(undefined)}
            onBlockingChange={blocking}
        />)
        expect(screen.getByText(/Subiendo…/)).toBeInTheDocument()
        expect(screen.getByTestId('space-draft-attachment-blocker')).toBeInTheDocument()
        expect(blocking).toHaveBeenLastCalledWith(true)
    })
})
