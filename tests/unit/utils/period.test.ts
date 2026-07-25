import { describe, expect, it } from 'vitest'
import {
    buildMonthOptions,
    getCurrentFinancialPeriod,
    getFinancialMonthRange,
    parseFinancialPeriod,
    shiftFinancialPeriod,
} from '@/lib/utils/period'

describe('getFinancialMonthRange', () => {
    it('con monthStartDay=1 equivale al mes calendario', () => {
        const { start, end } = getFinancialMonthRange(2026, 3, 1)

        expect(start).toEqual(new Date(2026, 2, 1))
        expect(end).toEqual(new Date(2026, 3, 1))
    })

    it('usa monthStartDay=1 por defecto', () => {
        expect(getFinancialMonthRange(2026, 3)).toEqual(getFinancialMonthRange(2026, 3, 1))
    })

    it('con monthStartDay=15 va del 15 de ese mes al 15 del siguiente', () => {
        const { start, end } = getFinancialMonthRange(2026, 3, 15)

        expect(start).toEqual(new Date(2026, 2, 15))
        expect(end).toEqual(new Date(2026, 3, 15))
    })

    it('cruza el fin de año en diciembre', () => {
        const { start, end } = getFinancialMonthRange(2026, 12, 10)

        expect(start).toEqual(new Date(2026, 11, 10))
        expect(end).toEqual(new Date(2027, 0, 10))
    })

    it('el rango es semiabierto: el fin pertenece al período siguiente', () => {
        const marzo = getFinancialMonthRange(2026, 3, 15)
        const abril = getFinancialMonthRange(2026, 4, 15)

        expect(marzo.end).toEqual(abril.start)
        // Una fecha igual al fin no está dentro del período: date >= start && date < end
        expect(marzo.end >= marzo.start && marzo.end < marzo.end).toBe(false)
        expect(abril.start >= abril.start && abril.start < abril.end).toBe(true)
    })
})

describe('getCurrentFinancialPeriod', () => {
    it('con monthStartDay=1 siempre devuelve el mes calendario', () => {
        expect(getCurrentFinancialPeriod(new Date(2026, 6, 1), 1)).toBe('2026-07')
        expect(getCurrentFinancialPeriod(new Date(2026, 6, 24), 1)).toBe('2026-07')
        expect(getCurrentFinancialPeriod(new Date(2026, 6, 31), 1)).toBe('2026-07')
    })

    it('si el día ya alcanzó monthStartDay pertenece al mes en curso', () => {
        expect(getCurrentFinancialPeriod(new Date(2026, 2, 15), 15)).toBe('2026-03')
        expect(getCurrentFinancialPeriod(new Date(2026, 2, 28), 15)).toBe('2026-03')
    })

    it('si el ciclo todavía no arrancó pertenece al período anterior', () => {
        expect(getCurrentFinancialPeriod(new Date(2026, 2, 10), 15)).toBe('2026-02')
        expect(getCurrentFinancialPeriod(new Date(2026, 2, 1), 15)).toBe('2026-02')
    })

    it('retrocede de año cuando enero todavía no arrancó su ciclo', () => {
        expect(getCurrentFinancialPeriod(new Date(2026, 0, 5), 15)).toBe('2025-12')
        expect(getCurrentFinancialPeriod(new Date(2026, 0, 20), 15)).toBe('2026-01')
    })

    it('el período devuelto contiene la fecha consultada', () => {
        const cases: Array<[Date, number]> = [
            [new Date(2026, 2, 10), 15],
            [new Date(2026, 2, 20), 15],
            [new Date(2026, 0, 5), 15],
            [new Date(2026, 6, 24), 1],
            [new Date(2026, 11, 31), 28],
        ]

        for (const [now, monthStartDay] of cases) {
            const period = getCurrentFinancialPeriod(now, monthStartDay)
            const { start, end } = parseFinancialPeriod(period, monthStartDay)

            expect(now >= start, `${now.toISOString()} >= ${start.toISOString()}`).toBe(true)
            expect(now < end, `${now.toISOString()} < ${end.toISOString()}`).toBe(true)
        }
    })
})

describe('parseFinancialPeriod', () => {
    it('devuelve el mismo rango que getFinancialMonthRange', () => {
        expect(parseFinancialPeriod('2026-03', 15)).toEqual(getFinancialMonthRange(2026, 3, 15))
    })

    it('interpreta correctamente meses de un solo dígito con cero a la izquierda', () => {
        const { start } = parseFinancialPeriod('2026-01', 1)
        expect(start).toEqual(new Date(2026, 0, 1))
    })
})

describe('shiftFinancialPeriod', () => {
    it('avanza y retrocede meses', () => {
        expect(shiftFinancialPeriod('2026-03', 1)).toBe('2026-04')
        expect(shiftFinancialPeriod('2026-03', -1)).toBe('2026-02')
        expect(shiftFinancialPeriod('2026-03', 0)).toBe('2026-03')
    })

    it('cruza el fin de año en ambas direcciones', () => {
        expect(shiftFinancialPeriod('2026-12', 1)).toBe('2027-01')
        expect(shiftFinancialPeriod('2026-01', -1)).toBe('2025-12')
        expect(shiftFinancialPeriod('2026-06', -12)).toBe('2025-06')
    })
})

describe('buildMonthOptions', () => {
    it('devuelve pastMonths + futureMonths + 1 opciones, de futuro a pasado', () => {
        const options = buildMonthOptions({ pastMonths: 2, futureMonths: 1, from: new Date(2026, 6, 24) })

        expect(options.map((o) => o.value)).toEqual(['2026-08', '2026-07', '2026-06', '2026-05'])
    })

    it('cruza el fin de año hacia atrás', () => {
        const options = buildMonthOptions({ pastMonths: 2, futureMonths: 0, from: new Date(2026, 0, 15) })

        expect(options.map((o) => o.value)).toEqual(['2026-01', '2025-12', '2025-11'])
    })

    it('etiqueta los meses en español', () => {
        const [option] = buildMonthOptions({ pastMonths: 0, futureMonths: 0, from: new Date(2026, 6, 24) })

        expect(option.value).toBe('2026-07')
        expect(option.label.toLowerCase()).toContain('julio')
    })
})
