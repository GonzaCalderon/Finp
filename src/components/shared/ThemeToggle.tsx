'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { iconSwap } from '@/lib/utils/animations'

export function ThemeToggle({ className, iconSize, style }: { className?: string; iconSize?: number; style?: React.CSSProperties } = {}) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setMounted(true) }, [])
    if (!mounted) return null

    const isDark = theme === 'dark'

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={className ?? 'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm w-full transition-colors hover:bg-white/5'}
            style={style ?? { color: 'var(--sidebar-foreground)' }}
        >
            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={theme}
                    {...iconSwap}
                    style={{ display: 'inline-flex', opacity: 0.65 }}
                >
                    {isDark ? <Sun size={iconSize ?? 14} /> : <Moon size={iconSize ?? 14} />}
                </motion.span>
            </AnimatePresence>
            {isDark ? 'Modo claro' : 'Modo oscuro'}
        </button>
    )
}
