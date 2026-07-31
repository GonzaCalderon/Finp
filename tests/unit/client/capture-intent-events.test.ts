import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportCaptureIntentCompleted } from '@/lib/client/capture-intent-events'

const input = {
    draftId: 'draft-1',
    intent: 'create_commitment' as const,
    sessionId: 'capture:session-1',
}

function sentEvent(call = 0) {
    const [, init] = fetchMock.mock.calls[call] as [string, RequestInit]
    return JSON.parse(String(init.body)).events[0]
}

const fetchMock = vi.fn()

describe('reportCaptureIntentCompleted', () => {
    beforeEach(() => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('emite intent_completed contra el endpoint de eventos', async () => {
        await reportCaptureIntentCompleted(input)

        expect(fetchMock.mock.calls[0][0]).toBe('/api/quick-capture/learning/events')
        expect(sentEvent()).toMatchObject({
            type: 'intent_completed',
            method: 'submit',
            suggestionId: 'create_commitment',
            sessionId: 'capture:session-1',
        })
    })

    it('deriva el eventId del borrador para registrarlo una sola vez', async () => {
        await reportCaptureIntentCompleted(input)
        await reportCaptureIntentCompleted(input)

        // El endpoint inserta sólo si el eventId no existe: dos envíos, un evento.
        expect(sentEvent(0).eventId).toBe('intent_completed:create_commitment:draft-1')
        expect(sentEvent(1).eventId).toBe(sentEvent(0).eventId)
    })

    it('no envía monto, descripción ni comercio', async () => {
        await reportCaptureIntentCompleted(input)

        expect(Object.keys(sentEvent()).sort()).toEqual([
            'eventId',
            'method',
            'sessionId',
            'suggestionId',
            'type',
        ])
    })

    it('mide la duración de la derivación desde el origen del sobre', async () => {
        await reportCaptureIntentCompleted({
            ...input,
            startedAt: new Date(Date.now() - 5_000).toISOString(),
        })

        expect(sentEvent().durationMs).toBeGreaterThanOrEqual(5_000)
        expect(sentEvent().durationMs).toBeLessThan(60_000)
    })

    it('acota la duración al máximo que acepta el endpoint', async () => {
        await reportCaptureIntentCompleted({
            ...input,
            startedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        })

        // Un borrador abierto durante días no debe invalidar todo el lote.
        expect(sentEvent().durationMs).toBe(86_400_000)
    })

    it('ignora un origen con fecha inválida en vez de mandar NaN', async () => {
        await reportCaptureIntentCompleted({ ...input, startedAt: 'no-es-fecha' })

        expect(sentEvent().durationMs).toBeUndefined()
    })

    it('no propaga un fallo de red: es una métrica, no una operación', async () => {
        fetchMock.mockRejectedValue(new Error('sin conexión'))

        await expect(reportCaptureIntentCompleted(input)).resolves.toBeUndefined()
    })
})
