import { createHash } from 'node:crypto'

function canonicalize(value: unknown): unknown {
    if (value === null || value === undefined) return value
    if (value instanceof Date) return value.toISOString()
    if (typeof value === 'bigint') return value.toString()
    if (Array.isArray(value)) return value.map(canonicalize)
    if (typeof value === 'object') {
        const object = value as Record<string, unknown> & { toHexString?: () => string }
        if (typeof object.toHexString === 'function') return object.toHexString()
        return Object.fromEntries(
            Object.keys(object)
                .sort()
                .map((key) => [key, canonicalize(object[key])])
        )
    }
    return value
}

export function stableMigrationJson(value: unknown) {
    return JSON.stringify(canonicalize(value))
}

export function migrationFingerprint(value: unknown) {
    return createHash('sha256').update(stableMigrationJson(value)).digest('hex')
}

export function combineMigrationFingerprints(fingerprints: string[]) {
    return migrationFingerprint([...fingerprints].sort())
}
