'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { spaceSchema, type SpaceFormData } from '@/lib/validations'
import { SPACE_TYPE_LABELS } from '@/lib/utils/spaces'
import { SPACE_TYPE_META, SpaceCurrencyBadge, SpaceCurrencyIcon, SpaceCurrencyStack, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
import { COMMON_CURRENCIES, ISO_CURRENCIES } from '@/lib/constants/iso-currencies'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select'
import {
    type DialogProps,
    normalizeDialogDate,
    SpaceDialogChoice,
    SpaceDialogField,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { cn } from '@/lib/utils'
import type { ISpace } from '@/types'

const WIZARD_STEPS = ['Información', 'Monedas', 'Revisión'] as const
type WizardStep = (typeof WIZARD_STEPS)[number]

const NAME_PLACEHOLDER: Record<SpaceFormData['type'], string> = {
    couple: 'Ej. Casa con Roro',
    home: 'Ej. El grupo del depa',
    travel: 'Ej. Semana en Bariloche',
    project: 'Ej. Remodelación de la cocina',
    event: 'Ej. Cumpleaños de Juli',
    personal: 'Ej. Presupuesto personal',
    other: 'Nombre del espacio',
}

const WIZARD_TYPES: SpaceFormData['type'][] = ['couple', 'home', 'travel', 'project']

function buildInitialForm(): SpaceFormData {
    return {
        name: '',
        description: '',
        type: 'couple',
        mode: 'managed',
        status: 'active',
        startDate: new Date(),
        endDate: undefined,
        currencies: ['ARS'],
        reportingCurrency: 'ARS',
        defaultSplitMode: 'equal',
    }
}

function StepIndicator({
    steps,
    current,
}: {
    steps: readonly WizardStep[]
    current: number
}) {
    return (
        <div className="flex items-center gap-1.5">
            {steps.map((label, i) => (
                <div key={i} className="flex items-center gap-1.5">
                    <div
                        className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
                            i < current
                                ? 'bg-primary text-primary-foreground'
                                : i === current
                                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/20'
                                    : 'bg-muted text-muted-foreground'
                        )}
                    >
                        {i < current ? <Check className="h-2.5 w-2.5" /> : i + 1}
                    </div>
                    <span
                        className={cn(
                            'hidden text-xs font-medium sm:inline',
                            i === current ? 'text-foreground' : 'text-muted-foreground'
                        )}
                    >
                        {label}
                    </span>
                    {i < steps.length - 1 && (
                        <div className="h-px w-3 shrink-0 bg-border sm:w-4" />
                    )}
                </div>
            ))}
        </div>
    )
}

function WizardSection({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}) {
    return (
        <section className={cn('space-y-3 border-b border-border/60 pb-5 last:border-b-0 last:pb-0', className)}>
            {children}
        </section>
    )
}

