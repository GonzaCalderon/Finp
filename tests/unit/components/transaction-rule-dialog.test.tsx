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
})
