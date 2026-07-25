import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CommitmentAmountSchedule } from '@/components/shared/CommitmentAmountSchedule'

vi.mock('@/lib/client/auth-client', () => ({
    apiJson: vi.fn(),
}))

describe('CommitmentAmountSchedule', () => {
    it('muestra el monto vigente y las tres formas de elegir vigencia', () => {
        render(
            <CommitmentAmountSchedule
                commitmentId="commitment-1"
                currency="ARS"
                currentAmount={650_000}
                currentEffectiveFrom={new Date(2026, 0, 1)}
                nextDueDate={new Date(2026, 7, 3)}
                schedule={[]}
            />
        )

        expect(screen.getByText('$ 650.000')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Cambiar monto' }))

        expect(
            screen.getByRole('button', { name: /Desde ahora/ })
        ).toBeVisible()
        expect(
            screen.getByRole('button', { name: /Próximo vencimiento/ })
        ).toBeVisible()
        expect(
            screen.getByRole('button', { name: /Elegir fecha/ })
        ).toBeVisible()
        expect(screen.getByRole('button', { name: 'Guardar cambio' })).toBeVisible()
    })

    it('sólo ofrece quitar cambios futuros', () => {
        const future = new Date()
        future.setDate(future.getDate() + 10)
        const historical = new Date()
        historical.setDate(historical.getDate() - 10)

        render(
            <CommitmentAmountSchedule
                commitmentId="commitment-1"
                currency="ARS"
                currentAmount={100}
                schedule={[
                    {
                        effectiveFrom: historical,
                        amount: 100,
                        source: 'initial',
                        createdAt: historical,
                    },
                    {
                        effectiveFrom: future,
                        amount: 150,
                        source: 'manual',
                        createdAt: new Date(),
                    },
                ]}
            />
        )

        fireEvent.click(
            screen.getByRole('button', { name: /Historial de montos/ })
        )
        expect(screen.getAllByText('Histórico')).toHaveLength(1)
        expect(
            screen.getByRole('button', { name: /Quitar cambio/ })
        ).toBeVisible()
    })
})
