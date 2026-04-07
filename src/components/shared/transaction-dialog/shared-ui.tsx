'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { ICategory } from '@/types'
import type { TransactionFormInput } from '@/lib/validations'
import { DURATION, easeSmooth, springButton, staggerItem } from '@/lib/utils/animations'

export const subtlePanelStyle = {
    borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
    background: 'color-mix(in srgb, var(--card) 86%, transparent)',
}

export function getSubtleSelectedStyle(selected: boolean) {
    return {
        borderColor: selected ? 'color-mix(in srgb, var(--border) 78%, var(--foreground) 22%)' : 'var(--border)',
        background: selected ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)' : 'transparent',
    }
}

export function getTypeSurface(type: TransactionFormInput['type'], isExpense: boolean) {
    if (isExpense) {
        return { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.24)', color: '#DC2626' }
    }
    if (type === 'income') {
        return { background: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.24)', color: '#059669' }
    }
    if (type === 'exchange') {
        return { background: 'rgba(217,119,6,0.10)', borderColor: 'rgba(217,119,6,0.24)', color: '#D97706' }
    }
    return {
        background: 'color-mix(in srgb, var(--secondary) 82%, transparent)',
        borderColor: 'color-mix(in srgb, var(--border) 86%, transparent)',
        color: 'var(--foreground)',
    }
}

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
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.992 }}
            transition={springButton}
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

export function CategoryChip({ category, selected, onClick }: { category: ICategory; selected: boolean; onClick: () => void }) {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            className="rounded-full border px-3 py-2 text-sm font-medium transition-colors"
            variants={staggerItem}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            transition={springButton}
            style={{
                background: selected ? category.color || 'var(--sky)' : category.type === 'income' ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                color: selected ? '#fff' : category.type === 'income' ? '#059669' : '#DC2626',
                borderColor: selected ? category.color || 'var(--sky)' : category.type === 'income' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)',
                outline: selected ? `2px solid ${category.color || 'var(--sky)'}` : 'none',
                outlineOffset: '2px',
            }}
        >
            {category.name}
        </motion.button>
    )
}

export function SummaryCard({ title, value }: { title: string; value: string }) {
    return (
        <motion.div
            variants={staggerItem}
            whileHover={{ y: -1 }}
            transition={{ duration: DURATION.fast, ease: easeSmooth }}
            className="rounded-2xl border p-3"
            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
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
