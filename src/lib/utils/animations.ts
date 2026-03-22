import type { Variants, Transition } from 'framer-motion'

const easeSmooth = [0.22, 1, 0.36, 1] as const
const easeSoft = [0.16, 1, 0.3, 1] as const

export const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.24, ease: easeSmooth } as Transition,
}

export const fadeInFast = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.16, ease: easeSoft } as Transition,
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
        transition: { duration: 0.2, ease: easeSmooth },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: 0.14, ease: easeSoft },
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
    transition: { duration: 0.2, ease: easeSmooth } as Transition,
}