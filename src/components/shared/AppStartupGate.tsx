'use client'

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { StartupSplash } from '@/components/shared/StartupSplash'

const STARTUP_PENDING_KEY = 'finp-startup-pending'
const STARTUP_MIN_DURATION_MS = 650
const STARTUP_MAX_DURATION_MS = 12000

type AppStartupContextValue = {
    isActive: boolean
    markReady: () => void
}

const AppStartupContext = createContext<AppStartupContextValue | undefined>(undefined)

export function markAppStartupPending() {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(STARTUP_PENDING_KEY, '1')
}

function clearTimer(timerRef: MutableRefObject<number | null>) {
    if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
    }
}

export function AppStartupGate({ children }: { children: ReactNode }) {
    const [isActive, setIsActive] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.sessionStorage.getItem(STARTUP_PENDING_KEY) === '1'
    })
    const [isBlocking, setIsBlocking] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.sessionStorage.getItem(STARTUP_PENDING_KEY) === '1'
    })
    const startedAtRef = useRef<number | null>(null)
    const deferredReleaseTimerRef = useRef<number | null>(null)
    const fallbackTimerRef = useRef<number | null>(null)
    const releaseTimerRef = useRef<number | null>(null)
    const releasedRef = useRef(false)
    const readyRequestedRef = useRef(false)
    const appShellRef = useRef<HTMLDivElement | null>(null)

    const release = useCallback(() => {
        if (releasedRef.current) return

        if (startedAtRef.current === null) {
            readyRequestedRef.current = true
            return
        }

        const startedAt = startedAtRef.current

        releasedRef.current = true
        setIsBlocking(false)
        clearTimer(fallbackTimerRef)

        const elapsed = Date.now() - startedAt
        const remaining = Math.max(STARTUP_MIN_DURATION_MS - elapsed, 0)

        clearTimer(releaseTimerRef)
        releaseTimerRef.current = window.setTimeout(() => {
            setIsActive(false)
            startedAtRef.current = null
            releaseTimerRef.current = null
        }, remaining)
    }, [])

    useEffect(() => {
        if (!isActive || typeof window === 'undefined') return

        window.sessionStorage.removeItem(STARTUP_PENDING_KEY)
        startedAtRef.current = Date.now()
        releasedRef.current = false

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        if (readyRequestedRef.current) {
            readyRequestedRef.current = false
            deferredReleaseTimerRef.current = window.setTimeout(() => {
                deferredReleaseTimerRef.current = null
                release()
            }, 0)
            return () => {
                document.body.style.overflow = previousOverflow
                clearTimer(deferredReleaseTimerRef)
                clearTimer(fallbackTimerRef)
                clearTimer(releaseTimerRef)
            }
        }

        fallbackTimerRef.current = window.setTimeout(() => {
            release()
        }, STARTUP_MAX_DURATION_MS)

        return () => {
            document.body.style.overflow = previousOverflow
            clearTimer(deferredReleaseTimerRef)
            clearTimer(fallbackTimerRef)
            clearTimer(releaseTimerRef)
        }
    }, [isActive, release])

    useEffect(() => {
        const node = appShellRef.current
        if (!node) return

        if (isBlocking) {
            node.setAttribute('inert', '')
            node.style.pointerEvents = 'none'
            return () => {
                node.removeAttribute('inert')
                node.style.pointerEvents = ''
            }
        }

        node.removeAttribute('inert')
        node.style.pointerEvents = ''

        return () => {
            node.removeAttribute('inert')
            node.style.pointerEvents = ''
        }
    }, [isBlocking])

    const value = useMemo<AppStartupContextValue>(
        () => ({
            isActive,
            markReady: release,
        }),
        [isActive, release]
    )

    return (
        <AppStartupContext.Provider value={value}>
            <div ref={appShellRef}>{children}</div>

            <AnimatePresence>{isActive && <StartupSplash blocking={isBlocking} />}</AnimatePresence>
        </AppStartupContext.Provider>
    )
}

export function useAppStartupReady(isReady: boolean) {
    const context = useContext(AppStartupContext)

    useEffect(() => {
        if (!context?.isActive || !isReady) return

        let frameA = 0
        let frameB = 0

        frameA = window.requestAnimationFrame(() => {
            frameB = window.requestAnimationFrame(() => {
                context.markReady()
            })
        })

        return () => {
            window.cancelAnimationFrame(frameA)
            window.cancelAnimationFrame(frameB)
        }
    }, [context, isReady])
}
