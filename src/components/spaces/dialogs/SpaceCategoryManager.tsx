'use client'

import { useMemo, useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useSpaceCategories } from '@/hooks/useSpaceCategories'
import { useToast } from '@/hooks/useToast'
import { extractId, SPACE_ENTRY_TYPE_LABELS } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { SpaceCategoryType } from '@/types'

const COLOR_PRESETS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#6B7280']
const CATEGORY_TYPES: SpaceCategoryType[] = ['expense', 'income', 'adjustment']

export function SpaceCategoryManager({
    spaceId,
    canManage = true,
}: {
    spaceId: string
    canManage?: boolean
}) {
    const { categories, createCategory, archiveCategory, seedCategories } = useSpaceCategories(spaceId)
    const { success, error: toastError } = useToast()
    const [name, setName] = useState('')
    const [color, setColor] = useState(COLOR_PRESETS[0])
    const [type, setType] = useState<SpaceCategoryType>('expense')
    const [saving, setSaving] = useState(false)
    const [archivingId, setArchivingId] = useState<string | null>(null)

    const groupedCategories = useMemo(
        () =>
            CATEGORY_TYPES.map((categoryType) => ({
                type: categoryType,
                categories: categories.filter((category) => category.type === categoryType),
            })),
        [categories]
    )

    const handleCreate = async () => {
        const nextName = name.trim()
        if (!nextName || !canManage) return

        setSaving(true)
        try {
            await createCategory({ name: nextName, color, type })
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
            success('Categoría archivada')
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'No pudimos archivar la categoría.')
        } finally {
            setArchivingId(null)
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
            {categories.length === 0 && canManage ? (
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
                {groupedCategories.map((group) =>
                    group.categories.length > 0 ? (
                        <div key={group.type} className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                                {SPACE_ENTRY_TYPE_LABELS[group.type]}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {group.categories.map((category) => {
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
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            ) : null}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    ) : null
                )}
            </div>

            {canManage ? (
                <div className="grid gap-3 rounded-[18px] border border-foreground/[0.07] bg-background/70 p-3 md:grid-cols-[minmax(0,1fr)_9rem_auto]">
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
                    <Select value={type} onValueChange={(value) => setType(value as SpaceCategoryType)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {CATEGORY_TYPES.map((categoryType) => (
                                <SelectItem key={categoryType} value={categoryType}>
                                    {SPACE_ENTRY_TYPE_LABELS[categoryType]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        type="button"
                        className="rounded-full"
                        onClick={handleCreate}
                        disabled={saving || !name.trim()}
                    >
                        <Plus className="h-4 w-4" />
                        Agregar
                    </Button>
                    <div className="flex flex-wrap gap-1 md:col-span-3">
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
            ) : null}
        </div>
    )
}
