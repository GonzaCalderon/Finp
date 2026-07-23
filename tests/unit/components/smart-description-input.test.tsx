import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SmartDescriptionInput } from '@/components/shared/transaction-dialog/SmartDescriptionInput'

describe('SmartDescriptionInput', () => {
    const baseProps = {
        id: 'description',
        value: 'Supermeracdo',
        placeholder: 'Ej: Supermercado',
        onChange: vi.fn(),
        onAcceptSuggestion: vi.fn(),
        onApplySimilarTransaction: vi.fn(),
    }

    it('permite aceptar la correccion con un click', () => {
        const onAcceptSuggestion = vi.fn()
        const suggestion = {
            kind: 'correction' as const,
            value: 'Supermercado',
            confidence: 0.95,
            reason: 'Se parece a una descripcion anterior.',
        }

        render(
            <SmartDescriptionInput
                {...baseProps}
                textSuggestion={suggestion}
                onAcceptSuggestion={onAcceptSuggestion}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /quisiste decir/i }))
        expect(onAcceptSuggestion).toHaveBeenCalledWith(suggestion)
    })

    it('permite reutilizar los datos de un movimiento parecido', () => {
        const onApplySimilarTransaction = vi.fn()
        const similar = {
            transactionId: 'tx-1',
            description: 'Supermercado semanal',
            categoryId: 'food',
            sourceAccountId: 'bank',
            currency: 'ARS' as const,
            occurredAt: '2026-07-20T12:00:00.000Z',
            reason: 'Movimiento parecido.',
        }

        render(
            <SmartDescriptionInput
                {...baseProps}
                similarTransaction={similar}
                onApplySimilarTransaction={onApplySimilarTransaction}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: /usar datos/i }))
        expect(onApplySimilarTransaction).toHaveBeenCalledWith(similar)
    })

    it('prioriza la alerta de duplicado sobre la sugerencia de copiar', () => {
        render(
            <SmartDescriptionInput
                {...baseProps}
                duplicate={{
                    transactionId: 'tx-1',
                    description: 'Supermercado',
                    amount: 1000,
                    currency: 'ARS',
                    occurredAt: '2026-07-23T12:00:00.000Z',
                }}
                similarTransaction={{
                    transactionId: 'tx-1',
                    description: 'Supermercado',
                    currency: 'ARS',
                    occurredAt: '2026-07-23T12:00:00.000Z',
                    reason: 'Movimiento parecido.',
                }}
            />
        )

        expect(screen.getByText(/posible movimiento duplicado/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /usar datos/i })).not.toBeInTheDocument()
    })
})
