'use client'

import { Check } from 'lucide-react'
import { SpaceAmountInline, SpaceInitialsAvatar, SpaceTonePill } from '@/components/spaces/SpaceUi'
import { SpaceDialogChoice, SpaceDialogField, SpaceDialogPanel, SpaceDialogSectionEyebrow } from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { Input } from '@/components/ui/input'
import { SPACE_ROLE_LABELS, extractId } from '@/lib/utils/spaces'
import { cn } from '@/lib/utils'
import type { ISpaceParticipant } from '@/types'
import type { SpaceEntryFormData } from '@/lib/validations'

type SplitPreset = 'none' | 'equal' | 'half' | '6040' | 'custom'

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
            amount: 0,
            percentage: 0,
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

export function SpaceSplitConfigurator({
    participants,
    amount,
    currency,
    selectedParticipantIds,
    splitMode,
    allocations,
    onToggleParticipant,
    onApplyPreset,
    onAllocationChange,
}: {
    participants: ISpaceParticipant[]
    amount: number
    currency: string
    selectedParticipantIds: string[]
    splitMode: SpaceEntryFormData['splitMode']
    allocations?: SpaceEntryFormData['splitAllocations']
    onToggleParticipant: (participantId: string) => void
    onApplyPreset: (preset: SplitPreset) => void
    onAllocationChange: (
        participantId: string,
        field: 'percentage' | 'amount',
        value: string
    ) => void
}) {
    const selectedParticipants = participants.filter((participant) =>
        selectedParticipantIds.includes(extractId(participant._id) ?? '')
    )
    const twoWaySplit = selectedParticipants.length === 2
    const configuredTotal =
        splitMode === 'percentage'
            ? (allocations ?? []).reduce((acc, item) => acc + (item.percentage ?? 0), 0)
            : splitMode === 'fixed'
                ? (allocations ?? []).reduce((acc, item) => acc + (item.amount ?? 0), 0)
                : amount
    const matchesTarget =
        splitMode === 'percentage'
            ? Math.abs(configuredTotal - 100) < 0.01
            : splitMode === 'fixed'
                ? Math.abs(configuredTotal - amount) < 0.01
                : true

    return (
        <SpaceDialogPanel>
            <div className="space-y-4">
                <div className="space-y-1">
                    <SpaceDialogSectionEyebrow>Split</SpaceDialogSectionEyebrow>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        Cómo se reparte este movimiento
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Elegí una lógica rápida o pasá a un reparto personalizado con preview inmediato.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <SpaceDialogChoice active={splitMode === 'none'} onClick={() => onApplyPreset('none')}>
                        Sin split
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'percentage' && allocations?.[0]?.percentage === 50}
                        onClick={() => onApplyPreset('half')}
                        disabled={!twoWaySplit}
                    >
                        50/50
                    </SpaceDialogChoice>
                    <SpaceDialogChoice
                        active={splitMode === 'percentage' && allocations?.[0]?.percentage === 60}
                        onClick={() => onApplyPreset('6040')}
                        disabled={!twoWaySplit}
                    >
                        60/40
                    </SpaceDialogChoice>
                    {selectedParticipants.length > 2 ? (
                        <SpaceDialogChoice active={splitMode === 'equal'} onClick={() => onApplyPreset('equal')}>
                            Partes iguales
                        </SpaceDialogChoice>
                    ) : null}
                    <SpaceDialogChoice
                        active={splitMode === 'percentage' || splitMode === 'fixed'}
                        onClick={() => onApplyPreset('custom')}
                    >
                        Personalizado
                    </SpaceDialogChoice>
                </div>

                {splitMode !== 'none' ? (
                    <>
                        <div className="space-y-2">
                            <SpaceDialogField
                                label="Participantes incluidos"
                                hint="Tocá para sumar o sacar participantes del reparto."
                            >
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {participants.map((participant) => {
                                        const participantId = extractId(participant._id) ?? ''
                                        const checked = selectedParticipantIds.includes(participantId)

                                        return (
                                            <button
                                                key={participantId}
                                                type="button"
                                                onClick={() => onToggleParticipant(participantId)}
                                                className={cn(
                                                    'flex items-center justify-between rounded-[22px] border px-3 py-3 text-left transition-colors',
                                                    checked
                                                        ? 'border-primary/20 bg-primary/8'
                                                        : 'border-border bg-background/70 hover:bg-accent/25'
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <SpaceInitialsAvatar name={participant.displayName} className="h-9 w-9" />
                                                    <div>
                                                        <p className="font-medium text-foreground">{participant.displayName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {SPACE_ROLE_LABELS[participant.role]}
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
                        </div>

                        {(splitMode === 'percentage' || splitMode === 'fixed') && (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {selectedParticipants.map((participant) => {
                                    const participantId = extractId(participant._id) ?? ''
                                    const allocation = allocations?.find((item) => item.participantId === participantId)

                                    return (
                                        <SpaceDialogField
                                            key={participantId}
                                            label={`${participant.displayName} · ${splitMode === 'percentage' ? '%' : 'Monto'}`}
                                        >
                                            <Input
                                                value={
                                                    splitMode === 'percentage'
                                                        ? allocation?.percentage ?? ''
                                                        : allocation?.amount ?? ''
                                                }
                                                onChange={(event) =>
                                                    onAllocationChange(
                                                        participantId,
                                                        splitMode === 'percentage' ? 'percentage' : 'amount',
                                                        event.target.value
                                                    )
                                                }
                                                placeholder={splitMode === 'percentage' ? '50' : '22500'}
                                            />
                                        </SpaceDialogField>
                                    )
                                })}
                            </div>
                        )}

                        <div className="rounded-[24px] border border-foreground/[0.07] bg-background/74 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">Preview del reparto</p>
                                    <p className="text-xs text-muted-foreground">
                                        Se calcula sobre el monto actual del movimiento.
                                    </p>
                                </div>

                                <SpaceTonePill positive={matchesTarget}>
                                    {splitMode === 'percentage'
                                        ? `${configuredTotal.toFixed(2)}%`
                                        : `${configuredTotal.toFixed(2)} ${currency}`}
                                </SpaceTonePill>
                            </div>

                            <div className="mt-4 space-y-3">
                                {selectedParticipants.map((participant) => {
                                    const participantId = extractId(participant._id) ?? ''
                                    const preview = resolvePreviewValue({
                                        participantId,
                                        amount,
                                        splitMode,
                                        selectedParticipantIds,
                                        allocations,
                                    })

                                    return (
                                        <div
                                            key={participantId}
                                            className="flex items-center justify-between gap-3 rounded-[20px] border border-foreground/[0.06] bg-card/70 px-3 py-3"
                                        >
                                            <div className="flex items-center gap-3">
                                                <SpaceInitialsAvatar name={participant.displayName} className="h-8 w-8" />
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{participant.displayName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {preview.percentage.toFixed(0)}%
                                                    </p>
                                                </div>
                                            </div>

                                            <SpaceAmountInline
                                                amount={preview.amount}
                                                currency={currency}
                                                hidden={false}
                                                className="text-sm font-semibold"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="rounded-[24px] border border-dashed border-border bg-background/60 px-4 py-6 text-sm text-muted-foreground">
                        Este movimiento no se va a dividir: el impacto queda concentrado en quien paga.
                    </div>
                )}
            </div>
        </SpaceDialogPanel>
    )
}
