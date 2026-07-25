'use client'

import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { isSimpleTransactionAccountType } from '@/lib/utils/accounts'
import type { IScheduledCommitment, ICategory, IAccount } from '@/types'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import { CommitmentAmountSchedule } from '@/components/shared/CommitmentAmountSchedule'
import { Wand2 } from 'lucide-react'
import type { CommitmentDraftEnvelope } from '@/types/capture-intent'

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

interface CommitmentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    commitment: IScheduledCommitment | null
    categories: ICategory[]
    accounts?: IAccount[]
    onSubmit: (data: CommitmentFormData) => Promise<void>
    /** Se dispara cuando cambia la agenda de montos, para refrescar el listado. */
    onScheduleChange?: () => void
    /**
     * Borrador que llega desde Captura rápida. Sólo se usa en modo alta: la
     * configuración final sigue siendo responsabilidad de esta pantalla.
     */
    initialDraft?: CommitmentDraftEnvelope | null
}

export function CommitmentDialog({
                                     open,
                                     onOpenChange,
                                     commitment,
                                     categories,
                                     accounts = [],
                                     onSubmit,
                                     onScheduleChange,
                                     initialDraft = null,
                                 }: CommitmentDialogProps) {
    const {
        register,
        handleSubmit,
        control,
        setValue,
        reset,
        formState: { errors, isSubmitting, submitCount },
    } = useForm<CommitmentFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(commitmentSchema) as any,
        defaultValues: {
            currency: 'ARS',
            recurrence: 'monthly',
            applyMode: 'manual',
            amountPolicy: 'fixed',
            estimationMode: 'template',
            startDate: new Date(),
        },
    })

    const scrollRef = useRef<HTMLFormElement>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    // Sólo se anuncian los campos que Finp realmente interpretó del texto, no los
    // que vienen de un valor por defecto.
    const interpretedFields = Object.entries(initialDraft?.provenance ?? {})
        .filter(([, source]) => source && source !== 'default')
        .map(([field]) => DRAFT_FIELD_LABELS[field] ?? field)

    const expenseCategories = categories.filter((c) => c.type === 'expense')
    const simpleAccounts = accounts.filter(
        (account) => account.isActive !== false && isSimpleTransactionAccountType(account.type)
    )
    const recurrence = useWatch({ control, name: 'recurrence' })
    const amount = useWatch({ control, name: 'amount' })
    const currency = useWatch({ control, name: 'currency' })
    const categoryId = useWatch({ control, name: 'categoryId' })
    const accountId = useWatch({ control, name: 'accountId' })
    const applyMode = useWatch({ control, name: 'applyMode' })
    const amountPolicy = useWatch({ control, name: 'amountPolicy' })
    const estimationMode = useWatch({ control, name: 'estimationMode' })
    const startDate = useWatch({ control, name: 'startDate' })
    const endDate = useWatch({ control, name: 'endDate' })

    useEffect(() => {
        if (open) {
            if (commitment) {
                reset({
                    description: commitment.description,
                    amount: commitment.amount,
                    currency: commitment.currency,
                    recurrence: commitment.recurrence,
                    dayOfMonth: commitment.dayOfMonth,
                    applyMode: commitment.applyMode,
                    amountPolicy: commitment.amountPolicy ?? 'fixed',
                    estimationMode: commitment.estimationMode ?? 'template',
                    categoryId: (commitment.categoryId as { _id?: { toString(): string } })?._id?.toString() ?? commitment.categoryId?.toString() ?? '',
                    accountId: (commitment.accountId as { _id?: { toString(): string } })?._id?.toString() ?? commitment.accountId?.toString() ?? '',
                    startDate: commitment.startDate
                        ? new Date(String(commitment.startDate))
                        : new Date(),
                    endDate: commitment.endDate
                        ? new Date(String(commitment.endDate))
                        : undefined,
                })
            } else {
                // Un borrador de Captura rápida sólo precarga lo que se interpretó
                // con confianza; el resto conserva los valores por defecto.
                const fields = initialDraft?.fields
                reset({
                    description: fields?.description ?? '',
                    amount: fields?.amount ?? undefined,
                    currency: fields?.currency ?? 'ARS',
                    recurrence: fields?.recurrence ?? 'monthly',
                    dayOfMonth: fields?.dayOfMonth,
                    applyMode: 'manual',
                    amountPolicy: fields?.amountPolicy ?? 'fixed',
                    estimationMode: 'template',
                    categoryId: fields?.categoryId ?? '',
                    accountId: fields?.accountId ?? '',
                    startDate: fields?.startDate ? new Date(fields.startDate) : new Date(),
                })
            }
        }
    }, [open, commitment, initialDraft, reset])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" className="max-w-md p-0 overflow-hidden">
                <DialogHeader className="px-5 pt-5 pb-0">
                    <DialogTitle>{commitment ? 'Editar compromiso' : 'Nuevo compromiso'}</DialogTitle>
                    <DialogDescription>
                        Defini monto, recurrencia y modo de aplicacion del compromiso.
                    </DialogDescription>
                </DialogHeader>

                <form ref={scrollRef} onSubmit={handleSubmit(onSubmit)} className="flex max-h-[100dvh] flex-col sm:max-h-[85vh]">
                    <div className="overflow-y-auto px-5 py-4 space-y-4">
                    {!commitment && interpretedFields.length > 0 && (
                        <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2">
                            <p className="text-xs text-violet-700 dark:text-violet-300">
                                <Wand2 className="mr-1 inline size-3" />
                                Desde Captura rápida completamos{' '}
                                <strong className="font-medium">{interpretedFields.join(', ')}</strong>.
                                Revisá el resto antes de crear el compromiso.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Input id="description" placeholder="Ej: Alquiler" autoFocus {...register('description')} />
                        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormattedAmountInput
                            id="amount"
                            label={amountPolicy === 'variable' ? 'Monto estimado' : 'Monto'}
                            value={amount}
                            currency={currency}
                            autoFocus
                            error={errors.amount?.message}
                            onValueChangeAction={(value) =>
                                setValue('amount', value, { shouldValidate: true, shouldDirty: true })
                            }
                        />
                        <CurrencySelector
                            value={currency}
                            options={['ARS', 'USD'] as const}
                            onValueChange={(value) =>
                                setValue('currency', value, { shouldValidate: true, shouldDirty: true })
                            }
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Política de monto</Label>
                        <Select
                            value={amountPolicy ?? 'fixed'}
                            onValueChange={(v) =>
                                setValue('amountPolicy', v as CommitmentFormData['amountPolicy'], {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                })
                            }
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="fixed">Monto fijo</SelectItem>
                                <SelectItem value="variable">Monto variable a confirmar</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            {amountPolicy === 'variable'
                                ? 'Finp prepara el período pero te pide confirmar el importe real antes de registrarlo. En la proyección aparece como estimado.'
                                : 'El mismo valor sigue vigente hasta que lo cambies o programes un aumento.'}
                        </p>
                    </div>

                    {amountPolicy === 'variable' && (
                        <div className="space-y-2">
                            <Label>Cómo estimarlo mientras tanto</Label>
                            <Select
                                value={estimationMode ?? 'template'}
                                onValueChange={(v) =>
                                    setValue('estimationMode', v as CommitmentFormData['estimationMode'], {
                                        shouldValidate: true,
                                        shouldDirty: true,
                                    })
                                }
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="template">Usar el monto estimado</SelectItem>
                                    <SelectItem value="last">Usar el último importe registrado</SelectItem>
                                    <SelectItem value="average">Promediar los últimos importes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Recurrencia</Label>
                            <Select value={recurrence} onValueChange={(v) => setValue('recurrence', v as CommitmentFormData['recurrence'])}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="monthly">Mensual</SelectItem>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                    <SelectItem value="once">Una vez</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {recurrence === 'monthly' && (
                            <div className="space-y-2">
                                <Label htmlFor="dayOfMonth">Día del mes</Label>
                                <Input id="dayOfMonth" type="number" inputMode="numeric" min="1" max="31" placeholder="Ej: 10"
                                       {...register('dayOfMonth', { valueAsNumber: true })} />
                                {errors.dayOfMonth && <p className="text-xs text-destructive">{errors.dayOfMonth.message}</p>}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Modo de aplicación</Label>
                        <Select value={applyMode} onValueChange={(v) => setValue('applyMode', v as CommitmentFormData['applyMode'])}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="auto_month_start">Preparado para automatización</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {expenseCategories.length > 0 && (
                        <div className="space-y-2">
                            <Label>Categoría (opcional)</Label>
                            <Select value={categoryId} onValueChange={(v) => setValue('categoryId', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccioná categoría" /></SelectTrigger>
                                <SelectContent>
                                    {expenseCategories.map((c) => (
                                        <SelectItem key={c._id.toString()} value={c._id.toString()}>
                                            <div className="flex items-center gap-2">
                                                {c.color && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
                                                {c.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {simpleAccounts.length > 0 && (
                        <div className="space-y-2">
                            <Label>Cuenta habitual (opcional)</Label>
                            <Select
                                value={accountId || undefined}
                                onValueChange={(v) => setValue('accountId', v, { shouldDirty: true })}
                            >
                                <SelectTrigger><SelectValue placeholder="Seleccioná cuenta" /></SelectTrigger>
                                <SelectContent>
                                    {simpleAccounts.map((account) => (
                                        <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Se propone al aplicar el compromiso. Podés cambiarla en cada aplicación.
                            </p>
                        </div>
                    )}

                    {commitment && (
                        <CommitmentAmountSchedule
                            commitmentId={commitment._id.toString()}
                            currency={currency}
                            schedule={commitment.amountSchedule ?? []}
                            onChange={onScheduleChange}
                        />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <DatePickerField
                            label="Fecha de inicio *"
                            value={startDate}
                            error={errors.startDate?.message}
                            onChange={(date) => {
                                if (date) setValue('startDate', date, { shouldValidate: true, shouldDirty: true })
                            }}
                        />
                        <DatePickerField
                            label="Fecha de fin (opcional)"
                            value={endDate}
                            minDate={startDate}
                            clearable
                            onChange={(date) =>
                                setValue('endDate', date, { shouldValidate: true, shouldDirty: true })
                            }
                        />
                    </div>

                    </div>

                    <div
                        className="sticky bottom-0 border-t bg-background px-5 py-4 safe-area-pb flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
                        style={{ borderColor: 'var(--border)' }}
                    >
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <span className="flex items-center gap-2"><Spinner />Guardando...</span>
                            ) : commitment ? 'Guardar cambios' : 'Crear compromiso'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
