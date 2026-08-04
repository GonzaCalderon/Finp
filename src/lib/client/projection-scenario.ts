'use client'

import { projectionScenarioRequestSchema } from '@/lib/validations/projection-scenario'
import type { ProjectionScenarioChange } from '@/types/projection'

export const PROJECTION_SCENARIO_DRAFT_VERSION = 2
export const PROJECTION_SCENARIO_DRAFT_TTL_MS = 24 * 60 * 60 * 1000

type ProjectionScenarioDraftEnvelope = {
    version: typeof PROJECTION_SCENARIO_DRAFT_VERSION
    userId: string
    startedAt: string
    expiresAt: string
    changes: ProjectionScenarioChange[]
}

export type ProjectionScenarioDraftRead = {
    changes: ProjectionScenarioChange[]
    startedAt: string | null
    storageAvailable: boolean
}

const KEY_PREFIX = 'finp:projection-scenario:v2:'
const memoryDrafts = new Map<string, ProjectionScenarioDraftEnvelope>()

function keyFor(userId: string) {
    return `${KEY_PREFIX}${userId}`
}

function sessionStore(): Storage | null {
    if (typeof window === 'undefined') return null
    try {
        const storage = window.sessionStorage
        const probe = `${KEY_PREFIX}probe`
        storage.setItem(probe, '1')
        storage.removeItem(probe)
        return storage
    } catch {
        return null
    }
}

function parseEnvelope(raw: string | null, userId: string): ProjectionScenarioDraftEnvelope | null {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as ProjectionScenarioDraftEnvelope
        if (parsed.version !== PROJECTION_SCENARIO_DRAFT_VERSION || parsed.userId !== userId) return null
        if (Date.parse(parsed.expiresAt) <= Date.now()) return null
        const validated = projectionScenarioRequestSchema.safeParse({
            view: { mode: 'monthly' },
            changes: parsed.changes,
        })
        if (!validated.success) return null
        return { ...parsed, changes: validated.data.changes }
    } catch {
        return null
    }
}

export function loadProjectionScenarioDraft(userId: string): ProjectionScenarioDraftRead {
    const key = keyFor(userId)
    const store = sessionStore()
    const envelope = parseEnvelope(store?.getItem(key) ?? null, userId) ?? memoryDrafts.get(key) ?? null

    if (envelope && Date.parse(envelope.expiresAt) > Date.now()) {
        memoryDrafts.set(key, envelope)
        return {
            changes: envelope.changes,
            startedAt: envelope.startedAt,
            storageAvailable: Boolean(store),
        }
    }

    memoryDrafts.delete(key)
    try {
        store?.removeItem(key)
    } catch {
        // El borrador ya se descartó de memoria; el storage bloqueado no impide continuar.
    }
    return { changes: [], startedAt: null, storageAvailable: Boolean(store) }
}

export function saveProjectionScenarioDraft(input: {
    userId: string
    changes: ProjectionScenarioChange[]
    startedAt: string
}): { storageAvailable: boolean } {
    const startedAtMs = Date.parse(input.startedAt)
    const safeStartedAt = Number.isFinite(startedAtMs) ? startedAtMs : Date.now()
    const envelope: ProjectionScenarioDraftEnvelope = {
        version: PROJECTION_SCENARIO_DRAFT_VERSION,
        userId: input.userId,
        startedAt: new Date(safeStartedAt).toISOString(),
        expiresAt: new Date(safeStartedAt + PROJECTION_SCENARIO_DRAFT_TTL_MS).toISOString(),
        changes: input.changes.slice(0, 50),
    }
    const key = keyFor(input.userId)
    memoryDrafts.set(key, envelope)

    const store = sessionStore()
    if (!store) return { storageAvailable: false }
    try {
        store.setItem(key, JSON.stringify(envelope))
        return { storageAvailable: true }
    } catch {
        return { storageAvailable: false }
    }
}

export function clearProjectionScenarioDraft(userId: string): { storageAvailable: boolean } {
    const key = keyFor(userId)
    memoryDrafts.delete(key)
    const store = sessionStore()
    if (!store) return { storageAvailable: false }
    try {
        store.removeItem(key)
        return { storageAvailable: true }
    } catch {
        return { storageAvailable: false }
    }
}
