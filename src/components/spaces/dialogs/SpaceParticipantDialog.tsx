'use client'

import { useEffect, useState } from 'react'
import { spaceParticipantSchema, type SpaceParticipantFormData } from '@/lib/validations'
import { SPACE_ROLE_LABELS } from '@/lib/utils/spaces'
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
    SpaceDialogChoice,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

const INITIAL_FORM: SpaceParticipantFormData = {
    kind: 'finp_user',
    displayName: '',
    email: '',
    role: 'participant',
}

export function SpaceParticipantDialog({
    open,
    onOpenChange,
    onSubmit,
}: DialogProps & {
    onSubmit: (data: SpaceParticipantFormData) => Promise<unknown>
}) {
    const [form, setForm] = useState<SpaceParticipantFormData>(INITIAL_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setForm(INITIAL_FORM)
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
            setError(err instanceof Error ? err.message : 'No pudimos agregar al participante.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[620px] gap-0 overflow-hidden p-0 sm:max-h-[92vh] sm:max-w-[620px]"
            >
                <div className="flex h-full flex-col">
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl tracking-tight">Invitar participante</DialogTitle>
                            <DialogDescription>
                                Sumá una persona al espacio con un rol claro y una experiencia más ordenada de invitación.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            <SpaceDialogPanel>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Tipo de participante</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Cómo querés incorporarlo
                                        </h3>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <SpaceDialogChoice
                                            active={form.kind === 'finp_user'}
                                            onClick={() =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    kind: 'finp_user',
                                                }))
                                            }
                                        >
                                            Usuario Finp
                                        </SpaceDialogChoice>
                                        <SpaceDialogChoice
                                            active={form.kind === 'external'}
                                            onClick={() =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    kind: 'external',
                                                }))
                                            }
                                        >
                                            Externo
                                        </SpaceDialogChoice>
                                    </div>
                                </div>
                            </SpaceDialogPanel>

                            <SpaceDialogPanel>
                                <div className="grid gap-4">
                                    <SpaceDialogField label="Nombre visible">
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
                                    </SpaceDialogField>

                                    <SpaceDialogField
                                        label={form.kind === 'finp_user' ? 'Email de invitación' : 'Email opcional'}
                                    >
                                        <Input
                                            value={form.email ?? ''}
                                            onChange={(event) =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    email: event.target.value,
                                                }))
                                            }
                                            placeholder="persona@finp.app"
                                        />
                                    </SpaceDialogField>

                                    <SpaceDialogField label="Rol">
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
                                                {Object.entries(SPACE_ROLE_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </SpaceDialogField>
                                </div>
                            </SpaceDialogPanel>

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
                            {submitting ? 'Guardando...' : 'Agregar participante'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
