'use client'

import {
    CAPTURE_DRAFT_TTL_MS,
    CAPTURE_DRAFT_VERSION,
    type CaptureDraftEnvelope,
    type CaptureIntent,
    type DraftFieldSource,
} from '@/types/capture-intent'

/**
 * Transporte del borrador entre Captura rápida y el módulo de destino.
 *
 * El sobre vive en `sessionStorage` y sólo el `draftId` viaja en la URL. Los
 * campos llevan datos financieros personales — monto, descripción, comercio — y
 * no deben quedar en la barra de direcciones, el historial del navegador ni en
 * los logs del servidor. Además sobrevive a un refresh, a diferencia de pasarlo
 * por estado de React, y no depende de qué instancia del launcher lo creó.
 */

const KEY_PREFIX = 'finp:capture-draft:'

function storage(): Storage | null {
    if (typeof window === 'undefined') return null
    try {
        return window.sessionStorage
    } catch {
        // Safari en modo privado puede tirar al tocar sessionStorage.
        return null
    }
}

export function buildCaptureDraft<TFields>(input: {
    intent: CaptureIntent
    sessionId: string
    fields: Partial<TFields>
    provenance: Partial<Record<keyof TFields, DraftFieldSource>>
    confidence: number
}): CaptureDraftEnvelope<TFields> {
    const now = Date.now()

    return {
        version: CAPTURE_DRAFT_VERSION,
        draftId:
            typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${now}-${Math.random().toString(36).slice(2)}`,
        intent: input.intent,
        origin: {
            surface: 'quick_capture',
            sessionId: input.sessionId,
            createdAt: new Date(now).toISOString(),
        },
        expiresAt: new Date(now + CAPTURE_DRAFT_TTL_MS).toISOString(),
        fields: input.fields,
        provenance: input.provenance,
        confidence: input.confidence,
    }
}

/** Guarda el sobre y devuelve el id que hay que llevar en la URL. */
export function putCaptureDraft<TFields>(envelope: CaptureDraftEnvelope<TFields>): string {
    const store = storage()
    if (!store) return envelope.draftId

    try {
        store.setItem(KEY_PREFIX + envelope.draftId, JSON.stringify(envelope))
    } catch {
        // Sin espacio o sin permiso: la derivación sigue, el destino abre vacío.
    }

    return envelope.draftId
}

/**
 * Lee y consume el sobre: un borrador se usa una sola vez, así volver atrás no
 * reabre el formulario precargado por sorpresa.
 *
 * Devuelve `null` si no existe, venció, es de otra versión o está corrupto.
 */
export function takeCaptureDraft<TFields>(
    draftId: string | null | undefined
): CaptureDraftEnvelope<TFields> | null {
    if (!draftId) return null

    const store = storage()
    if (!store) return null

    const key = KEY_PREFIX + draftId
    const raw = store.getItem(key)
    if (!raw) return null

    store.removeItem(key)

    try {
        const parsed = JSON.parse(raw) as CaptureDraftEnvelope<TFields>

        if (parsed.version !== CAPTURE_DRAFT_VERSION) return null
        if (!parsed.fields || typeof parsed.fields !== 'object') return null
        if (new Date(parsed.expiresAt).getTime() < Date.now()) return null

        return parsed
    } catch {
        return null
    }
}

/** Limpia sobres vencidos que quedaron sin consumir. */
export function pruneExpiredCaptureDrafts(): void {
    const store = storage()
    if (!store) return

    const now = Date.now()
    const stale: string[] = []

    for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index)
        if (!key?.startsWith(KEY_PREFIX)) continue

        try {
            const parsed = JSON.parse(store.getItem(key) ?? '{}') as { expiresAt?: string }
            if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() < now) stale.push(key)
        } catch {
            stale.push(key)
        }
    }

    stale.forEach((key) => store.removeItem(key))
}
