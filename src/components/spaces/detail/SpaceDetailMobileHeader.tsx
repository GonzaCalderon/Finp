'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ChevronDown, Settings2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SpaceStatusBadge, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
import { useSpaces } from '@/hooks/useSpaces'
import type { ISpace } from '@/types'

export function SpaceDetailMobileHeader({
    space,
    onSettings,
}: {
    space: ISpace
    onSettings: () => void
}) {
    const [selectorOpen, setSelectorOpen] = useState(false)
    const { spaces } = useSpaces()
    const router = useRouter()

    const handleSelectSpace = (id: string) => {
        setSelectorOpen(false)
        router.push(`/spaces/${id}`)
    }

    return (
        <>
            <div className="flex items-center gap-2 md:hidden">
                <Link
                    href="/spaces"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-card/70 text-muted-foreground transition-colors active:bg-muted"
                    aria-label="Volver"
                >
                    <ArrowLeft size={16} />
                </Link>

                <button
                    type="button"
                    onClick={() => setSelectorOpen(true)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-foreground/10 bg-card/70 px-3 py-1.5 transition-colors active:bg-muted"
                >
                    <SpaceTypeIcon
                        type={space.type}
                        className="h-6 w-6 shrink-0 rounded-[8px]"
                        iconClassName="h-3 w-3"
                    />
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                        {space.name}
                    </span>
                    <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                </button>

                <button
                    type="button"
                    onClick={onSettings}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-card/70 text-muted-foreground transition-colors active:bg-muted"
                    aria-label="Configuración"
                >
                    <Settings2 size={16} />
                </button>
            </div>

            <AnimatePresence>
                {selectorOpen && (
                    <>
                        <motion.button
                            type="button"
                            className="fixed inset-0 z-40 bg-black/40 md:hidden"
                            onClick={() => setSelectorOpen(false)}
                            aria-label="Cerrar selector"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                        />

                        <motion.div
                            className="fixed inset-x-0 bottom-0 z-50 md:hidden rounded-t-3xl border-t shadow-2xl"
                            style={{
                                background: 'var(--background)',
                                borderColor: 'var(--border)',
                                maxHeight: '70dvh',
                            }}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'tween', duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <div className="mx-auto mt-3 mb-2 h-1.5 w-12 rounded-full bg-muted" />

                            <div className="px-4 pb-safe-or-5 overflow-y-auto" style={{ maxHeight: 'calc(70dvh - 32px)' }}>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                    Mis espacios
                                </p>

                                <div className="space-y-1 pb-4">
                                    {spaces.map((s) => {
                                        const sid = String(s.space._id)
                                        const isActive = sid === String(space._id)
                                        return (
                                            <button
                                                key={sid}
                                                type="button"
                                                onClick={() => handleSelectSpace(sid)}
                                                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors"
                                                style={{
                                                    background: isActive
                                                        ? 'color-mix(in srgb, var(--sky) 12%, transparent)'
                                                        : 'transparent',
                                                }}
                                            >
                                                <SpaceTypeIcon
                                                    type={s.space.type}
                                                    className="h-9 w-9 shrink-0 rounded-[12px]"
                                                    iconClassName="h-4 w-4"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">{s.space.name}</p>
                                                    <SpaceStatusBadge status={s.space.status} className="mt-0.5" />
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}
