'use client'

import { useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import type { ICategory } from '@/types'

const CATEGORY_TYPE_LABELS: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
}

const CATEGORY_TYPE_VARIANTS: Record<string, 'default' | 'secondary'> = {
    income: 'default',
    expense: 'secondary',
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

    const handleSubmit = async (data: Partial<ICategory>) => {
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
            <div className="space-y-2">
                {list.map((category) => (
                    <div
                        key={category._id.toString()}
                        className="flex items-center justify-between rounded-md border px-4 py-3"
                    >
                        <div className="flex items-center gap-3">
                            {category.color && (
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                            )}
                            <span className="text-sm font-medium">{category.name}</span>
                            <Badge variant={CATEGORY_TYPE_VARIANTS[category.type]}>
                                {CATEGORY_TYPE_LABELS[category.type]}
                            </Badge>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(category)}>
                                Editar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setArchiveId(category._id.toString())}>
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
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            Ingresos
                        </h2>
                        {renderList(incomeCategories)}
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
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