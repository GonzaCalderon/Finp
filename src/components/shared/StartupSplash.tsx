'use client'

import { motion, useReducedMotion } from 'framer-motion'

export function StartupSplash({ blocking = true }: { blocking?: boolean }) {
    const reducedMotion = useReducedMotion()

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.12 : 0.18 }}
            className="fixed inset-0 z-[140] flex items-center justify-center overflow-hidden px-6"
            style={{
                pointerEvents: 'none',
                background: `
                    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--sky) 16%, transparent), transparent 18%),
                    radial-gradient(circle at 34% 62%, color-mix(in srgb, var(--chart-3) 9%, transparent), transparent 24%),
                    radial-gradient(circle at 66% 34%, color-mix(in srgb, var(--amber) 8%, transparent), transparent 22%),
                    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--sky-dark) 8%, transparent), transparent 42%),
                    linear-gradient(180deg, color-mix(in srgb, var(--background) 84%, transparent) 0%, color-mix(in srgb, var(--card) 88%, transparent) 100%)
                `,
                backdropFilter: 'blur(14px)',
            }}
            aria-live="polite"
            aria-busy={blocking}
        >
            <motion.div
                className="relative flex flex-col items-center justify-center"
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{
                    opacity: 0,
                    scale: reducedMotion ? 0.94 : 0.42,
                    filter: reducedMotion ? 'blur(0px)' : 'blur(12px)',
                }}
                transition={{ duration: reducedMotion ? 0.16 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
                <motion.div
                    className="absolute h-20 w-20 md:h-24 md:w-24"
                    style={{
                        background: `
                            radial-gradient(circle at 35% 35%, color-mix(in srgb, var(--chart-3) 55%, transparent) 0%, transparent 34%),
                            radial-gradient(circle at 72% 68%, color-mix(in srgb, var(--amber) 44%, transparent) 0%, transparent 30%),
                            linear-gradient(135deg, color-mix(in srgb, var(--sky) 72%, transparent) 0%, color-mix(in srgb, var(--chart-3) 62%, transparent) 48%, color-mix(in srgb, var(--amber) 56%, transparent) 100%)
                        `,
                        filter: 'blur(24px)',
                    }}
                    animate={reducedMotion ? { opacity: 0.82 } : { opacity: [0.68, 1, 0.7], scale: [0.92, 1.1, 0.96] }}
                    transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
                    exit={{
                        opacity: [0.8, 1, 0],
                        scale: reducedMotion ? 0.8 : [1, 0.48, 0.08],
                    }}
                />

                <motion.div
                    className="relative h-20 w-20 md:h-24 md:w-24"
                    style={{
                        background: 'linear-gradient(135deg, var(--sky) 0%, var(--chart-3) 58%, var(--amber) 100%)',
                        boxShadow: `
                            0 0 0 1px rgba(255,255,255,0.12) inset,
                            0 0 20px color-mix(in srgb, var(--sky) 32%, transparent),
                            0 0 48px color-mix(in srgb, var(--chart-3) 24%, transparent)
                        `,
                    }}
                    animate={
                        reducedMotion
                            ? { rotate: -18, borderRadius: '22%' }
                            : {
                                rotate: [-45, -220, -360, -45],
                                borderRadius: ['22%', '34%', '50%', '22%'],
                                scale: [1, 1.02, 0.98, 1],
                            }
                    }
                    transition={{
                        duration: reducedMotion ? 0.2 : 3,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'easeInOut',
                        times: reducedMotion ? undefined : [0, 0.46, 0.72, 1],
                    }}
                    exit={{
                        rotate: reducedMotion ? -12 : -420,
                        borderRadius: '50%',
                        scale: reducedMotion ? 0.88 : [1, 0.64, 0.12],
                        opacity: [1, 1, 0],
                    }}
                >
                    <div
                        className="absolute inset-0 -z-10"
                        style={{
                            background: 'linear-gradient(135deg, var(--sky) 0%, var(--chart-3) 58%, var(--amber) 100%)',
                            transform: 'translate3d(0, 0, 0) scale(0.95)',
                            filter: 'blur(20px)',
                        }}
                    />
                    <div
                        className="absolute inset-[2px] rounded-[inherit]"
                        style={{
                            background:
                                'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.08) 100%)',
                        }}
                    />
                </motion.div>

                <motion.div
                    className="mt-5 text-center"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, delay: 0.04 }}
                >
                    <p
                        className="text-xl font-semibold tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, var(--foreground) 0%, color-mix(in srgb, var(--sky) 68%, var(--foreground)) 100%)',
                            WebkitBackgroundClip: 'text',
                            backgroundClip: 'text',
                            color: 'transparent',
                        }}
                    >
                        Finp
                    </p>
                </motion.div>
            </motion.div>
        </motion.div>
    )
}
