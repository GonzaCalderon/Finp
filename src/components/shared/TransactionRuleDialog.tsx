'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    FlaskConical,
    Info,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/shared/Spinner'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import type {
    RuleSimulationResult,
    RuleSimulationRuleInput,
    RuleSimulationSample,
} from '@/hooks/useTransactionRules'
import { RULE_APPLIES_TO, RULE_CONDITIONS, RULE_FIELDS } from '@/lib/constants'
import type { ICategory, ITransactionRule } from '@/types'

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

type RuleDialogStep = 'match' | 'actions' | 'review'

interface TransactionRuleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    rule: ITransactionRule | null
    initialValues?: Partial<RuleFormValues> | null
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
    initialValues,
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
        defaultValues: getDefaultValues(),
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

    const [activeStep, setActiveStep] = useState<RuleDialogStep>('match')
    const [sampleType, setSampleType] = useState<RuleSimulationSample['type']>('expense')
    const [sampleDescription, setSampleDescription] = useState('')
    const [sampleMerchant, setSampleMerchant] = useState('')
    const [simulation, setSimulation] = useState<RuleSimulationResult | null>(null)
    const [simulationError, setSimulationError] = useState<string | null>(null)
    const [isSimulating, setIsSimulating] = useState(false)

    const resultingCategoryType =
        watchedSetType || (watchedAppliesTo === 'any' ? undefined : watchedAppliesTo)
    const filteredCategories = categories.filter(
        (category) => !resultingCategoryType || category.type === resultingCategoryType
    )

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
    }, [categories, resultingCategoryType, setValue, watchedCategoryId])

    useEffect(() => {
        if (!open) return

        simulationRequestIdRef.current += 1
        setSimulation(null)
        setSimulationError(null)
        setIsSimulating(false)
        setSampleDescription('')
        setSampleMerchant('')
        setActiveStep('match')

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
            return
        }

        setSampleType(initialValues?.appliesTo === 'income' ? 'income' : 'expense')
        reset({ ...getDefaultValues(), ...initialValues })
    }, [initialValues, open, reset, rule])

    useEffect(() => {
        simulationRequestIdRef.current += 1
        setSimulation(null)
        setSimulationError(null)
        setIsSimulating(false)
    }, [
        watchedAppliesTo,
        watchedCategoryId,
        watchedCondition,
        watchedField,
        watchedNormalizeMerchant,
        watchedPriority,
        watchedSetType,
        watchedValue,
    ])

    const goToActions = async () => {
        const values = getValues()
        if (!values.name.trim() || !values.value.trim()) {
            await trigger(['name', 'value'])
            return
        }
        setActiveStep('actions')
    }

    const handleSimulate = async () => {
        const isValid = await trigger(['priority', 'value'])
        if (!isValid) return

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
                    categoryId: values.categoryId || undefined,
                    setType: values.setType || undefined,
                    normalizeMerchant: values.normalizeMerchant?.trim() || undefined,
                },
                { type: sampleType, description, merchant },
                rule?._id.toString()
            )
            if (simulationRequestIdRef.current === requestId) setSimulation(result)
        } catch (error) {
            if (simulationRequestIdRef.current === requestId) {
                setSimulation(null)
                setSimulationError(
                    error instanceof Error ? error.message : 'No se pudo simular la regla.'
                )
            }
        } finally {
            if (simulationRequestIdRef.current === requestId) setIsSimulating(false)
        }
    }

    const categoryName = getCategoryName(categories, watchedCategoryId)
    const actionSummary = [
        watchedSetType
            ? `marcar como ${watchedSetType === 'expense' ? 'gasto' : 'ingreso'}`
            : null,
        categoryName ? `asignar ${categoryName}` : null,
        watchedNormalizeMerchant?.trim()
            ? `completar comercio como ${watchedNormalizeMerchant.trim()}`
            : null,
    ].filter(Boolean)
    const stepIndex = (['match', 'actions', 'review'] as const).indexOf(activeStep)
    const stepLabel =
        activeStep === 'match'
            ? 'Coincidencia'
            : activeStep === 'actions'
                ? 'Acciones'
                : 'Prueba y activación'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                showCloseButton={false}
                className="gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[min(88dvh,760px)] sm:max-w-4xl"
            >
                <DialogHeader className="shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur md:px-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-[1.02rem] tracking-tight">
                                    {rule ? 'Editar regla' : 'Nueva regla'}
                                </DialogTitle>
                                <Badge variant="secondary" className="rounded-full">
                                    {stepIndex + 1} / 3
                                </Badge>
                                {initialValues && !rule && (
                                    <Badge variant="outline" className="rounded-full">
                                        Sugerida por Finp
                                    </Badge>
                                )}
                            </div>
                            <DialogDescription className="text-xs">
                                {stepLabel}
                                <span className="hidden sm:inline">
                                    {' '}· Definí qué reconoce Finp y qué debe completar.
                                </span>
                            </DialogDescription>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="-mr-2 shrink-0 text-muted-foreground"
                            onClick={() => onOpenChange(false)}
                        >
                            Cerrar
                        </Button>
                    </div>
                    <div className="mt-2 flex gap-1" aria-hidden="true">
                        {[0, 1, 2].map((index) => (
                            <div
                                key={index}
                                className="h-1.5 flex-1 rounded-full transition-colors"
                                style={{
                                    background:
                                        index === stepIndex
                                            ? 'var(--sky)'
                                            : index < stepIndex
                                                ? 'color-mix(in srgb, var(--sky) 42%, var(--border))'
                                                : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                }}
                            />
                        ))}
                    </div>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit(
                        onSubmit,
                        (formErrors) => {
                            if (
                                formErrors.name ||
                                formErrors.appliesTo ||
                                formErrors.field ||
                                formErrors.condition ||
                                formErrors.value
                            ) {
                                setActiveStep('match')
                            }
                        }
                    )}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div
                            ref={scrollRef}
                            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6"
                        >
                            {activeStep === 'match' && (
                                <MatchStep
                                    register={register}
                                    errors={errors}
                                    appliesTo={watchedAppliesTo}
                                    field={watchedField}
                                    condition={watchedCondition}
                                    value={watchedValue}
                                    setValue={setValue}
                                />
                            )}
                            <ActionsStep
                                active={activeStep === 'actions'}
                                register={register}
                                categories={filteredCategories}
                                categoryId={watchedCategoryId}
                                setType={watchedSetType}
                                actionSummary={actionSummary}
                                setValue={setValue}
                            />
                            <ReviewStep
                                active={activeStep === 'review'}
                                categories={categories}
                                field={watchedField}
                                value={watchedValue}
                                sampleType={sampleType}
                                sampleDescription={sampleDescription}
                                sampleMerchant={sampleMerchant}
                                simulation={simulation}
                                simulationError={simulationError}
                                isSimulating={isSimulating}
                                isActive={isActive}
                                priorityError={errors.priority?.message}
                                register={register}
                                setValue={setValue}
                                onSampleTypeChange={(value) => {
                                    simulationRequestIdRef.current += 1
                                    setSampleType(value)
                                    setSimulation(null)
                                    setIsSimulating(false)
                                }}
                                onSampleDescriptionChange={(value) => {
                                    simulationRequestIdRef.current += 1
                                    setSampleDescription(value)
                                    setSimulation(null)
                                    setIsSimulating(false)
                                }}
                                onSampleMerchantChange={(value) => {
                                    simulationRequestIdRef.current += 1
                                    setSampleMerchant(value)
                                    setSimulation(null)
                                    setIsSimulating(false)
                                }}
                                onSimulate={handleSimulate}
                            />
                        </div>
                    </div>

                    <DialogFooterActions
                        activeStep={activeStep}
                        isEditing={Boolean(rule)}
                        isSubmitting={isSubmitting}
                        onCancel={() => onOpenChange(false)}
                        onBack={() =>
                            setActiveStep(activeStep === 'review' ? 'actions' : 'match')
                        }
                        onNext={() => {
                            if (activeStep === 'match') void goToActions()
                            else setActiveStep('review')
                        }}
                    />
                </form>
            </DialogContent>
        </Dialog>
    )
}

