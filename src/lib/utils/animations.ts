import type { Variants, Transition } from 'framer-motion'

const easeOut = [0.0, 0.0, 0.2, 1.0] as const

export const fadeIn = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: 0.18, ease: easeOut } as Transition,
}

export const fadeInFast = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.12, ease: easeOut } as Transition,
}

export const staggerContainer: Variants = {
    initial: {},
    animate: {
        transition: {
            staggerChildren: 0.06,
        },
    },
}

export const staggerItem: Variants = {
    initial: { opacity: 0, y: 8 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.16, ease: easeOut },
    },
}

export const slideInRight = {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 12 },
    transition: { duration: 0.2, ease: easeOut } as Transition,
}

export const scaleIn = {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.97 },
    transition: { duration: 0.15, ease: easeOut } as Transition,
}