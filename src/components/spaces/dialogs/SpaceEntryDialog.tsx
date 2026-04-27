'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Banknote,
    Building2,
    CalendarRange,
    CircleDollarSign,
    Coins,
    CreditCard,
    PiggyBank,
    Save,
    Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useSpaceCategories } from '@/hooks/useSpaceCategories'
import { useToast } from '@/hooks/useToast'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { spaceEntrySchema, type SpaceEntryFormData, type SpaceFormData } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { AccountType } from '@/lib/constants'
import type { IAccount, ICategory, ISpaceCategory, ISpaceEntry, ISpaceParticipant } from '@/types'
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
    SpaceAmountInline,
    SpaceEntryTypeBadge,
    SpaceInitialsAvatar,
    SpaceMetaBadge,
} from '@/components/spaces/SpaceUi'
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

// ── Account type helpers ──────────────────────────────────────────────────────

function getAccountTypeMeta(type: AccountType): { label: string; icon: LucideIcon } {
    switch (type) {
        case 'bank':
            return { label: 'Cuenta bancaria', icon: Building2 }
        case 'cash':
            return { label: 'Efectivo', icon: Banknote }
        case 'wallet':
            return { label: 'Billetera', icon: Wallet }
        case 'credit_card':
            return { label: 'Tarjeta de crédito', icon: CreditCard }
        case 'savings':
            return { label: 'Caja de ahorro', icon: PiggyBank }
        default:
            return { label: 'Cuenta', icon: CircleDollarSign }
    }
}

// ── Internal types ────────────────────────────────────────────────────────────

type EntryDraftPayload = Omit<SpaceEntryFormData, 'date'> & {
    date: string
}

function buildDefaultSplitAllocations(
    participantIds: string[],
    splitMode: SpaceEntryFormData['splitMode']
) {
    if (participantIds.length === 0) return undefined

    if (splitMode === 'percentage') {
        const base = Number((100 / participantIds.length).toFixed(2))
        let assigned = 0
        return participantIds.map((participantId, index) => {
            const percentage =
                index === participantIds.length - 1
                    ? Number((100 - assigned).toFixed(2))
                    : base
            assigned = Number((assigned + percentage).toFixed(2))
            return { participantId, percentage }
        })
    }

    if (splitMode === 'fixed') {
        return participantIds.map((participantId) => ({
            participantId,
            amount: 0,
        }))
    }

    return undefined
}

