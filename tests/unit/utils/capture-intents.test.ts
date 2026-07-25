import { describe, expect, it } from 'vitest'
import {
    detectCaptureIntents,
    detectRecurrenceHint,
    stripRecurrencePhrases,
} from '@/lib/utils/capture-intents'
import type { CommitmentCandidate } from '@/lib/server/commitment-matching'
import type { QuickCaptureDraft } from '@/types/quick-capture'

function draft(overrides: Partial<QuickCaptureDraft> = {}): QuickCaptureDraft {
    return {
        type: 'expense',
        amount: 650_000,
        currency: 'ARS',
        date: new Date(2026, 6, 24),
        description: 'Alquiler',
        ...overrides,
    }
}

const alquilerPendiente: CommitmentCandidate = {
    commitmentId: 'commitment-alquiler',
    description: 'Alquiler',
    normalizedDescription: 'alquiler',
    period: '2026-07',
    currency: 'ARS',
    resolvedAmount: 650_000,
    amountPolicy: 'fixed',
    accountId: 'account-1',
    state: 'ready',
}

describe('detectRecurrenceHint', () => {
    it('reconoce "el 5 de cada mes" con el día', () => {
        expect(detectRecurrenceHint('Alquiler 650000 el 5 de cada mes')).toEqual({
            recurrence: 'monthly',
            dayOfMonth: 5,
            amountPolicy: 'fixed',
        })
    })

    it('reconoce variantes de la frase mensual', () => {
        for (const text of [
            'Netflix todos los meses',
            'Gimnasio por mes',
            'Abono mensual',
            'Seguro mensualmente',
            'Expensas cada mes',
        ]) {
            expect(detectRecurrenceHint(text)?.recurrence, text).toBe('monthly')
        }
    })

    it('reconoce "el día 12 de cada mes"', () => {
        expect(detectRecurrenceHint('Internet el día 12 de cada mes')?.dayOfMonth).toBe(12)
    })

    it('reconoce recurrencia semanal', () => {
        expect(detectRecurrenceHint('Clases cada semana')?.recurrence).toBe('weekly')
        expect(detectRecurrenceHint('Pago semanal')?.recurrence).toBe('weekly')
    })

    it('detecta monto variable', () => {
        expect(detectRecurrenceHint('Luz mensual monto variable')).toEqual({
            recurrence: 'monthly',
            dayOfMonth: undefined,
            amountPolicy: 'variable',
        })
    })

    it('el día del mes desambigua cuando el texto menciona ambas cadencias', () => {
        expect(detectRecurrenceHint('Pago semanal el 5 de cada mes')?.recurrence).toBe('monthly')
    })

    it('descarta un día imposible pero conserva la recurrencia mensual', () => {
        // "de cada mes" sigue siendo una señal válida: se ignora sólo el día.
        expect(detectRecurrenceHint('Algo el 45 de cada mes')).toEqual({
            recurrence: 'monthly',
            dayOfMonth: undefined,
            amountPolicy: 'fixed',
        })
    })

    it('no inventa recurrencia en un gasto común', () => {
        for (const text of ['Café 1500 ayer mp', 'Supermercado 38500 visa', 'Nafta 54000']) {
            expect(detectRecurrenceHint(text), text).toBeNull()
        }
    })

    it('funciona sin tildes y con mayúsculas', () => {
        expect(detectRecurrenceHint('ALQUILER EL 5 DE CADA MES')?.dayOfMonth).toBe(5)
    })
})

describe('stripRecurrencePhrases', () => {
    it('deja sólo la descripción del compromiso', () => {
        expect(stripRecurrencePhrases('Alquiler el 5 de cada mes')).toBe('Alquiler')
        expect(stripRecurrencePhrases('Luz mensual monto variable')).toBe('Luz')
        expect(stripRecurrencePhrases('Clases cada semana')).toBe('Clases')
    })

    it('no toca un texto sin frases de recurrencia', () => {
        expect(stripRecurrencePhrases('Café con leche')).toBe('Café con leche')
    })
})

