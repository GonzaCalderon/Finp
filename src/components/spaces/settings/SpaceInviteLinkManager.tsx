'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Link2, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSpaceInvites } from '@/hooks/useSpaceInvites'

type SpaceInviteLinkManagerProps = {
    spaceId: string
    canManage: boolean
}

const DAY_OPTIONS = [
    { value: 1, label: '1 día' },
    { value: 3, label: '3 días' },
    { value: 7, label: '7 días' },
] as const

function formatDate(value?: string) {
    if (!value) return null
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

export function SpaceInviteLinkManager({ spaceId, canManage }: SpaceInviteLinkManagerProps) {
    const { state, loading, error, createLink, revokeLink } = useSpaceInvites(spaceId)
    const [expiresInDays, setExpiresInDays] = useState<1 | 3 | 7>(7)
    const [busy, setBusy] = useState(false)
    const [copied, setCopied] = useState(false)
    const [lastUrl, setLastUrl] = useState<string | null>(null)

    const invite = state?.invite
    const hasActiveInvite = Boolean(state?.hasActiveInvite && invite)
    const expiresLabel = useMemo(() => formatDate(invite?.expiresAt), [invite?.expiresAt])
    const visibleUrl = lastUrl ?? state?.inviteUrl ?? null

    const generate = async (regenerate = false) => {
        setBusy(true)
        setCopied(false)
        try {
            const result = await createLink({ expiresInDays, regenerate })
            setLastUrl(result.inviteUrl ?? null)
        } finally {
            setBusy(false)
        }
    }

    const copyLink = async () => {
        if (!visibleUrl) return
        await navigator.clipboard.writeText(visibleUrl)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
    }

    const revoke = async () => {
        if (!invite?.id) return
        setBusy(true)
        try {
            await revokeLink(invite.id)
            setLastUrl(null)
        } finally {
            setBusy(false)
        }
    }

    if (!canManage) return null

    return (
        <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Link2 className="size-4 text-primary" />
                        <h3 className="font-semibold">Invitación por link</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Invitá participantes con un enlace temporal. Solo se muestra completo al generarlo.
                    </p>
                </div>
                {loading && <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setExpiresInDays(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            expiresInDays === option.value
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {error && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            {!loading && !hasActiveInvite && (
                <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">
                        Todavía no hay un link activo para este espacio.
                    </p>
                    <Button type="button" onClick={() => generate(false)} disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                        Generar link
                    </Button>
                </div>
            )}

            {hasActiveInvite && (
                <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                    {visibleUrl ? (
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <div className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                                <span className="block truncate">{visibleUrl}</span>
                            </div>
                            <Button type="button" onClick={copyLink} variant="secondary" disabled={busy}>
                                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Ya hay un link activo, pero por seguridad solo podemos mostrar el enlace completo al generarlo. Podés regenerarlo para copiarlo.
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {expiresLabel && <span>Vence: {expiresLabel}</span>}
                        <span>Usos: {invite?.usedCount ?? 0}</span>
                        {invite?.tokenPreview && (
                            <span className="inline-flex items-center gap-1">
                                <ShieldCheck className="size-3.5" />
                                Ref. {invite.tokenPreview}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button type="button" onClick={() => generate(true)} disabled={busy} variant="secondary">
                            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                            Regenerar link
                        </Button>
                        <Button type="button" onClick={revoke} disabled={busy} variant="ghost">
                            <Trash2 className="size-4" />
                            Revocar
                        </Button>
                    </div>
                </div>
            )}
        </section>
    )
}
