export function resolveEntityId(value: unknown): string {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'toString' in value) {
        return value.toString()
    }
    return ''
}
