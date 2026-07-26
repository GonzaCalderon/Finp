'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
    DebtDirectionBadge,
    DebtSourceBadge,
    DebtStatusBadge,
    DebtAmountInline,
} from '@/components/debts/DebtsUi'
import type { IDebt, IDebtMovement } from '@/types/debt'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface DebtDetailSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    debtId: string | null
    hidden?: boolean
    onPay: (debt: IDebt) => void
    onCollect: (debt: IDebt) => void
    onIgnore: (debt: IDebt) => void
    onRestore: (debt: IDebt) => void
    onCancel: (debt: IDebt) => void
    onBack?: () => void
    backLabel?: string
    getDebtWithMovements: (id: string) => Promise<{ debt: IDebt; movements: IDebtMovement[] }>
}

function idToString(id: unknown) {
    if (!id) return ''
    return typeof id === 'string' ? id : id.toString()
}

function movementTitle(movement: IDebtMovement, debt: IDebt) {
    if (movement.type === 'payment') return `Le pagaste a ${debt.counterpartyNameSnapshot}`
    if (movement.type === 'collect') return `${debt.counterpartyNameSnapshot} te pagó`
    if (movement.type === 'creation') return 'Deuda registrada'
    if (movement.type === 'sync_update') return 'Actualizado desde espacio'
    if (movement.type === 'cancellation') return 'Deuda cancelada'
    if (movement.type === 'ignore') return 'Deuda ignorada'
    if (movement.type === 'restore') return 'Deuda restaurada'
    if (movement.type === 'adjustment') return 'Ajuste de deuda'
    return movement.type
}

function statusCopy(debt: IDebt) {
    if (debt.status === 'paid') return 'Sin saldo pendiente'
    if (debt.status === 'ignored') return 'Ignorada en tu Finp'
    if (debt.status === 'cancelled') return 'Cancelada'
    if (debt.status === 'partially_paid') return 'Pago parcial registrado'
    return debt.sourceType === 'space' ? 'Pendiente de impactar' : 'Saldo pendiente'
}

function spaceHref(spaceId?: unknown, entryId?: unknown) {
    const sid = idToString(spaceId)
    if (!sid) return ''
    const eid = idToString(entryId)
    return `/spaces/${sid}${eid ? `?entryId=${eid}` : ''}`
}

