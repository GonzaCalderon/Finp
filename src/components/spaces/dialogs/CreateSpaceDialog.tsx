'use client'

import { useEffect, useState } from 'react'
import { spaceSchema, type SpaceFormData } from '@/lib/validations'
import { SPACE_SPLIT_MODE_LABELS, SPACE_STATUS_LABELS, SPACE_MODE_LABELS, SPACE_TYPE_LABELS } from '@/lib/utils/spaces'
import { SPACE_TYPE_META, SpaceTypeIcon } from '@/components/spaces/SpaceUi'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    DialogProps,
    formatDateInput,
    SpaceDialogChoice,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

function buildInitialForm(initialValues?: Partial<SpaceFormData>): SpaceFormData {
    return {
        name: initialValues?.name ?? '',
        description: initialValues?.description ?? '',
        type: initialValues?.type ?? 'home',
        mode: initialValues?.mode ?? 'managed',
        status: initialValues?.status ?? 'active',
        startDate: initialValues?.startDate ?? new Date(),
        endDate: initialValues?.endDate,
        currencies: initialValues?.currencies ?? ['ARS'],
        reportingCurrency: initialValues?.reportingCurrency ?? 'ARS',
        defaultSplitMode: initialValues?.defaultSplitMode ?? 'equal',
    }
}

