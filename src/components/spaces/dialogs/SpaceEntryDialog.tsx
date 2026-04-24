'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarRange, Coins, Save } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/hooks/useToast'
import { spaceEntrySchema, type SpaceEntryFormData, type SpaceFormData } from '@/lib/validations'
import { extractId, SPACE_ENTRY_TYPE_LABELS } from '@/lib/utils/spaces'
import type { IAccount, ICategory, ISpaceParticipant } from '@/types'
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
import { SPACE_ENTRY_TYPE_META, SpaceAmountInline, SpaceEntryTypeBadge, SpaceMetaBadge } from '@/components/spaces/SpaceUi'
import {
    DialogProps,
    formatDateInput,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import {
    SpaceAttachmentDraft,
    SpaceAttachmentsUploader,
} from '@/components/spaces/dialogs/SpaceAttachmentsUploader'
import { SpaceSplitConfigurator } from '@/components/spaces/dialogs/SpaceSplitConfigurator'

type EntryDraftPayload = Omit<SpaceEntryFormData, 'date'> & {
    date: string
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

function buildDefaultForm({
    activeParticipants,
    currentUserId,
    defaultCurrency,
    defaultSplitMode,
    spaceMode,
}: {
    activeParticipants: ISpaceParticipant[]
    currentUserId: string
    defaultCurrency: string
    defaultSplitMode: SpaceEntryFormData['splitMode']
    spaceMode: SpaceFormData['mode']
}): SpaceEntryFormData {
    const allParticipantIds = activeParticipants
        .map((participant) => extractId(participant._id) ?? '')
        .filter(Boolean)
    const currentParticipantId = extractId(
        activeParticipants.find((participant) => extractId(participant.userId) === currentUserId)?._id
    )

    return {
        type: 'expense',
        title: '',
        description: '',
        amount: 0,
        currency: defaultCurrency,
        exchangeRate: undefined,
        date: new Date(),
        categoryId: undefined,
        paidByParticipantId: currentParticipantId,
        sharedWithParticipantIds: spaceMode === 'solo' ? undefined : allParticipantIds,
        splitMode: spaceMode === 'solo' ? 'none' : defaultSplitMode,
        splitAllocations:
            spaceMode === 'solo'
                ? undefined
                : buildDefaultSplitAllocations(allParticipantIds, defaultSplitMode),
        notes: '',
        personalAccountId: undefined,
        linkedTransactionId: undefined,
    }
}

function sanitizeDraft({
    raw,
    defaults,
    activeParticipants,
    spaceMode,
}: {
    raw: string
    defaults: SpaceEntryFormData
    activeParticipants: ISpaceParticipant[]
    spaceMode: SpaceFormData['mode']
}) {
    try {
        const parsed = JSON.parse(raw) as Partial<EntryDraftPayload>
        const activeParticipantIds = new Set(
            activeParticipants.map((participant) => extractId(participant._id) ?? '')
        )
        const sharedWithParticipantIds = Array.isArray(parsed.sharedWithParticipantIds)
            ? parsed.sharedWithParticipantIds.filter((item) => activeParticipantIds.has(item))
            : defaults.sharedWithParticipantIds
        const splitMode =
            parsed.splitMode && ['none', 'equal', 'percentage', 'fixed'].includes(parsed.splitMode)
                ? parsed.splitMode
                : defaults.splitMode

        return {
            ...defaults,
            ...parsed,
            amount: typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : defaults.amount,
            currency: parsed.currency ?? defaults.currency,
            date: parsed.date ? new Date(parsed.date) : defaults.date,
            paidByParticipantId:
                parsed.paidByParticipantId && activeParticipantIds.has(parsed.paidByParticipantId)
                    ? parsed.paidByParticipantId
                    : defaults.paidByParticipantId,
            sharedWithParticipantIds:
                spaceMode === 'solo' || splitMode === 'none' ? undefined : sharedWithParticipantIds,
            splitMode: spaceMode === 'solo' ? 'none' : splitMode,
            splitAllocations:
                splitMode === 'percentage' || splitMode === 'fixed'
                    ? (parsed.splitAllocations ?? []).filter((item) =>
                          activeParticipantIds.has(item.participantId)
                      )
                    : undefined,
        } satisfies SpaceEntryFormData
    } catch {
        return defaults
    }
}

function revokeAttachment(attachment: SpaceAttachmentDraft) {
    if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
    }
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
    draftKey,
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<unknown>
    participants: ISpaceParticipant[]
    currentUserId: string
    defaultCurrency: string
    reportingCurrency: string
    defaultSplitMode: SpaceEntryFormData['splitMode']
    spaceMode: SpaceFormData['mode']
    draftKey?: string
}) {
    const { categories } = useCategories()
    const { accounts } = useAccounts()
    const { success } = useToast()

    const activeParticipants = useMemo(
        () => participants.filter((participant) => participant.isActive),
        [participants]
    )

    const [form, setForm] = useState<SpaceEntryFormData>(
        buildDefaultForm({
            activeParticipants,
            currentUserId,
            defaultCurrency,
            defaultSplitMode,
            spaceMode,
        })
    )
    const [attachments, setAttachments] = useState<SpaceAttachmentDraft[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const attachmentsRef = useRef<SpaceAttachmentDraft[]>([])

    const draftStorageKey = draftKey ? `finp:space-entry-draft:${draftKey}` : undefined

    useEffect(() => {
        attachmentsRef.current = attachments
    }, [attachments])

    useEffect(() => {
        return () => {
            attachmentsRef.current.forEach(revokeAttachment)
        }
    }, [])

    useEffect(() => {
        if (open) return

        setAttachments((previous) => {
            previous.forEach(revokeAttachment)
            return previous.length > 0 ? [] : previous
        })
    }, [open])

    useEffect(() => {
        if (!open) return

        const defaults = buildDefaultForm({
            activeParticipants,
            currentUserId,
            defaultCurrency,
            defaultSplitMode,
            spaceMode,
        })
        const savedDraft =
            draftStorageKey && typeof window !== 'undefined'
                ? window.sessionStorage.getItem(draftStorageKey)
                : null

        setForm(
            savedDraft
                ? sanitizeDraft({
                      raw: savedDraft,
                      defaults,
                      activeParticipants,
                      spaceMode,
                  })
                : defaults
        )
        setAttachments((previous) => {
            previous.forEach(revokeAttachment)
            return []
        })
        setSubmitting(false)
        setError(null)
    }, [
        activeParticipants,
        currentUserId,
        defaultCurrency,
        defaultSplitMode,
        draftStorageKey,
        open,
        spaceMode,
    ])

    useEffect(() => {
        if (spaceMode === 'solo') return
        if (form.splitMode !== 'percentage' && form.splitMode !== 'fixed') return

        const participantIds = form.sharedWithParticipantIds ?? []
        const currentAllocations = form.splitAllocations ?? []
        const currentIds = new Set(currentAllocations.map((item) => item.participantId))
        const requiresReset =
            participantIds.length !== currentAllocations.length ||
            participantIds.some((participantId) => !currentIds.has(participantId)) ||
            (form.splitMode === 'percentage' &&
                currentAllocations.some((item) => typeof item.percentage !== 'number')) ||
            (form.splitMode === 'fixed' &&
                currentAllocations.some((item) => typeof item.amount !== 'number'))

        if (!requiresReset) return

        setForm((previous) => ({
            ...previous,
            splitAllocations: buildDefaultSplitAllocations(participantIds, previous.splitMode),
        }))
    }, [form.sharedWithParticipantIds, form.splitMode, form.splitAllocations, spaceMode])

    const paidByParticipant = activeParticipants.find(
        (participant) => extractId(participant._id) === form.paidByParticipantId
    )
    const isCurrentUserPayer = extractId(paidByParticipant?.userId) === currentUserId
    const filteredAccounts = useMemo(
        () =>
            accounts.filter((account) =>
                (account.supportedCurrencies ?? [account.currency]).includes(form.currency as never)
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
                          [field]:
                              typeof numericValue === 'number' && Number.isFinite(numericValue)
                                  ? numericValue
                                  : undefined,
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

    const applySplitPreset = (
        preset: 'none' | 'equal' | 'half' | '6040' | 'custom'
    ) => {
        const allParticipantIds = activeParticipants
            .map((participant) => extractId(participant._id) ?? '')
            .filter(Boolean)

        setForm((previous) => {
            const selectedIds =
                previous.sharedWithParticipantIds && previous.sharedWithParticipantIds.length > 0
                    ? previous.sharedWithParticipantIds
                    : allParticipantIds

            if (preset === 'none') {
                return {
                    ...previous,
                    splitMode: 'none',
                }
            }

            if (preset === 'equal') {
                return {
                    ...previous,
                    splitMode: 'equal',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: undefined,
                }
            }

            if (preset === 'half' && selectedIds.length === 2) {
                return {
                    ...previous,
                    splitMode: 'percentage',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: [
                        { participantId: selectedIds[0], percentage: 50 },
                        { participantId: selectedIds[1], percentage: 50 },
                    ],
                }
            }

            if (preset === '6040' && selectedIds.length === 2) {
                return {
                    ...previous,
                    splitMode: 'percentage',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: [
                        { participantId: selectedIds[0], percentage: 60 },
                        { participantId: selectedIds[1], percentage: 40 },
                    ],
                }
            }

            return {
                ...previous,
                splitMode: 'percentage',
                sharedWithParticipantIds: selectedIds,
                splitAllocations: buildDefaultSplitAllocations(selectedIds, 'percentage'),
            }
        })
    }

    const clearDraft = () => {
        if (!draftStorageKey || typeof window === 'undefined') return
        window.sessionStorage.removeItem(draftStorageKey)
    }

    const handleSaveDraft = () => {
        if (!draftStorageKey || typeof window === 'undefined') {
            onOpenChange(false)
            return
        }

        const payload: EntryDraftPayload = {
            ...form,
            amount: Number.isFinite(form.amount) ? form.amount : 0,
            date: form.date.toISOString(),
        }

        window.sessionStorage.setItem(draftStorageKey, JSON.stringify(payload))
        success('Borrador local guardado')
        onOpenChange(false)
    }

    const handleFilesSelected = (files: File[]) => {
        const nextAttachments = files.map((file, index) => ({
            id:
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `${Date.now()}-${index}`,
            file,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        }))

        setAttachments((previous) => [...previous, ...nextAttachments])
    }

    const handleRemoveAttachment = (id: string) => {
        setAttachments((previous) => {
            const target = previous.find((attachment) => attachment.id === id)
            if (target) revokeAttachment(target)
            return previous.filter((attachment) => attachment.id !== id)
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
            clearDraft()
            setAttachments((previous) => {
                previous.forEach(revokeAttachment)
                return []
            })
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar el movimiento.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[1120px] gap-0 overflow-hidden p-0 sm:max-h-[94vh] sm:max-w-[1120px]"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-3">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                                Movimiento del espacio
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl tracking-tight">Nuevo movimiento</DialogTitle>
                                <DialogDescription>
                                    Tipo, monto, pagador y reparto. Los comprobantes y notas son opcionales.
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                                <div className="space-y-5">
                                    <SpaceDialogPanel>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <SpaceDialogSectionEyebrow>Tipo de movimiento</SpaceDialogSectionEyebrow>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                    Elegí el contexto contable
                                                </h3>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                {(Object.keys(SPACE_ENTRY_TYPE_META) as SpaceEntryFormData['type'][]).map(
                                                    (type) => {
                                                        const meta = SPACE_ENTRY_TYPE_META[type]
                                                        const Icon = meta.icon
                                                        const active = form.type === type

                                                        return (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() =>
                                                                    setForm((previous) => ({
                                                                        ...previous,
                                                                        type,
                                                                    }))
                                                                }
                                                                className={[
                                                                    'rounded-[22px] border px-4 py-4 text-left transition-colors',
                                                                    active
                                                                        ? 'border-primary/20 bg-primary/8'
                                                                        : 'border-border bg-background/72 hover:bg-accent/25',
                                                                ].join(' ')}
                                                            >
                                                                <div className="space-y-3">
                                                                    <div
                                                                        className="flex h-10 w-10 items-center justify-center rounded-[16px]"
                                                                        style={{
                                                                            background: meta.softAccent,
                                                                            color: meta.accent,
                                                                        }}
                                                                    >
                                                                        <Icon className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="font-semibold text-foreground">
                                                                            {SPACE_ENTRY_TYPE_LABELS[type]}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {type === 'expense'
                                                                                ? 'Compra, gasto o pago compartido.'
                                                                                : type === 'income'
                                                                                    ? 'Ingreso que impacta el espacio.'
                                                                                    : type === 'adjustment'
                                                                                        ? 'Corrección o ajuste interno.'
                                                                                        : 'Saldar deuda entre participantes.'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        )
                                                    }
                                                )}
                                            </div>
                                        </div>
                                    </SpaceDialogPanel>

                                    <SpaceDialogPanel>
                                        <div className="grid gap-4">
                                            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.55fr_0.7fr]">
                                                <SpaceDialogField label="Monto">
                                                    <Input
                                                        value={form.amount === 0 ? '' : String(form.amount)}
                                                        onChange={(event) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                amount: Number(
                                                                    event.target.value.replace(',', '.')
                                                                ),
                                                            }))
                                                        }
                                                        placeholder="45000"
                                                    />
                                                </SpaceDialogField>

                                                <SpaceDialogField label="Moneda">
                                                    <Select
                                                        value={form.currency}
                                                        onValueChange={(value) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                currency: value,
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
                                                </SpaceDialogField>

                                                <SpaceDialogField label="Fecha">
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
                                                </SpaceDialogField>
                                            </div>

                                            <SpaceDialogField label="Descripción">
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
                                            </SpaceDialogField>

                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <SpaceDialogField label="Pagó">
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
                                                                                extractId(
                                                                                    participant._id
                                                                                ) === value
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
                                                </SpaceDialogField>

                                                <SpaceDialogField label="Categoría">
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
                                                </SpaceDialogField>
                                            </div>

                                            {form.currency !== reportingCurrency ? (
                                                <SpaceDialogField
                                                    label={`Cotización a ${reportingCurrency}`}
                                                    hint="Necesaria para reflejar el movimiento correctamente en la moneda de reporte."
                                                >
                                                    <Input
                                                        value={form.exchangeRate ? String(form.exchangeRate) : ''}
                                                        onChange={(event) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                exchangeRate: event.target.value
                                                                    ? Number(
                                                                          event.target.value.replace(',', '.')
                                                                      )
                                                                    : undefined,
                                                            }))
                                                        }
                                                        placeholder={`Ingresá cuánto vale 1 ${form.currency} en ${reportingCurrency}`}
                                                    />
                                                </SpaceDialogField>
                                            ) : null}
                                        </div>
                                    </SpaceDialogPanel>

                                    {spaceMode !== 'solo' ? (
                                        <SpaceSplitConfigurator
                                            participants={activeParticipants}
                                            amount={Number.isFinite(form.amount) ? form.amount : 0}
                                            currency={form.currency}
                                            selectedParticipantIds={form.sharedWithParticipantIds ?? []}
                                            splitMode={form.splitMode}
                                            allocations={form.splitAllocations}
                                            onToggleParticipant={toggleSharedParticipant}
                                            onApplyPreset={applySplitPreset}
                                            onAllocationChange={updateSplitAllocation}
                                        />
                                    ) : null}
                                </div>

                                <div className="space-y-5">
                                    <SpaceDialogPanel>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <SpaceDialogSectionEyebrow>Resumen</SpaceDialogSectionEyebrow>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                    Vista rápida antes de guardar
                                                </h3>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <SpaceEntryTypeBadge type={form.type} />
                                                <SpaceMetaBadge icon={Coins}>
                                                    {form.currency} · reporte en {reportingCurrency}
                                                </SpaceMetaBadge>
                                                <SpaceMetaBadge icon={CalendarRange}>
                                                    {formatDateInput(form.date)}
                                                </SpaceMetaBadge>
                                            </div>

                                            <div className="rounded-[24px] border border-foreground/[0.07] bg-background/72 p-4">
                                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                                    Monto
                                                </p>
                                                <SpaceAmountInline
                                                    amount={Number.isFinite(form.amount) ? form.amount : 0}
                                                    currency={form.currency}
                                                    hidden={false}
                                                    className="mt-2 text-2xl font-semibold"
                                                />
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    {paidByParticipant
                                                        ? `Lo registra ${paidByParticipant.displayName}.`
                                                        : 'Todavía falta elegir quién paga.'}
                                                </p>
                                            </div>
                                        </div>
                                    </SpaceDialogPanel>

                                    {isCurrentUserPayer ? (
                                        <SpaceDialogPanel>
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <SpaceDialogSectionEyebrow>Impacto personal</SpaceDialogSectionEyebrow>
                                                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                        Tu contabilidad
                                                    </h3>
                                                </div>

                                                <SpaceDialogField label="Impactar en tu contabilidad">
                                                    <Select
                                                        value={form.personalAccountId ?? 'none'}
                                                        onValueChange={(value) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                personalAccountId:
                                                                    value === 'none' ? undefined : value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Solo guardar dentro del espacio" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">
                                                                Solo guardar en el espacio
                                                            </SelectItem>
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
                                                </SpaceDialogField>

                                                <p className="text-xs text-muted-foreground">
                                                    Si elegís una cuenta, el movimiento también puede reflejarse en tu contabilidad personal.
                                                </p>
                                            </div>
                                        </SpaceDialogPanel>
                                    ) : null}

                                    <SpaceAttachmentsUploader
                                        attachments={attachments}
                                        onFilesSelected={handleFilesSelected}
                                        onRemove={handleRemoveAttachment}
                                    />

                                    <SpaceDialogPanel>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <SpaceDialogSectionEyebrow>Borrador</SpaceDialogSectionEyebrow>
                                                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                    Guardado local
                                                </h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Guardá el formulario como borrador y retomalo después en este espacio. Los comprobantes adjuntados no se incluyen en el borrador.
                                            </p>
                                        </div>
                                    </SpaceDialogPanel>
                                </div>
                            </div>

                            <SpaceDialogPanel>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Notas</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Contexto adicional
                                        </h3>
                                    </div>

                                    <SpaceDialogTextArea
                                        value={form.notes ?? ''}
                                        onChange={(event) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                notes: event.target.value,
                                            }))
                                        }
                                        rows={4}
                                        placeholder="Notas internas, contexto o recordatorios útiles para el equipo."
                                    />
                                </div>
                            </SpaceDialogPanel>

                            {error ? (
                                <p className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                    {error}
                                </p>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 sm:px-6">
                        <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Guardar movimiento'}
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={handleSaveDraft}
                            disabled={submitting}
                        >
                            <Save className="h-4 w-4" />
                            Guardar borrador
                        </Button>
                        <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
