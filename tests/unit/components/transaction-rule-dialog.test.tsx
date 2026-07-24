import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Types } from 'mongoose'
import { describe, expect, it, vi } from 'vitest'
import type { ITransactionRule } from '@/types'

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

const { TransactionRuleDialog } = await import(
    '@/components/shared/TransactionRuleDialog'
)

const rule: ITransactionRule = {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    name: 'Café',
    isActive: true,
    priority: 10,
    appliesTo: 'expense',
    field: 'description',
    condition: 'contains',
    value: 'cafe',
    setType: 'income',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
}

describe('TransactionRuleDialog simulation', () => {
    it('simulates without submitting and renders winner and conflicts', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        const onSimulate = vi.fn().mockResolvedValue({
            normalizedSample: { description: 'cafe', merchant: '' },
            candidateMatches: true,
            matchedRules: [
                {
                    id: rule._id.toString(),
                    name: 'Café',
                    priority: 10,
                    isCandidate: true,
                    actions: {
                        result: { type: 'income' },
                        appliedActions: { setType: 'income' },
                        skippedActions: [],
                    },
                },
            ],
            winner: {
                id: rule._id.toString(),
                name: 'Café',
                priority: 10,
                isCandidate: true,
                actions: {
                    result: { type: 'income' },
                    appliedActions: { setType: 'income' },
                    skippedActions: [],
                },
            },
            conflicts: [
                {
                    ruleId: 'other-rule',
                    ruleName: 'Otra regla',
                    kind: 'contradictory_actions',
                    severity: 'warning',
                    priorityRelation: 'candidate_wins',
                    differingActions: ['setType'],
                    message: 'Se superpone con “Otra regla”.',
                },
            ],
        })

        render(
            <TransactionRuleDialog
                open
                onOpenChange={() => undefined}
                rule={rule}
                categories={[]}
                onSubmit={onSubmit}
                onSimulate={onSimulate}
            />
        )

        await user.click(screen.getByRole('tab', { name: /3\. probar/i }))
        const simulateButton = await screen.findByRole('button', {
            name: /probar regla/i,
        })
        await waitFor(() => expect(simulateButton).toBeEnabled())
        await user.click(simulateButton)

        await waitFor(() => expect(onSimulate).toHaveBeenCalledOnce())
        expect(onSubmit).not.toHaveBeenCalled()
        expect(await screen.findByText(/la regla coincide y se aplicaría/i)).toBeInTheDocument()
        expect(screen.getByText(/se superpone con “otra regla”/i)).toBeInTheDocument()
    })

    it('prefills a suggestion and guides the user through the three decisions', async () => {
        const user = userEvent.setup()

        render(
            <TransactionRuleDialog
                open
                onOpenChange={() => undefined}
                rule={null}
                initialValues={{
                    name: 'Farmacity → Salud',
                    appliesTo: 'expense',
                    field: 'merchant',
                    condition: 'equals',
                    value: 'Farmacity',
                    categoryId: '64b000000000000000000001',
                }}
                categories={[
                    {
                        _id: new Types.ObjectId('64b000000000000000000001'),
                        userId: new Types.ObjectId(),
                        name: 'Salud',
                        type: 'expense',
                        color: '#0ea5e9',
                        icon: 'heart',
                        isDefault: false,
                        isArchived: false,
                        sortOrder: 0,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ]}
                onSubmit={vi.fn()}
                onSimulate={vi.fn()}
            />
        )

        expect(screen.getByDisplayValue('Farmacity → Salud')).toBeInTheDocument()
        expect(screen.getByText(/sugerida por finp/i)).toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: /2\. acciones/i }))
        expect(await screen.findByText(/qué completa finp/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Salud' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /probar y activar/i }))
        expect(await screen.findByText(/movimiento de ejemplo/i)).toBeInTheDocument()
    })
})
