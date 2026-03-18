'use client'

import { useState } from 'react'
import { useCommitments } from '@/hooks/useCommitments'
import { useCategories } from '@/hooks/useCategories'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CommitmentDialog } from '@/components/shared/CommitmentDialog'
import type { IScheduledCommitment } from '@/types'

const RECURRENCE_LABELS: Record<string, string> = {
    monthly: 'Mensual',
    weekly: 'Semanal',
    once: 'Una vez',
}

export default function CommitmentsPage() {
    const { commitments, loading, error, createCommitment, updateCommitment, deleteCommitment } = useCommitments()
    const { categories } = useCategories()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selected, setSelected] = useState<IScheduledCommitment | null>(null)

    const handleCreate = () => {
        setSelected(null)
        setDialogOpen(true)
    }

    const handleEdit = (commitment: IScheduledCommitment) => {
        setSelected(commitment)
        setDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Desactivar este compromiso?')) return
        try {
            await deleteCommitment(id)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al desactivar')
        }
    }

    const handleSubmit = async (data: Partial<IScheduledCommitment>) => {
        try {
            if (selected) {
                await updateCommitment(selected._id.toString(), data)
            } else {
                await createCommitment(data)
            }
            setDialogOpen(false)
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Error al guardar compromiso')
        }
    }

    const formatAmount = (amount: number, currency: string) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount)

    if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando compromisos...</div>
    if (error) return <div className="p-8 text-center text-destructive">{error}</div>

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Compromisos</h1>
                <Button onClick={handleCreate}>+ Nuevo compromiso</Button>
            </div>

            {commitments.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        No tenés compromisos programados.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {commitments.map((commitment) => (
                        <Card key={commitment._id.toString()}>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium">{commitment.description}</p>
                                            <Badge variant="secondary">
                                                {RECURRENCE_LABELS[commitment.recurrence]}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {commitment.dayOfMonth && `Día ${commitment.dayOfMonth} · `}
                                            {commitment.applyMode === 'manual' ? 'Aplicación manual' : 'Aplicación automática'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <p className="font-semibold text-red-600">
                                            {formatAmount(commitment.amount, commitment.currency)}
                                        </p>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(commitment)}>
                                                Editar
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(commitment._id.toString())}>
                                                Desactivar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CommitmentDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                commitment={selected}
                categories={categories}
                onSubmit={handleSubmit}
            />
        </div>
    )
}