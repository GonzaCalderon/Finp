'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarRange, Save, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DatePickerField } from '@/components/shared/transaction-dialog/fields/DatePickerField'
import { CurrencyMultiSelector } from '@/components/shared/CurrencyMultiSelector'
import { CurrencySelector } from '@/components/shared/CurrencySelector'
import { ISO_CURRENCIES } from '@/lib/constants/iso-currencies'
import { spaceSchema, type SpaceFormData } from '@/lib/validations'
import {
    SPACE_MODE_LABELS,
    SPACE_SPLIT_MODE_LABELS,
    SPACE_STATUS_LABELS,
    SPACE_TYPE_LABELS,
} from '@/lib/utils/spaces'
import {
    DialogProps,
    normalizeDialogDate,
    SpaceDialogChoice,
    SpaceDialogField,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { SpaceCategoryManager } from '@/components/spaces/dialogs/SpaceCategoryManager'
import type { ISpaceParticipant } from '@/types'

const TYPE_OPTIONS = Object.entries(SPACE_TYPE_LABELS) as Array<[SpaceFormData['type'], string]>
const MODE_OPTIONS = Object.entries(SPACE_MODE_LABELS) as Array<[SpaceFormData['mode'], string]>
const STATUS_OPTIONS = Object.entries(SPACE_STATUS_LABELS) as Array<[SpaceFormData['status'], string]>
const SPLIT_OPTIONS = Object.entries(SPACE_SPLIT_MODE_LABELS) as Array<[SpaceFormData['defaultSplitMode'], string]>

function buildForm(initialValues: SpaceFormData): SpaceFormData {
    return {
        ...initialValues,
        description: initialValues.description ?? '',
        startDate: normalizeDialogDate(initialValues.startDate),
        endDate: normalizeDialogDate(initialValues.endDate),
        currencies: initialValues.currencies.length > 0 ? initialValues.currencies : [initialValues.reportingCurrency],
    }
}

function SettingSection({
    title,
    children,
}: {
    title: string
    children: ReactNode
}) {
    return (
        <section className="space-y-3 border-t border-border/70 pt-5 first:border-t-0 first:pt-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {title}
            </p>
            {children}
        </section>
    )
}

export function EditSpaceSettingsDialog({
    open,
    onOpenChange,
    spaceId,
    initialValues,
    participants = [],
    onInvite,
    onSubmit,
    reportingCurrencyLocked = false,
    lockedCurrencies = [],
}: DialogProps & {
    spaceId: string
    initialValues: SpaceFormData
    participants?: ISpaceParticipant[]
    onInvite?: () => void
    onSubmit: (data: SpaceFormData) => Promise<unknown>
    reportingCurrencyLocked?: boolean
    lockedCurrencies?: string[]
}) {
    const [form, setForm] = useState<SpaceFormData>(buildForm(initialValues))
    const [startDateOpen, setStartDateOpen] = useState(false)
    const [endDateOpen, setEndDateOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const availableCurrencies = useMemo(
        () => Array.from(new Set([
            ...ISO_CURRENCIES.map((currency) => currency.code),
            ...form.currencies,
            form.reportingCurrency,
        ])),
        [form.currencies, form.reportingCurrency]
    )

    useEffect(() => {
        if (!open) return
        setForm(buildForm(initialValues))
        setSubmitting(false)
        setError(null)
    }, [initialValues, open])

    const setField = <K extends keyof SpaceFormData>(key: K, value: SpaceFormData[K]) => {
        setForm((previous) => {
            const next = { ...previous, [key]: value }
            if (key === 'mode' && value === 'solo') {
                next.defaultSplitMode = 'none'
            }
            return next
        })
        setError(null)
    }

    const handleSubmit = async () => {
        const parsed = spaceSchema.safeParse({
            ...form,
            defaultSplitMode: form.mode === 'solo' ? 'none' : form.defaultSplitMode,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá la configuración del espacio.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await onSubmit(parsed.data)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar los cambios.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[760px] gap-0 overflow-hidden p-0 sm:max-h-[92vh]"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    <div className="shrink-0 border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl tracking-tight">{initialValues.name}</DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            <SettingSection title="General">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <SpaceDialogField label="Nombre">
                                        <Input
                                            value={form.name}
                                            onChange={(event) => setField('name', event.target.value)}
                                            placeholder="Nombre del espacio"
                                        />
                                    </SpaceDialogField>
                                    <SpaceDialogField label="Tipo">
                                        <Select
                                            value={form.type}
                                            onValueChange={(value) => setField('type', value as SpaceFormData['type'])}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TYPE_OPTIONS.map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </SpaceDialogField>
                                </div>
                            </SettingSection>

                            <SettingSection title="Participantes">
                                <div className="rounded-[18px] border border-foreground/[0.07] bg-background/70 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                {participants.length} participante{participants.length === 1 ? '' : 's'}
                                            </p>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Las invitaciones y roles se administran dentro del espacio, sin mezclarlo con el historial.
                                            </p>
                                        </div>
                                        {onInvite ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-full"
                                                onClick={() => {
                                                    onOpenChange(false)
                                                    onInvite()
                                                }}
                                            >
                                                <UserPlus className="h-4 w-4" />
                                                Invitar
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            </SettingSection>

                            <SettingSection title="Categorías">
                                <SpaceCategoryManager spaceId={spaceId} />
                            </SettingSection>

                            <SettingSection title="Funcionamiento">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <SpaceDialogField label="Modo">
                                        <Select
                                            value={form.mode}
                                            onValueChange={(value) => setField('mode', value as SpaceFormData['mode'])}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MODE_OPTIONS.map(([value, label]) => (
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
                                            onValueChange={(value) => setField('status', value as SpaceFormData['status'])}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </SpaceDialogField>
                                </div>

                                <SpaceDialogField
                                    label="Simplificar deudas entre participantes"
                                    hint="Finp minimiza la cantidad de pagos necesarios para saldar el espacio."
                                >
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { value: null, label: 'Automático' },
                                            { value: true, label: 'Activado' },
                                            { value: false, label: 'Desactivado' },
                                        ] as const).map((option) => (
                                            <SpaceDialogChoice
                                                key={String(option.value)}
                                                active={form.simplifyDebts === option.value}
                                                onClick={() => setField('simplifyDebts', option.value)}
                                            >
                                                {option.label}
                                            </SpaceDialogChoice>
                                        ))}
                                    </div>
                                </SpaceDialogField>

                                <SpaceDialogField
                                    label="Criterio de deudas personales"
                                    hint="Controla cómo se calculan las deudas en el Finp personal de cada participante."
                                >
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { value: 'simplified' as const, label: 'Simplificado', desc: 'Reduce la cantidad de pagos' },
                                            { value: 'direct' as const, label: 'Directo', desc: 'Respeta el origen de cada movimiento' },
                                        ]).map((option) => (
                                            <SpaceDialogChoice
                                                key={option.value}
                                                active={form.debtMode === option.value}
                                                onClick={() => setField('debtMode', option.value)}
                                            >
                                                {option.label}
                                            </SpaceDialogChoice>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Cambiar este criterio recalculará las deudas personales derivadas de este espacio. No modifica los movimientos originales.
                                    </p>
                                </SpaceDialogField>
                            </SettingSection>

                            <SettingSection title="Reparto">
                                <SpaceDialogField
                                    label="Split por defecto"
                                    hint="Esta regla se usa como punto de partida al crear movimientos nuevos."
                                >
                                    <Select
                                        value={form.mode === 'solo' ? 'none' : form.defaultSplitMode}
                                        onValueChange={(value) =>
                                            setField('defaultSplitMode', value as SpaceFormData['defaultSplitMode'])
                                        }
                                        disabled={form.mode === 'solo'}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SPLIT_OPTIONS.map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SpaceDialogField>
                            </SettingSection>

                            <SettingSection title="Monedas">
                                <CurrencyMultiSelector
                                    value={form.currencies}
                                    options={availableCurrencies}
                                    onValueChange={(currencies) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            currencies,
                                            reportingCurrency: currencies.includes(previous.reportingCurrency)
                                                ? previous.reportingCurrency
                                                : currencies[0],
                                        }))
                                    }
                                    label="Monedas del espacio"
                                    lockedValues={lockedCurrencies}
                                    helperText={lockedCurrencies.length
                                        ? `Con historia: ${lockedCurrencies.join(', ')}. No se pueden retirar.`
                                        : undefined}
                                />
                                <div className="grid gap-4 md:grid-cols-2">
                                    <p className="self-center text-xs leading-relaxed text-muted-foreground">
                                        Podés agregar monedas ISO activas. Una moneda usada conserva su historia y ya no puede retirarse.
                                    </p>
                                    <CurrencySelector
                                        value={form.reportingCurrency}
                                        options={form.currencies}
                                        onValueChange={(currency) => setField('reportingCurrency', currency)}
                                        label="Moneda de reporte"
                                        readOnly={reportingCurrencyLocked}
                                        helperText={reportingCurrencyLocked ? 'Quedó fijada al registrar el primer movimiento.' : undefined}
                                    />
                                </div>
                            </SettingSection>

                            <SettingSection title="Cierre">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <DatePickerField
                                        label="Inicio"
                                        value={form.startDate}
                                        isOpen={startDateOpen}
                                        onOpenChange={setStartDateOpen}
                                        onChange={(date) => setField('startDate', date)}
                                    />
                                    <div className="space-y-2">
                                        <DatePickerField
                                            label="Fin"
                                            value={form.endDate ?? undefined}
                                            isOpen={endDateOpen}
                                            onOpenChange={setEndDateOpen}
                                            onChange={(date) => setField('endDate', date)}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-full text-muted-foreground"
                                            onClick={() => setField('endDate', undefined)}
                                        >
                                            <CalendarRange className="h-3.5 w-3.5" />
                                            Sin fecha de fin
                                        </Button>
                                    </div>
                                </div>
                            </SettingSection>

                            {error ? (
                                <p className="rounded-[18px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                    {error}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 sm:px-6">
                        <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
                            <Save className="h-4 w-4" />
                            {submitting ? 'Guardando...' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