function reconcilePercentageAllocations(
    participantIds: string[],
    currentAllocations: SpaceEntryFormData['splitAllocations']
) {
    if (participantIds.length === 0) return undefined
    if (participantIds.length === 1) {
        return [{ participantId: participantIds[0], percentage: 100 }]
    }

    const existing = new Map(
        (currentAllocations ?? []).map((allocation) => [
            allocation.participantId,
            allocation.percentage,
        ])
    )
    const next = participantIds.map((participantId) => ({
        participantId,
        percentage: existing.get(participantId),
    }))
    const missing = next.filter((allocation) => typeof allocation.percentage !== 'number')
    const assigned = next.reduce(
        (acc, allocation) => acc + (typeof allocation.percentage === 'number' ? allocation.percentage : 0),
        0
    )
    const remaining = Math.max(0, 100 - assigned)

    if (missing.length > 0) {
        const base = Number((remaining / missing.length).toFixed(2))
        let distributed = 0
        missing.forEach((allocation, index) => {
            allocation.percentage =
                index === missing.length - 1
                    ? Number((remaining - distributed).toFixed(2))
                    : base
            distributed = Number((distributed + (allocation.percentage ?? 0)).toFixed(2))
        })
    }

    const total = next.reduce((acc, allocation) => acc + (allocation.percentage ?? 0), 0)
    const diff = Number((100 - total).toFixed(2))
    next[next.length - 1].percentage = Number(((next[next.length - 1].percentage ?? 0) + diff).toFixed(2))

    return next
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
    const responsibleParticipantId = currentParticipantId ?? allParticipantIds[0]
    const defaultSharedParticipantIds =
        spaceMode === 'solo'
            ? undefined
            : defaultSplitMode === 'none'
                ? responsibleParticipantId
                    ? [responsibleParticipantId]
                    : undefined
                : allParticipantIds

    return {
        type: 'expense',
        title: '',
        description: '',
        amount: 0,
        currency: defaultCurrency,
        exchangeRate: undefined,
        date: new Date(),
        spaceCategoryId: undefined,
        paidByParticipantId: currentParticipantId,
        sharedWithParticipantIds: defaultSharedParticipantIds,
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
            type: 'expense',
            amount: typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : defaults.amount,
            currency: parsed.currency ?? defaults.currency,
            date: parsed.date ? new Date(parsed.date) : defaults.date,
            paidByParticipantId:
                parsed.paidByParticipantId && activeParticipantIds.has(parsed.paidByParticipantId)
                    ? parsed.paidByParticipantId
                    : defaults.paidByParticipantId,
            sharedWithParticipantIds:
                spaceMode === 'solo'
                    ? undefined
                    : splitMode === 'none'
                        ? sharedWithParticipantIds?.slice(0, 1)
                        : sharedWithParticipantIds,
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

// ── Component ─────────────────────────────────────────────────────────────────

export function SpaceEntryDialog({
    open,
    onOpenChange,
    onSubmit,
    spaceId,
    participants,
    currentUserId,
    defaultCurrency,
    reportingCurrency,
    spaceCurrencies,
    defaultSplitMode,
    spaceMode,
    draftKey,
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<ISpaceEntry>
    spaceId: string
    participants: ISpaceParticipant[]
    currentUserId: string
    defaultCurrency: string
    reportingCurrency: string
    spaceCurrencies: string[]
    defaultSplitMode: SpaceEntryFormData['splitMode']
    spaceMode: SpaceFormData['mode']
    draftKey?: string
}) {
    const { categories } = useSpaceCategories(spaceId)
    const { categories: personalCategories } = useCategories()
    const { accounts } = useAccounts()
    const { success, warning } = useToast()

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
            splitAllocations:
                previous.splitMode === 'percentage'
                    ? reconcilePercentageAllocations(participantIds, previous.splitAllocations)
                    : buildDefaultSplitAllocations(participantIds, previous.splitMode),
        }))
    }, [form.sharedWithParticipantIds, form.splitMode, form.splitAllocations, spaceMode])

    useEffect(() => {
        if (spaceCurrencies.includes(form.currency)) return
        setForm((previous) => ({
            ...previous,
            currency: spaceCurrencies[0] ?? reportingCurrency,
            personalAccountId: undefined,
            categoryId: undefined,
        }))
    }, [form.currency, reportingCurrency, spaceCurrencies])

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
    const filteredCategories = useMemo(
        () => categories.filter((category) => category.type === 'expense'),
        [categories]
    )
    const personalExpenseCategories = useMemo(
        () => personalCategories.filter((category) => category.type === 'expense' && !category.isArchived),
        [personalCategories]
    )
    const selectedSpaceCategory = useMemo(
        () => filteredCategories.find((category) => extractId(category._id) === form.spaceCategoryId),
        [filteredCategories, form.spaceCategoryId]
    )

    useEffect(() => {
        if (!form.spaceCategoryId) return
        if (categories.length === 0) return
        const selectedStillMatches = filteredCategories.some(
            (category) => extractId(category._id) === form.spaceCategoryId
        )
        if (selectedStillMatches) return

        setForm((previous) => ({
            ...previous,
            spaceCategoryId: undefined,
        }))
    }, [categories.length, filteredCategories, form.spaceCategoryId])

    useEffect(() => {
        if (!form.personalAccountId) {
            if (!form.categoryId) return
            setForm((previous) => ({ ...previous, categoryId: undefined }))
            return
        }

        if (form.categoryId || !selectedSpaceCategory) return

        const normalizeCategoryName = (value: string) =>
            value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const normalizedSpaceName = normalizeCategoryName(selectedSpaceCategory.name)
        const match = personalExpenseCategories.find(
            (category) => {
                const normalizedPersonalName = normalizeCategoryName(category.name)
                return (
                    normalizedPersonalName === normalizedSpaceName ||
                    normalizedPersonalName.includes(normalizedSpaceName) ||
                    normalizedSpaceName.includes(normalizedPersonalName)
                )
            }
        )

        if (!match) return

        setForm((previous) => ({
            ...previous,
            categoryId: extractId(match._id),
        }))
    }, [form.categoryId, form.personalAccountId, personalExpenseCategories, selectedSpaceCategory])

    const updateSplitAllocations = (
        allocations: NonNullable<SpaceEntryFormData['splitAllocations']>
    ) => {
        setForm((previous) => ({
            ...previous,
            splitAllocations: allocations,
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

    const setResponsibleParticipant = (participantId: string) => {
        setForm((previous) => ({
            ...previous,
            splitMode: 'none',
            sharedWithParticipantIds: [participantId],
            splitAllocations: undefined,
        }))
    }

    const applySplitPreset = (preset: SpaceEntryFormData['splitMode']) => {
        const allParticipantIds = activeParticipants
            .map((participant) => extractId(participant._id) ?? '')
            .filter(Boolean)

        setForm((previous) => {
            const selectedIds =
                previous.splitMode !== 'none' &&
                previous.sharedWithParticipantIds &&
                previous.sharedWithParticipantIds.length > 1
                    ? previous.sharedWithParticipantIds
                    : allParticipantIds

            if (preset === 'none') {
                const responsibleId =
                    previous.sharedWithParticipantIds?.[0] ??
                    previous.paidByParticipantId ??
                    allParticipantIds[0]
                return {
                    ...previous,
                    splitMode: 'none',
                    sharedWithParticipantIds: responsibleId ? [responsibleId] : undefined,
                    splitAllocations: undefined,
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

            if (preset === 'percentage') {
                return {
                    ...previous,
                    splitMode: 'percentage',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: buildDefaultSplitAllocations(selectedIds, 'percentage'),
                }
            }

            if (preset === 'fixed') {
                return {
                    ...previous,
                    splitMode: 'fixed',
                    sharedWithParticipantIds: selectedIds,
                    splitAllocations: buildDefaultSplitAllocations(selectedIds, 'fixed'),
                }
            }

            return previous
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

    const uploadDraftAttachments = async (entryId: string, draftAttachments: SpaceAttachmentDraft[]) => {
        if (draftAttachments.length === 0) return true

        let allUploaded = true
        for (const attachment of draftAttachments) {
            try {
                const formData = new FormData()
                formData.append('file', attachment.file)
                await apiJson(`/api/spaces/${spaceId}/entries/${entryId}/attachments`, {
                    method: 'POST',
                    body: formData,
                })
            } catch {
                allUploaded = false
            }
        }

        invalidateData(SPACE_INVALIDATION_TAGS)
        return allUploaded
    }

    const handleSubmit = async () => {
        // Normalize 1-participant fixed mode: allocation should equal full amount
        const normalizedAllocations =
            form.splitMode === 'fixed' && (form.sharedWithParticipantIds?.length ?? 0) === 1
                ? form.sharedWithParticipantIds?.map((id) => ({
                      participantId: id,
                      amount: Number.isFinite(form.amount) ? form.amount : 0,
                  }))
                : form.splitAllocations

        const parsed = spaceEntrySchema.safeParse({
            ...form,
            type: 'expense',
            splitMode: spaceMode === 'solo' ? 'none' : form.splitMode,
            sharedWithParticipantIds:
                spaceMode === 'solo' ? undefined : form.sharedWithParticipantIds,
            splitAllocations:
                form.splitMode === 'percentage' || form.splitMode === 'fixed'
                    ? normalizedAllocations
                    : undefined,
        })

        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá los datos del movimiento.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const entry = await onSubmit({
                ...parsed.data,
                categoryId: parsed.data.personalAccountId ? parsed.data.categoryId : undefined,
            })
            const entryId = extractId(entry._id)
            if (entryId && attachmentsRef.current.length > 0) {
                const uploaded = await uploadDraftAttachments(entryId, attachmentsRef.current)
                if (!uploaded) {
                    warning('El movimiento se guardó, pero algún comprobante no pudo subirse.')
                }
            }
            clearDraft()
            setAttachments((previous) => {
                previous.forEach(revokeAttachment)
                return []
            })
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos guardar el gasto.')
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
                    {/* ── Header ── */}
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-3">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                                Movimiento del espacio
                            </div>
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl tracking-tight">Nuevo gasto</DialogTitle>
                                <DialogDescription>
                                    Monto, pagador y reparto. Los comprobantes y notas son opcionales.
                                </DialogDescription>
                            </div>
                        </DialogHeader>
                    </div>

                    {/* ── Body ── */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">

                                {/* ── Left column ── */}
                                <div className="space-y-5">

                                    {/* Monto, moneda, fecha, descripción, pagó, categoría */}
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
                                                                categoryId: undefined,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {spaceCurrencies.map((currency) => (
                                                                <SelectItem key={currency} value={currency}>
                                                                    {currency}
                                                                </SelectItem>
                                                            ))}
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
                                                            setForm((previous) => {
                                                                const nextIsCurrentUser =
                                                                    extractId(
                                                                        activeParticipants.find(
                                                                            (participant) =>
                                                                                extractId(participant._id) === value
                                                                        )?.userId
                                                                    ) === currentUserId
                                                                const shouldMoveResponsibility =
                                                                    previous.splitMode === 'none' &&
                                                                    (!previous.sharedWithParticipantIds?.[0] ||
                                                                        previous.sharedWithParticipantIds[0] ===
                                                                            previous.paidByParticipantId)

                                                                return {
                                                                    ...previous,
                                                                    paidByParticipantId: value,
                                                                    sharedWithParticipantIds: shouldMoveResponsibility
                                                                        ? [value]
                                                                        : previous.sharedWithParticipantIds,
                                                                    personalAccountId: nextIsCurrentUser
                                                                        ? previous.personalAccountId
                                                                        : undefined,
                                                                }
                                                            })
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
                                                                    <span className="flex items-center gap-2">
                                                                        <SpaceInitialsAvatar
                                                                            name={participant.displayName}
                                                                            className="h-6 w-6 text-[10px]"
                                                                        />
                                                                        <span>{participant.displayName}</span>
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </SpaceDialogField>

                                                <SpaceDialogField label="Categoría del espacio">
                                                    <Select
                                                        value={form.spaceCategoryId ?? 'none'}
                                                        onValueChange={(value) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                spaceCategoryId: value === 'none' ? undefined : value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Sin categoría" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sin categoría</SelectItem>
                                                            {filteredCategories.map((category: ISpaceCategory) => (
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

                                    {/* Split configurator */}
                                    {spaceMode !== 'solo' ? (
                                        <SpaceSplitConfigurator
                                            participants={activeParticipants}
                                            amount={Number.isFinite(form.amount) ? form.amount : 0}
                                            currency={form.currency}
                                            paidByParticipantId={form.paidByParticipantId}
                                            selectedParticipantIds={form.sharedWithParticipantIds ?? []}
                                            splitMode={form.splitMode}
                                            allocations={form.splitAllocations}
                                            onToggleParticipant={toggleSharedParticipant}
                                            onResponsibleChange={setResponsibleParticipant}
                                            onApplyPreset={applySplitPreset}
                                            onAllocationsChange={updateSplitAllocations}
                                        />
                                    ) : null}
                                </div>

                                {/* ── Right column ── */}
                                <div className="space-y-5">

                                    {/* Resumen */}
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

                                    {/* Pagado desde */}
                                    {isCurrentUserPayer ? (
                                        <SpaceDialogPanel>
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <SpaceDialogSectionEyebrow>Impacto personal</SpaceDialogSectionEyebrow>
                                                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                        Pagado desde
                                                    </h3>
                                                </div>

                                                <SpaceDialogField label="Cuenta o tarjeta">
                                                    <Select
                                                        value={form.personalAccountId ?? 'none'}
                                                        onValueChange={(value) =>
                                                            setForm((previous) => ({
                                                                ...previous,
                                                                personalAccountId:
                                                                    value === 'none' ? undefined : value,
                                                                categoryId:
                                                                    value === 'none' ? undefined : previous.categoryId,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Solo registrar en el espacio" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none" textValue="Solo registrar en el espacio">
                                                                <span className="flex items-center gap-2.5">
                                                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-muted">
                                                                        <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                                                    </span>
                                                                    <span className="text-sm text-muted-foreground">
                                                                        Solo registrar en el espacio
                                                                    </span>
                                                                </span>
                                                            </SelectItem>
                                                            {filteredAccounts.map((account: IAccount) => {
                                                                const meta = getAccountTypeMeta(account.type)
                                                                const Icon = meta.icon
                                                                return (
                                                                    <SelectItem
                                                                        key={extractId(account._id)}
                                                                        value={extractId(account._id) ?? ''}
                                                                        textValue={account.name}
                                                                    >
                                                                        <span className="flex items-center gap-2.5">
                                                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-muted">
                                                                                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                            </span>
                                                                            <span>
                                                                                <span className="block text-sm font-medium leading-tight">
                                                                                    {account.name}
                                                                                </span>
                                                                                <span className="block text-xs leading-tight text-muted-foreground">
                                                                                    {meta.label} · {account.currency}
                                                                                </span>
                                                                            </span>
                                                                        </span>
                                                                    </SelectItem>
                                                                )
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </SpaceDialogField>

                                                {filteredAccounts.length === 0 ? (
                                                    <p className="rounded-[18px] border border-warning-soft bg-warning-soft/40 px-3 py-2 text-xs text-warning-foreground">
                                                        Para impactarlo en Finp personal vas a necesitar registrarlo en una moneda compatible o resolverlo con una conversión.
                                                    </p>
                                                ) : null}

                                                {form.personalAccountId ? (
                                                    <SpaceDialogField
                                                        label="Categoría personal"
                                                        hint="Solo impacta en tu Finp personal. La categoría del espacio se conserva aparte."
                                                    >
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
                                                                {personalExpenseCategories.map((category: ICategory) => (
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
                                                ) : null}

                                                <p className="text-xs text-muted-foreground">
                                                    Elegí una cuenta o tarjeta si querés impactarlo también en tu Finp personal.
                                                </p>
                                            </div>
                                        </SpaceDialogPanel>
                                    ) : null}

                                    {/* Adjuntos */}
                                    <SpaceAttachmentsUploader
                                        attachments={attachments}
                                        onFilesSelected={handleFilesSelected}
                                        onRemove={handleRemoveAttachment}
                                    />

                                    {/* Borrador */}
                                    <SpaceDialogPanel>
                                        <div className="space-y-3">
                                            <SpaceDialogSectionEyebrow>Borrador</SpaceDialogSectionEyebrow>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="w-full justify-start rounded-full text-muted-foreground"
                                                onClick={handleSaveDraft}
                                                disabled={submitting}
                                            >
                                                <Save className="h-4 w-4" />
                                                Guardar borrador local
                                            </Button>
                                        </div>
                                    </SpaceDialogPanel>
                                </div>
                            </div>

                            {/* Notas */}
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

                    {/* ── Footer ── */}
                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 sm:px-6">
                        <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Guardar gasto'}
                        </Button>
                        <Button
                            variant="ghost"
                            className="rounded-full"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancelar
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
