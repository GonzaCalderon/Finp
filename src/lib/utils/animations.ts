import type { Variants, Transition } from 'framer-motion'

// ─── Easing curves ────────────────────────────────────────────────────────────
// easeSmooth: entrada suave con ligero overshooot — ideal para enters
export const easeSmooth = [0.22, 1, 0.36, 1] as const
// easeSoft: aceleración rápida inicial — ideal para exits y overlays
export const easeSoft = [0.16, 1, 0.3, 1] as const

// Strings CSS para usar en globals.css / inline styles
export const easeSmootCSS = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const easeSoftCSS = 'cubic-bezier(0.16, 1, 0.3, 1)'

// ─── Spring physics ───────────────────────────────────────────────────────────
// springButton: respuesta inmediata, amortiguación fuerte — toggles, switches
export const springButton = {
    type: 'spring' as const,
    stiffness: 500,
    damping: 35,
    mass: 0.5,
}

// springGentle: más suave — menús, popovers
export const springGentle = {
    type: 'spring' as const,
    stiffness: 300,
    damping: 28,
    mass: 0.6,
}

// ─── Timing tokens ────────────────────────────────────────────────────────────
export const DURATION = {
    fast: 0.15,    // feedback inmediato (hover, focus, badges)
    normal: 0.2,   // transiciones estándar (fadeIn, staggerItem)
    slow: 0.3,     // drawers, sheets, overlays
} as const

// ─── Presets de animación ─────────────────────────────────────────────────────
export const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: DURATION.normal, ease: easeSmooth } as Transition,
}

export const fadeInFast = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: DURATION.fast, ease: easeSoft } as Transition,
}

export const staggerContainer: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.035,
            delayChildren: 0.02,
        },
    },
}

export const staggerItem: Variants = {
    initial: { opacity: 0, y: 6 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.normal, ease: easeSmooth },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: DURATION.fast, ease: easeSoft },
    },
}

export const slideInRight = {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 },
    transition: { duration: 0.22, ease: easeSmooth } as Transition,
}

export const scaleIn = {
    initial: { opacity: 0, scale: 0.985 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.985 },
    transition: { duration: DURATION.normal, ease: easeSmooth } as Transition,
}

// ─── Icon swap (ej. ThemeToggle) ──────────────────────────────────────────────
export const iconSwap = {
    initial: { opacity: 0, rotate: -20, scale: 0.75 },
    animate: { opacity: 1, rotate: 0, scale: 1 },
    exit:    { opacity: 0, rotate: 20,  scale: 0.75 },
    transition: { duration: DURATION.fast, ease: easeSmooth } as Transition,
}
