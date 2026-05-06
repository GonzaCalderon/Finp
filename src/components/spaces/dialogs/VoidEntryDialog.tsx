'use client'

import { useState } from 'react'
import { AlertTriangle, Ban } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import type { ISpaceEntry } from '@/types'

export function VoidEntryDialog({
    open,
    onOpenChange,
    entry,
    hasLinkedTransaction,
    hasSubsequentSettlement,
    onConfirm,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    entry: ISpaceEntry | null
    hasLinkedTransaction: boolean
    hasSubsequentSettlement: boolean
    onConfirm: (voidReason?: string) => Promise<void>
}) {
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleConfirm() {
        setIsSubmitting(true)
        try {
            await onConfirm(reason.trim() || undefined)
            setReason('')
            onOpenChange(false)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!entry) return null

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-center gap-2">
                        <Ban className="h-5 w-5 text-destructive" />
                        <AlertDialogTitle>Anular movimiento</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>
                        <span className="block font-medium text-foreground">
                            &ldquo;{entry.title}&rdquo;
                        </span>
                        <span className="mt-1 block">
                            El movimiento quedará marcado como anulado y no impactará en el balance.
                            Seguirá visible en el historial para referencia.
                        </span>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-4 py-2">
                    {hasSubsequentSettlement ? (
                        <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                Hay pagos registrados después de este movimiento. Si lo anulás, el balance puede cambiar y esos pagos seguirán registrados.
                            </span>
                        </div>
                    ) : null}

                    {hasLinkedTransaction ? (
                        <div className="flex gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>
                                Este movimiento impactó en tu Finp personal. Revisá la transacción vinculada para mantener tus finanzas consistentes.
                            </span>
                        </div>
                    ) : null}

                    <div className="space-y-1.5">
                        <Label htmlFor="void-reason" className="text-sm text-muted-foreground">
                            Motivo de anulación <span className="text-xs">(opcional)</span>
                        </Label>
                        <textarea
                            id="void-reason"
                            placeholder="¿Por qué anulás este movimiento?"
                            value={reason}
                            onChange={(e) => setReason(e.target.value.slice(0, 200))}
                            rows={3}
                            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                        {reason.length > 150 ? (
                            <p className="text-right text-xs text-muted-foreground">{reason.length}/200</p>
                        ) : null}
                    </div>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            void handleConfirm()
                        }}
                        disabled={isSubmitting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isSubmitting ? 'Anulando...' : 'Confirmar anulación'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
