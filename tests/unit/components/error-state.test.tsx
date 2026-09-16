import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WifiOff } from 'lucide-react'

import { ErrorState } from '@/components/shared/ErrorState'

describe('ErrorState', () => {
    it('anuncia el error como alerta y recibe el foco al montarse', async () => {
        render(
            <ErrorState
                icon={WifiOff}
                title="No pudimos cargar tus espacios"
                description="Revisá tu conexión e intentá de nuevo."
            />
        )

        const alert = screen.getByRole('alert')
        expect(alert).toHaveTextContent('No pudimos cargar tus espacios')
        expect(alert).toHaveTextContent('Revisá tu conexión e intentá de nuevo.')
        await waitFor(() => expect(alert).toHaveFocus())
    })

    it('no ofrece reintentar sin onRetry', () => {
        render(<ErrorState icon={WifiOff} title="No pudimos cargar" />)

        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('dispara la recuperación real al reintentar', () => {
        const onRetry = vi.fn()
        render(
            <ErrorState
                icon={WifiOff}
                title="No pudimos cargar"
                onRetry={onRetry}
                retryLabel="Reintentar carga"
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })
})
