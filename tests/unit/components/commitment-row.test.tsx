import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Types } from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import { CommitmentRow } from '@/components/commitments/CommitmentRow'
import type { IScheduledCommitment } from '@/types'

const commitment: IScheduledCommitment = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    description: 'Alquiler',
    amount: 500_000,
    resolvedAmount: 650_000,
    resolvedAmountEffectiveFrom: new Date(2026, 6, 1),
    currency: 'ARS',
    recurrence: 'monthly',
    dayOfMonth: 5,
    applyMode: 'manual',
    isActive: true,
    lifecycleStatus: 'active',
    reminderLeadDays: 3,
    reminderState: 'due',
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 6, 1),
    startDate: new Date(2026, 0, 1),
    amountPolicy: 'fixed',
    amountSchedule: [
        {
            effectiveFrom: new Date(2026, 0, 1),
            amount: 500_000,
            source: 'initial',
            createdAt: new Date(2026, 0, 1),
        },
        {
            effectiveFrom: new Date(2026, 6, 1),
            amount: 650_000,
            source: 'manual',
            createdAt: new Date(2026, 5, 1),
        },
    ],
    estimationMode: 'template',
    aliases: [],
    createdFrom: 'web',
}

describe('CommitmentRow', () => {
    it('muestra el monto vigente, su fecha y el historial colapsable', async () => {
        const user = userEvent.setup()
        render(
            <CommitmentRow
                commitment={commitment}
                onApply={vi.fn()}
                onEdit={vi.fn()}
                onUpdateAmount={vi.fn()}
                onDeactivate={vi.fn()}
                onReactivate={vi.fn()}
            />
        )

        expect(screen.getByText('Monto vigente')).toBeInTheDocument()
        expect(screen.getByText(/650[.\s]?000/)).toBeInTheDocument()
        expect(screen.getByText(/Vigente desde/)).toBeInTheDocument()
        expect(screen.getByText('Recordatorio activo')).toBeInTheDocument()

        await user.click(
            screen.getByRole('button', { name: /ver historial de montos/i })
        )
        expect(screen.getByText(/500[.\s]?000/)).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /ocultar historial/i })
        ).toHaveAttribute('aria-expanded', 'true')
    })

    it('expone una acción accesible y separada para actualizar el monto', async () => {
        const user = userEvent.setup()
        const onUpdateAmount = vi.fn()
        render(
            <CommitmentRow
                commitment={commitment}
                onApply={vi.fn()}
                onEdit={vi.fn()}
                onUpdateAmount={onUpdateAmount}
                onDeactivate={vi.fn()}
                onReactivate={vi.fn()}
            />
        )

        await user.click(
            screen.getByRole('button', { name: /cambiar monto de alquiler/i })
        )
        expect(onUpdateAmount).toHaveBeenCalledWith(commitment)
    })
})
