'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    Calendar,
    CheckCircle,
    Clock3,
    EyeOff,
    Pencil,
    Plus,
    Repeat,
    Sparkles,
    Wallet,
} from 'lucide-react'
import { useCommitments } from '@/hooks/useCommitments'
import { useCategories } from '@/hooks/useCategories'
import { useAccounts } from '@/hooks/useAccounts'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { CommitmentDialog } from '@/components/shared/CommitmentDialog'
import { ApplyCommitmentDialog } from '@/components/shared/ApplyCommitmentDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ResponsiveAmount } from '@/components/shared/ResponsiveAmount'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { CommitmentFormData } from '@/lib/validations'
import type { IScheduledCommitment } from '@/types'
import { cn } from '@/lib/utils'

const RECURRENCE_LABELS: Record<string, string> = {
    monthly: 'Mensual',
    weekly: 'Semanal',
    once: 'Una vez',
}

const APPLY_MODE_LABELS: Record<string, string> = {
    manual: 'Manual',
    auto_month_start: 'Automático',
}

const getCurrentPeriod = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const fmtDate = (date: Date | string) =>
    new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function getRefName(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { name?: unknown }
    return typeof candidate.name === 'string' ? candidate.name : null
}

function getRefColor(value: unknown): string | null {
    if (!value || typeof value === 'string' || typeof value !== 'object') return null
    const candidate = value as { color?: unknown }
    return typeof candidate.color === 'string' ? candidate.color : null
}

function SummaryCard({
    title,
    value,
    hint,
}: {
    title: string
    value: string
    hint: string
}) {
    return (
        <div
            className="min-w-[190px] shrink-0 snap-start rounded-xl p-3 md:min-w-0 md:rounded-2xl md:p-4"
            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
        >
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight md:mt-2 md:text-2xl">{value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground md:mt-1 md:text-xs">{hint}</p>
        </div>
    )
}

