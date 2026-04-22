'use client'

import { useSyncExternalStore } from 'react'

function subscribe(query: string, onStoreChange: () => void) {
    if (typeof window === 'undefined') {
        return () => undefined
    }

    const mediaQuery = window.matchMedia(query)
    const listener = () => onStoreChange()

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
}

function getSnapshot(query: string) {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
}

export function useMediaQuery(query: string) {
    return useSyncExternalStore(
        (onStoreChange) => subscribe(query, onStoreChange),
        () => getSnapshot(query),
        () => false
    )
}
