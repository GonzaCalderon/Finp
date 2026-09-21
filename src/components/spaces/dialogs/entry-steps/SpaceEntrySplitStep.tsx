'use client'

import { SpaceSplitConfigurator } from '@/components/spaces/dialogs/SpaceSplitConfigurator'
import type { SpaceEntryFormData } from '@/lib/validations'
import type { ISpaceParticipant } from '@/types'

/**
 * Paso «Reparto». Sólo existe en un Espacio compartido: en uno `solo` no hay
 * nada que repartir y el paso ni siquiera se construye (`buildSpaceEntrySteps`).
 */
export function SpaceEntrySplitStep({
    participants,
    amount,
    currency,
    paidByParticipantId,
    selectedParticipantIds,
    splitMode,
    allocations,
    error,
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
    allocations: SpaceEntryFormData['splitAllocations']
    error?: string
    onToggleParticipant: (participantId: string) => void
    onResponsibleChange: (participantId: string) => void
    onApplyPreset: (preset: SpaceEntryFormData['splitMode']) => void
    onAllocationsChange: (allocations: NonNullable<SpaceEntryFormData['splitAllocations']>) => void
}) {
    return (
        <div>
            <SpaceSplitConfigurator
                participants={participants}
                amount={amount}
                currency={currency}
                paidByParticipantId={paidByParticipantId}
                selectedParticipantIds={selectedParticipantIds}
                splitMode={splitMode}
                allocations={allocations}
                onToggleParticipant={onToggleParticipant}
                onResponsibleChange={onResponsibleChange}
                onApplyPreset={onApplyPreset}
                onAllocationsChange={onAllocationsChange}
            />
            {error ? (
                <p className="mt-2 text-xs font-medium text-destructive" tabIndex={-1}>
                    {error}
                </p>
            ) : null}
        </div>
    )
}
