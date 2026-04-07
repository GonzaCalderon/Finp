'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { fadeIn } from '@/lib/utils/animations'

export function StepSection({
    children,
}: {
    eyebrow?: string
    title?: string
    subtitle?: string
    children: ReactNode
}) {
    return (
        <motion.section
            {...fadeIn}
            className="mx-auto flex w-full max-w-[68rem] flex-col justify-center"
        >
            {children}
        </motion.section>
    )
}
