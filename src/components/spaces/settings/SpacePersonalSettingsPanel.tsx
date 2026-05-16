'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Settings2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useCategories } from '@/hooks/useCategories'
import { useSpacePersonalSettings } from '@/hooks/useSpacePersonalSettings'
import type { SpacePersonalSettingsData } from '@/lib/validations'

type Strategy = SpacePersonalSettingsData['categoryStrategy']

type SpacePersonalSettingsPanelProps = {
    spaceId: string
}

const STRATEGIES: Array<{
    value: Strategy
    title: string
    description: string
}> = [
    {
        value: 'manual',
        title: 'Elegir categoría al impactar',
        description: 'Vas a elegir una categoría cada vez que registres un movimiento de este espacio en tu Finp.',
    },
    {
        value: 'space_name_virtual',
        title: 'Usar el nombre del espacio',
        description: 'Los gastos se agrupan bajo una categoría automática de este espacio en tu Finp.',
    },
    {
        value: 'fixed_personal_category',
        title: 'Usar una categoría fija',
        description: 'Todos los gastos de este espacio se registran con la categoría que elijas.',
    },
    {
        value: 'map_space_categories',
        title: 'Mapear categorías del espacio',
        description: 'Elegí qué categoría personal corresponde a cada categoría interna del espacio.',
    },
]

function idOf(value: unknown) {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        return value.toString()
    }
    return ''
}

export function SpacePersonalSettingsPanel({ spaceId }: SpacePersonalSettingsPanelProps) {
    const { categories } = useCategories()
    const { state, loading, error, saveSettings, migrateVirtualCategory } = useSpacePersonalSettings(spaceId)
    const [strategy, setStrategy] = useState<Strategy>('manual')
    const [fixedCategoryId, setFixedCategoryId] = useState('')
    const [mappings, setMappings] = useState<Record<string, string>>({})
    const [migrationTargetId, setMigrationTargetId] = useState('')
    const [saving, setSaving] = useState(false)
    const [savedMessage, setSavedMessage] = useState<string | null>(null)
    const [migrationMessage, setMigrationMessage] = useState<string | null>(null)

    const personalCategories = useMemo(
        () => categories.filter((category) => !category.isArchived && !category.isVirtual && !category.hiddenFromSettings),
        [categories]
    )

    useEffect(() => {
        if (!state) return
        const settings = state.settings
        setStrategy(settings?.categoryStrategy ?? state.suggestedStrategy ?? 'manual')
        setFixedCategoryId(idOf(settings?.defaultPersonalCategoryId))
        setMappings(
            Object.fromEntries(
                (settings?.categoryMappings ?? []).map((mapping) => [
                    idOf(mapping.spaceCategoryId),
                    idOf(mapping.personalCategoryId),
                ])
            )
        )
    }, [state])

    const save = async () => {
        setSaving(true)
        setSavedMessage(null)
        try {
            await saveSettings({
                categoryStrategy: strategy,
                defaultPersonalCategoryId:
                    strategy === 'fixed_personal_category' ? fixedCategoryId : undefined,
                categoryMappings:
                    strategy === 'map_space_categories'
                        ? Object.entries(mappings)
                            .filter(([, personalCategoryId]) => Boolean(personalCategoryId))
                            .map(([spaceCategoryId, personalCategoryId]) => ({
                                spaceCategoryId,
                                personalCategoryId,
                            }))
                        : [],
            })
            setSavedMessage('Configuración guardada.')
        } finally {
            setSaving(false)
        }
    }

    const migrate = async () => {
        if (!migrationTargetId) return
        setSaving(true)
        setMigrationMessage(null)
        try {
            const result = await migrateVirtualCategory(migrationTargetId)
            setMigrationMessage(
                `Migramos ${result.migratedTransactions} transacciones personales.`
            )
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <section className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando Mi Finp...
                </div>
            </section>
        )
    }

    return (
        <section className="space-y-5 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <Settings2 className="size-4 text-primary" />
                    <h3 className="font-semibold">Mi Finp</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    Esto solo afecta cómo los movimientos de este espacio aparecen en tu Finp personal.
                </p>
            </div>

            {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="grid gap-3 md:grid-cols-2">
                {STRATEGIES.map((option) => {
                    const selected = strategy === option.value
                    const recommended = state?.suggestedStrategy === option.value

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setStrategy(option.value)}
                            className={`min-h-28 rounded-xl border p-4 text-left transition-colors ${
                                selected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border bg-background hover:border-primary/50'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                    <p className="font-medium text-foreground">{option.title}</p>
                                    <p className="text-sm text-muted-foreground">{option.description}</p>
                                </div>
                                {selected && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />}
                            </div>
                            {recommended && (
                                <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                                    <Sparkles className="size-3" />
                                    Recomendado
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {personalCategories.length === 0 && strategy !== 'space_name_virtual' && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Todavía no tenés categorías personales. Podés usar “Elegir categoría al impactar” por ahora o crear una categoría desde Configuración.
                </div>
            )}

            {strategy === 'fixed_personal_category' && (
                <div className="space-y-2">
                    <Label>Categoría fija</Label>
                    <Select value={fixedCategoryId} onValueChange={setFixedCategoryId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Elegí una categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            {personalCategories.map((category) => (
                                <SelectItem key={idOf(category._id)} value={idOf(category._id)}>
                                    {category.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {strategy === 'map_space_categories' && (
                <div className="space-y-3 rounded-xl bg-muted/30 p-4">
                    <div className="space-y-1">
                        <p className="font-medium">Mapping de categorías</p>
                        <p className="text-sm text-muted-foreground">
                            Si una categoría queda sin mapping, la vas a elegir al impactar.
                        </p>
                    </div>
                    <div className="grid gap-3">
                        {(state?.spaceCategories ?? []).map((spaceCategory) => {
                            const spaceCategoryId = idOf(spaceCategory._id)
                            return (
                                <div key={spaceCategoryId} className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-center">
                                    <span className="text-sm font-medium">{spaceCategory.name}</span>
                                    <Select
                                        value={mappings[spaceCategoryId] ?? ''}
                                        onValueChange={(value) =>
                                            setMappings((prev) => ({
                                                ...prev,
                                                [spaceCategoryId]: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Elegí categoría personal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {personalCategories.map((category) => (
                                                <SelectItem key={idOf(category._id)} value={idOf(category._id)}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {state?.virtualCategory && (
                <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">
                            Categoría automática actual: {state.virtualCategory.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Esto solo cambia tus transacciones personales. No modifica el espacio ni afecta a otros participantes.
                        </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Select value={migrationTargetId} onValueChange={setMigrationTargetId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Migrar a otra categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {personalCategories.map((category) => (
                                    <SelectItem key={idOf(category._id)} value={idOf(category._id)}>
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button type="button" variant="secondary" onClick={migrate} disabled={!migrationTargetId || saving}>
                            Migrar
                        </Button>
                    </div>
                    {migrationMessage && <p className="text-sm text-emerald-600">{migrationMessage}</p>}
                </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    Guardar Mi Finp
                </Button>
                {savedMessage && <p className="text-sm text-emerald-600">{savedMessage}</p>}
            </div>
        </section>
    )
}
