import { describe, expect, it } from 'vitest'
import {
    resolveCommitmentOccurrenceForPeriod,
    resolveCommitmentReminderDate,
    resolveDayInMonth,
    resolveNextCommitmentOccurrence,
} from '@/lib/utils/commitment-dates'

describe('commitment-dates', () => {
    it('ajusta los días 29 a 31 al último día real del mes', () => {
        expect(resolveDayInMonth(2026, 1, 31)).toEqual(new Date(2026, 1, 28))
        expect(resolveDayInMonth(2028, 1, 31)).toEqual(new Date(2028, 1, 29))
        expect(resolveDayInMonth(2026, 3, 31)).toEqual(new Date(2026, 3, 30))
    })

    it('busca la primera ocurrencia mensual posterior al inicio', () => {
        const input = {
            recurrence: 'monthly',
            dayOfMonth: 3,
            startDate: new Date(2026, 6, 25),
        }

        expect(
            resolveCommitmentOccurrenceForPeriod(input, '2026-07')
        ).toBeNull()
        expect(
            resolveNextCommitmentOccurrence(input, new Date(2026, 6, 25))
        ).toEqual(new Date(2026, 7, 3))
    })

    it('permite que el recordatorio cruce al mes anterior', () => {
        expect(
            resolveCommitmentReminderDate({
                dueDate: new Date(2026, 7, 3),
                reminderLeadDays: 5,
                startDate: new Date(2026, 6, 25),
            })
        ).toEqual(new Date(2026, 6, 29))
    })

    it('limita el primer recordatorio a la fecha de inicio', () => {
        expect(
            resolveCommitmentReminderDate({
                dueDate: new Date(2026, 7, 3),
                reminderLeadDays: 5,
                startDate: new Date(2026, 6, 31),
            })
        ).toEqual(new Date(2026, 6, 31))
    })
})
