'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { SpaceAmountInline, SpaceInitialsAvatar, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { SpaceDialogChoice, SpaceDialogField, SpaceDialogPanel, SpaceDialogSectionEyebrow } from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { Input } from '@/components/ui/input'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { SPACE_ROLE_LABELS, extractId } from '@/lib/utils/spaces'
import {
    applySmartFixed,
    applySmartPercentage,
    currencyAmountsEqual,
    round2,
    roundCurrency,
    sumCurrencyAmounts,
} from '@/lib/utils/space-split'
import { calculateSpaceSharesV2 } from '@/lib/utils/space-financial-v2'
import { getCurrencyScale } from '@/lib/constants/iso-currencies'
import { cn } from '@/lib/utils'
import type { ISpaceParticipant } from '@/types'
import type { SpaceEntryFormData } from '@/lib/validations'

type SplitAllocation = NonNullable<SpaceEntryFormData['splitAllocations']>[number]

function getParticipantId(participant: ISpaceParticipant) {
    return extractId(participant._id) ?? ''
}

function getPercentage(allocations: SpaceEntryFormData['splitAllocations'], participantId: string) {
    return allocations?.find((item) => item.participantId === participantId)?.percentage ?? 0
}

function getAmount(allocations: SpaceEntryFormData['splitAllocations'], participantId: string) {
    return allocations?.find((item) => item.participantId === participantId)?.amount ?? 0
}

function formatAmount(value: number, currency: string) {
    const scale = getCurrencyScale(currency) ?? 2
    return value.toLocaleString('es-AR', {
        minimumFractionDigits: scale,
        maximumFractionDigits: scale,
    })
}

function resolvePreviewValue({
    participantId,
    amount,
    splitMode,
    selectedParticipantIds,
    allocations,
}: {
    participantId: string
    amount: number
    splitMode: SpaceEntryFormData['splitMode']
    selectedParticipantIds: string[]
    allocations?: SpaceEntryFormData['splitAllocations']
}) {
    if (splitMode === 'none') {
        return { amount, percentage: 100 }
    }

    if (splitMode === 'equal') {
        const count = selectedParticipantIds.length || 1
        return { amount: amount / count, percentage: 100 / count }
    }

    const allocation = allocations?.find((item) => item.participantId === participantId)

    if (splitMode === 'percentage') {
        const percentage = allocation?.percentage ?? 0
        return { amount: amount * (percentage / 100), percentage }
    }

    if (splitMode === 'fixed') {
        const allocationAmount = allocation?.amount ?? 0
        return {
            amount: allocationAmount,
            percentage: amount > 0 ? (allocationAmount / amount) * 100 : 0,
        }
    }

    return { amount: 0, percentage: 0 }
}

// ── Preview bar ───────────────────────────────────────────────────────────────

