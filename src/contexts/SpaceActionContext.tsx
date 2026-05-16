'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface SpaceAction {
    label: string
    icon?: React.ReactNode
    onPress: () => void
}

interface SpaceActionContextValue {
    action: SpaceAction | null
    setAction: (action: SpaceAction | null) => void
    clearAction: () => void
}

const SpaceActionContext = createContext<SpaceActionContextValue | null>(null)

export function SpaceActionProvider({ children }: { children: React.ReactNode }) {
    const [action, setActionState] = useState<SpaceAction | null>(null)

    const setAction = useCallback((action: SpaceAction | null) => {
        setActionState(action)
    }, [])

    const clearAction = useCallback(() => {
        setActionState(null)
    }, [])

    return (
        <SpaceActionContext.Provider value={{ action, setAction, clearAction }}>
            {children}
        </SpaceActionContext.Provider>
    )
}

export function useSpaceAction() {
    const ctx = useContext(SpaceActionContext)
    if (!ctx) throw new Error('useSpaceAction must be used within SpaceActionProvider')
    return ctx
}
