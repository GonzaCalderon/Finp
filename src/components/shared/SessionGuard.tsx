'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
    installClientFetchAuthInterceptor,
    notifyAuthExpired,
    subscribeToAuthExpired,
} from '@/lib/client/auth-client'

const SESSION_CHECK_MIN_INTERVAL_MS = 20_000

export function SessionGuard() {
    const router = useRouter()
    const pathname = usePathname()
    const lastCheckRef = useRef(0)
    const redirectingRef = useRef(false)

    const redirectToLogin = useCallback(() => {
        if (redirectingRef.current) return

        redirectingRef.current = true
        router.replace('/login?reason=session-expired')
    }, [router])

    const checkSession = useCallback(async () => {
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
            return
        }

        const now = Date.now()
        if (now - lastCheckRef.current < SESSION_CHECK_MIN_INTERVAL_MS) return
        lastCheckRef.current = now

        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-store' },
            })

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    notifyAuthExpired()
                }
                return
            }

            const session = (await response.json()) as { user?: { id?: string } } | null

            if (!session?.user?.id) {
                notifyAuthExpired()
            }
        } catch {
            // avoid forcing logout on transient connectivity issues
        }
    }, [])

    useEffect(() => {
        const removeFetchInterceptor = installClientFetchAuthInterceptor()
        const unsubscribeAuthExpired = subscribeToAuthExpired(() => {
            redirectToLogin()
        })

        const handleFocus = () => {
            void checkSession()
        }

        const handlePageShow = () => {
            void checkSession()
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void checkSession()
            }
        }

        window.addEventListener('focus', handleFocus)
        window.addEventListener('pageshow', handlePageShow)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        void checkSession()

        return () => {
            removeFetchInterceptor()
            unsubscribeAuthExpired()
            window.removeEventListener('focus', handleFocus)
            window.removeEventListener('pageshow', handlePageShow)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [checkSession, redirectToLogin])

    useEffect(() => {
        redirectingRef.current = false
    }, [pathname])

    return null
}
