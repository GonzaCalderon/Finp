'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FileSpreadsheet, ChevronRight, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/shared/Spinner'
import { useImportBatches } from '@/hooks/useImportBatch'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { IImportBatch } from '@/types'

const STATUS_META: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: '#d97706' },
    confirmed: { label: 'Confirmada', color: '#16a34a' },
    reverted: { label: 'Revertida', color: '#6b7280' },
}

function BatchCard({ batch, onDelete, onClick }: {
    batch: IImportBatch
    onDelete: (id: string) => void
    onClick: (id: string) => void
}) {
    const meta = STATUS_META[batch.status] ?? { label: batch.status, color: '#6b7280' }
    const date = new Date(batch.createdAt).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })

    return (
        <div
            className="rounded-xl border p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
            style={{ borderColor: 'var(--border)' }}
            onClick={() => onClick(String(batch._id))}
        >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(34, 197, 94, 0.12)' }}>
                <FileSpreadsheet className="w-4 h-4" style={{ color: '#16a34a' }} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                    >
                        {meta.label}
                    </span>
                </div>
                <p className="text-sm font-medium truncate">{batch.fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {date} · {batch.summary.total} filas · {batch.summary.imported} importadas
                </p>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
                {batch.status === 'draft' && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); onDelete(String(batch._id)) }}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
        </div>
    )
}

export default function ImportHistoryPage() {
    usePageTitle('Historial de importaciones')

    const router = useRouter()
    const { batches, loading, error, fetchBatches, deleteBatch } = useImportBatches()
    const { success, error: toastError } = useToast()

    useEffect(() => {
        fetchBatches()
    }, [fetchBatches])

    const handleDelete = async (id: string) => {
        try {
            await deleteBatch(id)
            success('Importación eliminada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar')
        }
    }

    return (
        <div className="flex flex-col min-h-full">
            <div className="flex items-center gap-3 px-4 md:px-6 py-3">
                <Button variant="ghost" size="sm" onClick={() => router.push('/transactions/import')} className="gap-1.5">
                    <ArrowLeft className="w-4 h-4" />
                    Importar
                </Button>
            </div>

            <motion.div
                className="flex-1 px-4 md:px-6 pb-8 max-w-2xl mx-auto w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="mb-5">
                    <h1 className="text-xl font-semibold">Historial de importaciones</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Importaciones realizadas en tu cuenta.
                    </p>
                </div>

                {loading && (
                    <div className="flex justify-center py-12">
                        <Spinner className="w-6 h-6" />
                    </div>
                )}

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                {!loading && !error && batches.length === 0 && (
                    <div className="text-center py-16 text-sm text-muted-foreground">
                        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p>No hay importaciones todavía.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => router.push('/transactions/import')}
                        >
                            Importar transacciones
                        </Button>
                    </div>
                )}

                {!loading && batches.length > 0 && (
                    <motion.div
                        className="space-y-2"
                        initial="initial"
                        animate="animate"
                        variants={{
                            initial: {},
                            animate: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
                        }}
                    >
                        {batches.map((batch) => (
                            <motion.div
                                key={String(batch._id)}
                                variants={{
                                    initial: { opacity: 0, y: 6 },
                                    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } },
                                }}
                            >
                                <BatchCard
                                    batch={batch}
                                    onDelete={handleDelete}
                                    onClick={(id) => router.push(`/transactions/import/${id}`)}
                                />
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </motion.div>
        </div>
    )
}
