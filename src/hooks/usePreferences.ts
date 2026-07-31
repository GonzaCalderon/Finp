'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Currency } from '@/lib/constants'
import type { ProjectionGrouping, ProjectionMode } from '@/types/projection'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    PREFERENCE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { useDataInvalidation } from '@/hooks/useDataInvalidation'

export type DefaultView = 'dashboard' | 'transactions' | 'accounts' | 'projection'
export type MonthStartDay = number // 1-28

export interface Preferences {
    defaultView: DefaultView
    monthStartDay: MonthStartDay
    defaultAccountId?: string
    consolidatedCurrency: Currency
    referenceArsPerUsdRate?: number
    operationalStartDate?: string
    projectionGrouping: ProjectionGrouping
    projectionMode: ProjectionMode
    projectionMonths: number
    projectionChartCurrency: Currency
}

const DEFAULT_PREFERENCES: Preferences = {
    defaultView: 'dashboard',
    monthStartDay: 1,
    defaultAccountId: undefined,
    consolidatedCurrency: 'ARS',
    referenceArsPerUsdRate: undefined,
    operationalStartDate: undefined,
    projectionGrouping: 'type',
    projectionMode: 'monthly',
    projectionMonths: 6,
    projectionChartCurrency: 'ARS',
}

const STORAGE_KEYS = {
    defaultView: 'finp-default-view',
    monthStartDay: 'finp-month-start-day',
    defaultAccountId: 'finp-default-account-id',
    consolidatedCurrency: 'finp-consolidated-currency',
    referenceArsPerUsdRate: 'finp-reference-ars-per-usd-rate',
    operationalStartDate: 'finp-operational-start-date',
    projectionGrouping: 'finp-projection-grouping',
    projectionMode: 'finp-projection-mode',
    projectionMonths: 'finp-projection-months',
    projectionChartCurrency: 'finp-projection-chart-currency',
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
        const projectionGroupingRaw = localStorage.getItem(STORAGE_KEYS.projectionGrouping)
        const projectionGrouping: ProjectionGrouping = ['type', 'card', 'category'].includes(projectionGroupingRaw ?? '')
            ? projectionGroupingRaw as ProjectionGrouping
            : DEFAULT_PREFERENCES.projectionGrouping
        const projectionMode: ProjectionMode = localStorage.getItem(STORAGE_KEYS.projectionMode) === 'annual'
            ? 'annual'
            : DEFAULT_PREFERENCES.projectionMode
        const projectionMonthsRaw = Number.parseInt(localStorage.getItem(STORAGE_KEYS.projectionMonths) ?? '', 10)
        const projectionMonths = [1, 3, 6, 9, 12].includes(projectionMonthsRaw)
            ? projectionMonthsRaw
            : DEFAULT_PREFERENCES.projectionMonths
        const projectionChartCurrency: Currency = localStorage.getItem(STORAGE_KEYS.projectionChartCurrency) === 'USD'
            ? 'USD'
            : DEFAULT_PREFERENCES.projectionChartCurrency
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
            projectionGrouping,
            projectionMode,
            projectionMonths,
            projectionChartCurrency,
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
        localStorage.setItem(STORAGE_KEYS.projectionGrouping, prefs.projectionGrouping)
        localStorage.setItem(STORAGE_KEYS.projectionMode, prefs.projectionMode)
        localStorage.setItem(STORAGE_KEYS.projectionMonths, String(prefs.projectionMonths))
        localStorage.setItem(STORAGE_KEYS.projectionChartCurrency, prefs.projectionChartCurrency)
    } catch {
        // ignore
    }
}

function isDefaultPreferences(prefs: Preferences): boolean {
    return prefs.defaultView === DEFAULT_PREFERENCES.defaultView &&
        prefs.monthStartDay === DEFAULT_PREFERENCES.monthStartDay &&
        prefs.consolidatedCurrency === DEFAULT_PREFERENCES.consolidatedCurrency &&
        prefs.projectionGrouping === DEFAULT_PREFERENCES.projectionGrouping &&
        prefs.projectionMode === DEFAULT_PREFERENCES.projectionMode &&
        prefs.projectionMonths === DEFAULT_PREFERENCES.projectionMonths &&
        prefs.projectionChartCurrency === DEFAULT_PREFERENCES.projectionChartCurrency &&
        !prefs.referenceArsPerUsdRate &&
        !prefs.operationalStartDate
}

async function patchPreferences(patch: Partial<Preferences>): Promise<void> {
    await apiJson('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
    })
}