export function CreateSpaceDialog({
    open,
    onOpenChange,
    onSubmit,
}: DialogProps & {
    onSubmit: (data: SpaceFormData) => Promise<ISpace | undefined | void>
}) {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [form, setForm] = useState<SpaceFormData>(buildInitialForm())
    const [submitting, setSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [globalError, setGlobalError] = useState<string | null>(null)
    const [createdSpace, setCreatedSpace] = useState<ISpace | null>(null)

    const [currencyQuery, setCurrencyQuery] = useState('')

    // Date pickers
    const [startDateOpen, setStartDateOpen] = useState(false)
    const [endDateOpen, setEndDateOpen] = useState(false)

    useEffect(() => {
        if (!open) return
        setStep(0)
        setForm(buildInitialForm())
        setSubmitting(false)
        setFieldErrors({})
        setGlobalError(null)
        setCurrencyQuery('')
        setCreatedSpace(null)
    }, [open])

    const setField = <K extends keyof SpaceFormData>(key: K, value: SpaceFormData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        if (fieldErrors[key]) {
            setFieldErrors((prev) => {
                const next = { ...prev }
                delete next[key]
                return next
            })
        }
    }

    const toggleCurrency = (currency: string) => {
        setForm((prev) => {
            const next = prev.currencies.includes(currency)
                ? prev.currencies.filter((c) => c !== currency)
                : [...prev.currencies, currency]
            const safe = next.length > 0 ? next : [currency]
            return {
                ...prev,
                currencies: safe,
                reportingCurrency: safe.includes(prev.reportingCurrency) ? prev.reportingCurrency : safe[0],
            }
        })
    }

    const currencyOptions = useMemo(() => {
        const query = currencyQuery.trim().toLowerCase()
        const common = ISO_CURRENCIES.filter((currency) =>
            (COMMON_CURRENCIES as readonly string[]).includes(currency.code)
        )
        const rest = ISO_CURRENCIES.filter((currency) =>
            !(COMMON_CURRENCIES as readonly string[]).includes(currency.code)
        )
        const options = query
            ? ISO_CURRENCIES.filter((currency) =>
                currency.code.toLowerCase().includes(query) ||
                currency.name.toLowerCase().includes(query)
            )
            : [...common, ...rest]

        return options
    }, [currencyQuery])

    const validateStep = (stepIndex: number): boolean => {
        const errors: Record<string, string> = {}

        if (stepIndex === 0) {
            if (!form.type) errors.type = 'Seleccioná un tipo de espacio'
            if (!form.name.trim() || form.name.trim().length < 2) {
                errors.name = 'El nombre debe tener al menos 2 caracteres'
            }
            if (form.name.trim().length > 80) errors.name = 'El nombre no puede superar los 80 caracteres'
            if (form.description && form.description.length > 240) {
                errors.description = 'La descripción no puede superar los 240 caracteres'
            }
        }

        if (stepIndex === 1) {
            if (form.currencies.length === 0) errors.currencies = 'Seleccioná al menos una moneda'
            if (!form.currencies.includes(form.reportingCurrency)) {
                errors.reportingCurrency = 'La moneda de reporte debe estar en la lista de monedas'
            }
            const startDate = normalizeDialogDate(form.startDate)
            const endDate = normalizeDialogDate(form.endDate)
            if (endDate && startDate && endDate < startDate) {
                errors.endDate = 'La fecha de fin no puede ser anterior a la de inicio'
            }
        }

        setFieldErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleNext = () => {
        if (!validateStep(step)) return
        setStep((s) => s + 1)
    }

    const handleBack = () => {
        setFieldErrors({})
        setStep((s) => s - 1)
    }

    const handleSubmit = async () => {
        if (!validateStep(step)) return

        const parsed = spaceSchema.safeParse(form)

        if (!parsed.success) {
            setGlobalError(parsed.error.issues[0]?.message ?? 'Revisá los datos del espacio.')
            return
        }

        setSubmitting(true)
        setGlobalError(null)

        try {
            const space = await onSubmit(parsed.data)
            const spaceResult = space ?? null

            setCreatedSpace(spaceResult)
            setStep(3)
        } catch (err) {
            setGlobalError(err instanceof Error ? err.message : 'No pudimos guardar el espacio.')
        } finally {
            setSubmitting(false)
        }
    }

    const isSuccessStep = step === 3
    const isLastDataStep = step === 2
    const canProceed = step === 0 ? !!form.type && form.name.trim().length >= 2 : true
    const reviewItems: Array<{ label: string; value: ReactNode }> = [
        { label: 'Tipo', value: SPACE_TYPE_LABELS[form.type] },
        { label: 'Monedas del espacio', value: <SpaceCurrencyStack currencies={form.currencies} /> },
        { label: 'Reporte', value: <SpaceCurrencyBadge currency={form.reportingCurrency} /> },
        { label: 'Reparto', value: 'Se configura después' },
        { label: 'Participantes', value: 'Se agregan luego con link' },
    ]

    return (
        <Dialog open={open} onOpenChange={isSuccessStep ? undefined : onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[680px] gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    {/* Header */}
                    <div className="shrink-0 border-b border-border/70 bg-background/92 px-5 py-4 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-xl tracking-tight">
                                {isSuccessStep ? '¡Espacio creado!' : 'Nuevo espacio'}
                            </DialogTitle>
                            {!isSuccessStep && (
                                <DialogDescription className="text-sm">
                                    Creá un contexto financiero claro para ordenar movimientos, balances y participantes.
                                </DialogDescription>
                            )}
                        </DialogHeader>
                        {!isSuccessStep && (
                            <div className="mt-3">
                                <StepIndicator steps={WIZARD_STEPS} current={step} />
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">

                        {/* ── Step 0: Identidad + Tipo ── */}
                        {step === 0 && (
                            <div className="space-y-4">
                                <WizardSection>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Identidad</SpaceDialogSectionEyebrow>
                                        <SpaceDialogField label="Nombre">
                                            <Input
                                                value={form.name}
                                                onChange={(e) => setField('name', e.target.value)}
                                                placeholder={NAME_PLACEHOLDER[form.type]}
                                                className={fieldErrors.name ? 'border-destructive' : ''}
                                                autoFocus
                                            />
                                            {fieldErrors.name && (
                                                <p className="text-xs text-destructive">{fieldErrors.name}</p>
                                            )}
                                        </SpaceDialogField>
                                        <SpaceDialogField label="Descripción">
                                            <SpaceDialogTextArea
                                                value={form.description ?? ''}
                                                onChange={(e) => setField('description', e.target.value)}
                                                rows={2}
                                                placeholder="¿Para qué es este espacio?"
                                                className={fieldErrors.description ? 'border-destructive' : ''}
                                            />
                                            {fieldErrors.description && (
                                                <p className="text-xs text-destructive">{fieldErrors.description}</p>
                                            )}
                                        </SpaceDialogField>
                                    </div>
                                </WizardSection>

                                <WizardSection>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Tipo de espacio</SpaceDialogSectionEyebrow>
                                        <div className="grid grid-cols-2 gap-2">
                                            {WIZARD_TYPES.map((value) => {
                                                const meta = SPACE_TYPE_META[value]
                                                const active = form.type === value
                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => {
                                                            setField('type', value)
                                                            if (fieldErrors.type) {
                                                                setFieldErrors((p) => {
                                                                    const n = { ...p }
                                                                    delete n.type
                                                                    return n
                                                                })
                                                            }
                                                        }}
                                                        className={cn(
                                                            'flex min-h-[120px] flex-col items-center gap-2 rounded-[18px] border p-3 text-center transition-all',
                                                            active
                                                                ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                                                                : 'border-border bg-background/80 hover:bg-accent/20'
                                                        )}
                                                    >
                                                        <SpaceTypeIcon
                                                            type={value}
                                                            className="h-10 w-10 rounded-[14px]"
                                                        />
                                                        <span className="text-xs font-semibold text-foreground">
                                                            {SPACE_TYPE_LABELS[value]}
                                                        </span>
                                                        <span className="text-center text-[10px] leading-tight text-muted-foreground">
                                                            {meta.description}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {fieldErrors.type && (
                                            <p className="text-xs text-destructive">{fieldErrors.type}</p>
                                        )}
                                    </div>
                                </WizardSection>
                            </div>
                        )}

                        {/* ── Step 1: Monedas + Período ── */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <WizardSection>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Monedas</SpaceDialogSectionEyebrow>
                                        <Input
                                            value={currencyQuery}
                                            onChange={(e) => setCurrencyQuery(e.target.value)}
                                            placeholder="Buscar por código o nombre"
                                            className="h-9"
                                        />
                                        <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                                            {currencyOptions.map((currency) => {
                                                const active = form.currencies.includes(currency.code)

                                                return (
                                                    <button
                                                        key={currency.code}
                                                        type="button"
                                                        onClick={() => toggleCurrency(currency.code)}
                                                        className={cn(
                                                            'flex items-center justify-between gap-3 rounded-[16px] border px-3 py-2 text-left transition-colors',
                                                            active
                                                                ? 'border-primary/25 bg-primary/10 text-primary'
                                                                : 'border-border bg-background/80 text-foreground hover:bg-accent/30'
                                                        )}
                                                    >
                                                        <SpaceCurrencyIcon currency={currency.code} />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-semibold">{currency.code}</span>
                                                            <span className="block truncate text-xs text-muted-foreground">
                                                                {currency.name}
                                                            </span>
                                                        </span>
                                                        {active ? (
                                                            <Check className="h-4 w-4 shrink-0" />
                                                        ) : null}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {fieldErrors.currencies && (
                                            <p className="text-xs text-destructive">{fieldErrors.currencies}</p>
                                        )}

                                        <SpaceDialogField label="Moneda de reporte">
                                            <Select
                                                value={form.reportingCurrency}
                                                onValueChange={(v) => setField('reportingCurrency', v)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <span className="flex min-w-0 items-center gap-2">
                                                        <SpaceCurrencyIcon currency={form.reportingCurrency} className="h-5 w-5" />
                                                        <span className="truncate">{form.reportingCurrency}</span>
                                                    </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {form.currencies.map((c) => {
                                                        return (
                                                        <SelectItem key={c} value={c}>
                                                            <span className="flex items-center gap-2">
                                                                <SpaceCurrencyIcon currency={c} className="h-5 w-5" />
                                                                <span>{c}</span>
                                                            </span>
                                                        </SelectItem>
                                                        )
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            {fieldErrors.reportingCurrency && (
                                                <p className="text-xs text-destructive">
                                                    {fieldErrors.reportingCurrency}
                                                </p>
                                            )}
                                        </SpaceDialogField>
                                    </div>
                                </WizardSection>

                                <WizardSection>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Período</SpaceDialogSectionEyebrow>
                                        <DatePickerField
                                            label="Fecha de inicio"
                                            value={form.startDate}
                                            isOpen={startDateOpen}
                                            onOpenChange={setStartDateOpen}
                                            onChange={(d) => setField('startDate', d)}
                                        />
                                        <DatePickerField
                                            label="Fecha de fin (opcional)"
                                            value={form.endDate ?? undefined}
                                            isOpen={endDateOpen}
                                            onOpenChange={setEndDateOpen}
                                            onChange={(d) => setField('endDate', d)}
                                            error={fieldErrors.endDate}
                                            showErrors
                                        />
                                    </div>
                                </WizardSection>
                            </div>
                        )}

                        {/* ── Step 2: Revisión final ── */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <WizardSection>
                                    <div className="space-y-4">
                                        <SpaceDialogSectionEyebrow>Revisión final</SpaceDialogSectionEyebrow>
                                        <div className="flex items-start gap-3">
                                            <SpaceTypeIcon type={form.type} className="h-12 w-12 shrink-0 rounded-[16px]" />
                                            <div className="min-w-0">
                                                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                                                    {form.name}
                                                </h3>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {form.description || 'Sin descripción por ahora.'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {reviewItems.map(({ label, value }) => (
                                                <div key={label} className="border-b border-border/60 pb-3 last:border-b-0">
                                                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                        {label}
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-foreground">
                                                        {value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </WizardSection>

                                <WizardSection>
                                    <div className="space-y-2">
                                        <SpaceDialogSectionEyebrow>Monedas</SpaceDialogSectionEyebrow>
                                        <p className="text-sm leading-relaxed text-muted-foreground">
                                            Las monedas se eligen desde el catálogo ISO. No se crean monedas nuevas desde este flujo.
                                        </p>
                                    </div>
                                </WizardSection>

                                {globalError && (
                                    <p className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                        {globalError}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ── Step 3: Éxito ── */}
                        {step === 3 && createdSpace && (
                            <div className="flex flex-col items-center gap-6 py-8 text-center">
                                <div
                                    className="flex h-20 w-20 items-center justify-center rounded-[28px]"
                                    style={{ background: 'color-mix(in srgb, var(--chart-3) 14%, transparent)' }}
                                >
                                    <Sparkles size={36} style={{ color: 'var(--chart-3)' }} />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                                        {createdSpace.name}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Tu espacio está listo. Ya podés empezar a registrar movimientos y sumar participantes cuando el link de invitación esté disponible.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                        className="rounded-full"
                                        onClick={() => {
                                            onOpenChange(false)
                                            router.push(`/spaces/${String(createdSpace._id)}`)
                                        }}
                                    >
                                        Ir al espacio
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="rounded-full"
                                        onClick={() => {
                                            setStep(0)
                                            setForm(buildInitialForm())
                                            setCreatedSpace(null)
                                        }}
                                    >
                                        Crear otro
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        className="rounded-full"
                                        onClick={() => onOpenChange(false)}
                                    >
                                        Cerrar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {!isSuccessStep && (
                        <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-3 sm:px-6">
                            <div className="flex w-full items-center gap-2">
                                {step > 0 ? (
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        disabled={submitting}
                                        className="rounded-full"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Atrás
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() => onOpenChange(false)}
                                        disabled={submitting}
                                        className="rounded-full"
                                    >
                                        Cancelar
                                    </Button>
                                )}

                                <div className="flex flex-1 justify-center gap-1">
                                    {WIZARD_STEPS.map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'h-1.5 rounded-full transition-all',
                                                i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted'
                                            )}
                                        />
                                    ))}
                                </div>

                                {isLastDataStep ? (
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="rounded-full"
                                    >
                                        {submitting ? 'Creando…' : 'Crear espacio'}
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleNext}
                                        disabled={!canProceed}
                                        className="rounded-full"
                                    >
                                        Siguiente
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
