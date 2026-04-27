'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Plus, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ColorPicker } from '@/components/shared/ColorPicker'
import { useSpaceCategories } from '@/hooks/useSpaceCategories'
import { useToast } from '@/hooks/useToast'
import { extractId } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'

const COLOR_PRESETS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#6B7280']

export function SpaceCategoryManager({
    spaceId,
    canManage = true,
}: {
    spaceId: string
    canManage?: boolean
}) {
    const {
        activeCategories,
        archivedCategories,
        createCategory,
        archiveCategory,
        restoreCategory,
        seedCategories,
    } = useSpaceCategories(spaceId)
    const { success, error: toastError } = useToast()
    const [name, setName] = useState('')
    const [color, setColor] = useState(COLOR_PRESETS[0])
    const [saving, setSaving] = useState(false)
    const [archivingId, setArchivingId] = useState<string | null>(null)
    const [restoringId, setRestoringId] = useState<string | null>(null)
    const [showArchived, setShowArchived] = useState(false)

    const expenseCategories = useMemo(
        () => activeCategories.filter((category) => category.type === 'expense'),
        [activeCategories]
    )
    const archivedExpenseCategories = useMemo(
        () => archivedCategories.filter((category) => category.type === 'expense'),
        [archivedCategories]
    )

    const handleCreate = async () => {
        const nextName = name.trim()
        if (!nextName || !canManage) return

        setSaving(true)
        try {
            await createCategory({ name: nextName, color, type: 'expense' })
            setName('')
            success('Categoría agregada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos crear la categoría.')
        } finally {
            setSaving(false)
        }
    }

    const handleArchive = async (categoryId: string) => {
        if (!canManage) return

        setArchivingId(categoryId)
        try {
            await archiveCategory(categoryId)
            success('Categoría archivada. Los movimientos existentes la conservan, pero ya no aparecerá al crear nuevos gastos.')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos archivar la categoría.')
        } finally {
            setArchivingId(null)
        }
    }

    const handleRestore = async (categoryId: string) => {
        if (!canManage) return

        setRestoringId(categoryId)
        try {
            await restoreCategory(categoryId)
            success('Categoría restaurada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos restaurar la categoría.')
        } finally {
            setRestoringId(null)
        }
    }

    const handleSeed = async () => {
        if (!canManage) return

        setSaving(true)
        try {
            const result = await seedCategories()
            success(
                result.created.length > 0
                    ? 'Categorías sugeridas creadas'
                    : 'Las categorías sugeridas ya estaban creadas'
            )
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos crear las sugeridas.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4">
            {expenseCategories.length === 0 && canManage ? (
                <div className="rounded-[18px] border border-primary/15 bg-primary/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-semibold text-foreground">No hay categorías del espacio</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Podés crear las sugeridas para este tipo de espacio y ajustarlas después.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-full"
                            onClick={handleSeed}
                            disabled={saving}
                        >
                            <Sparkles className="h-4 w-4" />
                            Crear categorías sugeridas
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className="space-y-3">
                {expenseCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {expenseCategories.map((category) => {
                            const categoryId = extractId(category._id) ?? ''

                            return (
                                <span
                                    key={categoryId}
                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 text-sm font-medium text-foreground"
                                >
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: category.color }}
                                    />
                                    <span className="truncate">{category.name}</span>
                                    {canManage ? (
                                        <button
                                            type="button"
                                            className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                                            onClick={() => void handleArchive(categoryId)}
                                            disabled={archivingId === categoryId}
                                            aria-label={`Archivar ${category.name}`}
                                            title="Archivar"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    ) : null}
                                </span>
                            )
                        })}
                    </div>
                ) : null}

                {archivedExpenseCategories.length > 0 ? (
                    <div className="rounded-[18px] border border-border/70 bg-background/50">
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium text-foreground"
                            onClick={() => setShowArchived((previous) => !previous)}
                        >
                            <span>Categorías archivadas</span>
                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                {archivedExpenseCategories.length}
                                {showArchived ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </span>
                        </button>
                        {showArchived ? (
                            <div className="space-y-2 border-t border-border/70 p-3">
                                {archivedExpenseCategories.map((category) => {
                                    const categoryId = extractId(category._id) ?? ''

                                    return (
                                        <div
                                            key={categoryId}
                                            className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-muted/45 px-3 py-2"
                                        >
                                            <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                                                <span
                                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: category.color }}
                                                />
                                                <span className="truncate">{category.name}</span>
                                            </span>
                                            {canManage ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="rounded-full"
                                                    onClick={() => void handleRestore(categoryId)}
                                                    disabled={restoringId === categoryId}
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Restaurar
                                                </Button>
                                            ) : null}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {canManage ? (
                <div className="grid gap-3 rounded-[18px] border border-foreground/[0.07] bg-background/70 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                void handleCreate()
                            }
                        }}
                        placeholder="Nueva categoría"
                        maxLength={50}
                    />
                    <Button
                        type="button"
                        className="rounded-full"
                        onClick={handleCreate}
                        disabled={saving || !name.trim()}
                    >
                        <Plus className="h-4 w-4" />
                        Agregar
                    </Button>
                    <div className="space-y-2 md:col-span-2">
                        <ColorPicker label="Color" value={color} onChange={setColor} />
                        <div className="flex flex-wrap gap-1">
                            {COLOR_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    className={cn(
                                        'h-7 w-7 rounded-full border transition-transform hover:scale-105',
                                        color === preset ? 'border-foreground ring-2 ring-ring/30' : 'border-border'
                                    )}
                                    style={{ backgroundColor: preset }}
                                    onClick={() => setColor(preset)}
                                    aria-label={`Usar color ${preset}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