export function usePreferences() {
    // El primer render debe coincidir con el prerender del servidor. Leer
    // localStorage en el inicializador rompe la hidrataciÃ³n y puede dejar los
    // controles con defaults aunque API y almacenamiento tengan otro valor.
    const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)

    const fetchPreferences = useCallback(async () => {
        try {
            const data = await apiJson<{ preferences: Preferences }>('/api/preferences', {
                cache: 'no-store',
            })
            if (!data?.preferences) return

            const apiPrefs = data.preferences

            if (isDefaultPreferences(apiPrefs)) {
                const localPrefs = readFromStorage()
                if (!isDefaultPreferences(localPrefs)) {
                    patchPreferences(localPrefs)
                        .then(() => {
                            invalidateData(PREFERENCE_INVALIDATION_TAGS)
                        })
                        .catch(() => {})
                    setPreferences(localPrefs)
                    return
                }
            }

            setPreferences(apiPrefs)
            writeToStorage(apiPrefs)
        } catch {
            // API unavailable → localStorage fallback already in state
        }
    }, [])

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setPreferences(readFromStorage())
            void fetchPreferences()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [fetchPreferences])

    useDataInvalidation(['preferences'], () => {
        void fetchPreferences()
    })

    const setDefaultView = useCallback((view: DefaultView) => {
        setPreferences((prev) => ({ ...prev, defaultView: view }))
        writeToStorage({ ...readFromStorage(), defaultView: view })
        patchPreferences({ defaultView: view })
            .then(() => invalidateData(PREFERENCE_INVALIDATION_TAGS))
            .catch(() => {})
    }, [])

    const setMonthStartDay = useCallback((day: MonthStartDay) => {
        setPreferences((prev) => ({ ...prev, monthStartDay: day }))
        writeToStorage({ ...readFromStorage(), monthStartDay: day })
        patchPreferences({ monthStartDay: day })
            .then(() => invalidateData(PREFERENCE_INVALIDATION_TAGS))
            .catch(() => {})
    }, [])

    const setDefaultAccountId = useCallback((accountId: string | undefined) => {
        setPreferences((prev) => ({ ...prev, defaultAccountId: accountId }))
        writeToStorage({ ...readFromStorage(), defaultAccountId: accountId })
        patchPreferences({ defaultAccountId: accountId ?? null } as Partial<Preferences>)
            .then(() => invalidateData(PREFERENCE_INVALIDATION_TAGS))
            .catch(() => {})
    }, [])

    const setConsolidatedCurrency = useCallback((currency: Currency) => {
        setPreferences((prev) => ({ ...prev, consolidatedCurrency: currency }))
        writeToStorage({ ...readFromStorage(), consolidatedCurrency: currency })
        patchPreferences({ consolidatedCurrency: currency })
            .then(() => invalidateData(PREFERENCE_INVALIDATION_TAGS))
            .catch(() => {})
    }, [])

    const setReferenceArsPerUsdRate = useCallback((rate: number | undefined) => {
        const normalizedRate = rate && Number.isFinite(rate) && rate > 0 ? rate : undefined
        setPreferences((prev) => ({ ...prev, referenceArsPerUsdRate: normalizedRate }))
        writeToStorage({ ...readFromStorage(), referenceArsPerUsdRate: normalizedRate })
        patchPreferences({ referenceArsPerUsdRate: normalizedRate ?? null } as Partial<Preferences>)
            .then(() => invalidateData(PREFERENCE_INVALIDATION_TAGS))
            .catch(() => {})
    }, [])

    const setOperationalStartDate = useCallback((date: string | undefined) => {
        const normalizedDate = date?.trim() || undefined
        setPreferences((prev) => ({ ...prev, operationalStartDate: normalizedDate }))
        writeToStorage({ ...readFromStorage(), operationalStartDate: normalizedDate })
        patchPreferences({ operationalStartDate: normalizedDate ?? null } as Partial<Preferences>)
            .then(() => invalidateData(PREFERENCE_INVALIDATION_TAGS))
            .catch(() => {})
    }, [])

    const setProjectionPreferences = useCallback((patch: Partial<Pick<
        Preferences,
        'projectionGrouping' | 'projectionMode' | 'projectionMonths' | 'projectionChartCurrency'
    >>) => {
        const next = { ...readFromStorage(), ...patch }
        setPreferences((previous) => ({ ...previous, ...patch }))
        writeToStorage(next)
        patchPreferences(patch)
            .then(() => invalidateData(['preferences']))
            .catch(() => {})
    }, [])

    return {
        preferences,
        setDefaultView,
        setMonthStartDay,
        setDefaultAccountId,
        setConsolidatedCurrency,
        setReferenceArsPerUsdRate,
        setOperationalStartDate,
        setProjectionPreferences,
    }
}
