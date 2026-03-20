'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => { setMounted(true) }, [])
    if (!mounted) return null

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5"
            style={{ color: 'var(--sidebar-foreground)' }}
        >
            {theme === 'dark' ? (
                <Sun size={14} style={{ opacity: 0.6 }} />
            ) : (
                <Moon size={14} style={{ opacity: 0.6 }} />
            )}
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
    )
}