'use client'

import { useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { CategoryFormData } from '@/lib/validations'
import type { ICategory } from '@/types'

const CATEGORY_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
}

const CATEGORY_TYPE_COLORS: Record<string, string> = {
    income: 'text-green-600 bg-green-50 border-green-200',
    expense: 'text-orange-600 bg-orange-50 border-orange-200',
}

export default function CategoriesPage() {
    const { categories, loading, error, createCategory, updateCategory, archiveCategory } = useCategories()
    const { success, error: toastError } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<ICategory | null>(null)
    const [archiveId, setArchiveId] = useState<string | null>(null)

    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    const handleCreate = () => {
        setSelectedCategory(null)
        setDialogOpen(true)
    }

    const handleEdit = (category: ICategory) => {
        setSelectedCategory(category)
        setDialogOpen(true)
    }

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
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-10 w-40" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    )

    if (error) return <div className="p-8 text-center text-destructive">{error}</div>

    const renderList = (list: ICategory[]) => (
        list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sin categorías</p>
        ) : (
            <div className="space-y-1">
                {list.map((category) => (
                    <div
                        key={category._id.toString()}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: category.color ?? '#e5e7eb' }}
                            />
                            <span className="text-sm font-medium truncate">{category.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${CATEGORY_TYPE_COLORS[category.type]}`}>
                {CATEGORY_TYPE_LABELS[category.type]}
              </span>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(category)}>
                                Editar
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setArchiveId(category._id.toString())}>
                                Archivar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        )
    )

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Categorías</h1>
                <Button onClick={handleCreate}>+ Nueva categoría</Button>
            </div>

            <Card>
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                            Ingresos
                        </h2>
                        {renderList(incomeCategories)}
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                            Gastos
                        </h2>
                        {renderList(expenseCategories)}
                    </div>
                </CardContent>
            </Card>

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
                        <AlertDialogAction onClick={handleArchiveConfirm}>
                            Archivar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}