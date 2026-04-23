'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
    Check,
    CircleDollarSign,
    HandCoins,
    Home,
    Plane,
    Settings2,
    Sparkles,
    Users,
} from 'lucide-react'
import { apiJson } from '@/lib/client/auth-client'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import {
    spaceEntryConfirmSchema,
    spaceEntrySchema,
    spaceParticipantSchema,
    spaceSchema,
    type SpaceEntryConfirmData,
    type SpaceEntryFormData,
    type SpaceParticipantFormData,
    type SpaceFormData,
} from '@/lib/validations'
import { cn } from '@/lib/utils'
import {
    extractId,
    SPACE_ENTRY_TYPE_LABELS,
    SPACE_MODE_LABELS,
    SPACE_ROLE_LABELS,
    SPACE_SPLIT_MODE_LABELS,
    SPACE_STATUS_LABELS,
    SPACE_TYPE_LABELS,
} from '@/lib/utils/spaces'
import type { IAccount, ICategory, ISpaceEntry, ISpaceParticipant, ITransaction } from '@/types'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type DialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const SPACE_TYPE_OPTIONS = [
    { value: 'couple', icon: Users, accent: 'rgba(59,130,246,0.12)', color: '#2563EB' },
    { value: 'home', icon: Home, accent: 'rgba(249,115,22,0.12)', color: '#F97316' },
    { value: 'travel', icon: Plane, accent: 'rgba(37,99,235,0.12)', color: '#2563EB' },
    { value: 'project', icon: Sparkles, accent: 'rgba(139,92,246,0.12)', color: '#8B5CF6' },
]

const SPACE_ENTRY_TYPE_OPTIONS = [
    { value: 'expense', icon: HandCoins },
    { value: 'income', icon: CircleDollarSign },
    { value: 'adjustment', icon: Settings2 },
    { value: 'settlement', icon: Check },
] as const

function formatDateInput(value?: Date | string) {
    if (!value) return format(new Date(), 'yyyy-MM-dd')
    return format(new Date(value), 'yyyy-MM-dd')
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {children}
        </p>
    )
}

function PillButton({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
            )}
        >
            {children}
        </button>
    )
}

function DialogField({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm">{label}</Label>
            {children}
        </div>
    )
}

