import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CaptureOrientationCard } from '@/components/shared/CaptureOrientationCard'
import type { FunctionalSuggestion } from '@/types/capture-intent'

function suggestion(
    overrides: Partial<FunctionalSuggestion> = {}
): FunctionalSuggestion {
    return {
        id: 'card_purchase:1:visa',
        intent: 'use_installments',
        subjectKey: 'card_purchase:1:visa',
        title: 'Esto parece una compra con tarjeta.',
        reason: 'Revisá el impacto.',
        evidence: [],
        confidence: 0.97,
        destination: { kind: 'inline' },
        actions: [{ id: 'primary', label: 'Registrar compra' }],
        state: 'shown',
        canPersistDismissal: false,
        card: {
            operation: 'purchase',
            candidateAccountIds: ['visa'],
            accountId: 'visa',
            installmentCount: 1,
            firstClosingMonth: '2026-08',
        },
        ...overrides,
    }
}

describe('CaptureOrientationCard', () => {
    it('no permite salida simple ni descarte persistente para una tarjeta', () => {
        render(
            <CaptureOrientationCard
                suggestion={suggestion()}
                onAction={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Registrar compra' })).toBeTruthy()
        expect(screen.queryByText('Registrar sólo este gasto')).toBeNull()
        expect(screen.queryByText('No volver a sugerir')).toBeNull()
    })

    it('conserva el descarte persistente para recomendaciones aprendidas', () => {
        const onAction = vi.fn()
        render(
            <CaptureOrientationCard
                suggestion={suggestion({
                    intent: 'create_commitment',
                    subjectKey: 'create_commitment|ARS|netflix',
                    canPersistDismissal: true,
                    actions: [
                        { id: 'primary', label: 'Crear compromiso' },
                        { id: 'record_simple', label: 'Registrar sólo este gasto' },
                    ],
                    card: undefined,
                })}
                onAction={onAction}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'No volver a sugerir' }))
        expect(onAction).toHaveBeenCalledWith('never')
    })
})
