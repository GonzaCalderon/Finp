'use client'

import { useState, useEffect, useCallback } from 'react'

export type DefaultView = 'dashboard' | 'transactions' | 'accounts' | 'projection'
export type MonthStartDay = number // 1-28

interface Preferences {
    defaultView: DefaultView
    monthStartDay: MonthStartDay
}

const DEFAULT_PREFERENCES: Preferences = {
    defaultView: 'dashboard',
    monthStartDay: 1,
}

const STORAGE_KEYS = {
    defaultView: 'finp-default-view',
    monthStartDay: 'finp-month-start-day',
} as const

function readFromStorage(): Preferences {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES
    try {
        const defaultView = (localStorage.getItem(STORAGE_KEYS.defaultView) as DefaultView | null) ?? DEFAULT_PREFERENCES.defaultView
        const monthStartDayRaw = localStorage.getItem(STORAGE_KEYS.monthStartDay)
        const monthStartDay: MonthStartDay = monthStartDayRaw ? parseInt(monthStartDayRaw, 10) : DEFAULT_PREFERENCES.monthStartDay
        return {
            defaultView,
            monthStartDay: isNaN(monthStartDay) ? DEFAULT_PREFERENCES.monthStartDay : monthStartDay,
        }
    } catch {
        return DEFAULT_PREFERENCES
    }
}

function writeToStorage(prefs: Preferences) {
    try {
        localStorage.setItem(STORAGE_KEYS.defaultView, prefs.defaultView)
        localStorage.setItem(STORAGE_KEYS.monthStartDay, String(prefs.monthStartDay))
    } catch {
        // ignore
    }
}

function isDefaultPreferences(prefs: Preferences): boolean {
    return prefs.defaultView === DEFAULT_PREFERENCES.defaultView &&
        prefs.monthStartDay === DEFAULT_PREFERENCES.monthStartDay
}

async function patchPreferences(patch: Partial<Preferences>): Promise<void> {
    await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    })
}

export function usePreferences() {
    // Initialize from localStorage immediately to avoid flash of defaults
    const [preferences, setPreferences] = useState<Preferences>(() => readFromStorage())

    useEffect(() => {
        fetch('/api/preferences')
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { preferences: Preferences } | null) => {
                if (!data?.preferences) return

                const apiPrefs = data.preferences

                // If backend has default values, check whether localStorage has a
                // non-default config that should be migrated (existing users).
                if (isDefaultPreferences(apiPrefs)) {
                    const localPrefs = readFromStorage()
                    if (!isDefaultPreferences(localPrefs)) {
                        // Migrate localStorage → backend (one-time)
                        patchPreferences(localPrefs).catch(() => {})
                        setPreferences(localPrefs)
                        return
                    }
                }

                // Backend has explicit values → backend wins
                setPreferences(apiPrefs)
                writeToStorage(apiPrefs) // keep localStorage in sync as cache
            })
            .catch(() => {
                // API unavailable → localStorage fallback already in state
            })
    }, [])

    const setDefaultView = useCallback((view: DefaultView) => {
        setPreferences((prev) => ({ ...prev, defaultView: view }))
        writeToStorage({ ...readFromStorage(), defaultView: view })
        patchPreferences({ defaultView: view }).catch(() => {})
    }, [])

    const setMonthStartDay = useCallback((day: MonthStartDay) => {
        setPreferences((prev) => ({ ...prev, monthStartDay: day }))
        writeToStorage({ ...readFromStorage(), monthStartDay: day })
        patchPreferences({ monthStartDay: day }).catch(() => {})
    }, [])

    return {
        preferences,
        setDefaultView,
        setMonthStartDay,
    }
}
