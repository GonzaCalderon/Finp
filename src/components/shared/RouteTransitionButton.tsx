'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markSkipRouteTransitionAnimations } from '@/hooks/useSkipRouteTransitionAnimations'

type RouteTransitionDirection = 'forward' | 'back'

type ViewTransitionDocument = Document & {
    startViewTransition?: (callback: () => void) => {
        finished: Promise<void>
    }
}

type RouteTransitionButtonProps = {
    href: string
    direction?: RouteTransitionDirection
    className?: string
    children: React.ReactNode
    ariaLabel?: string
    style?: React.CSSProperties
}

export function RouteTransitionButton({
    href,
    direction = 'forward',
    className,
    children,
    ariaLabel,
    style,
}: RouteTransitionButtonProps) {
    const router = useRouter()

    const navigate = () => {
        startTransition(() => {
            router.push(href)
        })
    }

    const handleClick = () => {
        const currentDocument = document as ViewTransitionDocument

        if (!currentDocument.startViewTransition) {
            navigate()
            return
        }

        markSkipRouteTransitionAnimations()
        document.documentElement.dataset.routeTransition = direction

        const transition = currentDocument.startViewTransition(() => {
            navigate()
        })

        transition.finished.finally(() => {
            delete document.documentElement.dataset.routeTransition
        })
    }

    return (
        <button type="button" onClick={handleClick} className={className} aria-label={ariaLabel} style={style}>
            {children}
        </button>
    )
}
