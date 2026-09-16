'use client'

import {
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

/**
 * Notas del movimiento. Lo usan el paso «Extras» del alta y la edición.
 *
 * El encabezado del panel ya nombra la sección, así que el textarea toma su
 * nombre accesible de `aria-label` en vez de repetir un label visible.
 */
export function SpaceEntryNotesPanel({
    notes,
    onNotesChange,
}: {
    notes: string
    onNotesChange: (value: string) => void
}) {
    return (
        <SpaceDialogPanel>
            <div className="space-y-3">
                <div className="space-y-1">
                    <SpaceDialogSectionEyebrow>Notas</SpaceDialogSectionEyebrow>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        Contexto adicional
                    </h3>
                </div>
                <SpaceDialogTextArea
                    id="entry-notes"
                    aria-label="Notas del movimiento"
                    value={notes}
                    onChange={(event) => onNotesChange(event.target.value)}
                    rows={4}
                    placeholder="Notas internas, contexto o recordatorios útiles para el equipo."
                />
            </div>
        </SpaceDialogPanel>
    )
}
