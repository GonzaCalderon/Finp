import { describe, expect, it } from 'vitest'
import {
    requiresAmountConfirmation,
    resolveCommitmentAmountForPeriod,
    resolveCommitmentDueDate,
} from '@/lib/server/commitment-amounts'

const alquiler = {
    amount: 650_000,
    startDate: new Date(2026, 0, 1),
    dayOfMonth: 5,
}

describe('resolveCommitmentDueDate', () => {
    it('devuelve el día del mes dentro del período calendario', () => {
        expect(resolveCommitmentDueDate('2026-07', 5, 1)).toEqual(new Date(2026, 6, 5))
    })

    it('con monthStartDay=15 elige el mes calendario correcto del período', () => {
        // El período 2026-07 va del 15/07 al 15/08: el día 5 cae en agosto.
        expect(resolveCommitmentDueDate('2026-07', 5, 15)).toEqual(new Date(2026, 7, 5))
        // El día 20 cae en julio, que también está dentro del período.
        expect(resolveCommitmentDueDate('2026-07', 20, 15)).toEqual(new Date(2026, 6, 20))
    })

    it('sin dayOfMonth usa el inicio del período', () => {
        expect(resolveCommitmentDueDate('2026-07', undefined, 1)).toEqual(new Date(2026, 6, 1))
    })

    it('descarta un día que no existe en el mes en vez de desbordar', () => {
        // Febrero no tiene 31: no debe devolver el 3 de marzo.
        const due = resolveCommitmentDueDate('2026-02', 31, 1)
        expect(due).toEqual(new Date(2026, 1, 28))
    })
})

describe('resolveCommitmentAmountForPeriod', () => {
    it('monto fijo sin agenda usa la plantilla y queda como calculado', () => {
        expect(resolveCommitmentAmountForPeriod(alquiler, '2026-07')).toMatchObject({
            amount: 650_000,
            source: 'template',
            certainty: 'calculated',
            effectiveFrom: new Date(2026, 0, 1),
            dueDate: new Date(2026, 6, 5),
        })
    })

    it('una aplicación registrada gana sobre todo lo demás', () => {
        const resolution = resolveCommitmentAmountForPeriod(alquiler, '2026-07', {
            registeredApplication: { snapshot: { amount: 675_000, amountSource: 'manual' } },
        })

        expect(resolution).toMatchObject({
            amount: 675_000,
            source: 'manual',
            certainty: 'confirmed',
            dueDate: new Date(2026, 6, 5),
        })
    })

    it('usa el tramo de la agenda vigente al vencimiento', () => {
        const commitment = {
            ...alquiler,
            amountSchedule: [
                { effectiveFrom: new Date(2026, 0, 1), amount: 500_000 },
                { effectiveFrom: new Date(2026, 3, 1), amount: 575_000 },
                { effectiveFrom: new Date(2026, 6, 1), amount: 650_000 },
            ],
        }

        expect(resolveCommitmentAmountForPeriod(commitment, '2026-02').amount).toBe(500_000)
        expect(resolveCommitmentAmountForPeriod(commitment, '2026-05').amount).toBe(575_000)
        expect(resolveCommitmentAmountForPeriod(commitment, '2026-08').amount).toBe(650_000)
        expect(resolveCommitmentAmountForPeriod(commitment, '2026-08').source).toBe('schedule')
    })

    it('un tramo que arranca después del vencimiento todavía no rige', () => {
        const commitment = {
            ...alquiler,
            // Vencimiento el 5; el aumento entra el 10 del mismo mes.
            amountSchedule: [
                { effectiveFrom: new Date(2026, 0, 1), amount: 500_000 },
                { effectiveFrom: new Date(2026, 6, 10), amount: 650_000 },
            ],
        }

        expect(resolveCommitmentAmountForPeriod(commitment, '2026-07').amount).toBe(500_000)
        expect(resolveCommitmentAmountForPeriod(commitment, '2026-08').amount).toBe(650_000)
    })

    it('un tramo efectivo exactamente el día del vencimiento ya rige', () => {
        const commitment = {
            ...alquiler,
            amountSchedule: [{ effectiveFrom: new Date(2026, 6, 5), amount: 700_000 }],
        }

        expect(resolveCommitmentAmountForPeriod(commitment, '2026-07').amount).toBe(700_000)
    })

    it('ignora tramos con fecha inválida en vez de romper', () => {
        const commitment = {
            ...alquiler,
            amountSchedule: [
                { effectiveFrom: 'no-es-una-fecha', amount: 999 },
                { effectiveFrom: new Date(2026, 0, 1), amount: 500_000 },
            ],
        }

        expect(resolveCommitmentAmountForPeriod(commitment, '2026-07').amount).toBe(500_000)
    })

    describe('monto variable', () => {
        const luz = { amount: 40_000, amountPolicy: 'variable' as const, dayOfMonth: 12 }

        it('con estimationMode=last usa el último monto registrado', () => {
            const resolution = resolveCommitmentAmountForPeriod(
                { ...luz, estimationMode: 'last' },
                '2026-07',
                { recentAmounts: [58_000, 51_000, 47_000] }
            )

            expect(resolution).toMatchObject({
                amount: 58_000,
                source: 'estimated',
                certainty: 'estimated',
            })
        })

        it('con estimationMode=average promedia el historial', () => {
            const resolution = resolveCommitmentAmountForPeriod(
                { ...luz, estimationMode: 'average' },
                '2026-07',
                { recentAmounts: [60_000, 50_000, 40_000] }
            )

            expect(resolution.amount).toBe(50_000)
            expect(resolution.certainty).toBe('estimated')
        })

        it('sin historial cae a la plantilla, pero sigue siendo una estimación', () => {
            const resolution = resolveCommitmentAmountForPeriod(
                { ...luz, estimationMode: 'last' },
                '2026-07',
                { recentAmounts: [] }
            )

            expect(resolution.amount).toBe(40_000)
            expect(resolution.certainty).toBe('estimated')
        })

        it('sin plantilla ni historial queda pendiente de monto real', () => {
            const resolution = resolveCommitmentAmountForPeriod(
                { amount: 0, amountPolicy: 'variable', estimationMode: 'last' },
                '2026-07'
            )

            expect(resolution.certainty).toBe('pending_amount')
            expect(resolution.amount).toBe(0)
        })

        it('una aplicación registrada lo vuelve confirmado', () => {
            const resolution = resolveCommitmentAmountForPeriod(luz, '2026-07', {
                registeredApplication: { snapshot: { amount: 63_400, amountSource: 'manual' } },
            })

            expect(resolution.certainty).toBe('confirmed')
            expect(resolution.amount).toBe(63_400)
        })

        it('la agenda gana sobre la estimación', () => {
            const resolution = resolveCommitmentAmountForPeriod(
                { ...luz, amountSchedule: [{ effectiveFrom: new Date(2026, 0, 1), amount: 55_000 }] },
                '2026-07',
                { recentAmounts: [90_000] }
            )

            expect(resolution).toMatchObject({
                amount: 55_000,
                source: 'schedule',
                certainty: 'calculated',
                effectiveFrom: new Date(2026, 0, 1),
            })
        })
    })
})

describe('requiresAmountConfirmation', () => {
    it('sólo exige confirmar el importe cuando la política es variable', () => {
        expect(requiresAmountConfirmation({ amount: 100, amountPolicy: 'variable' })).toBe(true)
        expect(requiresAmountConfirmation({ amount: 100, amountPolicy: 'fixed' })).toBe(false)
        expect(requiresAmountConfirmation({ amount: 100 })).toBe(false)
    })
})
