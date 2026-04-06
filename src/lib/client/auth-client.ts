'use client'

import { ALL_DATA_TAGS, invalidateData } from '@/lib/client/data-sync'

type AuthExpiredListener = () => void

const authExpiredListeners = new Set<AuthExpiredListener>()

let authExpired = false

function shouldIgnoreAuthStatus(input: RequestInfo | URL) {
    const requestUrl =
        typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.toString()
                : input.url

    try {
        const url = new URL(requestUrl, window.location.origin)
        return url.pathname.startsWith('/api/auth')
    } catch {
        return false
    }
}

export function subscribeToAuthExpired(listener: AuthExpiredListener) {
    authExpiredListeners.add(listener)

    return () => {
        authExpiredListeners.delete(listener)
    }
}

export function notifyAuthExpired() {
    if (authExpired) return

    authExpired = true
    invalidateData(ALL_DATA_TAGS)
    authExpiredListeners.forEach((listener) => {
        listener()
    })
}

export function installClientFetchAuthInterceptor() {
    if (typeof window === 'undefined') return () => {}

    const patchedFetch = window.fetch as typeof window.fetch & {
        __finpAuthPatched?: boolean
        __finpOriginalFetch?: typeof window.fetch
    }

    if (patchedFetch.__finpAuthPatched && patchedFetch.__finpOriginalFetch) {
        return () => {}
    }

    const originalFetch = window.fetch.bind(window)

    const wrappedFetch: typeof window.fetch & {
        __finpAuthPatched?: boolean
        __finpOriginalFetch?: typeof window.fetch
    } = (async (input, init) => {
        const response = await originalFetch(input, init)

        if (
            (response.status === 401 || response.status === 403) &&
            !shouldIgnoreAuthStatus(input)
        ) {
            notifyAuthExpired()
        }

        return response
    }) as typeof window.fetch & {
        __finpAuthPatched?: boolean
        __finpOriginalFetch?: typeof window.fetch
    }

    wrappedFetch.__finpAuthPatched = true
    wrappedFetch.__finpOriginalFetch = originalFetch
    window.fetch = wrappedFetch

    return () => {
        window.fetch = originalFetch
    }
}

export class ApiError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }
}

export async function apiJson<T>(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(input, init)
    const text = await response.text()
    let data = {} as T & { error?: string; message?: string }

    if (text) {
        try {
            data = JSON.parse(text) as T & { error?: string; message?: string }
        } catch {
            data = { message: text } as T & { error?: string; message?: string }
        }
    }

    if (!response.ok) {
        throw new ApiError(
            data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
                ? data.error
                : data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
                    ? data.message
                : 'Error al procesar la solicitud',
            response.status
        )
    }

    return data
}
