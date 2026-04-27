'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { SpaceAmountInline, SpaceInitialsAvatar, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { SpaceDialogChoice, SpaceDialogField, SpaceDialogPanel, SpaceDialogSectionEyebrow } from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { Input } from '@/components/ui/input'
import { SPACE_ROLE_LABELS, extractId } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { ISpaceParticipant } from '@/types'
import type { SpaceEntryFormData } from '@/lib/validations'

type SplitPreset = 'none' | 'equal' | 'half' | '6040' | 'custom'
type SplitAllocation = NonNullable<SpaceEntryFormData['splitAllocations']>[number]

function round2(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100
}

function getParticipantId(participant: ISpaceParticipant) {
    return extractId(participant._id) ?? ''
}

function getPercentage(allocations: SpaceEntryFormData['splitAllocations'], participantId: string) {
    return allocations?.find((item) => item.participantId === participantId)?.percentage ?? 0
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
        return {
            amount,
            percentage: 100,
        }
    }

    if (splitMode === 'equal') {
        const count = selectedParticipantIds.length || 1
        return {
            amount: amount / count,
            percentage: 100 / count,
        }
    }

    const allocation = allocations?.find((item) => item.participantId === participantId)

    if (splitMode === 'percentage') {
        const percentage = allocation?.percentage ?? 0
        return {
            amount: amount * (percentage / 100),
            percentage,
        }
    }

    if (splitMode === 'fixed') {
        const allocationAmount = allocation?.amount ?? 0
        return {
            amount: allocationAmount,
            percentage: amount > 0 ? (allocationAmount / amount) * 100 : 0,
        }
    }

    return {
        amount: 0,
        percentage: 0,
    }
}

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
            ? participants.filter((participant) => getParticipantId(participant) === responsibleParticipantId)
            : participants.filter((participant) => selectedParticipantIds.includes(getParticipantId(participant)))
    const paidByParticipant = participants.find((participant) => getParticipantId(participant) === paidByParticipantId)
    const responsibleParticipant = selectedParticipants[0]
    const configuredTotal =
        splitMode === 'percentage'
            ? round2((allocations ?? []).reduce((acc, item) => acc + (item.percentage ?? 0), 0))
            : splitMode === 'fixed'
                ? round2((allocations ?? []).reduce((acc, item) => acc + (item.amount ?? 0), 0))
                : 100
    const difference =
        splitMode === 'percentage'
            ? round2(configuredTotal - 100)
            : splitMode === 'fixed'
                ? round2(configuredTotal - amount)
                : 0
    const complete = Math.abs(difference) < 0.01
    const statusLabel =
        splitMode === 'none' && responsibleParticipant
            ? paidByParticipant && getParticipantId(paidByParticipant) !== getParticipantId(responsibleParticipant)
                ? `${responsibleParticipant.displayName} absorbe el 100%. Si pagó ${paidByParticipant.displayName}, ${responsibleParticipant.displayName} le debe el total.`
                : `${responsibleParticipant.displayName} absorbe el 100%. El gasto queda saldado.`
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
                    {splitMode === 'fixed' ? `${configuredTotal.toFixed(2)} ${currency}` : `${configuredTotal.toFixed(2)}%`}
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

                    return (
                        <div key={participantId} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex min-w-0 items-center gap-2">
                                <SpaceInitialsAvatar name={participant.displayName} className="h-7 w-7 text-[10px]" />
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{participant.displayName}</p>
                                    <p className="text-xs text-muted-foreground">{preview.percentage.toFixed(2)}%</p>
                                </div>
                            </div>
                            <SpaceAmountInline
                                amount={preview.amount}
                                currency={currency}
                                hidden={false}
                                className="shrink-0 text-sm font-semibold"
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

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
    onAllocationChange,
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
    onApplyPreset: (preset: SplitPreset) => void
    onAllocationChange: (
        participantId: string,
        field: 'percentage' | 'amount',
        value: string
    ) => void
    onAllocationsChange: (allocations: SplitAllocation[]) => void
}) {
    const [manualPercentages, setManualPercentages] = useState<Set<string>>(new Set())
    const selectedParticipants = useMemo(
        () => participants.filter((participant) => selectedParticipantIds.includes(getParticipantId(participant))),
        [participants, selectedParticipantIds]
    )
    const responsibleParticipantId = selectedParticipantIds[0] ?? paidByParticipantId ?? getParticipantId(participants[0])
    const twoWaySplit = selectedParticipants.length === 2
    const configuredTotal =
        splitMode === 'percentage'
            ? round2((allocations ?? []).reduce((acc, item) => acc + (item.percentage ?? 0), 0))
            : splitMode === 'fixed'
                ? round2((allocations ?? []).reduce((acc, item) => acc + (item.amount ?? 0), 0))
                : 100
    const splitInvalid =
        splitMode === 'percentage'
            ? Math.abs(configuredTotal - 100) > 0.01
            : splitMode === 'fixed'
                ? Math.abs(configuredTotal - amount) > 0.01
                : false

    const applyPreset = (preset: SplitPreset) => {
        setManualPercentages(new Set())
        onApplyPreset(preset)
    }

    const handleSmartPercentageChange = (participantId: string, value: string) => {
        const index = selectedParticipants.findIndex((participant) => getParticipantId(participant) === participantId)
        if (index < 0) return

        const count = selectedParticipants.length
        if (count === 0) return

        const parsed = Number(value.replace(',', '.'))
        const rawValue = Number.isFinite(parsed) ? parsed : 0

        if (count === 1) {
            onAllocationsChange([{ participantId, percentage: 100 }])
            return
        }

        if (count === 2) {
            const clamped = round2(Math.max(0, Math.min(100, rawValue)))
            const otherIndex = index === 0 ? 1 : 0
            const next = selectedParticipants.map((participant, itemIndex) => ({
                participantId: getParticipantId(participant),
                percentage:
                    itemIndex === index
                        ? clamped
                        : itemIndex === otherIndex
                            ? round2(100 - clamped)
                            : 0,
            }))
            setManualPercentages(new Set([participantId]))
            onAllocationsChange(next)
            return
        }

        if (index === count - 1) return

        const current = selectedParticipants.map((participant) => {
            const id = getParticipantId(participant)
            return {
                participantId: id,
                percentage: getPercentage(allocations, id),
            }
        })
        const upperSum = round2(current.slice(0, index).reduce((acc, item) => acc + item.percentage, 0))
        const maxAllowed = round2(Math.max(0, 100 - upperSum))
        const clamped = round2(Math.max(0, Math.min(maxAllowed, rawValue)))
        const remaining = round2(100 - upperSum - clamped)
        const lowerCount = count - index - 1
        const lowerBase = lowerCount > 0 ? round2(remaining / lowerCount) : 0
        let lowerAssigned = 0
        const next = current.map((item, itemIndex) => {
            if (itemIndex < index) return item
            if (itemIndex === index) return { ...item, percentage: clamped }
            if (itemIndex === count - 1) {
                return { ...item, percentage: round2(remaining - lowerAssigned) }
            }
            lowerAssigned = round2(lowerAssigned + lowerBase)
            return { ...item, percentage: lowerBase }
        })

        setManualPercentages((previous) => {
            const nextManual = new Set(previous)
            nextManual.add(participantId)
            selectedParticipants.slice(index + 1).forEach((participant) => {
                nextManual.delete(getParticipantId(participant))
            })
            return nextManual
        })
        onAllocationsChange(next)
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
                        Elegí una lógica rápida o usá Smart para completar el 100% sin cuentas manuales.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <SpaceDialogChoice active={splitMode === 'equal'} onClick={() => applyPreset('equal')}>
                        Partes iguales
                    </SpaceDialogChoice>
                    <SpaceDialogChoice active={splitMode === 'none'} onClick={() => applyPreset('none')}>
                        Responsable único
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'percentage' && allocations?.[0]?.percentage === 50}
                        onClick={() => applyPreset('half')}
                        disabled={!twoWaySplit}
                    >
                        50/50
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'percentage' && allocations?.[0]?.percentage === 60}
                        onClick={() => applyPreset('6040')}
                        disabled={!twoWaySplit}
                    >
                        60/40
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'percentage' && Boolean(allocations?.some((item) => typeof item.percentage === 'number'))}
                        onClick={() => applyPreset('custom')}
                    >
                        Personalizado / Smart
                    </SpaceDialogChoice>
                </div>

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
                                            <SpaceInitialsAvatar name={participant.displayName} className="h-9 w-9" />
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-foreground">{participant.displayName}</p>
                                                <p className="text-xs text-muted-foreground">{SPACE_ROLE_LABELS[participant.role]}</p>
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
                                                <SpaceInitialsAvatar name={participant.displayName} className="h-9 w-9" />
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">{participant.displayName}</p>
                                                    <p className="text-xs text-muted-foreground">{SPACE_ROLE_LABELS[participant.role]}</p>
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

                        {splitMode === 'percentage' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {selectedParticipants.map((participant, index) => {
                                    const participantId = getParticipantId(participant)
                                    const lastResidual = selectedParticipants.length >= 3 && index === selectedParticipants.length - 1
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
                                                onChange={(event) => handleSmartPercentageChange(participantId, event.target.value)}
                                                disabled={lastResidual || selectedParticipants.length === 1}
                                                inputMode="decimal"
                                                placeholder="50"
                                            />
                                        </SpaceDialogField>
                                    )
                                })}
                            </div>
                        ) : null}

                        {splitMode === 'fixed' ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {selectedParticipants.map((participant) => {
                                    const participantId = getParticipantId(participant)
                                    const allocation = allocations?.find((item) => item.participantId === participantId)

                                    return (
                                        <SpaceDialogField key={participantId} label={`${participant.displayName} · Monto`}>
                                            <Input
                                                value={allocation?.amount ?? ''}
                                                onChange={(event) => onAllocationChange(participantId, 'amount', event.target.value)}
                                                placeholder="22500"
                                            />
                                        </SpaceDialogField>
                                    )
                                })}
                            </div>
                        ) : null}
                    </>
                )}

                {splitInvalid ? (
                    <p className="rounded-[18px] border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        El reparto tiene que cerrar en 100% antes de guardar.
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
