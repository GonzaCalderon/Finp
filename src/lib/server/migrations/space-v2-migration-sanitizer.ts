import { createHash } from 'node:crypto'
import type { Document } from 'mongodb'

const TEXT_FIELDS = new Set([
    'name', 'displayName', 'description', 'title', 'notes', 'message', 'merchant',
    'email', 'guestEmail', 'image', 'imageUrl', 'url', 'fileName', 'originalName',
    'counterpartyNameSnapshot', 'memo', 'comment', 'address',
])
const SECRET_FIELDS = new Set([
    'password', 'passwordHash', 'token', 'tokenHash', 'inviteToken', 'resetToken',
    'storageKey', 'credential', 'credentials', 'secret', 'apiKey', 'accessToken',
])

const URL_FIELD = /(url|uri|href|link)$/i
const SECRET_FIELD = /(password|token|secret|credential|apiKey|storageKey)/i

function shortHash(value: unknown) {
    return createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 12)
}

function sanitizeValue(value: unknown, key: string, identity: string): unknown {
    if (SECRET_FIELDS.has(key) || SECRET_FIELD.test(key)) return `disabled-${shortHash(`${identity}:${key}`)}`
    if (URL_FIELD.test(key)) return undefined
    if (TEXT_FIELDS.has(key)) {
        if (key.toLowerCase().includes('email')) return `migration-${shortHash(identity)}@example.invalid`
        if (key === 'url' || key === 'image' || key === 'imageUrl') return undefined
        return `Dato migrado ${shortHash(`${identity}:${key}`)}`
    }
    if (value instanceof Date || value === null || value === undefined) return value
    if (Array.isArray(value)) {
        return value
            .map((item) => sanitizeValue(item, key, identity))
            .filter((item) => item !== undefined)
    }
    if (typeof value === 'object') {
        const maybeObjectId = value as { toHexString?: () => string }
        if (typeof maybeObjectId.toHexString === 'function') return value
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([nestedKey, nestedValue]) => [
                    nestedKey,
                    sanitizeValue(nestedValue, nestedKey, identity),
                ])
                .filter(([, nestedValue]) => nestedValue !== undefined)
        )
    }
    return value
}

/**
 * Preserva importes, monedas, fechas, estados e identificadores. Sólo elimina
 * identidad, texto financiero libre, credenciales, tokens y URLs.
 */
export function sanitizeSpaceMigrationDocument(collection: string, document: Document): Document {
    const identity = `${collection}:${String(document._id ?? '')}`
    return Object.fromEntries(
        Object.entries(document)
            .map(([key, value]) => [key, sanitizeValue(value, key, identity)])
            .filter(([, value]) => value !== undefined)
    )
}
