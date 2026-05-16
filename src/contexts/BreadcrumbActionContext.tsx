'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

type BreadcrumbActionContextValue = {
    action: ReactNode | null
    setAction: (action: ReactNode | null) => void
    clearAction: () => void
}

const BreadcrumbActionContext = createContext<BreadcrumbActionContextValue | null>(null)

export function BreadcrumbActionProvider({ children }: { children: ReactNode }) {
    const [action, setActionState] = useState<ReactNode | null>(null)

    const setAction = useCallback((nextAction: ReactNode | null) => {
        setActionState(nextAction)
    }, [])

    const clearAction = useCallback(() => {
        setActionState(null)
    }, [])

    return (
        <BreadcrumbActionContext.Provider value={{ action, setAction, clearAction }}>
            {children}
        </BreadcrumbActionContext.Provider>
    )
}

export function useBreadcrumbAction() {
    const context = useContext(BreadcrumbActionContext)
    if (!context) {
        throw new Error('useBreadcrumbAction must be used within BreadcrumbActionProvider')
    }
    return context
}
