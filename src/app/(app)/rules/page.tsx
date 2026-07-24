'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Activity,
    ArrowRight,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FileInput,
    Layers3,
    Lightbulb,
    Plus,
    ReceiptText,
    Sparkles,
    Wand2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
    TransactionRuleDialog,
    type RuleFormValues,
} from '@/components/shared/TransactionRuleDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { RuleCard } from '@/components/rules/RuleCard'
import { RuleSuggestionCard } from '@/components/rules/RuleSuggestionCard'
import { useTransactionRules } from '@/hooks/useTransactionRules'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { usePageTitle } from '@/hooks/usePageTitle'
import { fadeIn, staggerContainer } from '@/lib/utils/animations'
import type { TransactionRuleSuggestion } from '@/lib/utils/rule-suggestions'
import type { ITransactionRule, QuickCaptureLearnedPatternDto } from '@/types'

type RuleFilter = 'active' | 'all' | 'paused'

function getReferenceId(value: unknown) {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && '_id' in value) {
        return (value as { _id?: { toString(): string } })._id?.toString()
    }
    return String(value)
}

function SummaryMetric({
    label,
    value,
    hint,
    icon: Icon,
}: {
    label: string
    value: string
    hint: string
    icon: React.ElementType
}) {
    return (
        <Card size="sm" className="gap-0 py-0">
            <CardContent className="flex items-start justify-between gap-3 px-4 py-4">
                <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--sky)_10%,transparent)] text-[var(--sky-dark)]">
                    <Icon className="h-4 w-4" />
                </div>
            </CardContent>
        </Card>
    )
}

function RulesLoadingState() {
    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 md:px-6 md:py-7">
            <Skeleton className="h-56 rounded-[28px]" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                    <Skeleton key={item} className="h-28 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
        </div>
    )
}

