'use client'

import type { ElementType } from 'react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { CommitmentRow } from '@/components/commitments/CommitmentRow'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { IScheduledCommitment } from '@/types'

interface CommitmentSectionProps {
    title: string
    description: string
    icon: ElementType
    accent: string
    commitments: IScheduledCommitment[]
    onApply: (commitment: IScheduledCommitment) => void
    onEdit: (commitment: IScheduledCommitment) => void
    onUpdateAmount: (commitment: IScheduledCommitment) => void
    onDeactivate: (id: string) => void
    onReactivate: (commitment: IScheduledCommitment) => void
}

export function CommitmentSection({
    title,
    description,
    icon: Icon,
    accent,
    commitments,
    onApply,
    onEdit,
    onUpdateAmount,
    onDeactivate,
    onReactivate,
}: CommitmentSectionProps) {
    if (commitments.length === 0) return null

    return (
        <motion.section variants={staggerItem} className="space-y-3">
            <div className="flex items-center gap-3">
                <div
                    className="flex size-9 items-center justify-center rounded-xl md:size-10 md:rounded-2xl"
                    style={{ background: `${accent}15`, color: accent }}
                >
                    <Icon className="size-4.5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold md:text-base">{title}</h2>
                        <Badge variant="secondary">{commitments.length}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>

            <motion.div
                className="overflow-hidden rounded-2xl border bg-card shadow-sm"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {commitments.map((commitment, index) => (
                    <div
                        key={commitment._id.toString()}
                        className={index > 0 ? 'border-t' : undefined}
                    >
                        <CommitmentRow
                            commitment={commitment}
                            onApply={onApply}
                            onEdit={onEdit}
                            onUpdateAmount={onUpdateAmount}
                            onDeactivate={onDeactivate}
                            onReactivate={onReactivate}
                        />
                    </div>
                ))}
            </motion.div>
        </motion.section>
    )
}
