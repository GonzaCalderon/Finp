'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Equal, Minus, Plus, X } from 'lucide-react'
import { spaceSchema, type SpaceFormData } from '@/lib/validations'
import { SPACE_MODE_LABELS, SPACE_TYPE_LABELS } from '@/lib/utils/spaces'
import { SPACE_TYPE_META, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
import { COMMON_CURRENCIES } from '@/lib/constants'
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
    SelectValue,
} from '@/components/ui/select'
import {
    type DialogProps,
    normalizeDialogDate,
    SpaceDialogChoice,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { apiJson } from '@/lib/client/auth-client'
import { cn } from '@/lib/utils'
import type { ISpace } from '@/types'

type InviteEntry = { email: string; role: 'participant' | 'admin' }

const WIZARD_STEPS_CREATE = ['Tipo', 'Configuración', 'Participantes'] as const
const WIZARD_STEPS_EDIT = ['Tipo', 'Configuración'] as const

const MODES_META = [
    {
        key: 'synchronized' as const,
        label: SPACE_MODE_LABELS.synchronized,
        desc: 'Los movimientos se vinculan a tus cuentas personales.',
    },
    {
        key: 'managed' as const,
        label: SPACE_MODE_LABELS.managed,
        desc: 'Un administrador aprueba los movimientos del espacio.',
    },
    {
        key: 'solo' as const,
        label: SPACE_MODE_LABELS.solo,
        desc: 'Espacio personal sin participantes ni splits.',
    },
]

const SPLIT_OPTIONS = [
    { key: 'equal' as const, label: 'Por partes iguales' },
    { key: 'percentage' as const, label: 'Porcentaje' },
    { key: 'fixed' as const, label: 'Montos fijos' },
    { key: 'none' as const, label: 'Sin split' },
]

function buildInitialForm(initialValues?: Partial<SpaceFormData>): SpaceFormData {
    return {
        name: initialValues?.name ?? '',
        description: initialValues?.description ?? '',
        type: initialValues?.type ?? 'home',
        mode: initialValues?.mode ?? 'managed',
        status: initialValues?.status ?? 'active',
        startDate: normalizeDialogDate(initialValues?.startDate) ?? new Date(),
        endDate: normalizeDialogDate(initialValues?.endDate),
        currencies: initialValues?.currencies ?? ['ARS'],
        reportingCurrency: initialValues?.reportingCurrency ?? 'ARS',
        defaultSplitMode: initialValues?.defaultSplitMode ?? 'equal',
    }
}

function StepIndicator({
    steps,
    current,
}: {
    steps: readonly string[]
    current: number
}) {
    return (
        <div className="flex items-center gap-2">
            {steps.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <div
                            className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                                i < current
                                    ? 'bg-primary text-primary-foreground'
                                    : i === current
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                            )}
                        >
                            {i < current ? <Check className="h-3 w-3" /> : i + 1}
                        </div>
                        <span
                            className={cn(
                                'text-sm font-medium',
                                i === current ? 'text-foreground' : 'text-muted-foreground'
                            )}
                        >
                            {label}
                        </span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className="h-px w-5 shrink-0 bg-border" />
                    )}
                </div>
            ))}
        </div>
    )
}