function RulesPageInner() {
    const router = useRouter()
    const searchParams = useSearchParams()
    usePageTitle('Reglas automáticas')

    const {
        rules,
        loading,
        suggestions,
        suggestionsLoading,
        createRule,
        updateRule,
        toggleRule,
        deleteRule,
        dismissSuggestion,
        fetchSuggestions,
        simulateRule,
    } = useTransactionRules()
    const { categories } = useCategories()
    const { success, error: toastError } = useToast()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<ITransactionRule | null>(null)
    const [initialValues, setInitialValues] =
        useState<Partial<RuleFormValues> | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<ITransactionRule | null>(null)
    const [filter, setFilter] = useState<RuleFilter>('active')
    const suggestionsRailRef = useRef<HTMLDivElement>(null)

    const activeRules = useMemo(
        () => rules.filter((rule) => rule.isActive),
        [rules]
    )
    const pausedRules = useMemo(
        () => rules.filter((rule) => !rule.isActive),
        [rules]
    )
    const visibleRules =
        filter === 'active'
            ? activeRules
            : filter === 'paused'
                ? pausedRules
                : rules
    const totalMatches = rules.reduce(
        (total, rule) => total + (rule.matchCount ?? 0),
        0
    )
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const usedThisMonth = rules.filter(
        (rule) =>
            rule.lastMatchedAt &&
            new Date(rule.lastMatchedAt).getTime() >= monthStart.getTime()
    ).length

    useEffect(() => {
        if (searchParams.get('create') !== '1') return
        setEditingRule(null)
        setInitialValues(null)
        setDialogOpen(true)
        router.replace('/rules', { scroll: false })
    }, [router, searchParams])

    useEffect(() => {
        const patternKey = searchParams.get('fromLearning')
        if (!patternKey || !/^[a-f0-9]{64}$/.test(patternKey)) return
        const controller = new AbortController()

        void fetch(`/api/quick-capture/learning/patterns/${patternKey}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                const result = await response.json()
                if (!response.ok) {
                    throw new Error(
                        result.error ?? 'No se pudo cargar el patrón aprendido'
                    )
                }
                const pattern =
                    result.pattern as QuickCaptureLearnedPatternDto
                setEditingRule(null)
                setInitialValues({
                    name: `${pattern.triggerLabel} → ${pattern.targetLabel}`.slice(
                        0,
                        100
                    ),
                    isActive: true,
                    priority: 20,
                    appliesTo: pattern.transactionType,
                    field:
                        pattern.triggerKind === 'merchant'
                            ? 'merchant'
                            : 'description',
                    condition: 'equals',
                    value: pattern.triggerLabel,
                    categoryId:
                        pattern.targetType === 'category'
                            ? pattern.targetId
                            : undefined,
                    setType: '',
                    normalizeMerchant:
                        pattern.targetType === 'merchant'
                            ? pattern.targetValue ?? pattern.targetLabel
                            : '',
                })
                setDialogOpen(true)
                router.replace('/rules', { scroll: false })
            })
            .catch((error) => {
                if (controller.signal.aborted) return
                toastError(
                    error instanceof Error
                        ? error.message
                        : 'No se pudo cargar el patrón aprendido'
                )
                router.replace('/rules', { scroll: false })
            })

        return () => controller.abort()
    }, [router, searchParams, toastError])

    const handleOpenCreate = () => {
        setEditingRule(null)
        setInitialValues(null)
        setDialogOpen(true)
    }

    const handleEdit = (rule: ITransactionRule) => {
        setEditingRule(rule)
        setInitialValues(null)
        setDialogOpen(true)
    }

    const handleReviewSuggestion = (suggestion: TransactionRuleSuggestion) => {
        const category = categories.find(
            (item) => item._id.toString() === suggestion.categoryId
        )
        setEditingRule(null)
        setInitialValues({
            name: `${suggestion.value} → ${category?.name ?? 'categoría habitual'}`.slice(0, 100),
            isActive: true,
            priority: 20,
            appliesTo: suggestion.appliesTo,
            field: suggestion.field,
            condition: suggestion.condition,
            value: suggestion.value,
            categoryId: suggestion.categoryId,
            setType: '',
            normalizeMerchant: suggestion.normalizeMerchant ?? '',
        })
        setDialogOpen(true)
    }

    const handleDismissSuggestion = async (
        suggestion: TransactionRuleSuggestion
    ) => {
        try {
            await dismissSuggestion(suggestion.key)
            success('Sugerencia descartada')
        } catch (error) {
            toastError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo descartar la sugerencia'
            )
        }
    }

    const scrollSuggestions = (direction: -1 | 1) => {
        suggestionsRailRef.current?.scrollBy({
            left: direction * Math.min(suggestionsRailRef.current.clientWidth * 0.9, 480),
            behavior: 'smooth',
        })
    }

    const handleDuplicate = async (rule: ITransactionRule) => {
        try {
            await createRule({
                name: `${rule.name} (copia)`,
                isActive: false,
                priority: rule.priority,
                appliesTo: rule.appliesTo,
                field: rule.field,
                condition: rule.condition,
                value: rule.value,
                categoryId: getReferenceId(rule.categoryId) as unknown as ITransactionRule['categoryId'],
                setType: rule.setType,
                normalizeMerchant: rule.normalizeMerchant,
            })
        } catch (error) {
            toastError(
                error instanceof Error ? error.message : 'Error al duplicar regla'
            )
        }
    }

    const handleSubmit = async (data: RuleFormValues) => {
        try {
            const payload = {
                ...data,
                setType: data.setType || undefined,
                normalizeMerchant: data.normalizeMerchant || undefined,
                categoryId: data.categoryId || undefined,
            }

            if (editingRule) {
                await updateRule(
                    editingRule._id.toString(),
                    payload as Partial<ITransactionRule>
                )
            } else {
                await createRule(payload as Partial<ITransactionRule>)
            }

            setDialogOpen(false)
            setInitialValues(null)
            await fetchSuggestions()
        } catch (error) {
            toastError(
                error instanceof Error ? error.message : 'Error al guardar regla'
            )
        }
    }

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return
        try {
            await deleteRule(deleteTarget._id.toString())
        } catch (error) {
            toastError(
                error instanceof Error ? error.message : 'Error al eliminar regla'
            )
        } finally {
            setDeleteTarget(null)
        }
    }

    if (loading) return <RulesLoadingState />

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 pb-24 md:px-6 md:py-7 md:pb-8">
            <motion.section
                {...fadeIn}
                className="relative overflow-hidden rounded-[28px] border border-foreground/[0.08] p-5 md:p-7"
                style={{
                    background:
                        'radial-gradient(circle at top left, color-mix(in srgb, var(--sky) 18%, transparent) 0%, transparent 38%), linear-gradient(180deg, color-mix(in srgb, var(--card) 97%, transparent) 0%, color-mix(in srgb, var(--card) 91%, transparent) 100%)',
                    boxShadow: 'var(--card-shadow)',
                }}
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--sky)]/40 to-transparent" />
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
                    <div className="space-y-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Automatizaciones
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-[2.15rem]">
                                Reglas automáticas
                            </h1>
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-[0.95rem]">
                                Finp reconoce patrones y completa tus movimientos de forma
                                consistente. Vos decidís qué automatizar y podés probar cada
                                regla antes de activarla.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="gap-1.5 rounded-full bg-background/55">
                                <ReceiptText className="h-3.5 w-3.5" />
                                Nuevos movimientos
                            </Badge>
                            <Badge variant="outline" className="gap-1.5 rounded-full bg-background/55">
                                <FileInput className="h-3.5 w-3.5" />
                                Importaciones y cuotas
                            </Badge>
                            <Badge variant="outline" className="gap-1.5 rounded-full bg-background/55">
                                <Layers3 className="h-3.5 w-3.5" />
                                Compromisos y Espacios
                            </Badge>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-foreground/[0.07] bg-background/55 p-4 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--sky)_14%,transparent)] text-[var(--sky-dark)]">
                                <Wand2 className="h-4.5 w-4.5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Creá una automatización</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    Definí cuándo actúa, qué completa y probala con un ejemplo real.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            className="mt-4 w-full gap-2"
                            onClick={handleOpenCreate}
                        >
                            <Plus className="h-4 w-4" />
                            Nueva regla
                        </Button>
                    </div>
                </div>
            </motion.section>

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <SummaryMetric
                    label="Reglas activas"
                    value={String(activeRules.length)}
                    hint={`${pausedRules.length} pausada${pausedRules.length === 1 ? '' : 's'}`}
                    icon={CheckCircle2}
                />
                <SummaryMetric
                    label="Automatizaciones"
                    value={String(totalMatches)}
                    hint="coincidencias acumuladas"
                    icon={Activity}
                />
                <SummaryMetric
                    label="Usadas este mes"
                    value={String(usedThisMonth)}
                    hint="reglas con actividad reciente"
                    icon={Sparkles}
                />
                <SummaryMetric
                    label="Sugerencias"
                    value={suggestionsLoading ? '…' : String(suggestions.length)}
                    hint="patrones listos para revisar"
                    icon={Lightbulb}
                />
            </section>

            <section className="space-y-3 overflow-hidden">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Sugerencias de Finp
                        </p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                            Patrones que podrías automatizar
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Se generan sólo cuando tu historial muestra una categoría consistente.
                        </p>
                    </div>
                    {suggestions.length > 0 ? (
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="rounded-full">
                                {suggestions.length} pendiente{suggestions.length === 1 ? '' : 's'}
                            </Badge>
                            {suggestions.length > 2 && (
                                <div className="hidden items-center gap-1 sm:flex">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => scrollSuggestions(-1)}
                                        aria-label="Ver sugerencias anteriores"
                                    >
                                        <ChevronLeft />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon-sm"
                                        onClick={() => scrollSuggestions(1)}
                                        aria-label="Ver más sugerencias"
                                    >
                                        <ChevronRight />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {suggestionsLoading ? (
                    <div className="grid gap-3 lg:grid-cols-2">
                        <Skeleton className="h-60 rounded-xl" />
                        <Skeleton className="h-60 rounded-xl" />
                    </div>
                ) : suggestions.length > 0 ? (
                    <div
                        ref={suggestionsRailRef}
                        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
                        role="region"
                        tabIndex={0}
                        aria-label="Sugerencias de automatización"
                    >
                        {suggestions.map((suggestion) => (
                            <div
                                key={suggestion.key}
                                className="min-w-[calc(100%-1.5rem)] snap-start sm:min-w-[23rem] lg:min-w-[calc(50%-0.375rem)]"
                            >
                                <RuleSuggestionCard
                                    suggestion={suggestion}
                                    category={categories.find(
                                        (category) =>
                                            category._id.toString() === suggestion.categoryId
                                    )}
                                    onReview={handleReviewSuggestion}
                                    onDismiss={handleDismissSuggestion}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-start gap-3 py-2 sm:flex-row sm:items-center">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                <Lightbulb className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">Sin sugerencias nuevas</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    Finp seguirá observando patrones. Necesita al menos tres
                                    movimientos consistentes antes de proponerte una regla.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5"
                                onClick={handleOpenCreate}
                            >
                                Crear manualmente
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Configuración
                        </p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight">Tus reglas</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            La primera regla que coincide según prioridad es la que se aplica.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit gap-1.5"
                        onClick={handleOpenCreate}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Nueva regla
                    </Button>
                </div>

                <Tabs
                    value={filter}
                    onValueChange={(value) => setFilter(value as RuleFilter)}
                    className="gap-4"
                >
                    <TabsList className="w-full sm:w-fit">
                        <TabsTrigger value="active">
                            Activas
                            <span className="text-[10px] text-muted-foreground">
                                {activeRules.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="all">
                            Todas
                            <span className="text-[10px] text-muted-foreground">
                                {rules.length}
                            </span>
                        </TabsTrigger>
                        <TabsTrigger value="paused">
                            Pausadas
                            <span className="text-[10px] text-muted-foreground">
                                {pausedRules.length}
                            </span>
                        </TabsTrigger>
                    </TabsList>

                    {(['active', 'all', 'paused'] as const).map((tab) => (
                        <TabsContent key={tab} value={tab}>
                            {visibleRules.length > 0 ? (
                                <motion.div
                                    variants={staggerContainer}
                                    initial="initial"
                                    animate="animate"
                                    className="space-y-3"
                                >
                                    {visibleRules.map((rule) => (
                                        <RuleCard
                                            key={rule._id.toString()}
                                            rule={rule}
                                            categories={categories}
                                            onEdit={handleEdit}
                                            onDelete={setDeleteTarget}
                                            onToggle={toggleRule}
                                            onDuplicate={handleDuplicate}
                                        />
                                    ))}
                                </motion.div>
                            ) : (
                                <EmptyState
                                    icon={Wand2}
                                    title={
                                        filter === 'paused'
                                            ? 'No hay reglas pausadas'
                                            : filter === 'active'
                                                ? 'No hay reglas activas'
                                                : 'Todavía no creaste reglas'
                                    }
                                    description={
                                        filter === 'active'
                                            ? 'Activá una regla existente o creá una nueva automatización.'
                                            : 'Las reglas completan categoría, comercio o tipo cuando un movimiento coincide.'
                                    }
                                    actionLabel="Crear regla"
                                    onAction={handleOpenCreate}
                                />
                            )}
                        </TabsContent>
                    ))}
                </Tabs>
            </section>

            <Card className="bg-[color-mix(in_srgb,var(--sky)_5%,var(--card))]">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[var(--sky-dark)]" />
                        Cómo decide Finp
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 pb-1 md:grid-cols-3">
                    {[
                        ['1', 'Normaliza', 'Ignora tildes, signos, espacios y referencias bancarias variables.'],
                        ['2', 'Compara', 'Evalúa las reglas activas desde la prioridad más alta.'],
                        ['3', 'Explica', 'Guarda qué regla coincidió y qué acciones aplicó.'],
                    ].map(([step, title, description]) => (
                        <div key={step} className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-[var(--sky-dark)]">
                                {step}
                            </span>
                            <div>
                                <p className="text-sm font-medium">{title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <TransactionRuleDialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open)
                    if (!open) setInitialValues(null)
                }}
                rule={editingRule}
                initialValues={initialValues}
                categories={categories}
                onSubmit={handleSubmit}
                onSimulate={simulateRule}
            />

            <AlertDialog
                open={Boolean(deleteTarget)}
                onOpenChange={(open) => {
                    if (!open) setDeleteTarget(null)
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará “{deleteTarget?.name}”. Las transacciones existentes
                            conservarán la trazabilidad de las aplicaciones anteriores.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-primary-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default function RulesPage() {
    return (
        <Suspense fallback={<RulesLoadingState />}>
            <RulesPageInner />
        </Suspense>
    )
}
