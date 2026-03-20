import { useEffect } from 'react'

interface Shortcut {
    key: string
    meta?: boolean
    ctrl?: boolean
    handler: () => void
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
    useEffect(() => {
        const isTouchDevice = () =>
            'ontouchstart' in window || navigator.maxTouchPoints > 0

        if (isTouchDevice()) return

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
                target.isContentEditable

            if (isInput) return

            shortcuts.forEach(({ key, meta, ctrl, handler }) => {
                const metaMatch = meta ? e.metaKey : true
                const ctrlMatch = ctrl ? e.ctrlKey : true
                if (e.key.toLowerCase() === key.toLowerCase() && metaMatch && ctrlMatch) {
                    e.preventDefault()
                    handler()
                }
            })
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [shortcuts])
}