function SplitPercentageEditor() {
    const [slots, setSlots] = useState([50, 50])
    const total = slots.reduce((s, p) => s + p, 0)

    const updateSlot = (index: number, value: string) => {
        const num = Math.max(0, Math.min(100, parseInt(value) || 0))
        setSlots((prev) => prev.map((p, i) => (i === index ? num : p)))
    }

    const equalize = () => {
        const base = Math.floor(100 / slots.length)
        const remainder = 100 - base * slots.length
        setSlots(slots.map((_, i) => (i === 0 ? base + remainder : base)))
    }

    const addSlot = () => {
        if (slots.length >= 8) return
        const base = Math.floor(100 / (slots.length + 1))
        const remainder = 100 - base * (slots.length + 1)
        setSlots([...Array.from({ length: slots.length + 1 }, (_, i) => (i === 0 ? base + remainder : base))])
    }

    const removeSlot = () => {
        if (slots.length <= 2) return
        const newSlots = slots.slice(0, -1)
        const base = Math.floor(100 / newSlots.length)
        const remainder = 100 - base * newSlots.length
        setSlots(newSlots.map((_, i) => (i === 0 ? base + remainder : base)))
    }

    const isValid = total === 100

    return (
        <div className="space-y-3 rounded-[20px] border border-foreground/[0.07] bg-background/60 p-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Distribución predeterminada
                </p>
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={removeSlot}
                        disabled={slots.length <= 2}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[52px] text-center text-xs font-medium text-foreground">
                        {slots.length} partes
                    </span>
                    <button
                        type="button"
                        onClick={addSlot}
                        disabled={slots.length >= 8}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                </div>
            </div>

            <div className="space-y-2">
                {slots.map((pct, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-2 rounded-[14px] border border-foreground/[0.06] bg-background px-3 py-2"
                    >
                        <span className="w-20 text-xs text-muted-foreground">
                            Parte {i + 1}
                        </span>
                        <div className="flex flex-1 items-center gap-1">
                            <div
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                    width: `${Math.min(pct, 100)}%`,
                                    background: isValid
                                        ? 'var(--chart-3)'
                                        : total > 100
                                            ? 'var(--destructive)'
                                            : 'var(--sky)',
                                    minWidth: 4,
                                    maxWidth: '100%',
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                value={pct}
                                min={0}
                                max={100}
                                onChange={(e) => updateSlot(i, e.target.value)}
                                className="h-7 w-16 text-right text-sm"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span
                        className={cn(
                            'text-xs font-medium',
                            isValid
                                ? 'text-[#10B981]'
                                : total > 100
                                    ? 'text-destructive'
                                    : 'text-amber-600'
                        )}
                    >
                        Total: {total}%
                    </span>
                    {!isValid && (
                        <span className="text-xs text-muted-foreground">
                            {total > 100 ? `+${total - 100}% de más` : `Faltan ${100 - total}%`}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={equalize}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                    <Equal className="h-3 w-3" />
                    Igualar
                </button>
            </div>
        </div>
    )
}

export function CreateSpaceDialog({
    open,
    onOpenChange,
    onSubmit,
    initialValues,
    title = 'Nuevo espacio',
    description = 'Creá un contexto financiero claro para ordenar movimientos, balances y participantes.',
    hideParticipants = false,
}: DialogProps & {
    onSubmit: (data: SpaceFormData) => Promise<ISpace | undefined | void>
    initialValues?: Partial<SpaceFormData>
    title?: string
    description?: string
    hideParticipants?: boolean
}) {
    const isEdit = hideParticipants || !!initialValues
    const STEPS = isEdit ? WIZARD_STEPS_EDIT : WIZARD_STEPS_CREATE
    const totalSteps = STEPS.length

    const [step, setStep] = useState(0)
    const [form, setForm] = useState<SpaceFormData>(buildInitialForm(initialValues))
    const [submitting, setSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [globalError, setGlobalError] = useState<string | null>(null)

    // Currencies: common chips + custom input
    const [customCurrencyInput, setCustomCurrencyInput] = useState('')
    const customInputRef = useRef<HTMLInputElement>(null)

    // Date pickers open state
    const [startDateOpen, setStartDateOpen] = useState(false)
    const [endDateOpen, setEndDateOpen] = useState(false)

    // Participants (create only)
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<'participant' | 'admin'>('participant')
    const [invites, setInvites] = useState<InviteEntry[]>([])

    useEffect(() => {
        if (!open) return
        setStep(0)
        setForm(buildInitialForm(initialValues))
        setSubmitting(false)
        setFieldErrors({})
        setGlobalError(null)
        setCustomCurrencyInput('')
        setInvites([])
        setInviteEmail('')
    }, [initialValues, open])

    const setField = <K extends keyof SpaceFormData>(key: K, value: SpaceFormData[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
        if (fieldErrors[key]) {
            setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
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
                reportingCurrency: safe.includes(prev.reportingCurrency)
                    ? prev.reportingCurrency
                    : safe[0],
            }
        })
    }

    const addCustomCurrency = () => {
        const code = customCurrencyInput.trim().toUpperCase()
        if (!code || !/^[A-Z]{2,6}$/.test(code)) return
        if (!form.currencies.includes(code)) {
            setForm((prev) => ({ ...prev, currencies: [...prev.currencies, code] }))
        }
        setCustomCurrencyInput('')
    }

    const addInvite = () => {
        const email = inviteEmail.trim()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
        if (invites.some((i) => i.email === email)) return
        setInvites((prev) => [...prev, { email, role: inviteRole }])
        setInviteEmail('')
    }

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
                errors.reportingCurrency = 'La moneda de reporte debe estar incluida en las monedas del espacio'
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

        const parsed = spaceSchema.safeParse({
            ...form,
            defaultSplitMode: form.mode === 'solo' ? 'none' : form.defaultSplitMode,
        })

        if (!parsed.success) {
            setGlobalError(parsed.error.issues[0]?.message ?? 'Revisá los datos del espacio.')
            return
        }

        setSubmitting(true)
        setGlobalError(null)

        try {
            const createdSpace = await onSubmit(parsed.data)

            if (invites.length > 0 && createdSpace?._id) {
                const spaceId = String(createdSpace._id)
                await Promise.allSettled(
                    invites.map((invite) =>
                        apiJson(`/api/spaces/${spaceId}/participants`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                kind: 'finp_user',
                                email: invite.email,
                                displayName: invite.email.split('@')[0],
                                role: invite.role,
                            }),
                        })
                    )
                )
            }

            onOpenChange(false)
        } catch (err) {
            setGlobalError(err instanceof Error ? err.message : 'No pudimos guardar el espacio.')
        } finally {
            setSubmitting(false)
        }
    }

    const isLastStep = step === totalSteps - 1
    const canProceed = step === 0 ? !!form.type : true

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[680px] gap-0 overflow-hidden p-0 sm:max-h-[90vh]"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    {/* Header */}
                    <div className="shrink-0 border-b border-border/70 bg-background/92 px-5 py-4 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-xl tracking-tight">{title}</DialogTitle>
                            <DialogDescription className="text-sm">{description}</DialogDescription>
                        </DialogHeader>
                        <div className="mt-3">
                            <StepIndicator steps={STEPS} current={step} />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                        {/* ── Step 0: Tipo + Identidad ── */}
                        {step === 0 && (
                            <div className="space-y-4">
                                <SpaceDialogPanel>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Tipo de espacio</SpaceDialogSectionEyebrow>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {Object.entries(SPACE_TYPE_META).filter(([k]) => k !== 'other').map(
                                                ([value, meta]) => {
                                                    const active = form.type === value
                                                    return (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            onClick={() => {
                                                                setField('type', value as SpaceFormData['type'])
                                                                if (fieldErrors.type) {
                                                                    setFieldErrors((p) => { const n = { ...p }; delete n.type; return n })
                                                                }
                                                            }}
                                                            className={cn(
                                                                'flex min-h-[132px] flex-col items-center gap-2 rounded-[18px] border p-3 text-center transition-all',
                                                                active
                                                                    ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                                                                    : 'border-border bg-background/80 hover:bg-accent/20'
                                                            )}
                                                        >
                                                            <SpaceTypeIcon
                                                                type={value as SpaceFormData['type']}
                                                                className="h-10 w-10 rounded-[14px]"
                                                            />
                                                            <span className="text-xs font-semibold text-foreground">
                                                                {SPACE_TYPE_LABELS[value as SpaceFormData['type']]}
                                                            </span>
                                                            <span className="text-center text-[10px] leading-tight text-muted-foreground">
                                                                {meta.description}
                                                            </span>
                                                        </button>
                                                    )
                                                }
                                            )}
                                            {/* "Other" type */}
                                            {(() => {
                                                const active = form.type === 'other'
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => setField('type', 'other')}
                                                        className={cn(
                                                            'flex min-h-[132px] flex-col items-center gap-2 rounded-[18px] border p-3 text-center transition-all',
                                                            active
                                                                ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                                                                : 'border-border bg-background/80 hover:bg-accent/20'
                                                        )}
                                                    >
                                                        <SpaceTypeIcon type="other" className="h-10 w-10 rounded-[14px]" />
                                                        <span className="text-xs font-semibold text-foreground">
                                                            {SPACE_TYPE_LABELS.other}
                                                        </span>
                                                        <span className="text-center text-[10px] leading-tight text-muted-foreground">
                                                            {SPACE_TYPE_META.other.description}
                                                        </span>
                                                    </button>
                                                )
                                            })()}
                                        </div>
                                        {fieldErrors.type && (
                                            <p className="text-xs text-destructive">{fieldErrors.type}</p>
                                        )}
                                    </div>
                                </SpaceDialogPanel>

                                <SpaceDialogPanel>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Identidad</SpaceDialogSectionEyebrow>
                                        <SpaceDialogField label="Nombre">
                                            <Input
                                                value={form.name}
                                                onChange={(e) => setField('name', e.target.value)}
                                                placeholder="Ej. Casa con Roro"
                                                className={fieldErrors.name ? 'border-destructive' : ''}
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
                                </SpaceDialogPanel>
                            </div>
                        )}

                        {/* ── Step 1: Configuración ── */}
                        {step === 1 && (
                            <div className="space-y-4">
                                {/* Modo */}
                                <SpaceDialogPanel>
                                    <div className="space-y-3">
                                        <SpaceDialogSectionEyebrow>Modo de trabajo</SpaceDialogSectionEyebrow>
                                        <div className="space-y-2">
                                            {MODES_META.map((m) => (
                                                <button
                                                    key={m.key}
                                                    type="button"
                                                    onClick={() => {
                                                        setField('mode', m.key)
                                                        if (m.key === 'solo') {
                                                            setField('defaultSplitMode', 'none')
                                                        } else if (form.defaultSplitMode === 'none') {
                                                            setField('defaultSplitMode', 'equal')
                                                        }
                                                    }}
                                                    className={cn(
                                                        'flex w-full items-start gap-3 rounded-[16px] border p-3 text-left transition-all',
                                                        form.mode === m.key
                                                            ? 'border-primary/30 bg-primary/8'
                                                            : 'border-border bg-background/80 hover:bg-accent/20'
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                                                            form.mode === m.key
                                                                ? 'border-primary'
                                                                : 'border-border'
                                                        )}
                                                    >
                                                        {form.mode === m.key && (
                                                            <div className="h-2 w-2 rounded-full bg-primary" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">
                                                            {m.label}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">{m.desc}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </SpaceDialogPanel>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Monedas */}
                                    <SpaceDialogPanel>
                                        <div className="space-y-3">
                                            <SpaceDialogSectionEyebrow>Monedas</SpaceDialogSectionEyebrow>
                                            <div className="flex flex-wrap gap-1.5">
                                                {COMMON_CURRENCIES.map((c) => (
                                                    <SpaceDialogChoice
                                                        key={c}
                                                        active={form.currencies.includes(c)}
                                                        onClick={() => toggleCurrency(c)}
                                                    >
                                                        {c}
                                                    </SpaceDialogChoice>
                                                ))}
                                                {form.currencies
                                                    .filter((c) => !(COMMON_CURRENCIES as readonly string[]).includes(c))
                                                    .map((c) => (
                                                        <div key={c} className="flex items-center gap-0.5">
                                                            <SpaceDialogChoice
                                                                active
                                                                onClick={() => toggleCurrency(c)}
                                                            >
                                                                {c}
                                                            </SpaceDialogChoice>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleCurrency(c)}
                                                                className="text-muted-foreground hover:text-foreground"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                            </div>
                                            {fieldErrors.currencies && (
                                                <p className="text-xs text-destructive">{fieldErrors.currencies}</p>
                                            )}
                                            <div className="flex gap-1.5">
                                                <Input
                                                    ref={customInputRef}
                                                    value={customCurrencyInput}
                                                    onChange={(e) =>
                                                        setCustomCurrencyInput(e.target.value.toUpperCase().slice(0, 6))
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            addCustomCurrency()
                                                        }
                                                    }}
                                                    placeholder="EUR, BRL…"
                                                    className="h-8 flex-1 text-xs uppercase"
                                                    maxLength={6}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addCustomCurrency}
                                                    className="h-8 px-2"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            <SpaceDialogField label="Moneda de reporte">
                                                <Select
                                                    value={form.reportingCurrency}
                                                    onValueChange={(v) => setField('reportingCurrency', v)}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {form.currencies.map((c) => (
                                                            <SelectItem key={c} value={c}>
                                                                {c}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {fieldErrors.reportingCurrency && (
                                                    <p className="text-xs text-destructive">
                                                        {fieldErrors.reportingCurrency}
                                                    </p>
                                                )}
                                            </SpaceDialogField>
                                        </div>
                                    </SpaceDialogPanel>

                                    {/* Split + Fechas */}
                                    <div className="space-y-4">
                                        <SpaceDialogPanel>
                                            <div className="space-y-3">
                                                <SpaceDialogSectionEyebrow>Split por defecto</SpaceDialogSectionEyebrow>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {SPLIT_OPTIONS.map((opt) => {
                                                        const disabled = form.mode === 'solo' && opt.key !== 'none'
                                                        const active =
                                                            (form.mode === 'solo' && opt.key === 'none') ||
                                                            (form.mode !== 'solo' && form.defaultSplitMode === opt.key)
                                                        return (
                                                            <SpaceDialogChoice
                                                                key={opt.key}
                                                                active={active}
                                                                disabled={disabled}
                                                                onClick={() =>
                                                                    !disabled && setField('defaultSplitMode', opt.key)
                                                                }
                                                                className="justify-center text-center text-xs"
                                                            >
                                                                {opt.label}
                                                            </SpaceDialogChoice>
                                                        )
                                                    })}
                                                </div>
                                                {form.defaultSplitMode === 'percentage' &&
                                                    form.mode !== 'solo' && (
                                                        <SplitPercentageEditor />
                                                    )}
                                            </div>
                                        </SpaceDialogPanel>

                                        <SpaceDialogPanel>
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
                                                    value={form.endDate}
                                                    isOpen={endDateOpen}
                                                    onOpenChange={setEndDateOpen}
                                                    onChange={(d) => setField('endDate', d)}
                                                    error={fieldErrors.endDate}
                                                    showErrors
                                                />
                                            </div>
                                        </SpaceDialogPanel>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Step 2: Participantes ── */}
                        {step === 2 && !isEdit && (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="flex items-center gap-3 rounded-[20px] border border-foreground/[0.07] bg-secondary/50 p-4">
                                    <SpaceTypeIcon type={form.type} className="h-10 w-10 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-foreground">
                                            {form.name || 'Sin nombre'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {SPACE_TYPE_LABELS[form.type]} ·{' '}
                                            {SPACE_MODE_LABELS[form.mode]} ·{' '}
                                            {form.currencies.join(' / ')}
                                        </p>
                                    </div>
                                </div>

                                {form.mode !== 'solo' ? (
                                    <SpaceDialogPanel>
                                        <div className="space-y-3">
                                            <SpaceDialogSectionEyebrow>Invitar participantes</SpaceDialogSectionEyebrow>
                                            <p className="text-xs text-muted-foreground">
                                                Ingresá los emails de quienes vas a invitar. También podés hacerlo
                                                más tarde desde el espacio.
                                            </p>
                                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                                                <Input
                                                    type="email"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            addInvite()
                                                        }
                                                    }}
                                                    placeholder="nombre@ejemplo.com"
                                                    className="flex-1"
                                                />
                                                <Select
                                                    value={inviteRole}
                                                    onValueChange={(v) =>
                                                        setInviteRole(v as 'participant' | 'admin')
                                                    }
                                                >
                                                    <SelectTrigger className="w-32">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="participant">Participante</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={addInvite}
                                                    size="sm"
                                                    className="shrink-0"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Agregar
                                                </Button>
                                            </div>

                                            {invites.length > 0 && (
                                                <div className="space-y-2">
                                                    {invites.map((invite) => (
                                                        <div
                                                            key={invite.email}
                                                            className="flex items-center gap-3 rounded-[14px] border border-foreground/[0.06] bg-background px-3 py-2"
                                                        >
                                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                                                                {invite.email[0]?.toUpperCase()}
                                                            </div>
                                                            <span className="flex-1 truncate text-sm text-foreground">
                                                                {invite.email}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {invite.role === 'admin' ? 'Admin' : 'Participante'}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setInvites((prev) =>
                                                                        prev.filter((i) => i.email !== invite.email)
                                                                    )
                                                                }
                                                                className="text-muted-foreground hover:text-foreground"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </SpaceDialogPanel>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Este espacio es individual, no tiene participantes.
                                    </p>
                                )}
                            </div>
                        )}

                        {globalError && (
                            <p className="mt-4 rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                {globalError}
                            </p>
                        )}
                    </div>

                    {/* Footer */}
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
                                {STEPS.map((_, i) => (
                                    <div
                                        key={i}
                                        className={cn(
                                            'h-1.5 rounded-full transition-all',
                                            i === step ? 'w-5 bg-primary' : 'w-1.5 bg-muted'
                                        )}
                                    />
                                ))}
                            </div>

                            {isLastStep ? (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting || !canProceed}
                                    className="rounded-full"
                                >
                                    {submitting
                                        ? 'Guardando…'
                                        : isEdit
                                            ? 'Guardar cambios'
                                            : 'Crear espacio'}
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
                </div>
            </DialogContent>
        </Dialog>
    )
}
