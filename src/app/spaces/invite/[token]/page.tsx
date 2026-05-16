'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Loader2, LogIn, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

type InviteState = {
    status: 'valid' | 'expired' | 'revoked' | 'invalid'
    spaceName?: string
    spaceType?: string
    inviterName?: string
    expiresAt?: string
    isAuthenticated: boolean
    alreadyParticipant: boolean
    spaceId?: string
}

const SPACE_TYPE_LABELS: Record<string, string> = {
    couple: 'Pareja',
    home: 'Grupo',
    travel: 'Viaje',
    project: 'Proyecto',
    event: 'Evento',
    personal: 'Personal',
    other: 'Otro',
}

function formatExpiration(value?: string) {
    if (!value) return null
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value))
}

export default function SpaceInvitePage() {
    const params = useParams<{ token: string }>()
    const router = useRouter()
    const token = params.token
    const callbackUrl = `/spaces/invite/${token}`
    const [invite, setInvite] = useState<InviteState | null>(null)
    const [loading, setLoading] = useState(true)
    const [accepting, setAccepting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadInvite = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/spaces/invites/${token}`, { cache: 'no-store' })
            const data = await res.json() as InviteState
            setInvite(data)
        } catch {
            setError('No pudimos cargar esta invitación.')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => {
        void loadInvite()
    }, [loadInvite])

    const expiresLabel = useMemo(() => formatExpiration(invite?.expiresAt), [invite?.expiresAt])

    const acceptInvite = async () => {
        setAccepting(true)
        setError(null)
        try {
            const res = await fetch(`/api/spaces/invites/${token}/accept`, { method: 'POST' })
            if (res.status === 401) {
                router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
                return
            }
            const data = await res.json() as { spaceId?: string; error?: string }
            if (!res.ok || !data.spaceId) {
                setError(data.error ?? 'Esta invitación ya no está disponible.')
                await loadInvite()
                return
            }
            router.push(`/spaces/${data.spaceId}?joined=1`)
        } catch {
            setError('No pudimos aceptar la invitación.')
        } finally {
            setAccepting(false)
        }
    }

    const renderBody = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Cargando invitación...
                </div>
            )
        }

        if (!invite || invite.status === 'invalid' || invite.status === 'revoked') {
            return (
                <div className="space-y-4 text-center">
                    <AlertCircle className="mx-auto size-10 text-muted-foreground" />
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold">Esta invitación ya no está disponible.</h1>
                        <p className="text-sm text-muted-foreground">
                            Pedile a un administrador que genere un nuevo enlace.
                        </p>
                    </div>
                </div>
            )
        }

        if (invite.status === 'expired') {
            return (
                <div className="space-y-4 text-center">
                    <AlertCircle className="mx-auto size-10 text-amber-500" />
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold">Esta invitación venció.</h1>
                        <p className="text-sm text-muted-foreground">
                            Pedile a un administrador que genere un nuevo enlace.
                        </p>
                    </div>
                </div>
            )
        }

        if (invite.alreadyParticipant && invite.spaceId) {
            return (
                <div className="space-y-5 text-center">
                    <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold">Ya formás parte de este espacio.</h1>
                        <p className="text-sm text-muted-foreground">
                            Podés entrar para ver movimientos, balances y pagos compartidos.
                        </p>
                    </div>
                    <Button asChild className="w-full">
                        <Link href={`/spaces/${invite.spaceId}`}>Ir al espacio</Link>
                    </Button>
                </div>
            )
        }

        return (
            <div className="space-y-5">
                <div className="space-y-2 text-center">
                    <p className="text-sm font-medium text-primary">Te invitaron a un espacio</p>
                    <h1 className="text-2xl font-semibold tracking-tight">{invite.spaceName}</h1>
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                        {invite.spaceType && (
                            <span className="rounded-full bg-muted px-2.5 py-1">
                                {SPACE_TYPE_LABELS[invite.spaceType] ?? invite.spaceType}
                            </span>
                        )}
                        {invite.inviterName && <span>Invitado por {invite.inviterName}</span>}
                    </div>
                    {expiresLabel && (
                        <p className="text-xs text-muted-foreground">Vence el {expiresLabel}</p>
                    )}
                </div>

                {invite.isAuthenticated ? (
                    <Button
                        type="button"
                        onClick={acceptInvite}
                        disabled={accepting}
                        className="w-full"
                        aria-label="Unirme al espacio"
                    >
                        {accepting ? (
                            <>
                                <Loader2 className="size-4 animate-spin" />
                                Uniéndote...
                            </>
                        ) : (
                            'Unirme al espacio'
                        )}
                    </Button>
                ) : (
                    <div className="grid gap-3">
                        <Button asChild className="w-full">
                            <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                                <LogIn className="size-4" />
                                Iniciar sesión para aceptar
                            </Link>
                        </Button>
                        <Button asChild variant="secondary" className="w-full">
                            <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                                <UserPlus className="size-4" />
                                Crear cuenta y aceptar
                            </Link>
                        </Button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
                <motion.div
                    className="w-full"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                >
                    <Card className="border-border/70 shadow-sm">
                        <CardHeader className="sr-only">
                            <CardTitle>Invitación a espacio</CardTitle>
                            <CardDescription>Aceptá una invitación para entrar al espacio.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8">
                            {renderBody()}
                            {error && (
                                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                    {error}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </main>
    )
}
