'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Link2, Loader2, RefreshCw, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
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
import { useSpaceInvites } from '@/hooks/useSpaceInvites'

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
    spaceId,
    canManage,
    spaceMode,
}: DialogProps & {
    onSubmit: (data: SpaceParticipantFormData) => Promise<unknown>
    spaceId?: string
    canManage?: boolean
    spaceMode?: string
}) {
    const [form, setForm] = useState<SpaceParticipantFormData>(INITIAL_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canManageLinks = canManage && spaceMode !== 'solo'
    const { state: linkState, loading: linkLoading, createLink } = useSpaceInvites(
        canManageLinks ? spaceId : undefined
    )
    const [linkBusy, setLinkBusy] = useState(false)
    const [copied, setCopied] = useState(false)
    const [lastUrl, setLastUrl] = useState<string | null>(null)

    const visibleUrl = lastUrl ?? linkState?.inviteUrl ?? null
    const hasActiveLink = Boolean(linkState?.hasActiveInvite && linkState?.invite)
    const expiresLabel = useMemo(() => {
        const raw = linkState?.invite?.expiresAt
        if (!raw) return null
        return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(raw))
    }, [linkState?.invite?.expiresAt])

    const generateLink = async (regenerate = false) => {
        setLinkBusy(true)
        try {
            const result = await createLink({ expiresInDays: 7, regenerate })
            setLastUrl(result.inviteUrl ?? null)
        } finally {
            setLinkBusy(false)
        }
    }

    const copyLink = async () => {
        if (!visibleUrl) return
        await navigator.clipboard.writeText(visibleUrl)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
    }

    useEffect(() => {
        if (!open) return
        setForm(INITIAL_FORM)
        setSubmitting(false)
        setError(null)
        setLastUrl(null)
        setCopied(false)
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
                            {canManageLinks && spaceId && (
                                <SpaceDialogPanel>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <SpaceDialogSectionEyebrow>Invitar por link</SpaceDialogSectionEyebrow>
                                                <p className="text-sm font-semibold">Link compartible</p>
                                            </div>
                                            {linkLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                                        </div>

                                        {!linkLoading && hasActiveLink && visibleUrl && (
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                                                        <span className="block truncate">{visibleUrl}</span>
                                                    </div>
                                                    <Button type="button" size="icon" variant="secondary" onClick={copyLink} disabled={linkBusy}>
                                                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                                                    </Button>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    {expiresLabel && (
                                                        <p className="text-xs text-muted-foreground">Vence: {expiresLabel}</p>
                                                    )}
                                                    <Button type="button" size="sm" variant="ghost" onClick={() => generateLink(true)} disabled={linkBusy} className="h-7 gap-1.5 px-2 text-xs">
                                                        {linkBusy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                                                        Regenerar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {!linkLoading && hasActiveLink && !visibleUrl && (
                                            <div className="space-y-2">
                                                <p className="text-sm text-muted-foreground">Hay un link activo. Regeneralo para copiarlo.</p>
                                                <Button type="button" size="sm" variant="secondary" onClick={() => generateLink(true)} disabled={linkBusy} className="gap-1.5">
                                                    {linkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                                                    Regenerar
                                                </Button>
                                            </div>
                                        )}

                                        {!linkLoading && !hasActiveLink && (
                                            <div className="space-y-2">
                                                <p className="text-sm text-muted-foreground">Generá un link temporal para que otros puedan unirse.</p>
                                                <Button type="button" size="sm" onClick={() => generateLink(false)} disabled={linkBusy} className="gap-1.5">
                                                    {linkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                                                    Generar link
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </SpaceDialogPanel>
                            )}

                            <SpaceDialogPanel>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Invitar directamente</SpaceDialogSectionEyebrow>
                                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                                            Tipo de participante
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
