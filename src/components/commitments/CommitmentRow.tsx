'use client'

import { useState } from 'react'
import {
    Bell,
    CheckCircle,
    ChevronDown,
    Clock3,
    CircleDollarSign,
    EyeOff,
    Pencil,
    RotateCcw,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { staggerItem } from '@/lib/utils/animations'
import type { IScheduledCommitment } from '@/types'
import { cn } from '@/lib/utils'

const RECURRENCE_LABELS: Record<string, string> = {
    monthly: 'Mensual',
    weekly: 'Semanal',
    once: 'Una vez',
}

const LIFECYCLE_LABELS: Record<string, string> = {
    upcoming: 'Próximo',
    active: 'Activo',
    ending_soon: 'Finaliza pronto',
    expired: 'Finalizado',
    inactive: 'Desactivado',
}

function formatDate(value: Date | string, includeYear = true): string {
    return new Date(value).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: includeYear ? 'numeric' : undefined,
    })
}

function getReferenceName(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { name?: unknown }
    return typeof candidate.name === 'string' ? candidate.name : null
}

function getReferenceColor(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { color?: unknown }
    return typeof candidate.color === 'string' ? candidate.color : null
}

interface CommitmentRowProps {
    commitment: IScheduledCommitment
    onApply: (commitment: IScheduledCommitment) => void
    onEdit: (commitment: IScheduledCommitment) => void
    onUpdateAmount: (commitment: IScheduledCommitment) => void
    onDeactivate: (id: string) => void
    onReactivate: (commitment: IScheduledCommitment) => void
}

export function CommitmentRow({
    commitment,
    onApply,
    onEdit,
    onUpdateAmount,
    onDeactivate,
    onReactivate,
}: CommitmentRowProps) {
    const [historyOpen, setHistoryOpen] = useState(false)
    const isApplied = Boolean(commitment.appliedThisMonth)
    const lifecycle = commitment.lifecycleStatus ?? 'active'
    const canApply =
        !isApplied && (lifecycle === 'active' || lifecycle === 'ending_soon')
    const categoryName = getReferenceName(commitment.categoryId)
    const categoryColor = getReferenceColor(commitment.categoryId)
    const schedule = [...(commitment.amountSchedule ?? [])].sort(
        (left, right) =>
            new Date(right.effectiveFrom).getTime() -
            new Date(left.effectiveFrom).getTime()
    )
    const displayedAmount = commitment.resolvedAmount ?? commitment.amount

    return (
        <motion.article variants={staggerItem} className="px-3 py-3 md:px-5 md:py-4">
            <div className="flex items-start gap-3">
                <div
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl md:size-10"
                    style={{
                        background: isApplied
                            ? 'rgba(16,185,129,0.10)'
                            : 'rgba(2,132,199,0.10)',
                        color: isApplied ? '#10B981' : 'var(--sky)',
                    }}
                >
                    {isApplied ? (
                        <CheckCircle className="size-4.5" />
                    ) : (
                        <Clock3 className="size-4.5" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="truncate text-sm font-medium md:text-base">
                                    {commitment.description}
                                </h3>
                                <Badge variant="outline">{commitment.currency}</Badge>
                                <Badge
                                    variant={
                                        lifecycle === 'expired' || lifecycle === 'inactive'
                                            ? 'secondary'
                                            : 'outline'
                                    }
                                >
                                    {LIFECYCLE_LABELS[lifecycle]}
                                </Badge>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Badge variant="secondary">
                                    {RECURRENCE_LABELS[commitment.recurrence]}
                                </Badge>
                                {isApplied && (
                                    <Badge>
                                        Aplicado el{' '}
                                        {commitment.currentApplication?.appliedAt
                                            ? formatDate(
                                                  commitment.currentApplication.appliedAt,
                                                  false
                                              )
                                            : 'período actual'}
                                    </Badge>
                                )}
                                {commitment.reminderState === 'due' && (
                                    <Badge variant="outline" className="gap-1 text-amber-700">
                                        <Bell className="size-3" />
                                        Recordatorio activo
                                    </Badge>
                                )}
                                {commitment.reminderState === 'overdue' && (
                                    <Badge variant="outline" className="gap-1 text-destructive">
                                        <Bell className="size-3" />
                                        Vencido
                                    </Badge>
                                )}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {commitment.dayOfMonth && (
                                    <span>Vence el día {commitment.dayOfMonth}</span>
                                )}
                                {commitment.endDate && (
                                    <span>Hasta {formatDate(commitment.endDate)}</span>
                                )}
                                {commitment.reminderLeadDays !== undefined && (
                                    <span>
                                        Recordatorio{' '}
                                        {commitment.reminderLeadDays === 0
                                            ? 'el mismo día'
                                            : `${commitment.reminderLeadDays} días antes`}
                                    </span>
                                )}
                                {categoryName && (
                                    <span className="flex items-center gap-1">
                                        {categoryColor && (
                                            <span
                                                className="size-2 rounded-full"
                                                style={{ backgroundColor: categoryColor }}
                                            />
                                        )}
                                        {categoryName}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 md:min-w-56 md:border-l md:pl-4">
                            <div className="flex items-end justify-between gap-3 md:justify-end">
                                <div className="md:text-right">
                                    <p className="text-xs text-muted-foreground">Monto vigente</p>
                                    <p className="text-base font-semibold tabular-nums md:text-lg">
                                        <ResponsiveAmount
                                            amount={displayedAmount}
                                            currency={commitment.currency}
                                        />
                                    </p>
                                    {commitment.resolvedAmountEffectiveFrom && (
                                        <p className="text-xs text-muted-foreground">
                                            Vigente desde{' '}
                                            {formatDate(
                                                commitment.resolvedAmountEffectiveFrom,
                                                false
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-1">
                                {canApply && (
                                    <Button
                                        size="sm"
                                        className="min-h-10"
                                        onClick={() => onApply(commitment)}
                                    >
                                        Aplicar
                                    </Button>
                                )}
                                {lifecycle === 'inactive' ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-h-10"
                                        onClick={() => onReactivate(commitment)}
                                    >
                                        <RotateCcw className="size-4" />
                                        Reactivar
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-10"
                                            aria-label={`Cambiar monto de ${commitment.description}`}
                                            onClick={() => onUpdateAmount(commitment)}
                                        >
                                            <CircleDollarSign className="size-4.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-10"
                                            aria-label={`Editar ${commitment.description}`}
                                            onClick={() => onEdit(commitment)}
                                        >
                                            <Pencil className="size-4.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-10"
                                            aria-label={`Desactivar ${commitment.description}`}
                                            onClick={() =>
                                                onDeactivate(commitment._id.toString())
                                            }
                                        >
                                            <EyeOff className="size-4.5 text-muted-foreground" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {schedule.length > 1 && (
                        <div className="mt-3 border-t pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-10 px-2"
                                onClick={() => setHistoryOpen((current) => !current)}
                                aria-expanded={historyOpen}
                            >
                                <ChevronDown
                                    className={cn(
                                        'size-4 transition-transform',
                                        historyOpen && 'rotate-180'
                                    )}
                                />
                                {historyOpen ? 'Ocultar historial' : 'Ver historial de montos'}
                            </Button>

                            {historyOpen && (
                                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                                    {schedule.map((entry) => (
                                        <li
                                            key={new Date(entry.effectiveFrom).toISOString()}
                                            className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                                        >
                                            <span className="text-muted-foreground">
                                                Desde {formatDate(entry.effectiveFrom)}
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                <ResponsiveAmount
                                                    amount={entry.amount}
                                                    currency={commitment.currency}
                                                />
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </motion.article>
    )
}