function CommitmentsLoadingState() {
    return (
        <div className="px-4 py-4 md:px-6 md:py-6 max-w-5xl mx-auto space-y-5 md:space-y-6">
            <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-9 w-36" />
            </div>

            <div className="grid gap-2.5 md:grid-cols-3 md:gap-3">
                {[...Array(3)].map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-xl md:rounded-2xl" />
                ))}
            </div>

            {[...Array(2)].map((_, sectionIndex) => (
                <div key={sectionIndex} className="space-y-3">
                    <Skeleton className="h-8 w-52" />
                    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                        {[...Array(2)].map((__, rowIndex) => (
                            <Skeleton key={rowIndex} className={cn('h-24 w-full rounded-none', rowIndex > 0 && 'border-t')} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function CommitmentRow({
    commitment,
    onApply,
    onEdit,
    onDelete,
}: {
    commitment: IScheduledCommitment
    onApply: (commitment: IScheduledCommitment) => void
    onEdit: (commitment: IScheduledCommitment) => void
    onDelete: (id: string) => void
}) {
    const isApplied = commitment.appliedThisMonth
    const categoryName = getRefName(commitment.categoryId)
    const categoryColor = getRefColor(commitment.categoryId)
    return (
        <motion.div variants={staggerItem}>
            <div className="px-2.5 py-2.5 md:px-5 md:py-4">
                <div className="flex items-start gap-2 md:gap-3">
                    <div
                        className="mt-0.5 flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-xl md:h-10 md:w-10"
                        style={{
                            background: isApplied ? 'rgba(16,185,129,0.10)' : 'rgba(2,132,199,0.10)',
                            color: isApplied ? '#10B981' : 'var(--sky)',
                        }}
                    >
                        {isApplied ? <CheckCircle className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                    <p className="truncate text-[12.5px] font-medium md:text-[15px]">{commitment.description}</p>
                                    <Badge variant="outline" className="h-4 rounded-md px-1.5 text-[9px] md:h-5 md:text-[10px]">
                                        {commitment.currency}
                                    </Badge>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                    <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[8.5px] md:px-2 md:py-0.5 md:text-[10px]">
                                        {RECURRENCE_LABELS[commitment.recurrence]}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[8.5px] md:px-2 md:py-0.5 md:text-[10px]">
                                        {APPLY_MODE_LABELS[commitment.applyMode]}
                                    </Badge>
                                    {isApplied && (
                                        <Badge className="rounded-md px-1.5 py-0 text-[8.5px] md:px-2 md:py-0.5 md:text-[10px]">
                                            Aplicado este mes
                                        </Badge>
                                    )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground md:gap-x-2 md:text-xs">
                                    {commitment.dayOfMonth && <span>Día {commitment.dayOfMonth}</span>}
                                    {commitment.startDate && <span>Desde {fmtDate(commitment.startDate)}</span>}
                                    {commitment.endDate && <span>Hasta {fmtDate(commitment.endDate)}</span>}
                                    {categoryName && (
                                        <span className="flex items-center gap-1">
                                            {categoryColor && (
                                                <span
                                                    className="h-2 w-2 rounded-full"
                                                    style={{ backgroundColor: categoryColor }}
                                                />
                                            )}
                                            {categoryName}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 md:justify-end md:gap-3">
                                <div className="text-left md:text-right">
                                    <p className="hidden text-[11px] uppercase tracking-[0.08em] text-muted-foreground md:block">
                                        Monto
                                    </p>
                                    <p className="text-[13px] font-semibold tabular-nums md:text-lg">
                                        <ResponsiveAmount amount={commitment.amount} currency={commitment.currency} />
                                    </p>
                                </div>

                                <div className="flex items-center gap-1">
                                    {!isApplied && (
                                        <Button
                                            size="sm"
                                            className="h-6.5 rounded-lg px-2 text-[10px] md:h-7 md:px-3 md:text-xs"
                                            onClick={() => onApply(commitment)}
                                        >
                                            Aplicar
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-7 w-7 md:h-8 md:w-8"
                                        aria-label="Editar compromiso"
                                        onClick={() => onEdit(commitment)}
                                    >
                                        <Pencil />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="h-7 w-7 md:h-8 md:w-8"
                                        aria-label="Desactivar compromiso"
                                        onClick={() => onDelete(commitment._id.toString())}
                                    >
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function CommitmentSection({
    title,
    description,
    icon: Icon,
    accent,
    commitments,
    onApply,
    onEdit,
    onDelete,
}: {
    title: string
    description: string
    icon: React.ElementType
    accent: string
    commitments: IScheduledCommitment[]
    onApply: (commitment: IScheduledCommitment) => void
    onEdit: (commitment: IScheduledCommitment) => void
    onDelete: (id: string) => void
}) {
    if (commitments.length === 0) return null

    return (
        <motion.section variants={staggerItem} className="space-y-2 md:space-y-3">
            <div className="flex items-center gap-3">
                <div
                    className="flex h-7.5 w-7.5 items-center justify-center rounded-xl md:h-10 md:w-10 md:rounded-2xl"
                    style={{ background: `${accent}15`, color: accent }}
                >
                    <Icon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-[13px] font-semibold md:text-base">{title}</h2>
                        <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[8.5px] md:text-[10px]">
                            {commitments.length}
                        </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground md:text-xs">{description}</p>
                </div>
            </div>

            <motion.div
                className="overflow-hidden rounded-2xl"
                style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {commitments.map((commitment, index) => (
                    <div
                        key={commitment._id.toString()}
                        style={index > 0 ? { borderTop: '0.5px solid var(--border)' } : undefined}
                    >
                        <CommitmentRow
                            commitment={commitment}
                            onApply={onApply}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </div>
                ))}
            </motion.div>
        </motion.section>
    )
}

export default function CommitmentsPage() {
    const { commitments, loading, error, createCommitment, updateCommitment, deleteCommitment } = useCommitments()
    const { categories } = useCategories()
    const { accounts } = useAccounts()
    const { success, error: toastError } = useToast()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [selected, setSelected] = useState<IScheduledCommitment | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [applyDialogOpen, setApplyDialogOpen] = useState(false)
    const [applyCommitment, setApplyCommitment] = useState<IScheduledCommitment | null>(null)
    const [appliedId, setAppliedId] = useState<string | null>(null)

    usePageTitle('Compromisos')

    const commitmentsWithRecentApply = useMemo(
        () =>
            commitments.map((commitment) => ({
                ...commitment,
                appliedThisMonth: commitment.appliedThisMonth || appliedId === commitment._id.toString(),
            })),
        [appliedId, commitments]
    )

    const pendingCommitments = useMemo(
        () =>
            commitmentsWithRecentApply.filter(
                (commitment) => !commitment.appliedThisMonth && commitment.applyMode === 'manual'
            ),
        [commitmentsWithRecentApply]
    )

    const appliedCommitments = useMemo(
        () => commitmentsWithRecentApply.filter((commitment) => commitment.appliedThisMonth),
        [commitmentsWithRecentApply]
    )

    const automaticCommitments = useMemo(
        () =>
            commitmentsWithRecentApply.filter(
                (commitment) => !commitment.appliedThisMonth && commitment.applyMode === 'auto_month_start'
            ),
        [commitmentsWithRecentApply]
    )

    const outstandingCount = useMemo(
        () => commitmentsWithRecentApply.filter((commitment) => !commitment.appliedThisMonth).length,
        [commitmentsWithRecentApply]
    )

    const handleCreate = () => {
        setSelected(null)
        setDialogOpen(true)
    }

    const handleEdit = (commitment: IScheduledCommitment) => {
        setSelected(commitment)
        setDialogOpen(true)
    }

    const handleDelete = (id: string) => setDeleteId(id)

    const handleApply = (commitment: IScheduledCommitment) => {
        setApplyCommitment(commitment)
        setApplyDialogOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        try {
            await deleteCommitment(deleteId)
            success('Compromiso desactivado correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al desactivar compromiso')
        } finally {
            setDeleteId(null)
        }
    }

    const handleSubmit = async (data: CommitmentFormData) => {
        try {
            if (selected) {
                await updateCommitment(selected._id.toString(), data as Record<string, unknown>)
                success('Compromiso actualizado correctamente')
            } else {
                await createCommitment(data as Record<string, unknown>)
                success('Compromiso creado correctamente')
            }
            setDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar compromiso')
        }
    }

    const handleApplySubmit = async (commitmentId: string, data: Record<string, unknown>) => {
        try {
            const res = await fetch(`/api/commitments/${commitmentId}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error)
            success('Compromiso aplicado correctamente')
            setApplyDialogOpen(false)
            setAppliedId(commitmentId)
            setTimeout(() => setAppliedId(null), 1800)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al aplicar compromiso')
        }
    }

    if (loading) return <CommitmentsLoadingState />

    if (error) {
        return (
            <div className="px-4 py-10 md:px-6">
                <p className="text-center text-sm text-destructive">{error}</p>
            </div>
        )
    }

    return (
        <motion.div className="px-4 py-3.5 pb-24 md:px-6 md:py-6 md:pb-6 max-w-5xl mx-auto space-y-3.5 md:space-y-6" {...fadeIn}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Compromisos</h1>
                    <p className="mt-1 text-xs text-muted-foreground md:text-sm">
                        Organizá tus pagos recurrentes y aplicalos sin perder de vista qué ya pasó este mes.
                    </p>
                </div>

                <Button size="sm" onClick={handleCreate} className="gap-2 w-full h-9 md:h-9 md:w-auto">
                    <Plus className="h-4 w-4" />
                    Nuevo compromiso
                </Button>
            </div>

            {commitments.length === 0 ? (
                <div
                    className="rounded-2xl"
                    style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                >
                    <EmptyState
                        icon={Calendar}
                        title="Sin compromisos programados"
                        description="Agregá alquiler, servicios, cuotas u otros gastos fijos para tenerlos siempre a mano."
                        actionLabel="Nuevo compromiso"
                        onAction={handleCreate}
                    />
                </div>
            ) : (
                <>
                    <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-3 md:overflow-visible">
                        <SummaryCard
                            title="Compromisos activos"
                            value={String(commitments.length)}
                            hint="Todo lo que sigue vigente y aparece en tu planificación"
                        />
                        <SummaryCard
                            title="Pendientes este mes"
                            value={String(outstandingCount)}
                            hint="Incluye manuales y automáticos que todavía no impactaron"
                        />
                        <SummaryCard
                            title="Automáticos"
                            value={String(automaticCommitments.length)}
                            hint="Se aplican solos al inicio del período configurado"
                        />
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                            type="button"
                            onClick={() => document.getElementById('commitments-pending')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.25 text-[10px] font-medium transition-colors md:gap-2 md:px-3 md:py-2 md:text-xs"
                            style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '0.5px solid var(--border)' }}
                        >
                            <Clock3 className="h-3.5 w-3.5 text-[var(--sky)]" />
                            Pendientes
                            <span className="text-muted-foreground">({pendingCommitments.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => document.getElementById('commitments-applied')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.25 text-[10px] font-medium transition-colors md:gap-2 md:px-3 md:py-2 md:text-xs"
                            style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '0.5px solid var(--border)' }}
                        >
                            <CheckCircle className="h-3.5 w-3.5 text-[#10B981]" />
                            Aplicados
                            <span className="text-muted-foreground">({appliedCommitments.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => document.getElementById('commitments-automatic')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.25 text-[10px] font-medium transition-colors md:gap-2 md:px-3 md:py-2 md:text-xs"
                            style={{ background: 'var(--secondary)', color: 'var(--foreground)', border: '0.5px solid var(--border)' }}
                        >
                            <Sparkles className="h-3.5 w-3.5 text-[#D97706]" />
                            Automáticos
                            <span className="text-muted-foreground">({automaticCommitments.length})</span>
                        </button>
                    </div>

                    <motion.div className="space-y-6 md:space-y-8" variants={staggerContainer} initial="initial" animate="animate">
                        <div id="commitments-pending">
                            <CommitmentSection
                                title="Pendientes del mes"
                                description="Los que todavía podés aplicar o revisar manualmente."
                                icon={Wallet}
                                accent="#0284C7"
                                commitments={pendingCommitments}
                                onApply={handleApply}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </div>

                        <div id="commitments-applied">
                            <CommitmentSection
                                title="Aplicados este mes"
                                description="Quedaron registrados en el período actual."
                                icon={CheckCircle}
                                accent="#10B981"
                                commitments={appliedCommitments}
                                onApply={handleApply}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </div>

                        <div id="commitments-automatic">
                            <CommitmentSection
                                title="Automáticos"
                                description="Se ejecutan según la configuración de aplicación automática."
                                icon={Repeat}
                                accent="#D97706"
                                commitments={automaticCommitments}
                                onApply={handleApply}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        </div>
                    </motion.div>
                </>
            )}

            <CommitmentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                commitment={selected}
                categories={categories}
                onSubmit={handleSubmit}
            />

            <ApplyCommitmentDialog
                open={applyDialogOpen}
                onOpenChange={setApplyDialogOpen}
                commitment={applyCommitment ? {
                    _id: applyCommitment._id.toString(),
                    description: applyCommitment.description,
                    amount: applyCommitment.amount,
                    currency: applyCommitment.currency,
                    dayOfMonth: applyCommitment.dayOfMonth,
                } : null}
                accounts={accounts}
                period={getCurrentPeriod()}
                onSubmit={handleApplySubmit}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desactivar este compromiso?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dejará de aparecer en la proyección y en la lista activa, pero el historial se conserva.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Desactivar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    )
}