export function SpaceSplitPreviewBar({
    participants,
    amount,
    currency,
    splitMode,
    selectedParticipantIds,
    allocations,
    paidByParticipantId,
    responsibleParticipantId,
}: {
    participants: ISpaceParticipant[]
    amount: number
    currency: string
    splitMode: SpaceEntryFormData['splitMode']
    selectedParticipantIds: string[]
    allocations?: SpaceEntryFormData['splitAllocations']
    paidByParticipantId?: string
    responsibleParticipantId?: string
}) {
    const selectedParticipants =
        splitMode === 'none'
            ? participants.filter((p) => getParticipantId(p) === responsibleParticipantId)
            : participants.filter((p) => selectedParticipantIds.includes(getParticipantId(p)))

    const paidByParticipant = participants.find((p) => getParticipantId(p) === paidByParticipantId)
    const responsibleParticipant = selectedParticipants[0]
    const exactShares = useMemo(() => {
        try {
            return new Map(calculateSpaceSharesV2({
                amount,
                reportingAmount: amount,
                currency,
                reportingCurrency: currency,
                splitMode,
                participantIds: splitMode === 'none'
                    ? responsibleParticipantId ? [responsibleParticipantId] : []
                    : selectedParticipantIds,
                allocations,
            }).map((share) => [share.participantId, share.amount]))
        } catch {
            return new Map<string, number>()
        }
    }, [allocations, amount, currency, responsibleParticipantId, selectedParticipantIds, splitMode])

    const configuredTotal =
        splitMode === 'percentage'
            ? round2((allocations ?? []).reduce((acc, item) => acc + (item.percentage ?? 0), 0))
            : splitMode === 'fixed'
                ? sumCurrencyAmounts((allocations ?? []).map((item) => item.amount ?? 0), currency)
                : 100

    const difference =
        splitMode === 'percentage'
            ? round2(configuredTotal - 100)
            : splitMode === 'fixed'
                ? roundCurrency(configuredTotal - amount, currency)
                : 0

    const complete = splitMode === 'fixed'
        ? currencyAmountsEqual(configuredTotal, amount, currency)
        : Math.abs(difference) < 0.01

    const statusLabel =
        splitMode === 'none' && responsibleParticipant
            ? paidByParticipant &&
              getParticipantId(paidByParticipant) !== getParticipantId(responsibleParticipant)
                ? `${responsibleParticipant.displayName} absorbe el 100%. Si pagó ${paidByParticipant.displayName}, ${responsibleParticipant.displayName} le debe el total.`
                : `${responsibleParticipant.displayName} absorbe el 100%. El gasto queda saldado.`
            : splitMode === 'fixed'
                ? complete
                    ? 'Reparto completo'
                    : difference < 0
                        ? `Falta asignar ${currency} ${formatAmount(Math.abs(difference), currency)}`
                        : `Excede ${currency} ${formatAmount(difference, currency)}`
                : complete
                    ? 'Reparto completo: 100%'
                    : difference < 0
                        ? `Falta asignar ${Math.abs(difference).toFixed(2)}%`
                        : `Excede ${difference.toFixed(2)}%`

    return (
        <div className="rounded-[20px] border border-foreground/[0.07] bg-background/74 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">Preview del reparto</p>
                    <p className="text-xs text-muted-foreground">{statusLabel}</p>
                </div>
                <SpaceTonePill positive={complete}>
                    {splitMode === 'fixed'
                        ? `${formatAmount(configuredTotal, currency)} ${currency}`
                        : `${configuredTotal.toFixed(2)}%`}
                </SpaceTonePill>
            </div>

            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
                {selectedParticipants.map((participant, index) => {
                    const participantId = getParticipantId(participant)
                    const preview = resolvePreviewValue({
                        participantId,
                        amount,
                        splitMode,
                        selectedParticipantIds,
                        allocations,
                    })
                    return (
                        <span
                            key={participantId}
                            className="h-full min-w-[2px]"
                            style={{
                                width: `${Math.max(0, Math.min(100, preview.percentage))}%`,
                                background: `var(--chart-${(index % 5) + 1})`,
                            }}
                        />
                    )
                })}
            </div>

            <div className="mt-3 space-y-2">
                {selectedParticipants.map((participant) => {
                    const participantId = getParticipantId(participant)
                    const preview = resolvePreviewValue({
                        participantId,
                        amount,
                        splitMode,
                        selectedParticipantIds,
                        allocations,
                    })
                    const previewAmount = exactShares.get(participantId) ?? preview.amount
                    return (
                        <div key={participantId} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                                <SpaceInitialsAvatar name={participant.displayName} className="h-7 w-7 text-[10px]" />
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">
                                        {participant.displayName}{!participant.isActive ? ' · inactivo' : ''}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{preview.percentage.toFixed(2)}%</p>
                                </div>
                            </div>
                            <SpaceAmountInline
                                amount={previewAmount}
                                currency={currency}
                                hidden={false}
                                exact
                                className="shrink-0 text-sm font-semibold"
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Configurator ──────────────────────────────────────────────────────────────

export function SpaceSplitConfigurator({
    participants,
    amount,
    currency,
    paidByParticipantId,
    selectedParticipantIds,
    splitMode,
    allocations,
    onToggleParticipant,
    onResponsibleChange,
    onApplyPreset,
    onAllocationsChange,
}: {
    participants: ISpaceParticipant[]
    amount: number
    currency: string
    paidByParticipantId?: string
    selectedParticipantIds: string[]
    splitMode: SpaceEntryFormData['splitMode']
    allocations?: SpaceEntryFormData['splitAllocations']
    onToggleParticipant: (participantId: string) => void
    onResponsibleChange: (participantId: string) => void
    onApplyPreset: (preset: SpaceEntryFormData['splitMode']) => void
    onAllocationsChange: (allocations: SplitAllocation[]) => void
}) {
    const [manualPercentages, setManualPercentages] = useState<Set<string>>(new Set())
    const [manualAmounts, setManualAmounts] = useState<Set<string>>(new Set())

    const selectedParticipants = useMemo(
        () => participants.filter((p) => selectedParticipantIds.includes(getParticipantId(p))),
        [participants, selectedParticipantIds]
    )

    const responsibleParticipantId =
        selectedParticipantIds[0] ?? paidByParticipantId ?? getParticipantId(participants[0])

    const configuredTotal =
        splitMode === 'percentage'
            ? round2((allocations ?? []).reduce((acc, item) => acc + (item.percentage ?? 0), 0))
            : splitMode === 'fixed'
                ? roundCurrency((allocations ?? []).reduce((acc, item) => acc + (item.amount ?? 0), 0), currency)
                : 100

    const splitInvalid =
        splitMode === 'percentage'
            ? Math.abs(configuredTotal - 100) > 0.01
            : splitMode === 'fixed'
                ? !currencyAmountsEqual(configuredTotal, amount, currency)
                : false

    const applyPreset = (preset: SpaceEntryFormData['splitMode']) => {
        setManualPercentages(new Set())
        setManualAmounts(new Set())
        onApplyPreset(preset)
    }

    // ── Smart percentage ──────────────────────────────────────────────────────

    const handleSmartPercentageChange = (participantId: string, value: string) => {
        const parsed = Number(value.replace(',', '.'))
        const rawValue = Number.isFinite(parsed) ? parsed : 0

        const participantIds = selectedParticipants.map(getParticipantId)
        const currentAllocations = participantIds.map((id) => ({
            participantId: id,
            percentage: getPercentage(allocations, id),
        }))

        const result = applySmartPercentage(participantIds, currentAllocations, participantId, rawValue)
        if (!result) return

        const index = participantIds.indexOf(participantId)
        setManualPercentages((prev) => {
            const next = new Set(prev)
            next.add(participantId)
            if (participantIds.length >= 3) {
                participantIds.slice(index + 1).forEach((id) => next.delete(id))
            }
            return next
        })
        onAllocationsChange(result)
    }

    // ── Smart fixed ───────────────────────────────────────────────────────────

    const handleSmartFixedChange = (participantId: string, value: string) => {
        const parsed = Number(value.replace(',', '.'))
        const rawValue = Number.isFinite(parsed) ? parsed : 0

        const participantIds = selectedParticipants.map(getParticipantId)
        const currentAllocations = participantIds.map((id) => ({
            participantId: id,
            amount: getAmount(allocations, id),
        }))

        const result = applySmartFixed(
            participantIds,
            currentAllocations,
            participantId,
            rawValue,
            amount,
            currency
        )
        if (!result) return

        const index = participantIds.indexOf(participantId)
        setManualAmounts((prev) => {
            const next = new Set(prev)
            next.add(participantId)
            if (participantIds.length >= 3) {
                participantIds.slice(index + 1).forEach((id) => next.delete(id))
            }
            return next
        })
        onAllocationsChange(result)
    }

    return (
        <SpaceDialogPanel>
            <div className="space-y-4">
                <div className="space-y-1">
                    <SpaceDialogSectionEyebrow>Split</SpaceDialogSectionEyebrow>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        Cómo se reparte este gasto
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Elegí cómo dividir el gasto entre los participantes.
                    </p>
                </div>

                {/* ── Preset buttons ── */}
                <div className="flex flex-wrap gap-2">
                    <SpaceDialogChoice
                        active={splitMode === 'equal'}
                        onClick={() => applyPreset('equal')}
                    >
                        Partes iguales
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'none'}
                        onClick={() => applyPreset('none')}
                    >
                        Responsable único
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'percentage'}
                        onClick={() => applyPreset('percentage')}
                    >
                        Porcentajes
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'fixed'}
                        onClick={() => applyPreset('fixed')}
                    >
                        Montos fijos
                    </SpaceDialogChoice>
                </div>

                {/* ── Responsable único ── */}
                {splitMode === 'none' ? (
                    <SpaceDialogField
                        label="¿Quién es responsable?"
                        hint="Una sola persona absorbe el gasto. Si es distinta de quien pagó, se genera deuda hacia quien pagó; si es la misma, queda saldado."
                    >
                        <div className="grid gap-2 sm:grid-cols-2">
                            {participants.map((participant) => {
                                const participantId = getParticipantId(participant)
                                const checked = responsibleParticipantId === participantId

                                return (
                                    <button
                                        key={participantId}
                                        type="button"
                                        onClick={() => onResponsibleChange(participantId)}
                                        className={cn(
                                            'flex items-center justify-between rounded-[20px] border px-3 py-3 text-left transition-colors',
                                            checked
                                                ? 'border-primary/20 bg-primary/8'
                                                : 'border-border bg-background/70 hover:bg-accent/25'
                                        )}
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <SpaceInitialsAvatar
                                                name={participant.displayName}
                                                className="h-9 w-9"
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">
                                                    {participant.displayName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {participant.isActive
                                                        ? SPACE_ROLE_LABELS[participant.role]
                                                        : 'Inactivo · sólo historial'}
                                                </p>
                                            </div>
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
                    </SpaceDialogField>
                ) : (
                    <>
                        {/* ── Participant selector ── */}
                        <SpaceDialogField
                            label="Participantes incluidos"
                            hint="Toca para sumar o sacar participantes del reparto."
                        >
                            <div className="grid gap-2 sm:grid-cols-2">
                                {participants.map((participant) => {
                                    const participantId = getParticipantId(participant)
                                    const checked = selectedParticipantIds.includes(participantId)

                                    return (
                                        <button
                                            key={participantId}
                                            type="button"
                                            onClick={() => onToggleParticipant(participantId)}
                                            className={cn(
                                                'flex items-center justify-between rounded-[20px] border px-3 py-3 text-left transition-colors',
                                                checked
                                                    ? 'border-primary/20 bg-primary/8'
                                                    : 'border-border bg-background/70 hover:bg-accent/25'
                                            )}
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <SpaceInitialsAvatar
                                                    name={participant.displayName}
                                                    className="h-9 w-9"
                                                />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">
                                                        {participant.displayName}
                                                    </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {participant.isActive
                                                        ? SPACE_ROLE_LABELS[participant.role]
                                                        : 'Inactivo · sólo historial'}
                                                    </p>
                                                </div>
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
                        </SpaceDialogField>

                        {/* ── Porcentajes ── */}
                        {splitMode === 'percentage' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {selectedParticipants.map((participant, index) => {
                                    const participantId = getParticipantId(participant)
                                    const lastResidual =
                                        selectedParticipants.length >= 3 &&
                                        index === selectedParticipants.length - 1
                                    const twoPersonCalculated =
                                        selectedParticipants.length === 2 &&
                                        manualPercentages.size > 0 &&
                                        !manualPercentages.has(participantId)
                                    const percentage = getPercentage(allocations, participantId)

                                    return (
                                        <SpaceDialogField
                                            key={participantId}
                                            label={`${participant.displayName} · %`}
                                            hint={
                                                lastResidual
                                                    ? 'Resto · Completa el 100%'
                                                    : manualPercentages.has(participantId)
                                                        ? 'Manual'
                                                        : twoPersonCalculated
                                                            ? 'Calculado'
                                                            : 'Auto'
                                            }
                                        >
                                            <Input
                                                value={Number.isFinite(percentage) ? String(percentage) : ''}
                                                onChange={(event) =>
                                                    handleSmartPercentageChange(
                                                        participantId,
                                                        event.target.value
                                                    )
                                                }
                                                disabled={
                                                    lastResidual || selectedParticipants.length === 1
                                                }
                                                inputMode="decimal"
                                                placeholder="50"
                                            />
                                        </SpaceDialogField>
                                    )
                                })}
                            </div>
                        ) : null}

                        {/* ── Montos fijos ── */}
                        {splitMode === 'fixed' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {selectedParticipants.map((participant, index) => {
                                    const participantId = getParticipantId(participant)
                                    const allocation = allocations?.find(
                                        (item) => item.participantId === participantId
                                    )
                                    const lastResidual =
                                        selectedParticipants.length >= 3 &&
                                        index === selectedParticipants.length - 1
                                    const twoPersonCalculated =
                                        selectedParticipants.length === 2 &&
                                        manualAmounts.size > 0 &&
                                        !manualAmounts.has(participantId)
                                    // 1 participant → disabled, shows the full amount
                                    const isSingleParticipant = selectedParticipants.length === 1
                                    const displayValue = isSingleParticipant
                                        ? String(amount)
                                        : Number.isFinite(allocation?.amount)
                                            ? String(allocation?.amount)
                                            : ''

                                    return (
                                        <FormattedAmountInput
                                            key={participantId}
                                            id={`split-amount-${participantId}`}
                                            label={`${participant.displayName} · ${currency}`}
                                            helperText={
                                                lastResidual
                                                    ? 'Resto · Completa el total'
                                                    : isSingleParticipant
                                                        ? 'Absorbe el total'
                                                        : manualAmounts.has(participantId)
                                                            ? 'Manual'
                                                            : twoPersonCalculated
                                                                ? 'Calculado'
                                                                : 'Auto'
                                            }
                                            value={displayValue ? Number(displayValue) : undefined}
                                            currency={currency}
                                            disabled={lastResidual || isSingleParticipant}
                                            placeholder="22.500"
                                            onValueChangeAction={(value) =>
                                                handleSmartFixedChange(participantId, String(value))
                                            }
                                        />
                                    )
                                })}
                            </div>
                        ) : null}
                    </>
                )}

                {/* ── Validation message ── */}
                {splitInvalid ? (
                    <p className="rounded-[18px] border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {splitMode === 'fixed'
                            ? `El reparto tiene que cerrar en ${currency} ${formatAmount(amount, currency)} antes de guardar.`
                            : 'El reparto tiene que cerrar en 100% antes de guardar.'}
                    </p>
                ) : null}

                <SpaceSplitPreviewBar
                    participants={participants}
                    amount={amount}
                    currency={currency}
                    splitMode={splitMode}
                    selectedParticipantIds={selectedParticipantIds}
                    allocations={allocations}
                    paidByParticipantId={paidByParticipantId}
                    responsibleParticipantId={responsibleParticipantId}
                />
            </div>
        </SpaceDialogPanel>
    )
}
