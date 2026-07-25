import { describe, expect, it } from 'vitest'
import { countOccurrencesInPeriod } from '@/lib/server/projection'

const julio = { start: new Date(2026, 6, 1), end: new Date(2026, 7, 1) }

describe('countOccurrencesInPeriod', () => {
    describe('monthly', () => {
        it('cae una vez por período', () => {
            const commitment = { recurrence: 'monthly', startDate: new Date(2026, 0, 1) }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(1)
        })

        it('no cuenta antes de la fecha de inicio', () => {
            const commitment = { recurrence: 'monthly', startDate: new Date(2026, 8, 1) }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(0)
        })

        it('no cuenta después de la fecha de fin', () => {
            const commitment = {
                recurrence: 'monthly',
                startDate: new Date(2026, 0, 1),
                endDate: new Date(2026, 3, 30),
            }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(0)
        })

        it('cuenta el período en el que arranca', () => {
            const commitment = { recurrence: 'monthly', startDate: new Date(2026, 6, 15) }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(1)
        })
    })

    describe('weekly', () => {
        it('cuenta los saltos de 7 días que caen dentro del período', () => {
            // 1/7/2026 y cada 7 días: 1, 8, 15, 22, 29 → 5 en julio.
            const commitment = { recurrence: 'weekly', startDate: new Date(2026, 6, 1) }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(5)
        })

        it('un anclaje distinto puede dar cuatro ocurrencias', () => {
            // 3/7/2026: 3, 10, 17, 24, 31 → 5; pero empezando el 5/6 la cadencia
            // cae 3, 10, 17, 24, 31 igual. Con anclaje el 2/7: 2, 9, 16, 23, 30 → 5.
            // Febrero de 28 días sí da exactamente 4.
            const commitment = { recurrence: 'weekly', startDate: new Date(2026, 1, 2) }
            expect(
                countOccurrencesInPeriod(commitment, new Date(2026, 1, 1), new Date(2026, 2, 1))
            ).toBe(4)
        })

        it('respeta la fecha de fin a mitad del período', () => {
            const commitment = {
                recurrence: 'weekly',
                startDate: new Date(2026, 6, 1),
                endDate: new Date(2026, 6, 16),
            }
            // 1, 8, 15 entran; 22 y 29 quedan afuera.
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(3)
        })

        it('no cuenta nada si arranca después del período', () => {
            const commitment = { recurrence: 'weekly', startDate: new Date(2026, 8, 1) }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(0)
        })
    })

    describe('once', () => {
        it('cuenta sólo en el período que lo contiene', () => {
            const commitment = { recurrence: 'once', startDate: new Date(2026, 6, 10) }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(1)
            expect(
                countOccurrencesInPeriod(commitment, new Date(2026, 7, 1), new Date(2026, 8, 1))
            ).toBe(0)
        })

        it('prefiere dueDate sobre startDate cuando existe', () => {
            const commitment = {
                recurrence: 'once',
                startDate: new Date(2026, 0, 1),
                dueDate: new Date(2026, 6, 20),
            }
            expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(1)
        })
    })

    it('el límite del período es semiabierto', () => {
        // El 1/8 pertenece a agosto, no a julio.
        const commitment = { recurrence: 'once', startDate: new Date(2026, 7, 1) }
        expect(countOccurrencesInPeriod(commitment, julio.start, julio.end)).toBe(0)
    })
})