export function DebtDetailSheet({
    open,
    onOpenChange,
    debtId,
    hidden,
    onPay,
    onCollect,
    onIgnore,
    onRestore,
    onCancel,
    onBack,
    backLabel,
    getDebtWithMovements,
}: DebtDetailSheetProps) {
    const [debt, setDebt] = useState<IDebt | null>(null)
    const [movements, setMovements] = useState<IDebtMovement[]>([])
    const [loading, setLoading] = useState(false)
    const isMobile = useMediaQuery('(max-width: 767px)')

    useEffect(() => {
        if (!open || !debtId) return
        const fetchData = async () => {
            setLoading(true)
            try {
                const { debt, movements } = await getDebtWithMovements(debtId)
                setDebt(debt)
                setMovements(movements)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [open, debtId, getDebtWithMovements])

    function handleOpenChange(next: boolean) {
        if (!next) {
            setDebt(null)
            setMovements([])
        }
        onOpenChange(next)
    }

    const isActionable = debt?.status === 'active' || debt?.status === 'partially_paid'

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetContent
                side={isMobile ? 'bottom' : 'right'}
                className="flex h-[90dvh] w-full flex-col gap-0 overflow-y-auto p-0 sm:h-full sm:max-w-lg"
            >
                <SheetHeader className="px-6 pt-6 pb-4">
                    {onBack && isMobile ? (
                        <button
                            type="button"
                            onClick={onBack}
                            className="mb-2 inline-flex min-h-10 items-center gap-2 self-start rounded-lg pr-3 text-sm font-medium text-primary"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Volver a {backLabel ?? 'la persona'}
                        </button>
                    ) : null}
                    <SheetTitle className="text-base">Detalle de deuda</SheetTitle>
                    <SheetDescription className="text-xs">
                        {debt ? `Con ${debt.counterpartyNameSnapshot}` : 'Cargando…'}
                    </SheetDescription>
                </SheetHeader>

                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && debt && (
                    <>
                        <div className="px-6 pb-4 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                                <DebtDirectionBadge direction={debt.direction} />
                                <DebtSourceBadge sourceType={debt.sourceType} />
                                <DebtStatusBadge status={debt.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">{statusCopy(debt)}</p>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground">Monto original</p>
                                    <DebtAmountInline amount={debt.amount} currency={debt.currency} hidden={hidden} className="text-sm" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Pendiente</p>
                                    <DebtAmountInline amount={debt.remainingAmount} currency={debt.currency} hidden={hidden} className="text-sm font-semibold" />
                                </div>
                            </div>

                            {debt.amount > 0 && debt.status !== 'paid' && (
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${Math.round((1 - debt.remainingAmount / debt.amount) * 100)}%`,
                                            background: 'var(--chart-3)',
                                        }}
                                    />
                                </div>
                            )}

                            {debt.notes && (
                                <p className="text-xs text-muted-foreground">{debt.notes}</p>
                            )}

                            {debt.sourceType === 'space' && debt.spaceId && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Origen:</span>
                                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                        <Link
                                            href={spaceHref(debt.spaceId, debt.metadata?.sourceEntryIds?.[0])}
                                            onClick={() => onOpenChange(false)}
                                        >
                                            Ver en espacio
                                            <ExternalLink size={10} />
                                        </Link>
                                    </Button>
                                    {debt.originMode && (
                                        <span className="text-xs text-muted-foreground">
                                            · Modo {debt.originMode === 'simplified' ? 'Simplificado' : 'Directo'}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {movements.length > 0 && (
                            <div className="px-6 py-4">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Historial</p>
                                <div className="space-y-2">
                                    {movements.map((mv) => (
                                        <div key={mv._id.toString()} className="flex items-center justify-between gap-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium">
                                                    {movementTitle(mv, debt)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(mv.date).toLocaleDateString('es-AR')}
                                                    {mv.notes ? ` · ${mv.notes}` : ''}
                                                </span>
                                                {mv.spaceId ? (
                                                    <Link
                                                        href={spaceHref(mv.spaceId, mv.spaceEntryId)}
                                                        className="mt-0.5 inline-flex w-fit items-center gap-1 text-xs text-sky-600 hover:underline dark:text-sky-400"
                                                        onClick={() => onOpenChange(false)}
                                                    >
                                                        Ver en espacio
                                                        <ExternalLink size={10} />
                                                    </Link>
                                                ) : null}
                                            </div>
                                            <DebtAmountInline
                                                amount={mv.amount}
                                                currency={mv.currency}
                                                hidden={hidden}
                                                className="text-xs shrink-0"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Separator />

                        <div className="sticky bottom-0 z-10 space-y-2 border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur">
                            {isActionable && debt.direction === 'payable' && (
                                <Button
                                    className="w-full"
                                    onClick={() => { onOpenChange(false); onPay(debt) }}
                                >
                                    Pagar
                                </Button>
                            )}
                            {isActionable && debt.direction === 'receivable' && (
                                <Button
                                    className="w-full"
                                    onClick={() => { onOpenChange(false); onCollect(debt) }}
                                >
                                    Registrar cobro
                                </Button>
                            )}

                            {debt.sourceType === 'space' && isActionable && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="w-full text-sm">
                                            Ignorar deuda
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Ignorar esta deuda?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Ignorar esta deuda solo afecta tu Finp personal. No modifica el espacio, no salda la deuda y no afecta a otros participantes. Podés restaurarla más adelante.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => { onOpenChange(false); onIgnore(debt) }}
                                            >
                                                Ignorar
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}

                            {debt.status === 'ignored' && (
                                <Button
                                    variant="outline"
                                    className="w-full text-sm"
                                    onClick={() => { onOpenChange(false); onRestore(debt) }}
                                >
                                    Restaurar deuda
                                </Button>
                            )}

                            {debt.sourceType === 'manual' && isActionable && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="w-full text-sm text-destructive hover:text-destructive">
                                            Cancelar deuda
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>¿Cancelar esta deuda?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                La deuda se marcará como cancelada. Esta acción no se puede deshacer.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Volver</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                onClick={() => { onOpenChange(false); onCancel(debt) }}
                                            >
                                                Cancelar deuda
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
