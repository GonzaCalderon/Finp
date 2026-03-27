'use client'

import { motion } from 'framer-motion'
import { fadeIn } from '@/lib/utils/animations'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background flex flex-col lg:flex-row">
            {/* Left branded panel — only visible on desktop */}
            <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between bg-[var(--sidebar)] p-12 relative overflow-hidden">
                {/* Background decoration */}
                <div
                    aria-hidden
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background:
                            'radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.05) 0%, transparent 50%)',
                    }}
                />
                <div className="relative z-10">
                    <div className="flex items-baseline">
                        <span className="text-white text-3xl font-bold tracking-tight">Fin</span>
                        <span className="text-3xl font-bold tracking-tight" style={{ color: 'var(--sky)' }}>p</span>
                    </div>
                </div>

                <div className="relative z-10 space-y-4">
                    <h2 className="text-white text-4xl font-bold leading-snug">
                        Tu finanzas,<br />
                        bajo control.
                    </h2>
                    <p className="text-white/70 text-lg leading-relaxed max-w-xs">
                        Registrá tus movimientos, visualizá tus cuentas y tomá mejores decisiones financieras.
                    </p>
                </div>

                <div className="relative z-10">
                    <p className="text-white/40 text-sm">© {new Date().getFullYear()} Finp</p>
                </div>
            </div>

            {/* Right content panel */}
            <motion.div
                className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 min-h-screen lg:min-h-0"
                initial={fadeIn.initial}
                animate={fadeIn.animate}
                transition={fadeIn.transition}
            >
                {/* Mobile logo — only visible on mobile/tablet */}
                <div className="lg:hidden mb-8 text-center">
                    <div className="flex items-baseline justify-center">
                        <span className="text-foreground text-3xl font-bold tracking-tight">Fin</span>
                        <span className="text-3xl font-bold tracking-tight" style={{ color: 'var(--sky)' }}>p</span>
                    </div>
                </div>

                <div className="w-full max-w-sm">
                    {children}
                </div>
            </motion.div>
        </div>
    )
}