describe('detectCaptureIntents', () => {
    const currentPeriod = '2026-07'

    it('una intención explícita prepara un compromiso nuevo', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Alquiler 650000 el 5 de cada mes',
            draft: draft(),
            currentPeriod,
        })

        expect(suggestion.intent).toBe('create_commitment')
        expect(suggestion.title).toContain('mensual')
        expect(suggestion.reason).toContain('Alquiler')
        expect(suggestion.reason).toContain('día 5')
        expect(suggestion.destination).toEqual({ kind: 'route', href: '/commitments' })
    })

    it('siempre ofrece registrar el movimiento simple como alternativa', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Alquiler 650000 el 5 de cada mes',
            draft: draft(),
            currentPeriod,
        })

        expect(suggestion.actions.map((a) => a.id)).toEqual(['primary', 'record_simple', 'dismiss'])
    })

    it('sin intención explícita propone aplicar el pendiente', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Pagué alquiler 675000 hoy mp',
            draft: draft({ description: 'Pagué alquiler', amount: 675_000 }),
            commitments: [alquilerPendiente],
            currentPeriod,
        })

        expect(suggestion.intent).toBe('apply_commitment')
        expect(suggestion.destination).toEqual({ kind: 'inline' })
        expect(suggestion.commitment).toMatchObject({
            commitmentId: 'commitment-alquiler',
            period: '2026-07',
            resolvedAmount: 650_000,
        })
    })

    it('una intención explícita gana sobre la evidencia histórica', () => {
        // Hay un pendiente que coincide, pero el texto dice claramente "cada mes".
        const [suggestion] = detectCaptureIntents({
            text: 'Alquiler 650000 el 5 de cada mes',
            draft: draft(),
            commitments: [alquilerPendiente],
            currentPeriod,
        })

        expect(suggestion.intent).toBe('create_commitment')
    })

    it('no propone nada cuando no hay señal ni coincidencia', () => {
        expect(
            detectCaptureIntents({
                text: 'Café 1500 ayer mp',
                draft: draft({ description: 'Café', amount: 1500 }),
                commitments: [alquilerPendiente],
                currentPeriod,
            })
        ).toEqual([])
    })

    it('nunca devuelve más de una propuesta para la misma frase', () => {
        const suggestions = detectCaptureIntents({
            text: 'Alquiler 650000 el 5 de cada mes',
            draft: draft(),
            commitments: [alquilerPendiente],
            currentPeriod,
        })

        expect(suggestions).toHaveLength(1)
    })

    it('respeta un descarte persistente de creación', () => {
        const [first] = detectCaptureIntents({
            text: 'Alquiler 650000 el 5 de cada mes',
            draft: draft(),
            currentPeriod,
        })

        expect(
            detectCaptureIntents({
                text: 'Alquiler 650000 el 5 de cada mes',
                draft: draft(),
                currentPeriod,
                dismissedSubjects: [first.subjectKey],
            })
        ).toEqual([])
    })

    it('respeta un descarte persistente de aplicación', () => {
        const [first] = detectCaptureIntents({
            text: 'Pagué alquiler',
            draft: draft({ description: 'Pagué alquiler' }),
            commitments: [alquilerPendiente],
            currentPeriod,
        })

        expect(
            detectCaptureIntents({
                text: 'Pagué alquiler',
                draft: draft({ description: 'Pagué alquiler' }),
                commitments: [alquilerPendiente],
                currentPeriod,
                dismissedSubjects: [first.subjectKey],
            })
        ).toEqual([])
    })

    it('el subjectKey de una aplicación distingue el período', () => {
        const [julio] = detectCaptureIntents({
            text: 'Alquiler',
            draft: draft(),
            commitments: [alquilerPendiente],
            currentPeriod,
        })
        const [agosto] = detectCaptureIntents({
            text: 'Alquiler',
            draft: draft(),
            commitments: [{ ...alquilerPendiente, period: '2026-08' }],
            currentPeriod: '2026-08',
        })

        // Descartar julio no puede silenciar agosto.
        expect(julio.subjectKey).not.toBe(agosto.subjectKey)
    })

    it('expone campos y procedencia para que el cliente arme el sobre', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Alquiler 650000 el 5 de cada mes',
            draft: draft(),
            currentPeriod,
        })

        expect(suggestion.draftFields).toMatchObject({
            description: 'Alquiler',
            amount: 650_000,
            recurrence: 'monthly',
            dayOfMonth: 5,
            amountPolicy: 'fixed',
        })
        // La moneda no se interpretó del texto: queda marcada como default para
        // que el destino no la anuncie como algo que Finp entendió.
        expect(suggestion.draftProvenance).toMatchObject({
            description: 'text',
            amount: 'text',
            dayOfMonth: 'text',
            currency: 'default',
        })
    })

    it('un monto variable explícito viaja en la propuesta', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Luz mensual monto variable',
            draft: draft({ description: 'Luz mensual monto variable', amount: undefined }),
            currentPeriod,
        })

        expect(suggestion.intent).toBe('create_commitment')
        expect(suggestion.reason).toContain('monto a confirmar')
    })
})