function MatchStep({
    register,
    errors,
    appliesTo,
    field,
    condition,
    value,
    setValue,
}: {
    register: ReturnType<typeof useForm<RuleFormValues>>['register']
    errors: ReturnType<typeof useForm<RuleFormValues>>['formState']['errors']
    appliesTo: RuleFormValues['appliesTo']
    field: RuleFormValues['field']
    condition: RuleFormValues['condition']
    value: string
    setValue: ReturnType<typeof useForm<RuleFormValues>>['setValue']
}) {
    return (
        <div className="space-y-5">
            <StepIntro
                title="¿Qué movimientos reconoce?"
                description="Usá un texto estable, como el nombre del comercio o una parte de la descripción."
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="rule-name">Nombre de la regla</Label>
                    <Input
                        id="rule-name"
                        placeholder="Ej: Uber a Transporte"
                        autoFocus
                        {...register('name')}
                    />
                    {errors.name && <FieldError message={errors.name.message} />}
                </div>
                <div className="space-y-2">
                    <Label>Tipo de movimiento</Label>
                    <Select
                        value={appliesTo}
                        onValueChange={(nextValue) =>
                            setValue('appliesTo', nextValue as RuleFormValues['appliesTo'], {
                                shouldValidate: true,
                            })
                        }
                    >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(APPLIES_TO_LABELS).map(([optionValue, label]) => (
                                <SelectItem key={optionValue} value={optionValue}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Dato a revisar</Label>
                    <Select
                        value={field}
                        onValueChange={(nextValue) =>
                            setValue('field', nextValue as RuleFormValues['field'], {
                                shouldValidate: true,
                            })
                        }
                    >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(FIELD_LABELS).map(([optionValue, label]) => (
                                <SelectItem key={optionValue} value={optionValue}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Forma de coincidencia</Label>
                    <Select
                        value={condition}
                        onValueChange={(nextValue) =>
                            setValue('condition', nextValue as RuleFormValues['condition'], {
                                shouldValidate: true,
                            })
                        }
                    >
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(CONDITION_LABELS).map(([optionValue, label]) => (
                                <SelectItem key={optionValue} value={optionValue}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="rule-value">Texto a buscar</Label>
                    <Input
                        id="rule-value"
                        placeholder={field === 'merchant' ? 'Ej: Farmacity' : 'Ej: uber'}
                        {...register('value')}
                    />
                    {errors.value && <FieldError message={errors.value.message} />}
                </div>
            </div>
            <NaturalLanguagePreview field={field} condition={condition} value={value} />
        </div>
    )
}

function ActionsStep({
    active,
    register,
    categories,
    categoryId,
    setType,
    actionSummary,
    setValue,
}: {
    active: boolean
    register: ReturnType<typeof useForm<RuleFormValues>>['register']
    categories: ICategory[]
    categoryId?: string
    setType?: RuleFormValues['setType']
    actionSummary: (string | null)[]
    setValue: ReturnType<typeof useForm<RuleFormValues>>['setValue']
}) {
    if (!active) return null

    return (
        <div className="space-y-5">
            <StepIntro
                title="¿Qué completa Finp?"
                description="Elegí una o más acciones. Los datos ya definidos por el usuario se preservan."
            />
            <Card className="shadow-none">
                <CardHeader>
                    <CardTitle>Asignar categoría</CardTitle>
                    <CardDescription>
                        Mostramos solo categorías compatibles con el tipo resultante.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {categories.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant={!categoryId ? 'default' : 'outline'}
                                className="rounded-full"
                                onClick={() => setValue('categoryId', undefined)}
                            >
                                No cambiar
                            </Button>
                            {categories.map((category) => {
                                const selected = categoryId === category._id.toString()
                                return (
                                    <Button
                                        key={category._id.toString()}
                                        type="button"
                                        size="sm"
                                        variant={selected ? 'default' : 'outline'}
                                        className="rounded-full"
                                        style={
                                            selected && category.color
                                                ? {
                                                    backgroundColor: category.color,
                                                    borderColor: category.color,
                                                }
                                                : undefined
                                        }
                                        onClick={() =>
                                            setValue('categoryId', category._id.toString(), {
                                                shouldDirty: true,
                                            })
                                        }
                                    >
                                        {category.name}
                                    </Button>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No hay categorías compatibles disponibles.
                        </p>
                    )}
                </CardContent>
            </Card>
            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Corregir tipo</CardTitle>
                        <CardDescription>
                            Útil si el origen no distingue gastos de ingresos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-2">
                        {(['', 'expense', 'income'] as const).map((type) => (
                            <Button
                                key={type || 'unchanged'}
                                type="button"
                                size="sm"
                                variant={setType === type ? 'default' : 'outline'}
                                onClick={() => setValue('setType', type, { shouldDirty: true })}
                            >
                                {type === '' ? 'Igual' : type === 'expense' ? 'Gasto' : 'Ingreso'}
                            </Button>
                        ))}
                    </CardContent>
                </Card>
                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Completar comercio</CardTitle>
                        <CardDescription>
                            Solo se usa cuando el movimiento no trae comercio.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="normalizeMerchant" className="sr-only">
                            Nombre normalizado del comercio
                        </Label>
                        <Input
                            id="normalizeMerchant"
                            placeholder="Ej: Uber Technologies"
                            {...register('normalizeMerchant')}
                        />
                    </CardContent>
                </Card>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                <p className="text-sm font-medium">Resultado configurado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {actionSummary.length > 0
                        ? `Finp va a ${actionSummary.join(', ')}.`
                        : 'Todavía no elegiste ninguna acción. La regla puede guardarse, pero no modificará movimientos.'}
                </p>
            </div>
        </div>
    )
}

function ReviewStep({
    active,
    categories,
    field,
    value,
    sampleType,
    sampleDescription,
    sampleMerchant,
    simulation,
    simulationError,
    isSimulating,
    isActive,
    priorityError,
    register,
    setValue,
    onSampleTypeChange,
    onSampleDescriptionChange,
    onSampleMerchantChange,
    onSimulate,
}: {
    active: boolean
    categories: ICategory[]
    field: RuleFormValues['field']
    value: string
    sampleType: RuleSimulationSample['type']
    sampleDescription: string
    sampleMerchant: string
    simulation: RuleSimulationResult | null
    simulationError: string | null
    isSimulating: boolean
    isActive: boolean
    priorityError?: string
    register: ReturnType<typeof useForm<RuleFormValues>>['register']
    setValue: ReturnType<typeof useForm<RuleFormValues>>['setValue']
    onSampleTypeChange: (value: RuleSimulationSample['type']) => void
    onSampleDescriptionChange: (value: string) => void
    onSampleMerchantChange: (value: string) => void
    onSimulate: () => void
}) {
    if (!active) return null

    return (
        <div className="space-y-5">
            <StepIntro
                title="Probala antes de activarla"
                description="La simulación no crea movimientos ni modifica reglas."
            />
            <Card className="border-sky-500/25 bg-sky-500/5 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FlaskConical className="size-4 text-sky-500" />
                        Movimiento de ejemplo
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                                value={sampleType}
                                onValueChange={(nextValue) =>
                                    onSampleTypeChange(nextValue as RuleSimulationSample['type'])
                                }
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
                            <Label htmlFor="rule-sample-description">Descripción</Label>
                            <Input
                                id="rule-sample-description"
                                value={sampleDescription}
                                placeholder={
                                    field === 'description'
                                        ? value || 'Ej: Pago en Café'
                                        : 'Opcional'
                                }
                                onChange={(event) => onSampleDescriptionChange(event.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rule-sample-merchant">Comercio</Label>
                        <Input
                            id="rule-sample-merchant"
                            value={sampleMerchant}
                            placeholder={
                                field === 'merchant' ? value || 'Ej: Farmacity' : 'Opcional'
                            }
                            onChange={(event) => onSampleMerchantChange(event.target.value)}
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2 bg-background"
                        disabled={isSimulating || !value}
                        onClick={onSimulate}
                    >
                        {isSimulating ? (
                            <><Spinner />Simulando...</>
                        ) : (
                            <><FlaskConical size={15} />Probar regla</>
                        )}
                    </Button>
                    {simulationError && (
                        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                            <AlertTriangle size={15} className="shrink-0" />
                            <span>{simulationError}</span>
                        </div>
                    )}
                    {simulation && (
                        <RuleSimulationSummary simulation={simulation} categories={categories} />
                    )}
                </CardContent>
            </Card>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Regla activa</p>
                        <p className="text-xs text-muted-foreground">
                            {isActive
                                ? 'Se usará en los próximos movimientos.'
                                : 'Quedará guardada en pausa.'}
                        </p>
                    </div>
                    <Switch
                        checked={isActive}
                        onCheckedChange={(checked) =>
                            setValue('isActive', checked, { shouldDirty: true })
                        }
                        aria-label="Regla activa"
                    />
                </div>
                <div className="space-y-2 rounded-xl border p-4">
                    <Label htmlFor="priority">Prioridad</Label>
                    <Input
                        id="priority"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={9999}
                        {...register('priority', { valueAsNumber: true })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                        Mayor número, primero.
                    </p>
                    {priorityError && <FieldError message={priorityError} />}
                </div>
            </div>
        </div>
    )
}

function DialogFooterActions({
    activeStep,
    isEditing,
    isSubmitting,
    onCancel,
    onBack,
    onNext,
}: {
    activeStep: RuleDialogStep
    isEditing: boolean
    isSubmitting: boolean
    onCancel: () => void
    onBack: () => void
    onNext: () => void
}) {
    return (
        <div
            className="shrink-0 border-t bg-background/95 px-4 pb-3.5 pt-2.5 backdrop-blur md:px-6 md:pb-4"
            style={{
                borderColor: 'var(--border)',
                boxShadow: '0 -12px 28px rgba(0,0,0,0.10)',
            }}
        >
            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="h-10 flex-1 rounded-[1rem] border-border/80 font-medium"
                    onClick={activeStep === 'match' ? onCancel : onBack}
                >
                    {activeStep === 'match' ? 'Cancelar' : (
                        <><ChevronLeft />Atrás</>
                    )}
                </Button>
                {activeStep !== 'review' ? (
                    <Button
                        type="button"
                        className="h-10 flex-[1.25] rounded-[1rem] font-semibold"
                        onClick={onNext}
                    >
                        {activeStep === 'match' ? 'Continuar' : 'Probar'}
                        <ChevronRight />
                    </Button>
                ) : (
                    <Button
                        type="submit"
                        className="h-10 flex-[1.25] rounded-[1rem] font-semibold"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <><Spinner className="mr-2" />Guardando...</>
                        ) : isEditing ? (
                            'Guardar cambios'
                        ) : (
                            'Crear regla'
                        )}
                    </Button>
                )}
            </div>
        </div>
    )
}

function StepIntro({ title, description }: { title: string; description: string }) {
    return (
        <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
    )
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return <p className="text-sm text-destructive">{message}</p>
}

function getDefaultValues(): RuleFormValues {
    return {
        name: '',
        isActive: true,
        priority: 10,
        appliesTo: RULE_APPLIES_TO.ANY,
        field: RULE_FIELDS.DESCRIPTION,
        condition: RULE_CONDITIONS.CONTAINS,
        value: '',
        categoryId: undefined,
        setType: '',
        normalizeMerchant: '',
    }
}

function getCategoryName(categories: ICategory[], categoryId?: string) {
    if (!categoryId) return null
    return (
        categories.find((category) => category._id.toString() === categoryId)?.name ??
        'Categoría configurada'
    )
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
                            {simulation.matchedRules.length} reglas coinciden; se usa la de mayor prioridad.
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
                                <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                            ) : (
                                <Info size={15} className="shrink-0 text-muted-foreground" />
                            )}
                            <span>{conflict.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

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
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400">
                Así se interpreta
            </p>
            <p className="mt-1 text-sm">
                Si {fieldLabel} {conditionLabel} <strong>&quot;{value}&quot;</strong>, la regla coincide.
            </p>
        </div>
    )
}
