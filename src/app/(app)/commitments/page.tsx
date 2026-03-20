'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useCommitments } from '@/hooks/useCommitments'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
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
import { EmptyState } from '@/components/shared/EmptyState'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { Calendar } from 'lucide-react'
import type { CommitmentFormData } from '@/lib/validations'
import type { IScheduledCommitment } from '@/types'

const RECURRENCE_LABELS: Record<string, string> = {
    monthly: 'Mensual',
    weekly: 'Semanal',
    once: 'Una vez',
}

export default function CommitmentsPage() {
    const { commitments, loading, error, createCommitment, updateCommitment, deleteCommitment } = useCommitments()
    const { categories } = useCategories()
    const { success, error: toastError } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selected, setSelected] = useState<IScheduledCommitment | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    usePageTitle('Compromisos')

    const handleCreate = () => { setSelected(null); setDialogOpen(true) }
    const handleEdit = (c: IScheduledCommitment) => { setSelected(c); setDialogOpen(true) }
    const handleDelete = (id: string) => setDeleteId(id)

    const handleDeleteConfirm = async () => {
        if (!deleteId) return
        try {
            await deleteCommitment(deleteId)
            success('Compromiso desactivado correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al desactivar')
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

    const fmt = (amount: number, currency: string) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency', currency, maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-8 w-44" />
            </div>
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>

    return (
        <motion.div className="p-6 max-w-3xl mx-auto space-y-6" {...fadeIn}>
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold tracking-tight">Compromisos</h1>
                <Button size="sm" onClick={handleCreate}>+ Nuevo compromiso</Button>
            </div>

            {commitments.length === 0 ? (
                <div className="rounded-xl"
                     style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                    <EmptyState
                        icon={Calendar}
                        title="Sin compromisos programados"
                        description="Agregá gastos fijos como alquiler, servicios o cuotas"
                        actionLabel="+ Nuevo compromiso"
                        onAction={handleCreate}
                    />
                </div>
            ) : (
                <motion.div
                    className="space-y-2"
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                >
                    {commitments.map((commitment) => (
                        <motion.div
                            key={commitment._id.toString()}
                            variants={staggerItem}
                            className="rounded-xl px-4 py-3"
                            style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{commitment.description}</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded"
                                              style={{ background: 'var(--sky-light)', color: 'var(--sky-dark)' }}>
                      {RECURRENCE_LABELS[commitment.recurrence]}
                    </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {commitment.dayOfMonth && `Día ${commitment.dayOfMonth} · `}
                                        {commitment.applyMode === 'manual' ? 'Aplicación manual' : 'Aplicación automática'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="font-semibold text-sm tabular-nums">
                                        {fmt(commitment.amount, commitment.currency)}
                                    </p>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="sm" className="h-7 text-xs"
                                                onClick={() => handleEdit(commitment)}>
                                            Editar
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                                                onClick={() => handleDelete(commitment._id.toString())}>
                                            Desactivar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            <CommitmentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                commitment={selected}
                categories={categories}
                onSubmit={handleSubmit}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desactivar este compromiso?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El compromiso dejará de aparecer en la proyección.
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