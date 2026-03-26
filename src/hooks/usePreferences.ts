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

export function usePreferences() {
    const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setPreferences(readFromStorage()) }, [])

    const setDefaultView = useCallback((view: DefaultView) => {
        try {
            localStorage.setItem(STORAGE_KEYS.defaultView, view)
        } catch {
            // ignore
        }
        setPreferences((prev) => ({ ...prev, defaultView: view }))
    }, [])

    const setMonthStartDay = useCallback((day: MonthStartDay) => {
        try {
            localStorage.setItem(STORAGE_KEYS.monthStartDay, String(day))
        } catch {
            // ignore
        }
        setPreferences((prev) => ({ ...prev, monthStartDay: day }))
    }, [])

    return {
        preferences,
        setDefaultView,
        setMonthStartDay,
    }
}
