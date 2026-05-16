export function normalizeSafeInviteCallbackUrl(value?: string | null) {
    if (!value || typeof value !== 'string') return null
    if (!value.startsWith('/spaces/invite/')) return null
    if (value.startsWith('//')) return null

    try {
        const parsed = new URL(value, 'https://finp.local')
        if (parsed.origin !== 'https://finp.local') return null
        if (!parsed.pathname.startsWith('/spaces/invite/')) return null

        const token = parsed.pathname.split('/').filter(Boolean).at(-1)
        if (!token || token.length < 16) return null

        return `${parsed.pathname}${parsed.search}`
    } catch {
        return null
    }
}

export function isSafeInviteCallbackUrl(value?: string | null) {
    return normalizeSafeInviteCallbackUrl(value) !== null
}
