'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

interface HideAmountsContextValue {
    hidden: boolean
    toggleHidden: () => void
    setHidden: (value: boolean) => void
}

const HideAmountsContext = createContext<HideAmountsContextValue | undefined>(undefined)

const STORAGE_KEY = 'finp-hide-amounts'

export function HideAmountsProvider({ children }: { children: React.ReactNode }) {
    const [hidden, setHiddenState] = useState(false)
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY)

            if (stored !== null) {
                setHiddenState(stored === 'true')
            }
        } catch (error) {
            console.error('No se pudo leer la preferencia de ocultar montos:', error)
        } finally {
            setHydrated(true)
        }
    }, [])

    useEffect(() => {
        if (!hydrated) return

        try {
            window.localStorage.setItem(STORAGE_KEY, String(hidden))
        } catch (error) {
            console.error('No se pudo guardar la preferencia de ocultar montos:', error)
        }
    }, [hidden, hydrated])

    const setHidden = (value: boolean) => {
        setHiddenState(value)
    }

    const toggleHidden = () => {
        setHiddenState((prev) => !prev)
    }

    const value = useMemo(
        () => ({
            hidden,
            toggleHidden,
            setHidden,
        }),
        [hidden]
    )

    return <HideAmountsContext.Provider value={value}>{children}</HideAmountsContext.Provider>
}

export function useHideAmounts() {
    const context = useContext(HideAmountsContext)

    if (!context) {
        throw new Error('useHideAmounts debe usarse dentro de HideAmountsProvider')
    }

    return context
}