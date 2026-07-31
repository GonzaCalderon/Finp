import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProjectionPeriodCard } from '@/components/projection/ProjectionPeriodCard'
import type { ProjectionPeriod } from '@/types/projection'

const period: ProjectionPeriod = {
    month: '2026-07',
    isCurrentMonth: true,
    isPast: false,
    items: [
        {
            id: 'commitment:rent:2026-07',
            sourceId: 'rent',
            source: { type: 'scheduled_commitment', id: 'rent' },
            kind: 'commitment',
            description: 'Alquiler con una descripcion deliberadamente extensa para validar contenido largo',
            amount: 120_000,
            currency: 'ARS',
            certainty: 'estimated',
            isRegistered: false,
            category: { id: 'home', name: 'Vivienda' },
            account: { id: 'bank', name: 'Cuenta habitual' },
            dueDate: '2026-07-10T12:00:00.000Z',
            link: { href: '/commitments', label: 'Ver Compromisos' },
        },
        {
            id: 'commitment:variable:2026-07',
            sourceId: 'variable',
            source: { type: 'scheduled_commitment', id: 'variable' },
            kind: 'commitment',
            description: 'Servicio variable',
            amount: 0,
            currency: 'USD',
            certainty: 'pending_amount',
            isRegistered: false,
            category: { id: 'home', name: 'Vivienda' },
            link: { href: '/commitments', label: 'Ver Compromisos' },
        },
    ],
    totals: {
        commitments: { ars: 120_000, usd: 0 },
        cardSingle: { ars: 0, usd: 0 },
        cardInstallments: { ars: 0, usd: 0 },
        estimated: { ars: 120_000, usd: 0 },
        total: { ars: 120_000, usd: 0 },
        pendingAmountCount: 1,
    },
}

describe('ProjectionPeriodCard', () => {
    it('expande el detalle con teclado y expone estado accesible', async () => {
        const user = userEvent.setup()
        render(<ProjectionPeriodCard period={period} grouping="type" hidden={false} includeYear />)

        const commitments = screen.getByRole('button', { name: /Compromisos/i })
        expect(commitments).toHaveAttribute('aria-expanded', 'false')
        commitments.focus()
        await user.keyboard('{Enter}')
        expect(commitments).toHaveAttribute('aria-expanded', 'true')

        const category = screen.getByRole('button', { name: /Vivienda/i })
        await user.click(category)
        expect(screen.getByText(/descripcion deliberadamente extensa/)).toBeInTheDocument()
        expect(screen.getByText(/Cuenta habitual/)).toBeInTheDocument()
        expect(screen.getByText('Monto a confirmar')).toBeInTheDocument()
        expect(screen.queryByText('$ 0', { exact: false })).not.toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: /Ver Compromisos/i }).length).toBeGreaterThan(0)
    })

    it('respeta el ocultamiento global tambien en resumen y detalle', async () => {
        const user = userEvent.setup()
        render(<ProjectionPeriodCard period={period} grouping="type" hidden includeYear={false} />)

        await user.click(screen.getByRole('button', { name: /Compromisos/i }))
        await user.click(screen.getByRole('button', { name: /Vivienda/i }))

        expect(screen.getAllByText('••••').length).toBeGreaterThan(1)
        expect(screen.queryByText(/120[.\s]?000/)).not.toBeInTheDocument()
    })
})
