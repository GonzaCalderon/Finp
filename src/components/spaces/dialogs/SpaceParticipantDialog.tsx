'use client'

import { useEffect, useState } from 'react'
import { ShieldCheck, UserRound, UsersRound } from 'lucide-react'
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
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl tracking-tight">Invitar participante</DialogTitle>
                            <DialogDescription>
                                Sumá una persona al espacio con un rol claro y una experiencia más ordenada de invitación.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            <SpaceDialogPanel>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Tipo de participante</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Cómo querés incorporarlo
                                        </h3>
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {[
                                            {
                                                key: 'finp_user' as const,
                                                title: 'Usuario Finp',
                                                desc: 'Recibe invitación y puede operar dentro de la app.',
                                                icon: UserRound,
                                            },
                                            {
                                                key: 'external' as const,
                                                title: 'Externo',
                                                desc: 'Queda registrado para balances sin requerir cuenta.',
                                                icon: UsersRound,
                                            },
                                        ].map((option) => {
                                            const Icon = option.icon
                                            const active = form.kind === option.key

                                            return (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    onClick={() =>
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            kind: option.key,
                                                        }))
                                                    }
                                                    className={[
                                                        'flex items-start gap-3 rounded-[18px] border p-3 text-left transition-colors',
                                                        active
                                                            ? 'border-primary/25 bg-primary/10 text-primary'
                                                            : 'border-border bg-background/80 text-muted-foreground hover:text-foreground',
                                                    ].join(' ')}
                                                >
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-card">
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold">{option.title}</p>
                                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                                            {option.desc}
                                                        </p>
                                                    </div>
                                                </button>
                                            )
                                        })}
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
                                        <div className="mt-2 rounded-[18px] border border-foreground/[0.07] bg-background/70 p-3 text-xs text-muted-foreground">
                                            <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                                                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                                {SPACE_ROLE_LABELS[form.role]}
                                            </div>
                                            {form.role === 'admin'
                                                ? 'Puede invitar participantes y cambiar configuración del espacio.'
                                                : form.role === 'owner'
                                                    ? 'Tiene control total del espacio.'
                                                    : 'Puede participar en movimientos, splits y balances.'}
                                        </div>
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

                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 sm:px-6">
                        <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button className="rounded-full" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Guardando...' : 'Agregar participante'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