export function CreateSpaceDialog({
    open,
    onOpenChange,
    onSubmit,
    initialValues,
    title = 'Nuevo espacio',
    description = 'Creá un contexto financiero claro para ordenar movimientos, balances y participantes.',
}: DialogProps & {
    onSubmit: (data: SpaceFormData) => Promise<unknown>
    initialValues?: Partial<SpaceFormData>
    title?: string
    description?: string
}) {
    const [form, setForm] = useState<SpaceFormData>(buildInitialForm(initialValues))
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setForm(buildInitialForm(initialValues))
        setSubmitting(false)
        setError(null)
    }, [initialValues, open])

    const handleToggleCurrency = (currency: 'ARS' | 'USD') => {
        setForm((previous) => {
            const nextCurrencies = previous.currencies.includes(currency)
                ? previous.currencies.filter((item) => item !== currency)
                : [...previous.currencies, currency]
            const safeCurrencies = nextCurrencies.length > 0 ? nextCurrencies : [currency]

            return {
                ...previous,
                currencies: safeCurrencies,
                reportingCurrency: safeCurrencies.includes(previous.reportingCurrency)
                    ? previous.reportingCurrency
                    : safeCurrencies[0],
            }
        })
    }

    const handleSubmit = async () => {
        const parsed = spaceSchema.safeParse({
            ...form,
            defaultSplitMode: form.mode === 'solo' ? 'none' : form.defaultSplitMode,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá los datos del espacio.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await onSubmit(parsed.data)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar el espacio.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[760px] gap-0 overflow-hidden p-0 sm:max-h-[92vh] sm:max-w-[760px]"
            >
                <div className="flex h-full flex-col">
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl tracking-tight">{title}</DialogTitle>
                            <DialogDescription>{description}</DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            <SpaceDialogPanel>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Identidad</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Lo primero: qué es este espacio
                                        </h3>
                                    </div>

                                    <div className="grid gap-4">
                                        <SpaceDialogField label="Nombre">
                                            <Input
                                                value={form.name}
                                                onChange={(event) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        name: event.target.value,
                                                    }))
                                                }
                                                placeholder="Ej. Casa con Roro"
                                            />
                                        </SpaceDialogField>

                                        <SpaceDialogField label="Descripción">
                                            <SpaceDialogTextArea
                                                value={form.description ?? ''}
                                                onChange={(event) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        description: event.target.value,
                                                    }))
                                                }
                                                rows={4}
                                                placeholder="Qué contexto financiero agrupa este espacio y qué decisiones querés ordenar acá."
                                            />
                                        </SpaceDialogField>
                                    </div>
                                </div>
                            </SpaceDialogPanel>

                            <SpaceDialogPanel>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Tipo</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Elegí el perfil del espacio
                                        </h3>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {Object.entries(SPACE_TYPE_META).map(([value, meta]) => {
                                            const active = form.type === value

                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() =>
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            type: value as SpaceFormData['type'],
                                                        }))
                                                    }
                                                    className={[
                                                        'rounded-[24px] border px-4 py-4 text-left transition-colors',
                                                        active
                                                            ? 'border-primary/20 bg-primary/8'
                                                            : 'border-border bg-background/72 hover:bg-accent/25',
                                                    ].join(' ')}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <SpaceTypeIcon type={value as SpaceFormData['type']} />
                                                        <div className="space-y-1">
                                                            <p className="font-semibold text-foreground">
                                                                {SPACE_TYPE_LABELS[value as SpaceFormData['type']]}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {meta.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </SpaceDialogPanel>

                            <div className="grid gap-5 lg:grid-cols-[1fr_0.95fr]">
                                <SpaceDialogPanel>
                                    <div className="grid gap-4 sm:grid-cols-3">
                                        <SpaceDialogField label="Modo">
                                            <Select
                                                value={form.mode}
                                                onValueChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        mode: value as SpaceFormData['mode'],
                                                        defaultSplitMode:
                                                            value === 'solo'
                                                                ? 'none'
                                                                : previous.defaultSplitMode === 'none'
                                                                    ? 'equal'
                                                                    : previous.defaultSplitMode,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(SPACE_MODE_LABELS).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </SpaceDialogField>

                                        <SpaceDialogField label="Estado">
                                            <Select
                                                value={form.status}
                                                onValueChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        status: value as SpaceFormData['status'],
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(SPACE_STATUS_LABELS).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </SpaceDialogField>

                                        <SpaceDialogField label="Split por defecto">
                                            <Select
                                                value={form.mode === 'solo' ? 'none' : form.defaultSplitMode}
                                                onValueChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        defaultSplitMode:
                                                            value as SpaceFormData['defaultSplitMode'],
                                                    }))
                                                }
                                                disabled={form.mode === 'solo'}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(SPACE_SPLIT_MODE_LABELS).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </SpaceDialogField>
                                    </div>

                                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                        <SpaceDialogField label="Fecha de inicio">
                                            <Input
                                                type="date"
                                                value={formatDateInput(form.startDate)}
                                                onChange={(event) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        startDate: new Date(event.target.value),
                                                    }))
                                                }
                                            />
                                        </SpaceDialogField>

                                        <SpaceDialogField label="Fecha de fin">
                                            <Input
                                                type="date"
                                                value={form.endDate ? formatDateInput(form.endDate) : ''}
                                                onChange={(event) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        endDate: event.target.value
                                                            ? new Date(event.target.value)
                                                            : undefined,
                                                    }))
                                                }
                                            />
                                        </SpaceDialogField>
                                    </div>
                                </SpaceDialogPanel>

                                <SpaceDialogPanel>
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <SpaceDialogSectionEyebrow>Monedas</SpaceDialogSectionEyebrow>
                                            <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                Configuración financiera base
                                            </h3>
                                        </div>

                                        <SpaceDialogField
                                            label="Monedas habilitadas"
                                            hint="Podés trabajar con una o dos monedas dentro del mismo espacio."
                                        >
                                            <div className="flex flex-wrap gap-2">
                                                {(['ARS', 'USD'] as const).map((currency) => (
                                                    <SpaceDialogChoice
                                                        key={currency}
                                                        active={form.currencies.includes(currency)}
                                                        onClick={() => handleToggleCurrency(currency)}
                                                    >
                                                        {currency}
                                                    </SpaceDialogChoice>
                                                ))}
                                            </div>
                                        </SpaceDialogField>

                                        <SpaceDialogField label="Moneda de reporte">
                                            <Select
                                                value={form.reportingCurrency}
                                                onValueChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        reportingCurrency: value as 'ARS' | 'USD',
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {form.currencies.map((currency) => (
                                                        <SelectItem key={currency} value={currency}>
                                                            {currency}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </SpaceDialogField>
                                    </div>
                                </SpaceDialogPanel>
                            </div>

                            {error ? (
                                <p className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                    {error}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="border-t border-border/70 bg-background/96">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Guardar espacio'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
