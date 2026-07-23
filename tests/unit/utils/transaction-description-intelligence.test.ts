import { describe, expect, it } from 'vitest'

import {
    buildDescriptionIntelligence,
    levenshteinDistance,
    normalizeDescriptionDisplay,
    type DescriptionHistoryEntry,
} from '@/lib/utils/transaction-description-intelligence'

function entry(
    transactionId: string,
    description: string,
    overrides: Partial<DescriptionHistoryEntry> = {}
): DescriptionHistoryEntry {
    return {
        transactionId,
        description,
        categoryId: 'food',
        sourceAccountId: 'bank',
        type: 'expense',
        amount: 1000,
        currency: 'ARS',
        occurredAt: '2026-07-20T12:00:00.000Z',
        ...overrides,
    }
}

describe('transaction description intelligence', () => {
    it('detecta errores de pocos caracteres y ofrece una correccion', () => {
        const result = buildDescriptionIntelligence(
            [
                entry('1', 'Supermercado'),
                entry('2', 'Supermercado'),
            ],
            { description: 'Supermeracdo' }
        )

        expect(result.textSuggestion).toMatchObject({
            kind: 'correction',
            value: 'Supermercado',
        })
        expect(levenshteinDistance('supermeracdo', 'supermercado')).toBe(2)
    })

    it('completa una descripcion frecuente desde el historial', () => {
        const result = buildDescriptionIntelligence(
            [entry('1', 'Supermercado semanal')],
            { description: 'Super' }
        )

        expect(result.textSuggestion).toMatchObject({
            kind: 'completion',
            value: 'Supermercado semanal',
        })
    })

    it('puede corregir un alias usando el comercio conocido', () => {
        const result = buildDescriptionIntelligence(
            [entry('1', 'Viaje al trabajo', { merchant: 'Uber' })],
            { description: 'Ubre' }
        )

        expect(result.textSuggestion).toMatchObject({
            kind: 'correction',
            value: 'Uber',
            merchant: 'Uber',
        })
    })

    it('normaliza espacios y capitalizacion sin alterar el contenido', () => {
        expect(normalizeDescriptionDisplay('  supermercado   semanal  ')).toBe('Supermercado semanal')

        const result = buildDescriptionIntelligence([], {
            description: '  supermercado   semanal  ',
        })

        expect(result.textSuggestion).toMatchObject({
            kind: 'normalization',
            value: 'Supermercado semanal',
        })
    })

    it('propone reutilizar categoria, cuenta y moneda de un movimiento parecido', () => {
        const result = buildDescriptionIntelligence(
            [entry('previous', 'Uber a la oficina', {
                categoryId: 'transport',
                sourceAccountId: 'wallet',
                currency: 'USD',
            })],
            { description: 'Uber oficina' }
        )

        expect(result.similarTransaction).toMatchObject({
            transactionId: 'previous',
            categoryId: 'transport',
            sourceAccountId: 'wallet',
            currency: 'USD',
        })
        expect(result.similarTransaction).not.toHaveProperty('amount')
    })

    it('alerta un posible duplicado por texto, monto, moneda y cercania temporal', () => {
        const result = buildDescriptionIntelligence(
            [entry('previous', 'Cena restaurante', {
                amount: 25500,
                occurredAt: '2026-07-22T20:00:00.000Z',
            })],
            {
                description: 'Cena restaurante',
                amount: 25500,
                currency: 'ARS',
                date: '2026-07-23T08:00:00.000Z',
            }
        )

        expect(result.duplicate?.transactionId).toBe('previous')
    })

    it('no alerta duplicado si cambia el monto', () => {
        const result = buildDescriptionIntelligence(
            [entry('previous', 'Cena restaurante', {
                amount: 25500,
                occurredAt: '2026-07-22T20:00:00.000Z',
            })],
            {
                description: 'Cena restaurante',
                amount: 26000,
                currency: 'ARS',
                date: '2026-07-23T08:00:00.000Z',
            }
        )

        expect(result.duplicate).toBeUndefined()
    })

    it('propone una regla solo despues de tres elecciones consistentes', () => {
        const result = buildDescriptionIntelligence(
            [
                entry('1', 'Uber oficina'),
                entry('2', 'Uber regreso'),
                entry('3', 'Uber aeropuerto'),
            ],
            {
                description: 'Uber trabajo',
                categoryId: 'food',
            }
        )

        expect(result.ruleProposal).toMatchObject({
            value: 'Uber',
            categoryId: 'food',
            occurrences: 3,
        })
    })
})
