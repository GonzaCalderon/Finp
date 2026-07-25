'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { commitmentSchema, type CommitmentFormData } from '@/lib/validations'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { Spinner } from '@/components/shared/Spinner'
import { Input } from '@/components/ui/input'
import { isSimpleTransactionAccountType } from '@/lib/utils/accounts'
import { ApiError } from '@/lib/client/auth-client'
import {
    resolveCommitmentReminderDate,
    resolveNextCommitmentOccurrence,
} from '@/lib/utils/commitment-dates'
import { CategoryPickerField } from '@/components/shared/CategoryPickerField'
import { CommitmentDayPicker } from '@/components/commitments/CommitmentDayPicker'
import { useRankedCommitmentCategories } from '@/hooks/useRankedCommitmentCategories'
import type { IScheduledCommitment, ICategory, IAccount } from '@/types'
import type { CommitmentDraftEnvelope } from '@/types/capture-intent'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import { cn } from '@/lib/utils'

const STEPS = [
    { title: 'Compromiso', description: 'Qué es y cuánto esperás pagar.' },
    { title: 'Frecuencia', description: 'Cuándo vence y cuándo querés recordarlo.' },
    { title: 'Aplicación', description: 'Cuenta, categoría y revisión final.' },
] as const

const DRAFT_FIELD_LABELS: Record<string, string> = {
    description: 'la descripción',
    amount: 'el monto',
    currency: 'la moneda',
    recurrence: 'la recurrencia',
    dayOfMonth: 'el día del mes',
    accountId: 'la cuenta',
    categoryId: 'la categoría',
    amountPolicy: 'la política de monto',
    startDate: 'la fecha de inicio',
}

const REMINDER_OPTIONS = [
    { value: 'none', label: 'Sin recordatorio' },
    { value: '0', label: 'El mismo día' },
    { value: '1', label: '1 día antes' },
    { value: '3', label: '3 días antes' },
    { value: '5', label: '5 días antes' },
    { value: '7', label: '7 días antes' },
] as const

const FIELDS_BY_STEP: Array<Array<keyof CommitmentFormData>> = [
    ['description', 'amount', 'currency', 'amountPolicy', 'estimationMode'],
    ['recurrence', 'dayOfMonth', 'startDate', 'endDate', 'reminderLeadDays'],
    ['accountId', 'categoryId'],
]

function stepForField(field: keyof CommitmentFormData): number {
    const index = FIELDS_BY_STEP.findIndex((fields) => fields.includes(field))
    return index >= 0 ? index : 0
}

interface CommitmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    commitment: IScheduledCommitment | null
    categories: ICategory[]
    accounts?: IAccount[]
    onSubmit: (data: CommitmentFormData) => Promise<void>
    initialDraft?: CommitmentDraftEnvelope | null
}

function referenceId(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value !== 'object') return ''
    const candidate = value as { _id?: unknown; toString?: () => string }
    if (candidate._id) return String(candidate._id)
    return candidate.toString?.() ?? ''
}

