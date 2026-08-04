import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    clearProjectionScenarioDraft,
    loadProjectionScenarioDraft,
    PROJECTION_SCENARIO_DRAFT_TTL_MS,
    saveProjectionScenarioDraft,
} from '@/lib/client/projection-scenario'
import type { ProjectionScenarioChange } from '@/types/projection'

const change: ProjectionScenarioChange = {
    id: 'hypothesis',
    type: 'hypothetical',
    description: 'Curso',
    amount: 100,
    currency: 'ARS',
    expense: { type: 'commitment', recurrence: { type: 'once', date: '2026-08-10' } },
}

describe('borrador de escenario en sesión', () => {
    beforeEach(() => {
        window.sessionStorage.clear()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-07-31T18:00:00-03:00'))
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('persiste por usuario, recupera tras una recarga lógica y limpia al descartar', () => {
        const startedAt = new Date().toISOString()
        expect(saveProjectionScenarioDraft({ userId: 'user-1', changes: [change], startedAt })).toEqual({
            storageAvailable: true,
        })
        expect(loadProjectionScenarioDraft('user-1')).toMatchObject({
            changes: [change],
            startedAt,
            storageAvailable: true,
        })
        expect(loadProjectionScenarioDraft('user-2').changes).toEqual([])

        clearProjectionScenarioDraft('user-1')
        expect(loadProjectionScenarioDraft('user-1').changes).toEqual([])
    })

    it('vence a las 24 horas desde el inicio y no extiende la vigencia al guardar', () => {
        const startedAt = new Date().toISOString()
        saveProjectionScenarioDraft({ userId: 'user-ttl', changes: [change], startedAt })
        vi.advanceTimersByTime(PROJECTION_SCENARIO_DRAFT_TTL_MS - 1)
        saveProjectionScenarioDraft({ userId: 'user-ttl', changes: [change], startedAt })
        expect(loadProjectionScenarioDraft('user-ttl').changes).toHaveLength(1)

        vi.advanceTimersByTime(2)
        expect(loadProjectionScenarioDraft('user-ttl').changes).toEqual([])
    })

    it('mantiene el escenario en memoria y avisa cuando sessionStorage está bloqueado', () => {
        const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
        Object.defineProperty(window, 'sessionStorage', {
            configurable: true,
            get() {
                throw new Error('blocked')
            },
        })

        const startedAt = new Date().toISOString()
        expect(saveProjectionScenarioDraft({ userId: 'user-memory', changes: [change], startedAt })).toEqual({
            storageAvailable: false,
        })
        expect(loadProjectionScenarioDraft('user-memory')).toMatchObject({
            changes: [change],
            startedAt,
            storageAvailable: false,
        })

        if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor)
    })
})
