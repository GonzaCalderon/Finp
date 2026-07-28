'use client'

import { ALL_DATA_TAGS, invalidateData } from '@/lib/client/data-sync'

type AuthExpiredListener = () => void

const authExpiredListeners = new Set<AuthExpiredListener>()

let authExpired = false

function didRedirectToLogin(response: Response) {
    try {
        const responseUrl = new URL(response.url, window.location.origin)
        return response.redirected && responseUrl.pathname.startsWith('/login')
    } catch {
        return false
    }
}

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

export function resetAuthExpired() {
    authExpired = false
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
            !shouldIgnoreAuthStatus(input) &&
            (
                response.status === 401 ||
                response.status === 403 ||
                didRedirectToLogin(response)
            )
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
    code?: string
    details?: Array<{
        path?: Array<string | number>
        message?: string
        code?: string
    }>

    constructor(
        message: string,
        status: number,
        options?: {
            code?: string
            details?: Array<{
                path?: Array<string | number>
                message?: string
                code?: string
            }>
        }
    ) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.code = options?.code
        this.details = options?.details
    }
}

export async function apiJson<T>(
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<T> {
    const response = await fetch(input, init)

    // Next.js puede convertir una respuesta protegida en una redirección HTML al
    // login. No debe llegar al consumidor tipada como si fuera el JSON esperado.
    if (didRedirectToLogin(response)) {
        notifyAuthExpired()
        throw new ApiError('Tu sesión expiró. Volvé a iniciar sesión.', 401, {
            code: 'AUTH_REQUIRED',
        })
    }

    const text = await response.text()
    let data = {} as T & {
        error?: string
        message?: string
        code?: string
        details?: Array<{
            path?: Array<string | number>
            message?: string
            code?: string
        }>
    }

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
            response.status,
            {
                code:
                    data && typeof data === 'object' && typeof data.code === 'string'
                        ? data.code
                        : undefined,
                details:
                    data && typeof data === 'object' && Array.isArray(data.details)
                        ? data.details
                        : undefined,
            }
        )
    }

    return data
}
