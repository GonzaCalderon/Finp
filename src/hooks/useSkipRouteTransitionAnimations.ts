'use client'

import { useEffect, useState } from 'react'

const ROUTE_TRANSITION_ANIMATION_KEY = 'finp-route-transition-enter'

export function markSkipRouteTransitionAnimations() {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(ROUTE_TRANSITION_ANIMATION_KEY, '1')
}

export function useSkipRouteTransitionAnimations() {
    const [skipAnimations] = useState(() => {
        if (typeof window === 'undefined') return false
        return window.sessionStorage.getItem(ROUTE_TRANSITION_ANIMATION_KEY) === '1'
    })

    useEffect(() => {
        if (typeof window === 'undefined') return

        if (!skipAnimations) return
        window.sessionStorage.removeItem(ROUTE_TRANSITION_ANIMATION_KEY)
    }, [skipAnimations])

    return skipAnimations
}
