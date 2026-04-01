'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Currency } from '@/lib/constants'

export type DefaultView = 'dashboard' | 'transactions' | 'accounts' | 'projection'
export type MonthStartDay = number // 1-28

interface Preferences {
    defaultView: DefaultView
    monthStartDay: MonthStartDay
    defaultAccountId?: string
    consolidatedCurrency: Currency
    referenceArsPerUsdRate?: number
    operationalStartDate?: string
}

const DEFAULT_PREFERENCES: Preferences = {
    defaultView: 'dashboard',
    monthStartDay: 1,
    defaultAccountId: undefined,
    consolidatedCurrency: 'ARS',
    referenceArsPerUsdRate: undefined,
    operationalStartDate: undefined,
}

const STORAGE_KEYS = {
    defaultView: 'finp-default-view',
    monthStartDay: 'finp-month-start-day',
    defaultAccountId: 'finp-default-account-id',
    consolidatedCurrency: 'finp-consolidated-currency',
    referenceArsPerUsdRate: 'finp-reference-ars-per-usd-rate',
    operationalStartDate: 'finp-operational-start-date',
} as const

function readFromStorage(): Preferences {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES
    try {
        const defaultView = (localStorage.getItem(STORAGE_KEYS.defaultView) as DefaultView | null) ?? DEFAULT_PREFERENCES.defaultView
        const monthStartDayRaw = localStorage.getItem(STORAGE_KEYS.monthStartDay)
        const monthStartDay: MonthStartDay = monthStartDayRaw ? parseInt(monthStartDayRaw, 10) : DEFAULT_PREFERENCES.monthStartDay
        const defaultAccountId = localStorage.getItem(STORAGE_KEYS.defaultAccountId) ?? undefined
        const consolidatedCurrencyRaw = localStorage.getItem(STORAGE_KEYS.consolidatedCurrency)
        const consolidatedCurrency: Currency = consolidatedCurrencyRaw === 'USD' ? 'USD' : DEFAULT_PREFERENCES.consolidatedCurrency
        const referenceArsPerUsdRateRaw = localStorage.getItem(STORAGE_KEYS.referenceArsPerUsdRate)
        const operationalStartDate = localStorage.getItem(STORAGE_KEYS.operationalStartDate) ?? undefined
        const parsedRate = referenceArsPerUsdRateRaw ? Number.parseFloat(referenceArsPerUsdRateRaw) : undefined
        return {
            defaultView,
            monthStartDay: isNaN(monthStartDay) ? DEFAULT_PREFERENCES.monthStartDay : monthStartDay,
            defaultAccountId: defaultAccountId || undefined,
            consolidatedCurrency,
            referenceArsPerUsdRate:
                parsedRate && Number.isFinite(parsedRate) && parsedRate > 0
                    ? parsedRate
                    : undefined,
            operationalStartDate: operationalStartDate || undefined,
        }
    } catch {
        return DEFAULT_PREFERENCES
    }
}

function writeToStorage(prefs: Preferences) {
    try {
        localStorage.setItem(STORAGE_KEYS.defaultView, prefs.defaultView)
        localStorage.setItem(STORAGE_KEYS.monthStartDay, String(prefs.monthStartDay))
        if (prefs.defaultAccountId) {
            localStorage.setItem(STORAGE_KEYS.defaultAccountId, prefs.defaultAccountId)
        } else {
            localStorage.removeItem(STORAGE_KEYS.defaultAccountId)
        }
        localStorage.setItem(STORAGE_KEYS.consolidatedCurrency, prefs.consolidatedCurrency)
        if (prefs.referenceArsPerUsdRate && prefs.referenceArsPerUsdRate > 0) {
            localStorage.setItem(STORAGE_KEYS.referenceArsPerUsdRate, String(prefs.referenceArsPerUsdRate))
        } else {
            localStorage.removeItem(STORAGE_KEYS.referenceArsPerUsdRate)
        }
        if (prefs.operationalStartDate) {
            localStorage.setItem(STORAGE_KEYS.operationalStartDate, prefs.operationalStartDate)
        } else {
            localStorage.removeItem(STORAGE_KEYS.operationalStartDate)
        }
    } catch {
        // ignore
    }
}

function isDefaultPreferences(prefs: Preferences): boolean {
    return prefs.defaultView === DEFAULT_PREFERENCES.defaultView &&
        prefs.monthStartDay === DEFAULT_PREFERENCES.monthStartDay &&
        prefs.consolidatedCurrency === DEFAULT_PREFERENCES.consolidatedCurrency &&
        !prefs.referenceArsPerUsdRate &&
        !prefs.operationalStartDate
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

    const setDefaultAccountId = useCallback((accountId: string | undefined) => {
        setPreferences((prev) => ({ ...prev, defaultAccountId: accountId }))
        writeToStorage({ ...readFromStorage(), defaultAccountId: accountId })
        patchPreferences({ defaultAccountId: accountId ?? null } as Partial<Preferences>).catch(() => {})
    }, [])

    const setConsolidatedCurrency = useCallback((currency: Currency) => {
        setPreferences((prev) => ({ ...prev, consolidatedCurrency: currency }))
        writeToStorage({ ...readFromStorage(), consolidatedCurrency: currency })
        patchPreferences({ consolidatedCurrency: currency }).catch(() => {})
    }, [])

    const setReferenceArsPerUsdRate = useCallback((rate: number | undefined) => {
        const normalizedRate = rate && Number.isFinite(rate) && rate > 0 ? rate : undefined
        setPreferences((prev) => ({ ...prev, referenceArsPerUsdRate: normalizedRate }))
        writeToStorage({ ...readFromStorage(), referenceArsPerUsdRate: normalizedRate })
        patchPreferences({ referenceArsPerUsdRate: normalizedRate ?? null } as Partial<Preferences>).catch(() => {})
    }, [])

    const setOperationalStartDate = useCallback((date: string | undefined) => {
        const normalizedDate = date?.trim() || undefined
        setPreferences((prev) => ({ ...prev, operationalStartDate: normalizedDate }))
        writeToStorage({ ...readFromStorage(), operationalStartDate: normalizedDate })
        patchPreferences({ operationalStartDate: normalizedDate ?? null } as Partial<Preferences>).catch(() => {})
    }, [])

    return {
        preferences,
        setDefaultView,
        setMonthStartDay,
        setDefaultAccountId,
        setConsolidatedCurrency,
        setReferenceArsPerUsdRate,
        setOperationalStartDate,
    }
}
