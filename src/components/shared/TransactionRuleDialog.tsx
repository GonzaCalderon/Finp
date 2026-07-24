'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    AlertTriangle,
    CheckCircle2,
    FlaskConical,
    Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Spinner } from '@/components/shared/Spinner'
import type { ICategory, ITransactionRule } from '@/types'
import { RULE_APPLIES_TO, RULE_CONDITIONS, RULE_FIELDS } from '@/lib/constants'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import type {
    RuleSimulationResult,
    RuleSimulationRuleInput,
    RuleSimulationSample,
} from '@/hooks/useTransactionRules'

// ─── Schema ───────────────────────────────────────────────────────────────────

const ruleFormSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido').max(100),
    isActive: z.boolean(),
    priority: z.number().int().min(0, 'La prioridad mínima es 0').max(9999, 'La prioridad máxima es 9999'),
    appliesTo: z.enum([RULE_APPLIES_TO.EXPENSE, RULE_APPLIES_TO.INCOME, RULE_APPLIES_TO.ANY]),
    field: z.enum([RULE_FIELDS.DESCRIPTION, RULE_FIELDS.MERCHANT]),
    condition: z.enum([RULE_CONDITIONS.CONTAINS, RULE_CONDITIONS.EQUALS, RULE_CONDITIONS.STARTS_WITH]),
    value: z.string().min(1, 'El valor a buscar es requerido').max(200),
    categoryId: z.string().optional(),
    setType: z.enum(['expense', 'income', '']).optional(),
    normalizeMerchant: z.string().max(200).optional(),
})

export type RuleFormValues = z.infer<typeof ruleFormSchema>

// ─── Labels ───────────────────────────────────────────────────────────────────

const APPLIES_TO_LABELS: Record<string, string> = {
    expense: 'Gastos',
    income: 'Ingresos',
    any: 'Cualquier tipo',
}

const FIELD_LABELS: Record<string, string> = {
    description: 'Descripción',
    merchant: 'Comercio',
}

const CONDITION_LABELS: Record<string, string> = {
    contains: 'contiene',
    equals: 'es igual a',
    starts_with: 'empieza con',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TransactionRuleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    rule: ITransactionRule | null
    categories: ICategory[]
    onSubmit: (data: RuleFormValues) => Promise<void>
    onSimulate: (
        data: RuleSimulationRuleInput,
        sample: RuleSimulationSample,
        editingRuleId?: string
    ) => Promise<RuleSimulationResult>
}

