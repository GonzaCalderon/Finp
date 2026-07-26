'use client'

import type { CaptureIntent } from '@/types/capture-intent'

/**
 * Cierre de métricas de orientación desde el módulo destino.
 *
 * `intent_accepted` lo emite Captura rápida al tocar el CTA; `intent_completed`
 * sólo puede emitirlo el módulo que realmente completó la función. Son estados
 * distintos a propósito: tocar el CTA no equivale a completar la derivación.
 *
 * Captura rápida usa una cola con debounce porque emite muchos eventos por
 * sesión. Un destino emite uno solo al terminar, así que acá alcanza un POST
 * best-effort: si falla se pierde una métrica, nunca una operación financiera.
 *
 * El respeto al interruptor de aprendizaje lo resuelve el servidor, que descarta
 * los eventos cuando el perfil está deshabilitado.
 */

/** Duración máxima que acepta el endpoint de eventos. */
const MAX_DURATION_MS = 86_400_000

export async function reportCaptureIntentCompleted(input: {
    /** Id del sobre consumido: hace determinista al evento. */
    draftId: string
    intent: CaptureIntent
    /** Sesión de la captura que originó la derivación, para correlacionar. */
    sessionId: string
    /** `origin.createdAt` del sobre. */
    startedAt?: string
}): Promise<void> {
    // El `eventId` deriva del borrador y el endpoint inserta sólo si no existe:
    // un reintento, un doble submit o dos pestañas registran la derivación una
    // sola vez.
    const eventId = `intent_completed:${input.intent}:${input.draftId}`.slice(0, 120)

    const startedAtMs = input.startedAt ? new Date(input.startedAt).getTime() : NaN
    const durationMs = Number.isFinite(startedAtMs)
        ? Math.min(Math.max(Date.now() - startedAtMs, 0), MAX_DURATION_MS)
        : undefined

    try {
        await fetch('/api/quick-capture/learning/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                events: [
                    {
                        eventId,
                        sessionId: input.sessionId,
                        type: 'intent_completed',
                        method: 'submit',
                        suggestionId: input.intent,
                        // Sin monto, descripción ni comercio: para el embudo sólo
                        // importa que la derivación terminó.
                        ...(durationMs === undefined ? {} : { durationMs }),
                    },
                ],
            }),
        })
    } catch {
        // Métrica best-effort: no interrumpe al usuario ni bloquea el alta.
    }
}