export function CreateSpaceDialog({
    open,
    onOpenChange,
    onSubmit,
    initialValues,
    title = 'Nuevo espacio',
    description = 'Agrupá gastos, balances y pendientes dentro de un mismo contexto.',
}: DialogProps & {
    onSubmit: (data: SpaceFormData) => Promise<unknown>
    initialValues?: Partial<SpaceFormData>
    title?: string
    description?: string
}) {
    const [form, setForm] = useState<SpaceFormData>({
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
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setForm({
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
        })
        setError(null)
        setSubmitting(false)
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
            <DialogContent className="max-w-[720px] gap-0 overflow-hidden p-0 sm:max-w-[720px]">
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl tracking-tight">{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <DialogField label="Nombre">
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
                        </DialogField>

                        <DialogField label="Descripción">
                            <textarea
                                value={form.description ?? ''}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        description: event.target.value,
                                    }))
                                }
                                rows={3}
                                placeholder="Qué contexto financiero agrupa este espacio."
                                className="min-h-[96px] w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                            />
                        </DialogField>
                    </div>

                    <div className="space-y-3">
                        <SectionLabel>Tipo</SectionLabel>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {SPACE_TYPE_OPTIONS.map((option) => {
                                const Icon = option.icon
                                const isActive = form.type === option.value

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            setForm((previous) => ({
                                                ...previous,
                                                type: option.value as SpaceFormData['type'],
                                            }))
                                        }
                                        className={cn(
                                            'flex items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all',
                                            isActive
                                                ? 'border-primary/20 bg-primary/8 shadow-sm'
                                                : 'border-border bg-card hover:border-primary/15 hover:bg-accent/30'
                                        )}
                                    >
                                        <div
                                            className="flex h-11 w-11 items-center justify-center rounded-[18px]"
                                            style={{
                                                background: option.accent,
                                                color: option.color,
                                            }}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-medium text-foreground">
                                                {SPACE_TYPE_LABELS[option.value as SpaceFormData['type']]}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {option.value === 'home'
                                                    ? 'Hogar, alquiler, vida cotidiana compartida.'
                                                    : option.value === 'couple'
                                                        ? 'Gastos y balances de pareja.'
                                                        : option.value === 'travel'
                                                            ? 'Presupuesto, gastos y recap de viaje.'
                                                            : 'Proyecto, evento u objetivo con contexto propio.'}
                                            </p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <DialogField label="Modo">
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
                        </DialogField>

                        <DialogField label="Estado">
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
                        </DialogField>

                        <DialogField label="Split por defecto">
                            <Select
                                value={form.mode === 'solo' ? 'none' : form.defaultSplitMode}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        defaultSplitMode: value as SpaceFormData['defaultSplitMode'],
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
                        </DialogField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <DialogField label="Fecha de inicio">
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
                        </DialogField>

                        <DialogField label="Fecha de fin">
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
                        </DialogField>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-2">
                            <Label className="text-sm">Monedas</Label>
                            <div className="flex flex-wrap gap-2">
                                {(['ARS', 'USD'] as const).map((currency) => (
                                    <PillButton
                                        key={currency}
                                        active={form.currencies.includes(currency)}
                                        onClick={() => handleToggleCurrency(currency)}
                                    >
                                        {currency}
                                    </PillButton>
                                ))}
                            </div>
                        </div>

                        <DialogField label="Moneda de reporte">
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
                        </DialogField>
                    </div>

                    {error && (
                        <p className="rounded-2xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter className="bg-background">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando...' : initialValues ? 'Guardar cambios' : 'Crear espacio'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function SpaceParticipantDialog({
    open,
    onOpenChange,
    onSubmit,
}: DialogProps & {
    onSubmit: (data: SpaceParticipantFormData) => Promise<unknown>
}) {
    const [form, setForm] = useState<SpaceParticipantFormData>({
        kind: 'finp_user',
        displayName: '',
        email: '',
        role: 'participant',
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setForm({
            kind: 'finp_user',
            displayName: '',
            email: '',
            role: 'participant',
        })
        setSubmitting(false)
        setError(null)
    }, [open])

    const handleSubmit = async () => {
        const parsed = spaceParticipantSchema.safeParse(form)
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá los datos del participante.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await onSubmit(parsed.data)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos agregar el participante.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[520px] p-0 sm:max-w-[520px]">
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl tracking-tight">Sumar participante</DialogTitle>
                        <DialogDescription>
                            Invitá a otra persona de Finp o agregá un participante externo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <SectionLabel>Tipo</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                            <PillButton
                                active={form.kind === 'finp_user'}
                                onClick={() =>
                                    setForm((previous) => ({
                                        ...previous,
                                        kind: 'finp_user',
                                    }))
                                }
                            >
                                Usuario Finp
                            </PillButton>
                            <PillButton
                                active={form.kind === 'external'}
                                onClick={() =>
                                    setForm((previous) => ({
                                        ...previous,
                                        kind: 'external',
                                    }))
                                }
                            >
                                Externo
                            </PillButton>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <DialogField label={form.kind === 'finp_user' ? 'Nombre de referencia' : 'Nombre'}>
                            <Input
                                value={form.displayName}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        displayName: event.target.value,
                                    }))
                                }
                                placeholder="Ej. Roro"
                            />
                        </DialogField>

                        <DialogField label="Rol">
                            <Select
                                value={form.role}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        role: value as SpaceParticipantFormData['role'],
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SPACE_ROLE_LABELS)
                                        .filter(([value]) => value !== 'owner')
                                        .map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </DialogField>
                    </div>

                    <DialogField label="Email">
                        <Input
                            type="email"
                            value={form.email ?? ''}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    email: event.target.value,
                                }))
                            }
                            placeholder={
                                form.kind === 'finp_user'
                                    ? 'usuario@finp.app'
                                    : 'Opcional para referencia o contacto'
                            }
                        />
                    </DialogField>

                    {error && (
                        <p className="rounded-2xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter className="bg-background">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando...' : 'Agregar participante'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function buildDefaultSplitAllocations(
    participantIds: string[],
    splitMode: SpaceEntryFormData['splitMode']
) {
    if (splitMode === 'percentage') {
        return participantIds.map((participantId) => ({
            participantId,
            percentage: Number((100 / participantIds.length).toFixed(2)),
        }))
    }

    if (splitMode === 'fixed') {
        return participantIds.map((participantId) => ({
            participantId,
            amount: 0,
        }))
    }

    return undefined
}

export function SpaceEntryDialog({
    open,
    onOpenChange,
    onSubmit,
    participants,
    currentUserId,
    defaultCurrency,
    reportingCurrency,
    defaultSplitMode,
    spaceMode,
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<unknown>
    participants: ISpaceParticipant[]
    currentUserId: string
    defaultCurrency: 'ARS' | 'USD'
    reportingCurrency: 'ARS' | 'USD'
    defaultSplitMode: SpaceEntryFormData['splitMode']
    spaceMode: SpaceFormData['mode']
}) {
    const { categories } = useCategories()
    const { accounts } = useAccounts()

    const activeParticipants = useMemo(
        () => participants.filter((participant) => participant.isActive),
        [participants]
    )

    const [form, setForm] = useState<SpaceEntryFormData>({
        type: 'expense',
        title: '',
        description: '',
        amount: 0,
        currency: defaultCurrency,
        exchangeRate: undefined,
        date: new Date(),
        categoryId: undefined,
        paidByParticipantId: extractId(
            activeParticipants.find((participant) => extractId(participant.userId) === currentUserId)?._id
        ),
        sharedWithParticipantIds:
            spaceMode === 'solo'
                ? undefined
                : activeParticipants.map((participant) => extractId(participant._id) ?? '').filter(Boolean),
        splitMode: spaceMode === 'solo' ? 'none' : defaultSplitMode,
        splitAllocations:
            spaceMode === 'solo'
                ? undefined
                : buildDefaultSplitAllocations(
                    activeParticipants.map((participant) => extractId(participant._id) ?? '').filter(Boolean),
                    defaultSplitMode
                ),
        notes: '',
        personalAccountId: undefined,
        linkedTransactionId: undefined,
    })
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return

        const allParticipantIds = activeParticipants
            .map((participant) => extractId(participant._id) ?? '')
            .filter(Boolean)

        setForm({
            type: 'expense',
            title: '',
            description: '',
            amount: 0,
            currency: defaultCurrency,
            exchangeRate: undefined,
            date: new Date(),
            categoryId: undefined,
            paidByParticipantId: extractId(
                activeParticipants.find((participant) => extractId(participant.userId) === currentUserId)?._id
            ),
            sharedWithParticipantIds: spaceMode === 'solo' ? undefined : allParticipantIds,
            splitMode: spaceMode === 'solo' ? 'none' : defaultSplitMode,
            splitAllocations:
                spaceMode === 'solo'
                    ? undefined
                    : buildDefaultSplitAllocations(allParticipantIds, defaultSplitMode),
            notes: '',
            personalAccountId: undefined,
            linkedTransactionId: undefined,
        })
        setSubmitting(false)
        setError(null)
    }, [activeParticipants, currentUserId, defaultCurrency, defaultSplitMode, open, spaceMode])

    useEffect(() => {
        if (spaceMode === 'solo') return
        if (form.splitMode !== 'percentage' && form.splitMode !== 'fixed') return

        const participantIds = form.sharedWithParticipantIds ?? []
        setForm((previous) => ({
            ...previous,
            splitAllocations: buildDefaultSplitAllocations(participantIds, previous.splitMode),
        }))
    }, [form.sharedWithParticipantIds, form.splitMode, spaceMode])

    const paidByParticipant = activeParticipants.find(
        (participant) => extractId(participant._id) === form.paidByParticipantId
    )
    const isCurrentUserPayer = extractId(paidByParticipant?.userId) === currentUserId

    const filteredAccounts = useMemo(
        () =>
            accounts.filter((account) =>
                (account.supportedCurrencies ?? [account.currency]).includes(form.currency)
            ),
        [accounts, form.currency]
    )

    const updateSplitAllocation = (
        participantId: string,
        field: 'percentage' | 'amount',
        value: string
    ) => {
        const numericValue = value === '' ? undefined : Number(value.replace(',', '.'))

        setForm((previous) => ({
            ...previous,
            splitAllocations: (previous.splitAllocations ?? []).map((allocation) =>
                allocation.participantId === participantId
                    ? {
                        ...allocation,
                        [field]: Number.isNaN(numericValue as number) ? undefined : numericValue,
                    }
                    : allocation
            ),
        }))
    }

    const toggleSharedParticipant = (participantId: string) => {
        setForm((previous) => {
            const current = previous.sharedWithParticipantIds ?? []
            const next = current.includes(participantId)
                ? current.filter((item) => item !== participantId)
                : [...current, participantId]

            return {
                ...previous,
                sharedWithParticipantIds: next,
            }
        })
    }

    const handleSubmit = async () => {
        const parsed = spaceEntrySchema.safeParse({
            ...form,
            splitMode: spaceMode === 'solo' ? 'none' : form.splitMode,
            sharedWithParticipantIds:
                spaceMode === 'solo' || form.splitMode === 'none'
                    ? undefined
                    : form.sharedWithParticipantIds,
            splitAllocations:
                form.splitMode === 'percentage' || form.splitMode === 'fixed'
                    ? form.splitAllocations
                    : undefined,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá los datos del movimiento.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await onSubmit(parsed.data)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar el movimiento.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-[940px] gap-0 overflow-hidden p-0 sm:max-w-[940px]">
                <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl tracking-tight">Nuevo movimiento</DialogTitle>
                        <DialogDescription>
                            Registrá un gasto, ingreso, ajuste o liquidación dentro del espacio.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <SectionLabel>Tipo de movimiento</SectionLabel>
                        <Tabs
                            value={form.type}
                            onValueChange={(value) =>
                                setForm((previous) => ({
                                    ...previous,
                                    type: value as SpaceEntryFormData['type'],
                                }))
                            }
                        >
                            <TabsList className="h-auto w-full justify-start gap-2 rounded-[20px] bg-transparent p-0">
                                {SPACE_ENTRY_TYPE_OPTIONS.map((option) => {
                                    const Icon = option.icon
                                    return (
                                        <TabsTrigger
                                            key={option.value}
                                            value={option.value}
                                            className="rounded-[18px] border border-border px-4 py-3 data-active:border-primary/20 data-active:bg-primary/8"
                                        >
                                            <Icon className="h-4 w-4" />
                                            {SPACE_ENTRY_TYPE_LABELS[option.value]}
                                        </TabsTrigger>
                                    )
                                })}
                            </TabsList>
                        </Tabs>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1.1fr_0.55fr_0.7fr]">
                        <DialogField label="Monto">
                            <Input
                                value={form.amount === 0 ? '' : String(form.amount)}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        amount: Number(event.target.value.replace(',', '.')),
                                    }))
                                }
                                placeholder="45000"
                            />
                        </DialogField>

                        <DialogField label="Moneda">
                            <Select
                                value={form.currency}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        currency: value as 'ARS' | 'USD',
                                        personalAccountId: undefined,
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                        </DialogField>

                        <DialogField label="Fecha">
                            <Input
                                type="date"
                                value={formatDateInput(form.date)}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        date: new Date(event.target.value),
                                    }))
                                }
                            />
                        </DialogField>
                    </div>

                    <DialogField label="Descripción">
                        <Input
                            value={form.title}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    title: event.target.value,
                                }))
                            }
                            placeholder="Ej. Almuerzo equipo en Santiago"
                        />
                    </DialogField>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <DialogField label="Pagó">
                            <Select
                                value={form.paidByParticipantId}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        paidByParticipantId: value,
                                        personalAccountId:
                                            extractId(
                                                activeParticipants.find(
                                                    (participant) =>
                                                        extractId(participant._id) === value
                                                )?.userId
                                            ) === currentUserId
                                                ? previous.personalAccountId
                                                : undefined,
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Elegí un participante" />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeParticipants.map((participant) => (
                                        <SelectItem
                                            key={extractId(participant._id)}
                                            value={extractId(participant._id) ?? ''}
                                        >
                                            {participant.displayName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DialogField>

                        <DialogField label="Categoría">
                            <Select
                                value={form.categoryId ?? 'none'}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        categoryId: value === 'none' ? undefined : value,
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Sin categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin categoría</SelectItem>
                                    {categories.map((category: ICategory) => (
                                        <SelectItem
                                            key={extractId(category._id)}
                                            value={extractId(category._id) ?? ''}
                                        >
                                            {category.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DialogField>
                    </div>

                    {form.currency !== reportingCurrency && (
                        <DialogField label={`Cotización a ${reportingCurrency}`}>
                            <Input
                                value={form.exchangeRate ? String(form.exchangeRate) : ''}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        exchangeRate: event.target.value
                                            ? Number(event.target.value.replace(',', '.'))
                                            : undefined,
                                    }))
                                }
                                placeholder={`Ingresá cuánto vale 1 ${form.currency} en ${reportingCurrency}`}
                            />
                        </DialogField>
                    )}

                    {spaceMode !== 'solo' && (
                        <div className="space-y-4 rounded-[28px] border bg-card/70 p-4">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <SectionLabel>Split</SectionLabel>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Definí cómo se reparte este movimiento dentro del espacio.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                        Dividir entre participantes
                                    </span>
                                    <Switch
                                        checked={form.splitMode !== 'none'}
                                        onCheckedChange={(checked) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                splitMode: checked ? defaultSplitMode : 'none',
                                            }))
                                        }
                                    />
                                </div>
                            </div>

                            {form.splitMode !== 'none' && (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {(['equal', 'percentage', 'fixed'] as const).map((mode) => (
                                            <PillButton
                                                key={mode}
                                                active={form.splitMode === mode}
                                                onClick={() =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        splitMode: mode,
                                                    }))
                                                }
                                            >
                                                {SPACE_SPLIT_MODE_LABELS[mode]}
                                            </PillButton>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-sm">Participantes incluidos</Label>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {activeParticipants.map((participant) => {
                                                const participantId = extractId(participant._id) ?? ''
                                                const checked = (form.sharedWithParticipantIds ?? []).includes(participantId)

                                                return (
                                                    <button
                                                        key={participantId}
                                                        type="button"
                                                        onClick={() => toggleSharedParticipant(participantId)}
                                                        className={cn(
                                                            'flex items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors',
                                                            checked
                                                                ? 'border-primary/20 bg-primary/8'
                                                                : 'border-border hover:bg-accent/25'
                                                        )}
                                                    >
                                                        <div>
                                                            <p className="font-medium">{participant.displayName}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {SPACE_ROLE_LABELS[participant.role]}
                                                            </p>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                'flex h-5 w-5 items-center justify-center rounded-full border',
                                                                checked
                                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                    : 'border-border text-transparent'
                                                            )}
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {(form.splitMode === 'percentage' || form.splitMode === 'fixed') && (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {(form.splitAllocations ?? []).map((allocation) => {
                                                const participant = activeParticipants.find(
                                                    (item) =>
                                                        extractId(item._id) === allocation.participantId
                                                )

                                                if (!participant) return null

                                                return (
                                                    <DialogField
                                                        key={allocation.participantId}
                                                        label={`${participant.displayName} · ${form.splitMode === 'percentage' ? '%' : 'Monto'}`}
                                                    >
                                                        <Input
                                                            value={
                                                                form.splitMode === 'percentage'
                                                                    ? allocation.percentage ?? ''
                                                                    : allocation.amount ?? ''
                                                            }
                                                            onChange={(event) =>
                                                                updateSplitAllocation(
                                                                    allocation.participantId,
                                                                    form.splitMode === 'percentage'
                                                                        ? 'percentage'
                                                                        : 'amount',
                                                                    event.target.value
                                                                )
                                                            }
                                                            placeholder={form.splitMode === 'percentage' ? '50' : '22500'}
                                                        />
                                                    </DialogField>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {isCurrentUserPayer && (
                        <DialogField label="Impactar en tu contabilidad">
                            <Select
                                value={form.personalAccountId ?? 'none'}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        personalAccountId: value === 'none' ? undefined : value,
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Solo guardar dentro del espacio" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Solo guardar en el espacio</SelectItem>
                                    {filteredAccounts.map((account: IAccount) => (
                                        <SelectItem
                                            key={extractId(account._id)}
                                            value={extractId(account._id) ?? ''}
                                        >
                                            {account.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DialogField>
                    )}

                    <DialogField label="Notas">
                        <textarea
                            value={form.notes ?? ''}
                            onChange={(event) =>
                                setForm((previous) => ({
                                    ...previous,
                                    notes: event.target.value,
                                }))
                            }
                            rows={3}
                            placeholder="Notas internas, contexto o recordatorios."
                            className="min-h-[90px] w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
                        />
                    </DialogField>

                    {error && (
                        <p className="rounded-2xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter className="bg-background">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Guardando...' : 'Guardar movimiento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function ConfirmSpaceEntryDialog({
    open,
    onOpenChange,
    entry,
    onSubmit,
}: DialogProps & {
    entry: ISpaceEntry | null
    onSubmit: (data: SpaceEntryConfirmData) => Promise<unknown>
}) {
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const [form, setForm] = useState<SpaceEntryConfirmData>({
        mode: 'create',
        description: entry?.title ?? '',
        categoryId: undefined,
        accountId: undefined,
        linkedTransactionId: undefined,
    })
    const [recentTransactions, setRecentTransactions] = useState<ITransaction[]>([])
    const [loadingTransactions, setLoadingTransactions] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !entry) return

        setForm({
            mode: 'create',
            description: entry.title,
            categoryId: extractId(entry.categoryId),
            accountId: undefined,
            linkedTransactionId: undefined,
        })
        setSubmitting(false)
        setError(null)
    }, [entry, open])

    useEffect(() => {
        if (!open || !entry) return

        let cancelled = false

        const fetchRecentTransactions = async () => {
            try {
                setLoadingTransactions(true)
                const data = await apiJson<{ transactions: ITransaction[] }>(
                    `/api/transactions?limit=25&sort=date_desc&currency=${entry.currency}`
                )
                if (cancelled) return
                setRecentTransactions(
                    data.transactions.filter((transaction) => Math.abs(transaction.amount - entry.amount) < 0.01)
                )
            } catch {
                if (!cancelled) {
                    setRecentTransactions([])
                }
            } finally {
                if (!cancelled) {
                    setLoadingTransactions(false)
                }
            }
        }

        void fetchRecentTransactions()

        return () => {
            cancelled = true
        }
    }, [entry, open])

    const handleSubmit = async () => {
        const parsed = spaceEntryConfirmSchema.safeParse(form)
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá la confirmación del movimiento.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await onSubmit(parsed.data)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos confirmar el movimiento.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[620px] gap-0 overflow-hidden p-0 sm:max-w-[620px]">
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="text-2xl tracking-tight">Confirmar movimiento</DialogTitle>
                        <DialogDescription>
                            Elegí si querés crear una transacción nueva o vincular una existente.
                        </DialogDescription>
                    </DialogHeader>

                    {entry && (
                        <div className="rounded-[24px] border bg-card/70 p-4">
                            <p className="text-base font-medium">{entry.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {entry.amount.toLocaleString('es-AR', {
                                    style: 'currency',
                                    currency: entry.currency,
                                    maximumFractionDigits: entry.currency === 'ARS' ? 0 : 2,
                                })}
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <SectionLabel>Modo</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                            <PillButton
                                active={form.mode === 'create'}
                                onClick={() =>
                                    setForm((previous) => ({
                                        ...previous,
                                        mode: 'create',
                                        linkedTransactionId: undefined,
                                    }))
                                }
                            >
                                Crear nueva transacción
                            </PillButton>
                            <PillButton
                                active={form.mode === 'link'}
                                onClick={() =>
                                    setForm((previous) => ({
                                        ...previous,
                                        mode: 'link',
                                        accountId: undefined,
                                    }))
                                }
                            >
                                Vincular existente
                            </PillButton>
                        </div>
                    </div>

                    {form.mode === 'create' ? (
                        <div className="space-y-4">
                            <DialogField label="Cuenta">
                                <Select
                                    value={form.accountId ?? ''}
                                    onValueChange={(value) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            accountId: value,
                                        }))
                                    }
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Elegí una cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts
                                            .filter((account) =>
                                                entry
                                                    ? (account.supportedCurrencies ?? [account.currency]).includes(entry.currency)
                                                    : true
                                            )
                                            .map((account) => (
                                                <SelectItem
                                                    key={extractId(account._id)}
                                                    value={extractId(account._id) ?? ''}
                                                >
                                                    {account.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </DialogField>

                            <DialogField label="Descripción">
                                <Input
                                    value={form.description ?? ''}
                                    onChange={(event) =>
                                        setForm((previous) => ({
                                            ...previous,
                                            description: event.target.value,
                                        }))
                                    }
                                    placeholder="Descripción para tu contabilidad personal"
                                />
                            </DialogField>
                        </div>
                    ) : (
                        <DialogField label="Transacción existente">
                            <Select
                                value={form.linkedTransactionId ?? ''}
                                onValueChange={(value) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        linkedTransactionId: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={
                                            loadingTransactions
                                                ? 'Buscando transacciones...'
                                                : 'Elegí una transacción'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {recentTransactions.map((transaction) => (
                                        <SelectItem
                                            key={extractId(transaction._id)}
                                            value={extractId(transaction._id) ?? ''}
                                        >
                                            {transaction.description}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </DialogField>
                    )}

                    <DialogField label="Categoría">
                        <Select
                            value={form.categoryId ?? 'none'}
                            onValueChange={(value) =>
                                setForm((previous) => ({
                                    ...previous,
                                    categoryId: value === 'none' ? undefined : value,
                                }))
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Sin categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin categoría</SelectItem>
                                {categories.map((category) => (
                                    <SelectItem
                                        key={extractId(category._id)}
                                        value={extractId(category._id) ?? ''}
                                    >
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </DialogField>

                    {error && (
                        <p className="rounded-2xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </div>

                <DialogFooter className="bg-background">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Confirmando...' : 'Confirmar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
