'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
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
import { CategoryDialog } from '@/components/shared/CategoryDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { Tag } from 'lucide-react'
import type { CategoryFormData } from '@/lib/validations'
import type { ICategory } from '@/types'

export default function CategoriesPage() {
    const { categories, loading, error, createCategory, updateCategory, archiveCategory } = useCategories()
    const { success, error: toastError } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<ICategory | null>(null)
    const [archiveId, setArchiveId] = useState<string | null>(null)

    usePageTitle('Categorías')

    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    const handleCreate = () => { setSelectedCategory(null); setDialogOpen(true) }
    const handleEdit = (category: ICategory) => { setSelectedCategory(category); setDialogOpen(true) }

    const handleArchiveConfirm = async () => {
        if (!archiveId) return
        try {
            await archiveCategory(archiveId)
            success('Categoría archivada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al archivar categoría')
        } finally {
            setArchiveId(null)
        }
    }

    const handleSubmit = async (data: CategoryFormData) => {
        try {
            if (selectedCategory) {
                await updateCategory(selectedCategory._id.toString(), data)
                success('Categoría actualizada correctamente')
            } else {
                await createCategory(data)
                success('Categoría creada correctamente')
            }
            setDialogOpen(false)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al guardar categoría')
        }
    }

    if (loading) return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-8 w-40" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive text-sm">{error}</div>

    const renderList = (list: ICategory[], type: 'income' | 'expense') => (
        list.length === 0 ? (
            <EmptyState
                icon={Tag}
                title={type === 'income' ? 'Sin categorías de ingreso' : 'Sin categorías de gasto'}
                actionLabel="+ Nueva categoría"
                onAction={handleCreate}
            />
        ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate">
                {list.map((category) => (
                    <motion.div
                        key={category._id.toString()}
                        variants={staggerItem}
                        className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                        style={{ borderBottom: '0.5px solid var(--border)' }}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: category.color ?? '#e5e7eb' }}
                            />
                            <span className="text-sm font-medium truncate">{category.name}</span>
                            <span
                                className="text-xs px-1.5 py-0.5 rounded shrink-0"
                                style={{
                                    background: type === 'income' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    color: type === 'income' ? '#10B981' : '#EF4444',
                                }}
                            >
                {type === 'income' ? 'Ingreso' : 'Gasto'}
              </span>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                                    onClick={() => handleEdit(category)}>Editar</Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                                    onClick={() => setArchiveId(category._id.toString())}>Archivar</Button>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        )
    )

    return (
        <motion.div className="p-6 max-w-3xl mx-auto space-y-6" {...fadeIn}>
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold tracking-tight">Categorías</h1>
                <Button size="sm" onClick={handleCreate}>+ Nueva categoría</Button>
            </div>

            <div className="rounded-xl overflow-hidden"
                 style={{ background: 'var(--card)', border: '0.5px solid var(--border)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingresos</p>
                </div>
                {renderList(incomeCategories, 'income')}

                <div className="px-4 py-3"
                     style={{ borderBottom: '0.5px solid var(--border)', borderTop: '0.5px solid var(--border)' }}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gastos</p>
                </div>
                {renderList(expenseCategories, 'expense')}
            </div>

            <CategoryDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                category={selectedCategory}
                onSubmit={handleSubmit}
            />

            <AlertDialog open={!!archiveId} onOpenChange={(o) => !o && setArchiveId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar esta categoría?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La categoría dejará de aparecer pero el historial se conserva.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveConfirm}>Archivar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    )
}