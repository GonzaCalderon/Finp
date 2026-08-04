import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectionScenarioSheet } from '@/components/projection/ProjectionScenarioSheet'
import { buildProjectionTotals } from '@/lib/utils/projection-totals'
import type { ProjectionItem, ProjectionPeriod, ProjectionScenarioChange } from '@/types/projection'

const mocks = vi.hoisted(() => ({ apiJson: vi.fn() }))
vi.mock('@/lib/client/auth-client', () => ({ apiJson: mocks.apiJson }))
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))

const item: ProjectionItem = {
    id: 'commitment:rent:2026-07',
    sourceId: 'rent',
    source: { type: 'scheduled_commitment', id: 'rent' },
    kind: 'commitment',
    description: 'Alquiler con una descripción extensa que sigue siendo editable',
    amount: 120_000,
    currency: 'ARS',
    certainty: 'estimated',
    isRegistered: false,
    link: { href: '/commitments', label: 'Ver Compromisos' },
}
const base: ProjectionPeriod[] = [
    {
        month: '2026-07',
        isCurrentMonth: true,
        isPast: false,
        items: [item],
        totals: buildProjectionTotals([item]),
    },
    {
        month: '2026-08',
        isCurrentMonth: false,
        isPast: false,
        items: [{ ...item, id: 'commitment:rent:2026-08' }],
        totals: buildProjectionTotals([{ ...item, id: 'commitment:rent:2026-08' }]),
    },
]

describe('ProjectionScenarioSheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Element.prototype.scrollIntoView = vi.fn()
        mocks.apiJson.mockImplementation((url: string) => Promise.resolve(
            url === '/api/accounts'
                ? {
                    accounts: [{
                        _id: '720000000000000000000001',
                        name: 'Visa prueba',
                        type: 'credit_card',
                        isActive: true,
                        currency: 'ARS',
                        supportedCurrencies: ['ARS', 'USD'],
                    }],
                }
                : { categories: [] }
        ))
    })

    it('crea un compromiso simulado con los campos compartidos de Finp', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        render(
            <ProjectionScenarioSheet
                open
                onOpenChange={vi.fn()}
                intent={{ kind: 'hypothetical' }}
                changes={[]}
                base={base}
                currentPeriod="2026-07"
                onSave={onSave}
                onRemove={vi.fn()}
                onDiscard={vi.fn()}
            />
        )

        await user.type(screen.getByLabelText('Descripción'), 'Curso semanal')
        await user.type(screen.getByLabelText('Monto por vez'), '2500')
        await user.click(screen.getByRole('button', { name: 'Sumar a la prueba' }))

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            type: 'hypothetical',
            description: 'Curso semanal',
            amount: 2500,
            currency: 'ARS',
            expense: {
                type: 'commitment',
                recurrence: { type: 'once', date: '2026-07-01' },
            },
        }))
    })

    it('simula una compra en cuotas sólo con una tarjeta compatible', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        render(
            <ProjectionScenarioSheet
                open
                onOpenChange={vi.fn()}
                intent={{ kind: 'hypothetical' }}
                changes={[]}
                base={base}
                currentPeriod="2026-07"
                onSave={onSave}
                onRemove={vi.fn()}
                onDiscard={vi.fn()}
            />
        )

        await user.click(screen.getByRole('tab', { name: /TC · cuotas/ }))
        await waitFor(() => expect(mocks.apiJson).toHaveBeenCalledTimes(2))
        await user.type(screen.getByLabelText('Descripción'), 'Notebook')
        await user.type(screen.getByLabelText('Monto total de la compra'), '120000')
        screen.getByLabelText('Tarjeta').focus()
        await user.keyboard('{Enter}{ArrowDown}{Enter}')
        await user.click(screen.getByRole('button', { name: 'Sumar a la prueba' }))

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            type: 'hypothetical',
            description: 'Notebook',
            amount: 120_000,
            currency: 'ARS',
            expense: {
                type: 'card_installment',
                accountId: '720000000000000000000001',
                purchaseDate: '2026-07-01',
                firstClosingMonth: '2026-08',
                installmentCount: 3,
            },
        }))
    })

    it('ajusta un gasto existente y conserva su moneda', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        render(
            <ProjectionScenarioSheet
                open
                onOpenChange={vi.fn()}
                intent={{ kind: 'existing', item, period: '2026-07' }}
                changes={[]}
                base={base}
                currentPeriod="2026-07"
                onSave={onSave}
                onRemove={vi.fn()}
                onDiscard={vi.fn()}
            />
        )

        const amount = screen.getByLabelText('Monto por ocurrencia (ARS)')
        await user.clear(amount)
        await user.type(amount, '135000')
        await user.click(screen.getByRole('button', { name: 'Actualizar la prueba' }))

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            type: 'adjust',
            target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
            scope: 'occurrence',
            amount: 135_000,
        }))
    })

    it('restaura individualmente y confirma antes de descartar todo', async () => {
        const user = userEvent.setup()
        const onRemove = vi.fn()
        const onDiscard = vi.fn()
        const changes: ProjectionScenarioChange[] = [{
            id: 'omit-rent',
            type: 'omit',
            target: { sourceType: 'scheduled_commitment', sourceId: 'rent', period: '2026-07' },
            scope: 'occurrence',
        }]
        render(
            <ProjectionScenarioSheet
                open
                onOpenChange={vi.fn()}
                intent={{ kind: 'changes' }}
                changes={changes}
                base={base}
                currentPeriod="2026-07"
                onSave={vi.fn()}
                onRemove={onRemove}
                onDiscard={onDiscard}
            />
        )

        await user.click(screen.getByRole('button', { name: /Restaurar Alquiler/i }))
        expect(onRemove).toHaveBeenCalledWith('omit-rent')

        await user.click(screen.getByRole('button', { name: 'Descartar todo' }))
        expect(await screen.findByText('¿Descartar todos los gastos simulados?')).toBeInTheDocument()
        expect(onDiscard).not.toHaveBeenCalled()
        await user.click(screen.getByRole('button', { name: 'Descartar simulación' }))
        await waitFor(() => expect(onDiscard).toHaveBeenCalledOnce())
    })
})
