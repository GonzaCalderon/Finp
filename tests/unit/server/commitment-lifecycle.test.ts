import { describe, expect, it } from 'vitest'
import {
    resolveCommitmentLifecycleStatus,
    resolveCommitmentReminder,
} from '@/lib/server/commitment-lifecycle'

const now = new Date(2026, 6, 25, 12)

describe('resolveCommitmentLifecycleStatus', () => {
    it('distingue próximos, vigentes, próximos a terminar, finalizados e inactivos', () => {
        expect(
            resolveCommitmentLifecycleStatus(
                { isActive: true, startDate: new Date(2026, 7, 1) },
                now
            )
        ).toBe('upcoming')
        expect(
            resolveCommitmentLifecycleStatus(
                { isActive: true, startDate: new Date(2026, 0, 1) },
                now
            )
        ).toBe('active')
        expect(
            resolveCommitmentLifecycleStatus(
                {
                    isActive: true,
                    startDate: new Date(2026, 0, 1),
                    endDate: new Date(2026, 7, 1),
                },
                now
            )
        ).toBe('ending_soon')
        expect(
            resolveCommitmentLifecycleStatus(
                {
                    isActive: true,
                    startDate: new Date(2026, 0, 1),
                    endDate: new Date(2026, 6, 24),
                },
                now
            )
        ).toBe('expired')
        expect(
            resolveCommitmentLifecycleStatus(
                { isActive: false, startDate: new Date(2026, 0, 1) },
                now
            )
        ).toBe('inactive')
        expect(
            resolveCommitmentLifecycleStatus(
                {
                    isActive: true,
                    recurrence: 'once',
                    startDate: new Date(2026, 6, 24),
                },
                now
            )
        ).toBe('expired')
    })
})

describe('resolveCommitmentReminder', () => {
    it('activa el recordatorio dentro de la ventana y marca vencidos', () => {
        expect(
            resolveCommitmentReminder({
                dueDate: new Date(2026, 6, 28),
                reminderLeadDays: 3,
                applied: false,
                lifecycleStatus: 'active',
                now,
            })
        ).toEqual({
            reminderDate: new Date(2026, 6, 25),
            reminderState: 'due',
        })

        expect(
            resolveCommitmentReminder({
                dueDate: new Date(2026, 6, 24),
                reminderLeadDays: 3,
                applied: false,
                lifecycleStatus: 'active',
                now,
            }).reminderState
        ).toBe('overdue')
    })

    it('recuerda una ocurrencia próxima cuando entra en la ventana configurada', () => {
        expect(
            resolveCommitmentReminder({
                dueDate: new Date(2026, 6, 28),
                reminderLeadDays: 3,
                applied: false,
                lifecycleStatus: 'upcoming',
                now,
            }).reminderState
        ).toBe('due')
    })

    it('no programa el primer recordatorio antes del inicio', () => {
        const result = resolveCommitmentReminder({
            dueDate: new Date(2026, 7, 3),
            reminderLeadDays: 5,
            applied: false,
            lifecycleStatus: 'upcoming',
            startDate: new Date(2026, 6, 31),
            now: new Date(2026, 6, 31),
        })

        expect(result).toEqual({
            reminderDate: new Date(2026, 6, 31),
            reminderState: 'due',
        })
    })

    it('no recuerda compromisos aplicados, finalizados o sin configuración', () => {
        expect(
            resolveCommitmentReminder({
                dueDate: new Date(2026, 6, 28),
                reminderLeadDays: 3,
                applied: true,
                lifecycleStatus: 'active',
                now,
            })
        ).toEqual({})
        expect(
            resolveCommitmentReminder({
                dueDate: new Date(2026, 6, 28),
                reminderLeadDays: 3,
                applied: false,
                lifecycleStatus: 'expired',
                now,
            })
        ).toEqual({})
        expect(
            resolveCommitmentReminder({
                dueDate: new Date(2026, 6, 28),
                applied: false,
                lifecycleStatus: 'active',
                now,
            })
        ).toEqual({})
    })
})
