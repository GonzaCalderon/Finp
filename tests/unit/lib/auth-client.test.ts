import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    apiJson,
    resetAuthExpired,
    subscribeToAuthExpired,
} from '@/lib/client/auth-client'

afterEach(() => {
    resetAuthExpired()
    vi.unstubAllGlobals()
})

describe('apiJson', () => {
    it('rechaza como sesión expirada una redirección HTML al login', async () => {
        const response = new Response('<html>login</html>', { status: 200 })
        Object.defineProperties(response, {
            redirected: { value: true },
            url: {
                value: 'http://localhost/login?callbackUrl=%2Fdashboard',
            },
        })
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

        const listener = vi.fn()
        const unsubscribe = subscribeToAuthExpired(listener)

        await expect(apiJson('/api/dashboard')).rejects.toMatchObject({
            name: 'ApiError',
            status: 401,
            code: 'AUTH_REQUIRED',
        })
        expect(listener).toHaveBeenCalledOnce()

        unsubscribe()
    })

    it('mantiene una respuesta JSON exitosa', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ value: 42 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            )
        )

        await expect(apiJson<{ value: number }>('/api/example')).resolves.toEqual({
            value: 42,
        })
    })
})
