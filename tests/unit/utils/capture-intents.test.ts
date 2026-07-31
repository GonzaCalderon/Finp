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

    it('clasifica una compra con tarjeta y no ofrece salida simple ni descarte persistente', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Supermercado 38500 Visa',
            draft: draft({
                amount: 38_500,
                description: 'Supermercado Visa',
            }),
            currentPeriod,
            creditCards: [{
                id: 'visa-galicia',
                name: 'Visa Galicia',
                currencies: ['ARS'],
            }],
        })

        expect(suggestion.intent).toBe('use_installments')
        expect(suggestion.destination).toEqual({ kind: 'inline' })
        expect(suggestion.card).toMatchObject({
            operation: 'purchase',
            accountId: 'visa-galicia',
            installmentCount: 1,
            firstClosingMonth: '2026-08',
        })
        expect(suggestion.actions.map((action) => action.id)).toEqual(['primary'])
        expect(suggestion.canPersistDismissal).toBe(false)
        expect(suggestion.draft).toMatchObject({
            kind: 'card_purchase',
            fields: {
                description: 'Supermercado',
                cardAccountId: 'visa-galicia',
            },
        })
    })

    it('transporta una compra en varias cuotas al flujo completo', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Notebook 120000 Visa en 6 cuotas',
            draft: draft({
                amount: 120_000,
                description: 'Notebook Visa en 6 cuotas',
            }),
            currentPeriod,
            creditCards: [{
                id: 'visa',
                name: 'Visa',
                currencies: ['ARS'],
            }],
        })

        expect(suggestion.destination).toEqual({ kind: 'route', href: '/transactions' })
        expect(suggestion.card?.installmentCount).toBe(6)
        expect(suggestion.draft).toMatchObject({
            kind: 'card_purchase',
            fields: {
                installmentCount: 6,
                description: 'Notebook',
            },
        })
    })

    it('un pago de resumen nunca se convierte en consumo', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Pagué el resumen Visa 50000',
            draft: draft({
                amount: 50_000,
                description: 'Pagué el resumen Visa',
            }),
            currentPeriod,
            creditCards: [{
                id: 'visa',
                name: 'Visa',
                currencies: ['ARS'],
            }],
        })

        expect(suggestion.intent).toBe('record_transaction')
        expect(suggestion.card?.operation).toBe('payment')
        expect(suggestion.draft).toMatchObject({
            kind: 'card_payment',
            fields: {
                type: 'credit_card_payment',
                destinationAccountId: 'visa',
            },
        })
    })

    it('no confunde un gasto pagado con Visa con el pago del resumen', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Pagué supermercado con Visa 50000',
            draft: draft({
                amount: 50_000,
                description: 'Pagué supermercado con Visa',
            }),
            currentPeriod,
            creditCards: [{
                id: 'visa',
                name: 'Visa',
                currencies: ['ARS'],
            }],
        })

        expect(suggestion.card?.operation).toBe('purchase')
    })

    it('pide seleccionar tarjeta ante una referencia genérica o ambigua', () => {
        const generic = detectCaptureIntents({
            text: 'Supermercado 38500 tarjeta',
            draft: draft({ amount: 38_500, description: 'Supermercado tarjeta' }),
            currentPeriod,
            creditCards: [{
                id: 'visa',
                name: 'Visa',
                currencies: ['ARS'],
            }],
        })[0]
        const ambiguous = detectCaptureIntents({
            text: 'Supermercado 38500 Visa',
            draft: draft({ amount: 38_500, description: 'Supermercado Visa' }),
            currentPeriod,
            creditCards: [
                { id: 'visa-1', name: 'Visa Galicia', currencies: ['ARS'] },
                { id: 'visa-2', name: 'Visa BBVA', currencies: ['ARS'] },
            ],
        })[0]

        expect(generic.card?.accountId).toBeUndefined()
        expect(ambiguous.card?.accountId).toBeUndefined()
        expect(ambiguous.card?.candidateAccountIds).toEqual(['visa-1', 'visa-2'])
    })

    it('no ofrece una tarjeta que no soporta la moneda', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Supermercado 100 USD Visa',
            draft: draft({
                amount: 100,
                currency: 'USD',
                description: 'Supermercado Visa',
            }),
            currentPeriod,
            creditCards: [{
                id: 'visa-ars',
                name: 'Visa',
                currencies: ['ARS'],
            }],
        })

        expect(suggestion.card?.accountId).toBeUndefined()
        expect(suggestion.card?.candidateAccountIds).toEqual([])
    })

    it('una cuota indexada abre revisión y no crea otro plan', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Notebook cuota 2 de 6',
            draft: draft({ description: 'Notebook cuota 2 de 6' }),
            currentPeriod,
        })

        expect(suggestion.card?.operation).toBe('existing_installment')
        expect(suggestion.destination).toEqual({
            kind: 'route',
            href: '/transactions/credit-card',
        })
    })

    it('propone el candidato mensual aprendido con la misma clave persistente', () => {
        const [suggestion] = detectCaptureIntents({
            text: 'Netflix 15000',
            draft: draft({ amount: 15_000, description: 'Netflix' }),
            currentPeriod,
            learnedCommitmentCandidates: [{
                subjectKey: 'create_commitment|ARS|netflix',
                description: 'Netflix',
                amount: 15_000,
                currency: 'ARS',
                amountPolicy: 'fixed',
                estimationMode: 'template',
                dayOfMonth: 12,
                categoryId: 'subscriptions',
                accountId: 'account-1',
                occurrences: 4,
                months: ['2026-04', '2026-05', '2026-06', '2026-07'],
                variationPercent: 0,
                confidence: 0.94,
                evidence: ['4 meses'],
            }],
        })

        expect(suggestion.intent).toBe('create_commitment')
        expect(suggestion.subjectKey).toBe('create_commitment|ARS|netflix')
        expect(suggestion.draft).toMatchObject({
            kind: 'commitment',
            fields: {
                recurrence: 'monthly',
                dayOfMonth: 12,
                amount: 15_000,
            },
        })
    })
})
