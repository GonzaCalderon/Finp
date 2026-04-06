'use client'

import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { Spinner } from '@/components/shared/Spinner'
import type { ICategory, ITransactionRule } from '@/types'
import { RULE_APPLIES_TO, RULE_CONDITIONS, RULE_FIELDS } from '@/lib/constants'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'

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

type RuleFormValues = z.infer<typeof ruleFormSchema>

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
}

export function TransactionRuleDialog({
    open,
    onOpenChange,
    rule,
    categories,
    onSubmit,
}: TransactionRuleDialogProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
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
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    const watchedAppliesTo = watch('appliesTo')
    const watchedField = watch('field')
    const watchedCondition = watch('condition')
    const watchedCategoryId = watch('categoryId')
    const watchedSetType = watch('setType')
    const isActive = watch('isActive')

    // Filter categories based on appliesTo
    const filteredCategories = categories.filter((c) => {
        if (watchedAppliesTo === 'expense') return c.type === 'expense'
        if (watchedAppliesTo === 'income') return c.type === 'income'
        return true
    })

    useEffect(() => {
        if (!open) return

        if (rule) {
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

    const handleFormSubmit = async (data: RuleFormValues) => {
        await onSubmit(data)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="max-w-lg p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>{rule ? 'Editar regla' : 'Nueva regla automática'}</DialogTitle>
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
                                value={watch('value')}
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
