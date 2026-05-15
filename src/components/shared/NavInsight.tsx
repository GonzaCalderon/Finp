'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Bell,
    BriefcaseBusiness,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    CreditCard,
    HandCoins,
    ScanSearch,
    Sparkles,
    Upload,
    type LucideIcon,
} from 'lucide-react'
import type { NavInsight as NavInsightType, NavInsightTone } from '@/types/nav-insight'

const ICONS: Record<string, LucideIcon> = {
    bell: Bell,
    briefcase: BriefcaseBusiness,
    calendar: Calendar,
    'check-circle': CheckCircle2,
    'clipboard-check': ClipboardCheck,
    'credit-card': CreditCard,
    'hand-coins': HandCoins,
    'scan-search': ScanSearch,
    upload: Upload,
    sparkles: Sparkles,
}

const TONE_STYLES: Record<NavInsightTone, { background: string; border: string; color: string }> = {
    sky: {
        background: 'color-mix(in srgb, var(--sky) 12%, transparent)',
        border: 'color-mix(in srgb, var(--sky) 24%, var(--finp-nav-line))',
        color: 'var(--sky)',
    },
    green: {
        background: 'color-mix(in srgb, #10B981 12%, transparent)',
        border: 'color-mix(in srgb, #10B981 24%, var(--finp-nav-line))',
        color: '#10B981',
    },
    amber: {
        background: 'color-mix(in srgb, var(--warning) 13%, transparent)',
        border: 'color-mix(in srgb, var(--warning) 25%, var(--finp-nav-line))',
        color: 'var(--warning)',
    },
    red: {
        background: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
        border: 'color-mix(in srgb, var(--destructive) 24%, var(--finp-nav-line))',
        color: 'var(--destructive)',
    },
    purple: {
        background: 'color-mix(in srgb, #8B5CF6 12%, transparent)',
        border: 'color-mix(in srgb, #8B5CF6 24%, var(--finp-nav-line))',
        color: '#A78BFA',
    },
    muted: {
        background: 'color-mix(in srgb, var(--finp-nav-hover) 70%, transparent)',
        border: 'var(--finp-nav-line)',
        color: 'var(--sidebar-foreground)',
    },
}

function NavInsightSkeleton({ variant }: { variant: 'desktop' | 'mobile' }) {
    const isMobile = variant === 'mobile'

    return (
        <motion.div
            key={`nav-insight-loading-${variant}`}
            className={isMobile
                ? 'flex min-w-0 animate-pulse items-center gap-2 rounded-xl border px-2.5 py-2'
                : 'flex min-w-0 animate-pulse items-start gap-2.5 rounded-xl border px-3 py-2.5'}
            style={{
                background: isMobile
                    ? 'color-mix(in srgb, var(--secondary) 72%, transparent)'
                    : 'color-mix(in srgb, var(--finp-nav-hover) 70%, transparent)',
                borderColor: isMobile ? 'var(--border)' : 'var(--finp-nav-line)',
            }}
            initial={{ opacity: 0, y: isMobile ? 4 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: isMobile ? -4 : -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
        >
            <span
                className={isMobile ? 'h-7 w-7 shrink-0 rounded-lg' : 'mt-0.5 h-8 w-8 shrink-0 rounded-lg'}
                style={{
                    background: isMobile
                        ? 'color-mix(in srgb, var(--muted-foreground) 14%, transparent)'
                        : 'rgba(255,255,255,0.10)',
                }}
            />
            <span className="min-w-0 flex-1 space-y-2">
                <span
                    className={isMobile ? 'block h-3 w-32 rounded-full' : 'block h-3 w-28 rounded-full'}
                    style={{
                        background: isMobile
                            ? 'color-mix(in srgb, var(--muted-foreground) 16%, transparent)'
                            : 'rgba(255,255,255,0.14)',
                    }}
                />
                <span
                    className={isMobile ? 'block h-2.5 w-40 rounded-full' : 'block h-2.5 w-36 rounded-full'}
                    style={{
                        background: isMobile
                            ? 'color-mix(in srgb, var(--muted-foreground) 11%, transparent)'
                            : 'rgba(255,255,255,0.09)',
                    }}
                />
            </span>
        </motion.div>
    )
}

function NavInsightBody({
    insight,
    variant,
}: {
    insight: NavInsightType
    variant: 'desktop' | 'mobile'
}) {
    const tone = TONE_STYLES[insight.tone ?? 'muted']
    const Icon = ICONS[insight.icon ?? 'sparkles'] ?? Sparkles
    const isMobile = variant === 'mobile'

    return (
        <div
            className={isMobile
                ? 'flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left'
                : 'group flex min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left'}
            style={{
                background: tone.background,
                borderColor: tone.border,
            }}
        >
            <span
                className={isMobile
                    ? 'grid h-7 w-7 shrink-0 place-items-center rounded-lg'
                    : 'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg'}
                style={{
                    background: 'color-mix(in srgb, currentColor 12%, transparent)',
                    color: tone.color,
                }}
            >
                <Icon size={isMobile ? 14 : 16} />
            </span>
            <span className="min-w-0 flex-1">
                <span className={isMobile
                    ? 'block truncate text-xs font-semibold text-foreground'
                    : 'block truncate text-[13px] font-semibold text-white'}
                >
                    {insight.title}
                </span>
                {insight.description && (
                    <span className={isMobile
                        ? 'mt-0.5 block truncate text-[11px] text-muted-foreground'
                        : 'mt-0.5 block truncate text-[11px] leading-snug text-white/50'}
                    >
                        {insight.description}
                    </span>
                )}
                {!isMobile && insight.href && (
                    <span className="mt-1.5 inline-flex text-[11px] font-medium text-white/55 transition-colors group-hover:text-white/75">
                        Ver ahora
                    </span>
                )}
            </span>
        </div>
    )
}

export function NavInsight({
    insight,
    variant = 'desktop',
    loading = false,
}: {
    insight: NavInsightType
    variant?: 'desktop' | 'mobile'
    loading?: boolean
}) {
    if (loading) {
        return (
            <div className="finp-nav-insight-loading" aria-busy="true" aria-label="Cargando insight de navegacion">
                <AnimatePresence mode="wait" initial={false}>
                    <NavInsightSkeleton variant={variant} />
                </AnimatePresence>
            </div>
        )
    }

    const content = (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: variant === 'mobile' ? 4 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: variant === 'mobile' ? -4 : -6 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
                <NavInsightBody insight={insight} variant={variant} />
            </motion.div>
        </AnimatePresence>
    )

    if (!insight.href) return content

    return (
        <Link
            href={insight.href}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            aria-label={`${insight.title}${insight.description ? `, ${insight.description}` : ''}`}
        >
            {content}
        </Link>
    )
}
