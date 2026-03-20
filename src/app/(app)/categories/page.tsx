'use client'

import { useState, useEffect } from 'react'
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CategoryDialog } from '@/components/shared/CategoryDialog'
import { fadeIn, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import type { CategoryFormData } from '@/lib/validations'
import type { ICategory } from '@/types'

type DefaultCategoryItem = { name: string; type: string; color: string }

function CategoryItem({
                          item,
                          selected,
                          onClick,
                          disabled,
                      }: {
    item: DefaultCategoryItem
    selected: boolean
    onClick: () => void
    disabled?: boolean
}) {
    return (
        <div
            onClick={disabled ? undefined : onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors"
            style={{
                background: selected ? 'var(--sky-light)' : 'transparent',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                borderLeft: selected ? '2px solid var(--sky)' : '2px solid transparent',
            }}
        >
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="text-xs ml-auto"
                  style={{ color: item.type === 'income' ? '#10B981' : 'var(--muted-foreground)' }}>
        {item.type === 'income' ? 'Ingreso' : 'Gasto'}
      </span>
        </div>
    )
}

function TransferList({
                          missing,
                          existing,
                          onConfirm,
                          onClose,
                      }: {
    missing: DefaultCategoryItem[]
    existing: DefaultCategoryItem[]
    onConfirm: (names: string[]) => Promise<void>
    onClose: () => void
}) {
    const [left, setLeft] = useState<DefaultCategoryItem[]>(missing)
    const [right, setRight] = useState<DefaultCategoryItem[]>(existing)
    const [selectedLeft, setSelectedLeft] = useState<Set<string>>(new Set())
    const [selectedRight, setSelectedRight] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)

    const toggleLeft = (name: string) => {
        setSelectedLeft((prev) => {
            const next = new Set(prev)
            next.has(name) ? next.delete(name) : next.add(name)
            return next
        })
    }

    const toggleRight = (name: string) => {
        const item = right.find((r) => r.name === name)
        if (existing.find((e) => e.name === item?.name)) return
        setSelectedRight((prev) => {
            const next = new Set(prev)
            next.has(name) ? next.delete(name) : next.add(name)
            return next
        })
    }

    const moveToRight = () => {
        const toMove = left.filter((c) => selectedLeft.has(c.name))
        setRight((prev) => [...prev, ...toMove])
        setLeft((prev) => prev.filter((c) => !selectedLeft.has(c.name)))
        setSelectedLeft(new Set())
    }

    const moveToLeft = () => {
        const toMove = right.filter((c) => selectedRight.has(c.name))
        setLeft((prev) => [...prev, ...toMove])
        setRight((prev) => prev.filter((c) => !selectedRight.has(c.name)))
        setSelectedRight(new Set())
    }

    const handleConfirm = async () => {
        const newOnes = right.filter((r) => !existing.find((e) => e.name === r.name))
        if (newOnes.length === 0) { onClose(); return }
        try {
            setSaving(true)
            await onConfirm(newOnes.map((c) => c.name))
            onClose()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Disponibles ({left.length})
                    </p>
                    <div className="rounded-lg overflow-hidden min-h-52 max-h-52 overflow-y-auto"
                         style={{ border: '0.5px solid var(--border)', background: 'var(--muted)' }}>
                        {left.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-4 text-center">Todas agregadas</p>
                        ) : left.map((item) => (
                            <CategoryItem
                                key={item.name}
                                item={item}
                                selected={selectedLeft.has(item.name)}
                                onClick={() => toggleLeft(item.name)}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" className="w-8 h-8 p-0"
                            onClick={moveToRight} disabled={selectedLeft.size === 0}>
                        <ChevronRight size={14} />
                    </Button>
                    <Button variant="outline" size="sm" className="w-8 h-8 p-0"
                            onClick={moveToLeft} disabled={selectedRight.size === 0}>
                        <ChevronLeft size={14} />
                    </Button>
                </div>

                <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        A agregar ({right.filter((r) => !existing.find((e) => e.name === r.name)).length} nuevas)
                    </p>
                    <div className="rounded-lg overflow-hidden min-h-52 max-h-52 overflow-y-auto"
                         style={{ border: '0.5px solid var(--border)', background: 'var(--muted)' }}>
                        {right.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-4 text-center">Ninguna seleccionada</p>
                        ) : right.map((item) => {
                            const isExisting = !!existing.find((e) => e.name === item.name)
                            return (
                                <CategoryItem
                                    key={item.name}
                                    item={item}
                                    selected={selectedRight.has(item.name)}
                                    onClick={() => toggleRight(item.name)}
                                    disabled={isExisting}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Las categorías en gris ya existen y no se pueden quitar desde acá.
            </p>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button onClick={handleConfirm} disabled={saving}>
                    {saving ? 'Guardando...' : 'Agregar seleccionadas'}
                </Button>
            </div>
        </div>
    )
}

function DeleteCategoryDialog({
                                  category,
                                  categories,
                                  open,
                                  onOpenChange,
                                  onConfirm,
                              }: {
    category: ICategory | null
    categories: ICategory[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (id: string, migrateTo?: string) => Promise<void>
}) {
    const [migrateTo, setMigrateTo] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [usageCount, setUsageCount] = useState<number | null>(null)

    useEffect(() => {
        if (!open || !category) return
        setMigrateTo('')
        fetch(`/api/categories/${category._id}/usage`)
            .then((r) => r.json())
            .then((d) => setUsageCount(d.count ?? 0))
            .catch(() => setUsageCount(0))
    }, [open, category])

    if (!category) return null

    const otherCategories = categories.filter(
        (c) => c._id.toString() !== category._id.toString() && c.type === category.type
    )

    const handleConfirm = async () => {
        try {
            setLoading(true)
            await onConfirm(category._id.toString(), migrateTo || undefined)
            onOpenChange(false)
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar "{category.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {usageCount === null ? (
                            'Calculando uso...'
                        ) : usageCount === 0 ? (
                            'Esta categoría no tiene items asociados.'
                        ) : (
                            `Esta categoría tiene ${usageCount} item${usageCount !== 1 ? 's' : ''} asociado${usageCount !== 1 ? 's' : ''}.`
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {usageCount !== null && usageCount > 0 && (
                    <div className="space-y-2 py-2">
                        <p className="text-sm font-medium">Migrar items a:</p>
                        <Select value={migrateTo} onValueChange={setMigrateTo}>
                            <SelectTrigger>
                                <SelectValue placeholder="Dejar sin categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {otherCategories.map((c) => (
                                    <SelectItem key={c._id.toString()} value={c._id.toString()}>
                                        <div className="flex items-center gap-2">
                                            {c.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />}
                                            {c.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!migrateTo && (
                            <p className="text-xs text-muted-foreground">
                                Si no seleccionás una categoría destino, los items quedarán sin categorizar.
                            </p>
                        )}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-destructive text-white hover:bg-destructive/90"
                    >
                        {loading ? 'Eliminando...' : 'Eliminar'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default function CategoriesPage() {
    const { categories, loading, error, createCategory, updateCategory, deleteCategory, addDefaultCategories, fetchMissingDefaults } = useCategories()
    const { success, error: toastError } = useToast()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<ICategory | null>(null)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [categoryToDelete, setCategoryToDelete] = useState<ICategory | null>(null)
    const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false)
    const [defaultsData, setDefaultsData] = useState<{
        missing: DefaultCategoryItem[]
        existing: DefaultCategoryItem[]
    } | null>(null)
    const [loadingDefaults, setLoadingDefaults] = useState(false)

    usePageTitle('Categorías')

    const incomeCategories = categories.filter((c) => c.type === 'income')
    const expenseCategories = categories.filter((c) => c.type === 'expense')

    const handleCreate = () => { setSelectedCategory(null); setDialogOpen(true) }
    const handleEdit = (category: ICategory) => { setSelectedCategory(category); setDialogOpen(true) }

    const handleDeleteClick = (category: ICategory) => {
        setCategoryToDelete(category)
        setDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = async (id: string, migrateTo?: string) => {
        try {
            await deleteCategory(id, migrateTo)
            success('Categoría eliminada correctamente')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al eliminar categoría')
        }
    }

    const handleOpenDefaults = async () => {
        try {
            setLoadingDefaults(true)
            const data = await fetchMissingDefaults()
            setDefaultsData(data)
            setDefaultsDialogOpen(true)
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Error al cargar categorías predeterminadas')
        } finally {
            setLoadingDefaults(false)
        }
    }

    const handleAddDefaults = async (names: string[]) => {
        const created = await addDefaultCategories(names)
        success(`${created} categoría${created !== 1 ? 's' : ''} agregada${created !== 1 ? 's' : ''} correctamente`)
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
            <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Sin categorías</p>
            </div>
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs"
                                    style={{ color: 'var(--destructive)' }}
                                    onClick={() => handleDeleteClick(category)}>Eliminar</Button>
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
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleOpenDefaults} disabled={loadingDefaults}>
                        <Sparkles size={14} className="mr-1" />
                        {loadingDefaults ? 'Cargando...' : 'Predeterminadas'}
                    </Button>
                    <Button size="sm" onClick={handleCreate}>+ Nueva categoría</Button>
                </div>
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

            <DeleteCategoryDialog
                category={categoryToDelete}
                categories={categories}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteConfirm}
            />

            <Dialog open={defaultsDialogOpen} onOpenChange={setDefaultsDialogOpen}>
                <DialogContent className="max-w-2xl" style={{ maxWidth: '42rem' }}>
                    <DialogHeader>
                        <DialogTitle>Categorías predeterminadas</DialogTitle>
                    </DialogHeader>
                    {defaultsData && (
                        <TransferList
                            missing={defaultsData.missing}
                            existing={defaultsData.existing}
                            onConfirm={handleAddDefaults}
                            onClose={() => setDefaultsDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}