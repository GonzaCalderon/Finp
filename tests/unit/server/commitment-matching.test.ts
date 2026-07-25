import { describe, expect, it } from 'vitest'
import {
    findApplicableCommitments,
    type CommitmentCandidate,
} from '@/lib/server/commitment-matching'

const alquiler: CommitmentCandidate = {
    commitmentId: 'commitment-alquiler',
    description: 'Alquiler',
    normalizedDescription: 'alquiler',
    aliases: ['renta'],
    period: '2026-07',
    currency: 'ARS',
    resolvedAmount: 650_000,
    amountPolicy: 'fixed',
    accountId: 'account-1',
    categoryId: 'category-servicios',
    state: 'ready',
}

const luz: CommitmentCandidate = {
    commitmentId: 'commitment-luz',
    description: 'Luz',
    normalizedDescription: 'luz',
    period: '2026-07',
    currency: 'ARS',
    resolvedAmount: 58_000,
    amountPolicy: 'variable',
    state: 'awaiting_amount',
}

const base = { type: 'expense' as const, currency: 'ARS' as const }

describe('findApplicableCommitments', () => {
    it('acierta por descripción exacta con la máxima confianza', () => {
        const [match] = findApplicableCommitments([alquiler], { ...base, description: 'Alquiler' })

        expect(match.candidate.commitmentId).toBe('commitment-alquiler')
        expect(match.score).toBe(1)
        expect(match.matchedOn).toBe('description')
    })

    it('acierta ignorando tildes y mayúsculas, como el motor de reglas', () => {
        const [match] = findApplicableCommitments([alquiler], { ...base, description: 'ALQUÍLER' })

        expect(match?.matchedOn).toBe('description')
    })

    it('acierta por alias conocido', () => {
        const [match] = findApplicableCommitments([alquiler], { ...base, description: 'renta' })

        expect(match.matchedOn).toBe('alias')
    })

    it('reconoce el compromiso dentro de una frase con verbo', () => {
        const [match] = findApplicableCommitments([alquiler], {
            ...base,
            description: 'pague alquiler',
        })

        expect(match.matchedOn).toBe('partial')
        expect(match.score).toBeLessThan(1)
    })

    it('acierta por comercio', () => {
        const [match] = findApplicableCommitments([alquiler], {
            ...base,
            description: 'transferencia',
            merchant: 'Alquiler',
        })

        expect(match.matchedOn).toBe('merchant')
    })

    it('descarta por moneda distinta', () => {
        expect(
            findApplicableCommitments([alquiler], {
                ...base,
                currency: 'USD',
                description: 'Alquiler',
            })
        ).toEqual([])
    })

    it('un ingreso nunca aplica un compromiso', () => {
        expect(
            findApplicableCommitments([alquiler], {
                ...base,
                type: 'income',
                description: 'Alquiler',
            })
        ).toEqual([])
    })

    it('descarta un compromiso ya registrado en el período', () => {
        expect(
            findApplicableCommitments([{ ...alquiler, state: 'registered' }], {
                ...base,
                description: 'Alquiler',
            })
        ).toEqual([])
    })

    it('descarta un compromiso que el usuario omitió', () => {
        expect(
            findApplicableCommitments([{ ...alquiler, state: 'skipped' }], {
                ...base,
                description: 'Alquiler',
            })
        ).toEqual([])
    })

    it('no confunde una transacción distinta con una aplicación pendiente', () => {
        expect(
            findApplicableCommitments([alquiler, luz], {
                ...base,
                description: 'Cafe con leche',
            })
        ).toEqual([])
    })

    it('incluye los que esperan monto: son los que más necesitan la aplicación', () => {
        const [match] = findApplicableCommitments([luz], { ...base, description: 'Luz' })

        expect(match.candidate.commitmentId).toBe('commitment-luz')
        expect(match.reason).toContain('monto pendiente')
    })

    it('ordena por confianza y respeta el límite', () => {
        const matches = findApplicableCommitments(
            [{ ...luz, description: 'Alquiler cochera', normalizedDescription: 'alquiler cochera' }, alquiler],
            { ...base, description: 'Alquiler' },
            { limit: 1 }
        )

        expect(matches).toHaveLength(1)
        expect(matches[0].candidate.commitmentId).toBe('commitment-alquiler')
    })

    it('tolera candidatos sin normalizedDescription calculando la normalización', () => {
        const [match] = findApplicableCommitments(
            [{ ...alquiler, normalizedDescription: undefined }],
            { ...base, description: 'alquiler' }
        )

        expect(match?.matchedOn).toBe('description')
    })

    it('no propone nada con texto vacío', () => {
        expect(findApplicableCommitments([alquiler], { ...base, description: '' })).toEqual([])
    })

    it('cada propuesta explica por qué aparece', () => {
        const [match] = findApplicableCommitments([alquiler], { ...base, description: 'Alquiler' })

        expect(match.reason).toContain('Alquiler')
        expect(match.reason.length).toBeGreaterThan(20)
    })
})
