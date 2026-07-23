'use client'

import { motion } from 'framer-motion'
import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { Check } from 'lucide-react'
import type { ICategory } from '@/types'
import type { TransactionFormInput } from '@/lib/validations'
import { DURATION, easeSmooth, springButton, staggerItem } from '@/lib/utils/animations'

// ─── Design tokens ───────────────────────────────────────────────────────────

export const RADIUS = {
    card: '1.6rem',
    chip: '9999px',
    input: '0.875rem',
    inner: '1rem',
} as const

export const SURFACE = {
    panel: {
        borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
        background: 'color-mix(in srgb, var(--card) 86%, transparent)',
    },
    selected: {
        borderColor: 'color-mix(in srgb, var(--border) 78%, var(--foreground) 22%)',
        background: 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)',
    },
    hover: {
        borderColor: 'color-mix(in srgb, var(--border) 84%, var(--foreground) 16%)',
        background: 'color-mix(in srgb, var(--card) 92%, var(--foreground) 8%)',
    },
    inner: {
        borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
        background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
    },
} as const

// Kept for backwards-compatibility — use SURFACE.panel going forward
export const subtlePanelStyle = SURFACE.panel

export function getSubtleSelectedStyle(selected: boolean) {
    return selected ? SURFACE.selected : { borderColor: 'var(--border)', background: 'transparent' }
}

// ─── Motion presets ───────────────────────────────────────────────────────────

export const MOTION_CARD = {
    whileHover: { scale: 1.012, y: -1 },
    whileTap: { scale: 0.993 },
    transition: springButton,
} as const

export const MOTION_CHIP = {
    whileHover: { scale: 1.015 },
    whileTap: { scale: 0.99 },
    transition: springButton,
} as const

// ─── Type surfaces ────────────────────────────────────────────────────────────

export function getTypeSurface(type: TransactionFormInput['type'], isExpense: boolean) {
    if (isExpense) {
        return { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.24)', color: '#DC2626' }
    }
    switch (type) {
        case 'income':
            return { background: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.24)', color: '#059669' }
        case 'exchange':
            return { background: 'rgba(217,119,6,0.10)', borderColor: 'rgba(217,119,6,0.24)', color: '#D97706' }
        case 'transfer':
            return { background: 'rgba(37,99,235,0.10)', borderColor: 'rgba(37,99,235,0.24)', color: '#2563EB' }
        case 'credit_card_payment':
        case 'debt_payment':
            return { background: 'rgba(124,58,237,0.10)', borderColor: 'rgba(124,58,237,0.24)', color: '#7C3AED' }
        case 'adjustment':
            return { background: 'rgba(71,85,105,0.10)', borderColor: 'rgba(71,85,105,0.28)', color: '#475569' }
        default:
            return {
                background: 'color-mix(in srgb, var(--secondary) 82%, transparent)',
                borderColor: 'color-mix(in srgb, var(--border) 86%, transparent)',
                color: 'var(--foreground)',
            }
    }
}

// ─── Shared components ────────────────────────────────────────────────────────

export function ChoiceCard({
    title,
    description,
    selected,
    onClick,
    dataTestId,
    surface,
}: {
    title: string
    description: string
    selected: boolean
    onClick: () => void
    dataTestId?: string
    surface: { background: string; borderColor: string; color: string }
}) {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            data-testid={dataTestId}
            className="rounded-[1.6rem] border px-4 py-4 text-left transition-all duration-200"
            variants={staggerItem}
            {...MOTION_CARD}
            style={{
                borderColor: selected ? surface.borderColor : 'var(--border)',
                background: selected ? surface.background : 'var(--card)',
                boxShadow: selected ? '0 10px 30px rgba(0,0,0,0.08)' : 'none',
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[1.08rem] font-semibold" style={{ color: selected ? surface.color : 'var(--foreground)' }}>{title}</p>
                    <p className="mt-1 text-[0.95rem] text-muted-foreground">{description}</p>
                </div>
                {selected && (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--background)', color: surface.color }}>
                        <Check className="h-4 w-4" />
                    </span>
                )}
            </div>
        </motion.button>
    )
}

export function CategoryChip({
    category,
    selected,
    onClick,
    animateOnMount = true,
}: {
    category: ICategory
    selected: boolean
    onClick: () => void
    animateOnMount?: boolean
}) {
    const categoryColor = category.color || (category.type === 'income' ? '#059669' : '#DC2626')

    return (
        <motion.button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className="rounded-full border px-3 py-2 text-sm font-medium transition-colors"
            variants={animateOnMount ? staggerItem : undefined}
            initial={animateOnMount ? undefined : false}
            {...MOTION_CHIP}
            style={{
                background: selected ? categoryColor : `color-mix(in srgb, ${categoryColor} 11%, transparent)`,
                color: selected ? '#fff' : 'var(--foreground)',
                borderColor: selected ? categoryColor : `color-mix(in srgb, ${categoryColor} 34%, var(--border))`,
                outline: selected ? `2px solid ${categoryColor}` : 'none',
                outlineOffset: '2px',
            }}
        >
            <span className="inline-flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                        background: selected ? 'rgba(255,255,255,0.92)' : categoryColor,
                        boxShadow: selected
                            ? '0 0 0 1px rgba(255,255,255,0.28)'
                            : `0 0 0 2px color-mix(in srgb, ${categoryColor} 18%, transparent)`,
                    }}
                />
                {category.name}
                {category.isVirtual || category.sourceType === 'space' ? (
                    <span className="rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/75">
                        Espacio
                    </span>
                ) : null}
            </span>
        </motion.button>
    )
}

export function SummaryCard({
    title,
    value,
    currency,
}: {
    title: string
    value: string
    currency?: string
}) {
    return (
        <motion.div
            variants={staggerItem}
            whileHover={{ y: -1 }}
            transition={{ duration: DURATION.fast, ease: easeSmooth }}
            className="rounded-2xl border p-3"
            style={{ borderColor: SURFACE.panel.borderColor, background: 'var(--background)' }}
        >
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
            <div className="mt-1 flex items-center gap-2">
                {currency ? <CurrencyFlagIcon currency={currency} className="h-5 w-5" /> : null}
                <p className="min-w-0 text-sm font-semibold">{value}</p>
            </div>
        </motion.div>
    )
}

export function SummaryLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
        </div>
    )
}
