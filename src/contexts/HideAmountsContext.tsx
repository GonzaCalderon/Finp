'use client'

import { createContext, useContext, useState } from 'react'

interface HideAmountsContextType {
    hidden: boolean
    toggle: () => void
}

const HideAmountsContext = createContext<HideAmountsContextType>({
    hidden: false,
    toggle: () => {},
})

export function HideAmountsProvider({ children }: { children: React.ReactNode }) {
    const [hidden, setHidden] = useState(false)
    return (
        <HideAmountsContext.Provider value={{ hidden, toggle: () => setHidden((p) => !p) }}>
            {children}
        </HideAmountsContext.Provider>
    )
}

export function useHideAmounts() {
    return useContext(HideAmountsContext)
}