function formatDate(value: Date | undefined): string {
    if (!value) return 'Sin fecha'
    return value.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

export function CommitmentDialog({
    open,
    onOpenChange,
    commitment,
    categories,
    accounts = [],
    onSubmit,
    initialDraft = null,
}: CommitmentDialogProps) {
    const [step, setStep] = useState(0)
    const [categoryQuery, setCategoryQuery] = useState('')
    const {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        trigger,
        setError,
        formState: { errors, isSubmitting, submitCount },
    } = useForm<CommitmentFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(commitmentSchema) as any,
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            currency: 'ARS',
            recurrence: 'monthly',
            amountPolicy: 'fixed',
            estimationMode: 'template',
            startDate: new Date(),
        },
    })

    const scrollRef = useRef<HTMLFormElement>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    const recurrence = useWatch({ control, name: 'recurrence' })
    const amount = useWatch({ control, name: 'amount' })
    const currency = useWatch({ control, name: 'currency' })
    const categoryId = useWatch({ control, name: 'categoryId' })
    const accountId = useWatch({ control, name: 'accountId' })
    const amountPolicy = useWatch({ control, name: 'amountPolicy' })
    const estimationMode = useWatch({ control, name: 'estimationMode' })
    const dayOfMonth = useWatch({ control, name: 'dayOfMonth' })
    const reminderLeadDays = useWatch({ control, name: 'reminderLeadDays' })
    const startDate = useWatch({ control, name: 'startDate' })
    const endDate = useWatch({ control, name: 'endDate' })
    const description = useWatch({ control, name: 'description' })

    const interpretedFields = Object.entries(initialDraft?.provenance ?? {})
        .filter(([, source]) => source && source !== 'default')
        .map(([field]) => DRAFT_FIELD_LABELS[field] ?? field)
    const expenseCategories = categories.filter((category) => category.type === 'expense')
    const simpleAccounts = accounts.filter(
        (account) =>
            account.isActive !== false && isSimpleTransactionAccountType(account.type)
    )
    const rankedExpenseCategories = useRankedCommitmentCategories({
        open,
        description: description ?? '',
        categories: expenseCategories,
        selectedCategoryId: categoryId,
    })
    const nextDueDate = useMemo(
        () =>
            resolveNextCommitmentOccurrence(
                {
                    recurrence,
                    dayOfMonth,
                    startDate,
                    endDate,
                    dueDate: recurrence === 'once' ? startDate : undefined,
                },
                new Date()
            ),
        [dayOfMonth, endDate, recurrence, startDate]
    )
    const nextReminderDate = useMemo(
        () =>
            nextDueDate && reminderLeadDays !== undefined
                ? resolveCommitmentReminderDate({
                      dueDate: nextDueDate,
                      reminderLeadDays,
                      startDate,
                  })
                : null,
        [nextDueDate, reminderLeadDays, startDate]
    )

    useEffect(() => {
        if (!open) return

        if (commitment) {
            reset({
                description: commitment.description,
                amount: commitment.amount,
                currency: commitment.currency,
                recurrence: commitment.recurrence,
                dayOfMonth: commitment.dayOfMonth,
                amountPolicy: commitment.amountPolicy ?? 'fixed',
                estimationMode: commitment.estimationMode ?? 'template',
                categoryId: referenceId(commitment.categoryId),
                accountId: referenceId(commitment.accountId),
                startDate: commitment.startDate
                    ? new Date(String(commitment.startDate))
                    : new Date(),
                endDate: commitment.endDate
                    ? new Date(String(commitment.endDate))
                    : undefined,
                reminderLeadDays: commitment.reminderLeadDays,
            })
            return
        }

        const fields = initialDraft?.fields
        reset({
            description: fields?.description ?? '',
            amount: fields?.amount ?? undefined,
            currency: fields?.currency ?? 'ARS',
            recurrence: fields?.recurrence ?? 'monthly',
            dayOfMonth: fields?.dayOfMonth,
            amountPolicy: fields?.amountPolicy ?? 'fixed',
            estimationMode: 'template',
            categoryId: fields?.categoryId ?? '',
            accountId: fields?.accountId ?? '',
            startDate: fields?.startDate ? new Date(fields.startDate) : new Date(),
            reminderLeadDays: undefined,
        })
    }, [open, commitment, initialDraft, reset])

    function handleDialogChange(nextOpen: boolean) {
        if (!nextOpen) {
            setStep(0)
            setCategoryQuery('')
        }
        onOpenChange(nextOpen)
    }

    async function nextStep() {
        const valid = await trigger(FIELDS_BY_STEP[step])
        if (valid) setStep((current) => Math.min(current + 1, STEPS.length - 1))
    }

    function goToFirstError(errorFields: string[]) {
        const validFields = errorFields.filter((field) =>
            FIELDS_BY_STEP.flat().includes(field as keyof CommitmentFormData)
        ) as Array<keyof CommitmentFormData>
        if (validFields.length === 0) return
        setStep(Math.min(...validFields.map(stepForField)))
    }

    async function submitCommitment(data: CommitmentFormData) {
        try {
            await onSubmit(data)
        } catch (error) {
            if (!(error instanceof ApiError) || !error.details?.length) return

            const serverFields: string[] = []
            for (const detail of error.details) {
                const field = String(detail.path?.[0] ?? '')
                if (
                    !FIELDS_BY_STEP.flat().includes(
                        field as keyof CommitmentFormData
                    )
                ) {
                    continue
                }
                serverFields.push(field)
                setError(field as keyof CommitmentFormData, {
                    type: 'server',
                    message: detail.message ?? 'Revisá este dato.',
                })
            }
            goToFirstError(serverFields)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="overflow-hidden p-0 sm:w-[min(94vw,56rem)] sm:max-w-4xl"
            >
                <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
                    <DialogTitle>
                        {commitment ? 'Editar compromiso' : 'Nuevo compromiso'}
                    </DialogTitle>
                    <DialogDescription>{STEPS[step].description}</DialogDescription>

                    <div className="mt-3 space-y-2 sm:hidden">
                        <p className="text-xs font-medium">
                            Paso {step + 1} de {STEPS.length} · {STEPS[step].title}
                        </p>
                        <div
                            className="h-1.5 overflow-hidden rounded-full bg-muted"
                            role="progressbar"
                            aria-valuemin={1}
                            aria-valuemax={STEPS.length}
                            aria-valuenow={step + 1}
                            aria-label={`Paso ${step + 1} de ${STEPS.length}`}
                        >
                            <div
                                className="h-full rounded-full bg-primary transition-[width]"
                                style={{
                                    width: `${((step + 1) / STEPS.length) * 100}%`,
                                }}
                            />
                        </div>
                    </div>

                    <ol
                        className="mt-4 hidden grid-cols-3 gap-2 sm:grid"
                        aria-label="Progreso"
                    >
                        {STEPS.map((item, index) => (
                            <li key={item.title}>
                                <button
                                    type="button"
                                    className={cn(
                                        'flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors',
                                        index === step
                                            ? 'bg-primary/10 text-foreground'
                                            : 'text-muted-foreground',
                                        index < step && 'text-foreground'
                                    )}
                                    onClick={() => {
                                        if (index < step) setStep(index)
                                    }}
                                    disabled={index > step}
                                    aria-current={index === step ? 'step' : undefined}
                                >
                                    <span
                                        className={cn(
                                            'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]',
                                            index <= step &&
                                                'border-primary bg-primary text-primary-foreground'
                                        )}
                                    >
                                        {index < step ? (
                                            <Check className="size-3.5" />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <span>{item.title}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </DialogHeader>

                <form
                    ref={scrollRef}
                    onSubmit={handleSubmit(submitCommitment, (invalidFields) =>
                        goToFirstError(Object.keys(invalidFields))
                    )}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
                        {!commitment && interpretedFields.length > 0 && step === 0 && (
                            <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2">
                                <p className="text-xs text-violet-700 dark:text-violet-300">
                                    <Wand2 className="mr-1 inline size-3" />
                                    Finp completó{' '}
                                    <strong className="font-medium">
                                        {interpretedFields.join(', ')}
                                    </strong>
                                    . Revisá todo antes de crear el compromiso.
                                </p>
                            </div>
                        )}

                        {step === 0 && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Descripción</Label>
                                    <Input
                                        id="description"
                                        placeholder="Ej: Alquiler"
                                        autoFocus
                                        {...register('description')}
                                    />
                                    {errors.description && (
                                        <p className="text-xs text-destructive">
                                            {errors.description.message}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                                    <FormattedAmountInput
                                        id="amount"
                                        label={
                                            amountPolicy === 'variable'
                                                ? 'Monto estimado'
                                                : 'Monto'
                                        }
                                        value={amount}
                                        currency={currency}
                                        error={errors.amount?.message}
                                        onValueChangeAction={(value) =>
                                            setValue('amount', value, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })
                                        }
                                    />
                                    <CurrencySelector
                                        value={currency}
                                        options={['ARS', 'USD'] as const}
                                        onValueChange={(value) =>
                                            setValue('currency', value, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amountPolicy">Tipo de monto</Label>
                                    <Select
                                        value={amountPolicy ?? 'fixed'}
                                        onValueChange={(value) =>
                                            setValue(
                                                'amountPolicy',
                                                value as CommitmentFormData['amountPolicy'],
                                                {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                }
                                            )
                                        }
                                    >
                                        <SelectTrigger id="amountPolicy">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">Monto fijo</SelectItem>
                                            <SelectItem value="variable">
                                                Monto variable a confirmar
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {amountPolicy === 'variable'
                                            ? 'Finp lo proyecta como estimado y te pide confirmar el valor real al aplicarlo.'
                                            : 'El monto continúa vigente hasta que programes una actualización.'}
                                    </p>
                                </div>

                                {amountPolicy === 'variable' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="estimationMode">
                                            Monto para la proyección
                                        </Label>
                                        <Select
                                            value={estimationMode ?? 'template'}
                                            onValueChange={(value) =>
                                                setValue(
                                                    'estimationMode',
                                                    value as CommitmentFormData['estimationMode'],
                                                    { shouldDirty: true }
                                                )
                                            }
                                        >
                                            <SelectTrigger id="estimationMode">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="template">
                                                    Usar el monto ingresado
                                                </SelectItem>
                                                <SelectItem value="last">
                                                    Usar el último monto pagado
                                                </SelectItem>
                                                <SelectItem value="average">
                                                    Promediar los últimos 6 pagos
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            Finp usa este cálculo sólo para anticipar tus
                                            gastos. Al aplicar el compromiso siempre
                                            confirmarás el monto real.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {step === 1 && (
                            <div className="grid items-start gap-5 lg:grid-cols-2">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="recurrence">Recurrencia</Label>
                                        <Select
                                            value={recurrence}
                                            onValueChange={(value) => {
                                                const next =
                                                    value as CommitmentFormData['recurrence']
                                                setValue('recurrence', next, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                                if (next !== 'monthly') {
                                                    setValue('dayOfMonth', undefined)
                                                }
                                                if (next === 'once') {
                                                    setValue('endDate', undefined)
                                                }
                                                if (next === 'weekly') {
                                                    setValue(
                                                        'reminderLeadDays',
                                                        undefined
                                                    )
                                                }
                                            }}
                                        >
                                            <SelectTrigger
                                                id="recurrence"
                                                className="w-full sm:max-w-56"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="monthly">
                                                    Mensual
                                                </SelectItem>
                                                <SelectItem value="weekly">
                                                    Semanal
                                                </SelectItem>
                                                <SelectItem value="once">
                                                    Una vez
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {recurrence === 'monthly' && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium leading-none">
                                                Día habitual de vencimiento
                                            </p>
                                            <CommitmentDayPicker
                                                value={dayOfMonth}
                                                error={errors.dayOfMonth?.message}
                                                onChange={(day) =>
                                                    setValue('dayOfMonth', day, {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    })
                                                }
                                            />
                                        </div>
                                    )}

                                    {recurrence !== 'weekly' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="reminderLeadDays">
                                                Recordatorio
                                            </Label>
                                            <Select
                                                value={
                                                    reminderLeadDays === undefined
                                                        ? 'none'
                                                        : String(reminderLeadDays)
                                                }
                                                onValueChange={(value) =>
                                                    setValue(
                                                        'reminderLeadDays',
                                                        value === 'none'
                                                            ? undefined
                                                            : Number(value),
                                                        {
                                                            shouldValidate: true,
                                                            shouldDirty: true,
                                                        }
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="reminderLeadDays"
                                                    className="w-full sm:max-w-56"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {REMINDER_OPTIONS.map((option) => (
                                                        <SelectItem
                                                            key={option.value}
                                                            value={option.value}
                                                        >
                                                            {option.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                Finp lo mostrará como pendiente dentro de la
                                                aplicación.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                                        <DatePickerField
                                            label={
                                                recurrence === 'once'
                                                    ? 'Fecha del compromiso *'
                                                    : 'Fecha de inicio *'
                                            }
                                            value={startDate}
                                            error={errors.startDate?.message}
                                            onChange={(date) => {
                                                if (date) {
                                                    setValue('startDate', date, {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    })
                                                }
                                            }}
                                        />
                                        {recurrence !== 'once' && (
                                            <DatePickerField
                                                label="Fecha de fin (opcional)"
                                                value={endDate}
                                                minDate={startDate}
                                                clearable
                                                error={errors.endDate?.message}
                                                onChange={(date) =>
                                                    setValue(
                                                        'endDate',
                                                        date ?? undefined,
                                                        {
                                                            shouldValidate: true,
                                                            shouldDirty: true,
                                                        }
                                                    )
                                                }
                                            />
                                        )}
                                    </div>

                                    {nextDueDate ? (
                                        <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/30 p-4 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Próximo vencimiento
                                                </p>
                                                <p className="mt-1 font-medium tabular-nums">
                                                    {formatDate(nextDueDate)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Primer recordatorio
                                                </p>
                                                <p className="mt-1 font-medium tabular-nums">
                                                    {nextReminderDate
                                                        ? formatDate(nextReminderDate)
                                                        : 'Sin recordatorio'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                                <div className="space-y-4">
                                    {simpleAccounts.length > 0 && (
                                        <div className="space-y-2">
                                            <Label htmlFor="accountId">
                                                Cuenta habitual (opcional)
                                            </Label>
                                            <Select
                                                value={accountId || undefined}
                                                onValueChange={(value) =>
                                                    setValue('accountId', value, {
                                                        shouldDirty: true,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="accountId"
                                                    className="w-full sm:max-w-64"
                                                >
                                                    <SelectValue placeholder="Seleccioná cuenta" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {simpleAccounts.map((account) => (
                                                        <SelectItem
                                                            key={account._id.toString()}
                                                            value={account._id.toString()}
                                                        >
                                                            {account.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {expenseCategories.length > 0 && (
                                        <CategoryPickerField
                                            categories={rankedExpenseCategories}
                                            selectedCategoryId={categoryId}
                                            query={categoryQuery}
                                            label="Categoría (opcional)"
                                            description="Primero mostramos las más probables según tu historial."
                                            collapsedLimit={8}
                                            onQueryChange={setCategoryQuery}
                                            onSelect={(value) =>
                                                setValue('categoryId', value, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                    )}
                                </div>

                                <div className="space-y-3 lg:sticky lg:top-0">
                                    <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Compromiso
                                            </p>
                                            <p className="font-medium">
                                                {description || 'Sin descripción'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Monto
                                                </p>
                                                <p className="font-medium tabular-nums">
                                                    {new Intl.NumberFormat('es-AR', {
                                                        style: 'currency',
                                                        currency,
                                                        maximumFractionDigits: 0,
                                                    }).format(amount ?? 0)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Frecuencia
                                                </p>
                                                <p className="font-medium">
                                                    {recurrence === 'monthly'
                                                        ? `Mensual${dayOfMonth ? ` · día ${dayOfMonth}` : ''}`
                                                        : recurrence === 'weekly'
                                                          ? 'Semanal'
                                                          : 'Una vez'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Inicio
                                                </p>
                                                <p>{formatDate(startDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">
                                                    Recordatorio
                                                </p>
                                                <p>
                                                    {reminderLeadDays === undefined
                                                        ? 'Sin recordatorio'
                                                        : reminderLeadDays === 0
                                                          ? 'El mismo día'
                                                          : `${reminderLeadDays} días antes`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        La aplicación es manual. Finp no registrará ningún
                                        gasto sin tu confirmación.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid shrink-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex sm:items-center sm:justify-between sm:px-6">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isSubmitting}
                            onClick={() => {
                                if (step === 0) {
                                    handleDialogChange(false)
                                } else {
                                    setStep((current) => current - 1)
                                }
                            }}
                            className="min-h-11 w-full sm:w-auto"
                        >
                            {step === 0 ? (
                                'Cancelar'
                            ) : (
                                <>
                                    <ChevronLeft className="size-4" />
                                    Atrás
                                </>
                            )}
                        </Button>

                        {step < STEPS.length - 1 ? (
                            <Button
                                type="button"
                                className="min-h-11 w-full sm:w-auto"
                                onClick={() => void nextStep()}
                            >
                                Continuar
                                <ChevronRight className="size-4" />
                            </Button>
                        ) : (
                            <Button
                                type="submit"
                                className="min-h-11 w-full sm:w-auto"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <Spinner />
                                ) : commitment ? (
                                    'Guardar cambios'
                                ) : (
                                    'Crear compromiso'
                                )}
                            </Button>
                        )}
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