export function TransactionRuleDialog({
    open,
    onOpenChange,
    rule,
    categories,
    onSubmit,
    onSimulate,
}: TransactionRuleDialogProps) {
    const {
        register,
        handleSubmit,
        control,
        getValues,
        setValue,
        reset,
        trigger,
        formState: { errors, isSubmitting, submitCount },
    } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            name: '',
            isActive: true,
            priority: 0,
            appliesTo: RULE_APPLIES_TO.ANY,
            field: RULE_FIELDS.DESCRIPTION,
            condition: RULE_CONDITIONS.CONTAINS,
            value: '',
            categoryId: undefined,
            setType: '',
            normalizeMerchant: '',
        },
    })

    const scrollRef = useRef<HTMLDivElement>(null)
    const simulationRequestIdRef = useRef(0)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    const watchedAppliesTo = useWatch({ control, name: 'appliesTo' })
    const watchedField = useWatch({ control, name: 'field' })
    const watchedCondition = useWatch({ control, name: 'condition' })
    const watchedValue = useWatch({ control, name: 'value' })
    const watchedCategoryId = useWatch({ control, name: 'categoryId' })
    const watchedSetType = useWatch({ control, name: 'setType' })
    const watchedNormalizeMerchant = useWatch({ control, name: 'normalizeMerchant' })
    const watchedPriority = useWatch({ control, name: 'priority' })
    const isActive = useWatch({ control, name: 'isActive' })
    const [sampleType, setSampleType] = useState<RuleSimulationSample['type']>('expense')
    const [sampleDescription, setSampleDescription] = useState('')
    const [sampleMerchant, setSampleMerchant] = useState('')
    const [simulation, setSimulation] = useState<RuleSimulationResult | null>(null)
    const [simulationError, setSimulationError] = useState<string | null>(null)
    const [isSimulating, setIsSimulating] = useState(false)

    const resultingCategoryType =
        watchedSetType ||
        (watchedAppliesTo === 'any' ? undefined : watchedAppliesTo)

    // Filter categories based on the type produced by the rule.
    const filteredCategories = categories.filter((c) => {
        return !resultingCategoryType || c.type === resultingCategoryType
    })

    useEffect(() => {
        if (!watchedCategoryId || !resultingCategoryType) return
        const selectedCategory = categories.find(
            (category) => category._id.toString() === watchedCategoryId
        )
        if (selectedCategory && selectedCategory.type !== resultingCategoryType) {
            setValue('categoryId', undefined, {
                shouldDirty: true,
                shouldValidate: true,
            })
        }
    }, [
        categories,
        resultingCategoryType,
        setValue,
        watchedCategoryId,
    ])

    useEffect(() => {
        if (!open) return

        simulationRequestIdRef.current += 1
        setSimulation(null)
        setSimulationError(null)
        setIsSimulating(false)
        setSampleDescription('')
        setSampleMerchant('')

        if (rule) {
            setSampleType(rule.appliesTo === 'income' ? 'income' : 'expense')
            reset({
                name: rule.name,
                isActive: rule.isActive,
                priority: rule.priority,
                appliesTo: rule.appliesTo,
                field: rule.field,
                condition: rule.condition,
                value: rule.value,
                categoryId:
                    (rule.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                    rule.categoryId?.toString() ??
                    undefined,
                setType: rule.setType ?? '',
                normalizeMerchant: rule.normalizeMerchant ?? '',
            })
        } else {
            setSampleType('expense')
            reset({
                name: '',
                isActive: true,
                priority: 0,
                appliesTo: RULE_APPLIES_TO.ANY,
                field: RULE_FIELDS.DESCRIPTION,
                condition: RULE_CONDITIONS.CONTAINS,
                value: '',
                categoryId: undefined,
                setType: '',
                normalizeMerchant: '',
            })
        }
    }, [open, rule, reset])

    useEffect(() => {
        simulationRequestIdRef.current += 1
        setSimulation(null)
        setSimulationError(null)
        setIsSimulating(false)
    }, [
        watchedAppliesTo,
        watchedField,
        watchedCondition,
        watchedValue,
        watchedCategoryId,
        watchedSetType,
        watchedNormalizeMerchant,
        watchedPriority,
    ])

    const handleFormSubmit = async (data: RuleFormValues) => {
        await onSubmit(data)
    }

    const handleSimulate = async () => {
        const valid = await trigger([
            'priority',
            'value',
        ])
        if (!valid) return

        const values = getValues()
        const description =
            sampleDescription.trim() ||
            (values.field === 'description' ? values.value.trim() : '')
        const merchant =
            sampleMerchant.trim() ||
            (values.field === 'merchant' ? values.value.trim() : '')

        if (!description && !merchant) {
            setSimulationError('Ingresá una descripción o un comercio para probar.')
            return
        }

        setIsSimulating(true)
        setSimulationError(null)
        const requestId = ++simulationRequestIdRef.current

        try {
            const result = await onSimulate(
                {
                    ...values,
                    name: values.name.trim() || 'Regla sin guardar',
                    setType: values.setType || undefined,
                    categoryId: values.categoryId || undefined,
                    normalizeMerchant: values.normalizeMerchant?.trim() || undefined,
                },
                {
                    type: sampleType,
                    description,
                    merchant,
                },
                rule?._id.toString()
            )
            if (simulationRequestIdRef.current === requestId) {
                setSimulation(result)
            }
        } catch (error) {
            if (simulationRequestIdRef.current === requestId) {
                setSimulation(null)
                setSimulationError(
                    error instanceof Error
                        ? error.message
                        : 'No se pudo simular la regla.'
                )
            }
        } finally {
            if (simulationRequestIdRef.current === requestId) {
                setIsSimulating(false)
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>{rule ? 'Editar regla' : 'Nueva regla automática'}</DialogTitle>
                    <DialogDescription>
                        Automatiza la categoria o el tipo cuando un movimiento coincida con este criterio.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="flex max-h-[85vh] flex-col">
                    <div ref={scrollRef} className="overflow-y-auto px-5 py-4 space-y-5">

                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="rule-name">Nombre de la regla</Label>
                            <Input
                                id="rule-name"
                                placeholder="Ej: Uber a Transporte"
                                {...register('name')}
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Applies To */}
                        <div className="space-y-2">
                            <Label>Aplicar a</Label>
                            <Select
                                value={watchedAppliesTo}
                                onValueChange={(v) =>
                                    setValue('appliesTo', v as RuleFormValues['appliesTo'], {
                                        shouldValidate: true,
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(APPLIES_TO_LABELS).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Condition row: field + condition + value */}
                        <div className="space-y-2">
                            <Label>Cuando</Label>
                            <div className="grid grid-cols-[1fr_1fr] gap-2">
                                <Select
                                    value={watchedField}
                                    onValueChange={(v) =>
                                        setValue('field', v as RuleFormValues['field'], {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(FIELD_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={watchedCondition}
                                    onValueChange={(v) =>
                                        setValue('condition', v as RuleFormValues['condition'], {
                                            shouldValidate: true,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Input
                                placeholder={
                                    watchedField === 'merchant'
                                        ? 'Ej: Farmacity'
                                        : 'Ej: uber, farmacia, supermercado...'
                                }
                                {...register('value')}
                            />
                            {errors.value && (
                                <p className="text-sm text-destructive">{errors.value.message}</p>
                            )}

                            {/* Natural language preview */}
                            <NaturalLanguagePreview
                                field={watchedField}
                                condition={watchedCondition}
                                value={watchedValue}
                            />
                        </div>

                        {/* Actions */}
                        <div
                            className="space-y-4 rounded-xl border p-4"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <p className="text-sm font-medium">Acciones al coincidir</p>

                            {/* Category */}
                            <div className="space-y-2">
                                <Label>Asignar categoría</Label>
                                <p className="text-xs text-muted-foreground">
                                    Se muestran categorías compatibles con el tipo resultante.
                                </p>
                                {filteredCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {/* No category option */}
                                        <button
                                            type="button"
                                            onClick={() => setValue('categoryId', undefined)}
                                            className="rounded-full border px-3 py-2 text-xs font-medium transition-colors"
                                            style={{
                                                background: !watchedCategoryId ? 'var(--sky)' : 'var(--secondary)',
                                                color: !watchedCategoryId ? '#fff' : 'var(--muted-foreground)',
                                                borderColor: !watchedCategoryId ? 'var(--sky)' : 'var(--border)',
                                            }}
                                        >
                                            Ninguna
                                        </button>
                                        {filteredCategories.map((cat) => {
                                            const selected = watchedCategoryId === cat._id.toString()
                                            return (
                                                <button
                                                    key={cat._id.toString()}
                                                    type="button"
                                                    onClick={() =>
                                                        setValue('categoryId', cat._id.toString())
                                                    }
                                                    className="rounded-full border px-3 py-2 text-xs font-medium transition-colors"
                                                    style={{
                                                        background: selected
                                                            ? cat.color || 'var(--sky)'
                                                            : cat.type === 'income'
                                                            ? 'rgba(16, 185, 129, 0.10)'
                                                            : 'rgba(239, 68, 68, 0.10)',
                                                        color: selected
                                                            ? '#fff'
                                                            : cat.type === 'income'
                                                            ? '#059669'
                                                            : '#DC2626',
                                                        borderColor: selected
                                                            ? cat.color || 'var(--sky)'
                                                            : cat.type === 'income'
                                                            ? 'rgba(16, 185, 129, 0.22)'
                                                            : 'rgba(239, 68, 68, 0.22)',
                                                    }}
                                                >
                                                    {cat.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No hay categorías disponibles.
                                    </p>
                                )}
                            </div>

                            {/* Set type (optional) */}
                            <div className="space-y-2">
                                <Label>Forzar tipo (opcional)</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['', 'expense', 'income'] as const).map((t) => {
                                        const selected = watchedSetType === t
                                        const label =
                                            t === '' ? 'No cambiar' : t === 'expense' ? 'Gasto' : 'Ingreso'
                                        return (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setValue('setType', t)}
                                                className="rounded-xl border px-3 py-2 text-xs font-medium transition-colors"
                                                style={{
                                                    background: selected ? 'var(--sky)' : 'var(--secondary)',
                                                    color: selected ? '#fff' : 'var(--foreground)',
                                                    borderColor: selected ? 'var(--sky)' : 'var(--border)',
                                                }}
                                            >
                                                {label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Normalize merchant (optional) */}
                            <div className="space-y-2">
                                <Label htmlFor="normalizeMerchant">
                                    Completar comercio (opcional)
                                </Label>
                                <Input
                                    id="normalizeMerchant"
                                    placeholder="Ej: Uber Technologies"
                                    {...register('normalizeMerchant')}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Se completará si el comercio está vacío.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 rounded-xl border border-sky-500/25 bg-sky-500/5 p-4">
                            <div className="flex items-start gap-3">
                                <FlaskConical
                                    size={18}
                                    className="mt-0.5 shrink-0 text-sky-500"
                                />
                                <div>
                                    <p className="text-sm font-medium">
                                        Probar antes de guardar
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        No crea movimientos ni modifica reglas.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Tipo del ejemplo</Label>
                                    <Select
                                        value={sampleType}
                                        onValueChange={(value) => {
                                            simulationRequestIdRef.current += 1
                                            setSampleType(value as RuleSimulationSample['type'])
                                            setSimulation(null)
                                            setIsSimulating(false)
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="expense">Gasto</SelectItem>
                                            <SelectItem value="income">Ingreso</SelectItem>
                                            <SelectItem value="credit_card_expense">
                                                Gasto con tarjeta
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="rule-sample-description">
                                        Descripción del ejemplo
                                    </Label>
                                    <Input
                                        id="rule-sample-description"
                                        value={sampleDescription}
                                        placeholder={
                                            watchedField === 'description'
                                                ? watchedValue || 'Ej: Pago en Café'
                                                : 'Opcional'
                                        }
                                        onChange={(event) => {
                                            simulationRequestIdRef.current += 1
                                            setSampleDescription(event.target.value)
                                            setSimulation(null)
                                            setIsSimulating(false)
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="rule-sample-merchant">
                                    Comercio del ejemplo
                                </Label>
                                <Input
                                    id="rule-sample-merchant"
                                    value={sampleMerchant}
                                    placeholder={
                                        watchedField === 'merchant'
                                            ? watchedValue || 'Ej: Farmacity'
                                            : 'Opcional'
                                    }
                                    onChange={(event) => {
                                        simulationRequestIdRef.current += 1
                                        setSampleMerchant(event.target.value)
                                        setSimulation(null)
                                        setIsSimulating(false)
                                    }}
                                />
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full gap-2"
                                disabled={isSimulating || !watchedValue}
                                onClick={handleSimulate}
                            >
                                {isSimulating ? (
                                    <>
                                        <Spinner />
                                        Simulando...
                                    </>
                                ) : (
                                    <>
                                        <FlaskConical size={15} />
                                        Probar regla
                                    </>
                                )}
                            </Button>

                            {simulationError && (
                                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                    <AlertTriangle size={15} className="shrink-0" />
                                    <span>{simulationError}</span>
                                </div>
                            )}

                            {simulation && (
                                <RuleSimulationSummary
                                    simulation={simulation}
                                    categories={categories}
                                />
                            )}
                        </div>

                        {/* Prioridad + Estado activo */}
                        <div
                            className="space-y-4 rounded-xl border p-4"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            {/* Active toggle */}
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">Regla activa</p>
                                    <p className="text-xs text-muted-foreground">
                                        {isActive
                                            ? 'Se aplica automáticamente al crear transacciones'
                                            : 'No se evaluará hasta que la actives'}
                                    </p>
                                </div>
                                <Switch
                                    checked={isActive}
                                    onCheckedChange={(checked) => setValue('isActive', checked)}
                                />
                            </div>

                            {/* Priority */}
                            <div className="space-y-2">
                                <Label htmlFor="priority">
                                    Prioridad
                                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                                        (mayor número = se evalúa primero)
                                    </span>
                                </Label>
                                <Input
                                    id="priority"
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={9999}
                                    {...register('priority', { valueAsNumber: true })}
                                />
                                {errors.priority && (
                                    <p className="text-sm text-destructive">{errors.priority.message}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div
                        className="border-t px-5 py-4 flex flex-col-reverse gap-2 sticky bottom-0 bg-background safe-area-pb sm:flex-row"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1">
                            {isSubmitting ? (
                                <>
                                    <Spinner className="mr-2" />
                                    Guardando...
                                </>
                            ) : rule ? (
                                'Guardar cambios'
                            ) : (
                                'Crear regla'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function getCategoryName(categories: ICategory[], categoryId?: string) {
    if (!categoryId) return null
    return categories.find((category) => category._id.toString() === categoryId)?.name
        ?? 'Categoría configurada'
}

function RuleSimulationSummary({
    simulation,
    categories,
}: {
    simulation: RuleSimulationResult
    categories: ICategory[]
}) {
    const winner = simulation.winner
    const winnerActions = winner?.actions.appliedActions
    const skippedActions = winner?.actions.skippedActions ?? []

    return (
        <div className="space-y-3" aria-live="polite">
            <div
                className={`flex gap-2 rounded-lg border p-3 text-xs ${
                    winner?.isCandidate
                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                        : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                }`}
            >
                {winner?.isCandidate ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                    <Info size={16} className="shrink-0" />
                )}
                <div className="space-y-1">
                    <p className="font-medium">
                        {!simulation.candidateMatches
                            ? 'La regla no coincide con este ejemplo'
                            : winner?.isCandidate
                                ? 'La regla coincide y se aplicaría'
                                : `Coincide, pero ganaría “${winner?.name}”`}
                    </p>
                    {simulation.matchedRules.length > 1 && (
                        <p>
                            {simulation.matchedRules.length} reglas coinciden; se usa la de
                            mayor prioridad.
                        </p>
                    )}
                </div>
            </div>

            {winner && Object.keys(winnerActions ?? {}).length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {winnerActions?.setType && (
                        <Badge variant="secondary">
                            Tipo: {winnerActions.setType === 'expense' ? 'Gasto' : 'Ingreso'}
                        </Badge>
                    )}
                    {winnerActions?.categoryId && (
                        <Badge variant="secondary">
                            Categoría: {getCategoryName(categories, winnerActions.categoryId)}
                        </Badge>
                    )}
                    {winnerActions?.normalizeMerchant && (
                        <Badge variant="secondary">
                            Comercio: {winnerActions.normalizeMerchant}
                        </Badge>
                    )}
                </div>
            )}

            {skippedActions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    {skippedActions.some(({ reason }) => reason === 'specialized_type')
                        ? 'El cambio de tipo no se aplicaría porque el ejemplo es un movimiento financiero especializado.'
                        : 'Los valores ya definidos en el movimiento no serían reemplazados.'}
                </p>
            )}

            {simulation.conflicts.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium">Conflictos detectados</p>
                    {simulation.conflicts.map((conflict) => (
                        <div
                            key={`${conflict.ruleId}-${conflict.kind}`}
                            className={`flex gap-2 rounded-lg border p-3 text-xs ${
                                conflict.severity === 'warning'
                                    ? 'border-amber-500/30 bg-amber-500/5'
                                    : 'border-border bg-muted/40'
                            }`}
                        >
                            {conflict.severity === 'warning' ? (
                                <AlertTriangle
                                    size={15}
                                    className="shrink-0 text-amber-600"
                                />
                            ) : (
                                <Info
                                    size={15}
                                    className="shrink-0 text-muted-foreground"
                                />
                            )}
                            <span>{conflict.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Natural Language Preview ─────────────────────────────────────────────────

function NaturalLanguagePreview({
    field,
    condition,
    value,
}: {
    field: string
    condition: string
    value: string
}) {
    if (!value) return null

    const fieldLabel = field === 'description' ? 'la descripción' : 'el comercio'
    const conditionLabel =
        condition === 'contains'
            ? 'contiene'
            : condition === 'equals'
            ? 'es igual a'
            : 'empieza con'

    return (
        <p
            className="text-xs rounded-lg px-3 py-2"
            style={{
                background: 'rgba(56,189,248,0.08)',
                color: 'var(--sky)',
                borderLeft: '2px solid var(--sky)',
            }}
        >
            Si {fieldLabel} {conditionLabel}{' '}
            <strong>&quot;{value}&quot;</strong>
        </p>
    )
}
