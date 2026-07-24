'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
    AlertTriangle,
    Loader2,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Trash2,
} from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import type {
    QuickCaptureAliasDto,
    QuickCaptureAliasTargetType,
} from '@/types'

const TYPE_LABELS: Record<QuickCaptureAliasTargetType, string> = {
    account: 'Cuenta',
    category: 'Categoría',
    merchant: 'Comercio',
    description: 'Descripción',
}

type AliasDraft = {
    term: string
    targetType: QuickCaptureAliasTargetType
    targetId: string
    targetValue: string
}

const EMPTY_DRAFT: AliasDraft = {
    term: '',
    targetType: 'account',
    targetId: '',
    targetValue: '',
}

function resolveId(value: unknown) {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'toString' in value) return value.toString()
    return ''
}

export function QuickCaptureAliasesSection() {
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const [aliases, setAliases] = useState<QuickCaptureAliasDto[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [query, setQuery] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editing, setEditing] = useState<QuickCaptureAliasDto>()
    const [deleting, setDeleting] = useState<QuickCaptureAliasDto>()
    const [draft, setDraft] = useState<AliasDraft>(EMPTY_DRAFT)

    const loadAliases = useCallback(async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/quick-capture/aliases', { cache: 'no-store' })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar los atajos')
            setAliases(result.aliases)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los atajos')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadAliases()
    }, [loadAliases])

    const filteredAliases = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase('es-AR')
        if (!normalized) return aliases
        return aliases.filter((alias) =>
            [alias.term, alias.targetLabel, TYPE_LABELS[alias.targetType]]
                .some((value) => value.toLocaleLowerCase('es-AR').includes(normalized))
        )
    }, [aliases, query])

    const targetOptions =
        draft.targetType === 'account'
            ? accounts.map((account) => ({
                id: resolveId(account._id),
                label: account.name,
                disabled: account.isActive === false,
            }))
            : draft.targetType === 'category'
                ? categories.map((category) => ({
                    id: resolveId(category._id),
                    label: category.name,
                    disabled: category.isArchived,
                }))
                : []

    function openCreate() {
        setEditing(undefined)
        setDraft(EMPTY_DRAFT)
        setDialogOpen(true)
    }

    function openEdit(alias: QuickCaptureAliasDto) {
        setEditing(alias)
        setDraft({
            term: alias.term,
            targetType: alias.targetType,
            targetId: alias.targetId ?? '',
            targetValue: alias.targetValue ?? '',
        })
        setDialogOpen(true)
    }

    async function saveAlias() {
        if (
            !draft.term.trim() ||
            ((draft.targetType === 'account' || draft.targetType === 'category') &&
                !draft.targetId) ||
            ((draft.targetType === 'merchant' || draft.targetType === 'description') &&
                !draft.targetValue.trim())
        ) {
            toast.error('Completá el término y su interpretación')
            return
        }
        setSaving(true)
        try {
            const response = await fetch(
                editing
                    ? `/api/quick-capture/aliases/${editing._id}`
                    : '/api/quick-capture/aliases',
                {
                    method: editing ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        term: draft.term,
                        targetType: draft.targetType,
                        targetId:
                            draft.targetType === 'account' || draft.targetType === 'category'
                                ? draft.targetId
                                : undefined,
                        targetValue:
                            draft.targetType === 'merchant' ||
                            draft.targetType === 'description'
                                ? draft.targetValue
                                : undefined,
                    }),
                }
            )
            const result = await response.json()
            if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar el atajo')
            setAliases((current) => [
                result.alias,
                ...current.filter((alias) => alias._id !== result.alias._id),
            ])
            setDialogOpen(false)
            toast.success(editing ? 'Atajo actualizado' : 'Atajo creado')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar el atajo')
        } finally {
            setSaving(false)
        }
    }

    async function deleteAlias() {
        if (!deleting) return
        try {
            const response = await fetch(`/api/quick-capture/aliases/${deleting._id}`, {
                method: 'DELETE',
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error ?? 'No se pudo eliminar el atajo')
            setAliases((current) => current.filter((alias) => alias._id !== deleting._id))
            setDeleting(undefined)
            toast.success('Atajo eliminado')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el atajo')
        }
    }

    return (
        <section className="space-y-5">
            <div className="rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Sparkles className="size-4" />
                    </span>
                    <div>
                        <h2 className="font-semibold">Atajos de captura</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Definí explícitamente cómo interpretar abreviaturas como “mp”.
                            Los atajos siempre tienen prioridad sobre patrones aprendidos.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar término o interpretación"
                        className="pl-9"
                    />
                </div>
                <Button onClick={openCreate}>
                    <Plus />
                    Nuevo atajo
                </Button>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 rounded-xl" />
                    ))}
                </div>
            ) : filteredAliases.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                    <Sparkles className="mx-auto size-5 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">
                        {query ? 'No hay atajos que coincidan' : 'Todavía no configuraste atajos'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        También podés crearlos desde una sugerencia de Captura rápida.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredAliases.map((alias) => (
                        <div
                            key={alias._id}
                            className="flex min-h-20 items-center gap-3 rounded-xl border bg-card p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <strong className="truncate text-sm">“{alias.term}”</strong>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="truncate text-sm">{alias.targetLabel}</span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <Badge variant="secondary">{TYPE_LABELS[alias.targetType]}</Badge>
                                    {alias.isStale ? (
                                        <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                                            <AlertTriangle />
                                            Requiere revisión
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Editar ${alias.term}`}
                                onClick={() => openEdit(alias)}
                            >
                                <Pencil />
                            </Button>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                aria-label={`Eliminar ${alias.term}`}
                                onClick={() => setDeleting(alias)}
                            >
                                <Trash2 />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar atajo' : 'Nuevo atajo'}</DialogTitle>
                        <DialogDescription>
                            Definí qué significa una palabra o abreviatura para vos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="capture-alias-term">Cuando escriba</Label>
                            <Input
                                id="capture-alias-term"
                                value={draft.term}
                                onChange={(event) => setDraft((current) => ({
                                    ...current,
                                    term: event.target.value,
                                }))}
                                placeholder="Ej: mp"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Interpretar como</Label>
                            <Select
                                value={draft.targetType}
                                onValueChange={(targetType: QuickCaptureAliasTargetType) =>
                                    setDraft((current) => ({
                                        ...current,
                                        targetType,
                                        targetId: '',
                                        targetValue: '',
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {draft.targetType === 'account' || draft.targetType === 'category' ? (
                            <div className="space-y-1.5">
                                <Label>{TYPE_LABELS[draft.targetType]}</Label>
                                <Select
                                    value={draft.targetId}
                                    onValueChange={(targetId) => setDraft((current) => ({
                                        ...current,
                                        targetId,
                                    }))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Elegir" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {targetOptions.map((option) => (
                                            <SelectItem
                                                key={option.id}
                                                value={option.id}
                                                disabled={option.disabled}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label htmlFor="capture-alias-value">
                                    {TYPE_LABELS[draft.targetType]}
                                </Label>
                                <Input
                                    id="capture-alias-value"
                                    value={draft.targetValue}
                                    onChange={(event) => setDraft((current) => ({
                                        ...current,
                                        targetValue: event.target.value,
                                    }))}
                                    placeholder={
                                        draft.targetType === 'merchant'
                                            ? 'Ej: Mercado Pago'
                                            : 'Ej: Café'
                                    }
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter className="-mx-4 -mb-4 mt-2">
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button disabled={saving} onClick={() => void saveAlias()}>
                            {saving ? <Loader2 className="animate-spin" /> : null}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(deleting)}
                onOpenChange={(open) => {
                    if (!open) setDeleting(undefined)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este atajo?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Finp dejará de interpretar “{deleting?.term}” como “
                            {deleting?.targetLabel}”.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void deleteAlias()}
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
