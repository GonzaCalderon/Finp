'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import {
    spaceSettlementSchema,
    type SpaceEntryFormData,
    type SpaceSettlementData,
} from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceParticipant } from '@/types'
import {
    Dialog,
    DialogContent,
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
import { SpaceInitialsAvatar } from '@/components/spaces/SpaceUi'
import {
    type DialogProps,
    formatDateInput,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogTextArea,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

export interface SettlementPrefill {
    payerId?: string
    receiverId?: string
    amount?: number
}

type FormState = {
    payerId: string
    receiverId: string
    amount: string
    currency: string
    date: string
    notes: string
}

function buildDefaultForm(
    participants: ISpaceParticipant[],
    defaultCurrency: string,
    prefill?: SettlementPrefill
): FormState {
    const activeIds = participants
        .filter((p) => p.isActive)
        .map((p) => extractId(p._id) ?? '')
        .filter(Boolean)

    return {
        payerId: prefill?.payerId ?? activeIds[0] ?? '',
        receiverId: prefill?.receiverId ?? activeIds[1] ?? '',
        amount: prefill?.amount != null ? String(prefill.amount) : '',
        currency: defaultCurrency,
        date: formatDateInput(),
        notes: '',
    }
}

export function SpaceSettlementDialog({
    open,
    onOpenChange,
    onSubmit,
    participants,
    defaultCurrency,
    reportingCurrency,
    prefill,
}: DialogProps & {
    onSubmit: (data: SpaceEntryFormData) => Promise<unknown>
    participants: ISpaceParticipant[]
    defaultCurrency: string
    reportingCurrency: string
    prefill?: SettlementPrefill
}) {
    const { error: toastError } = useToast()
    const activeParticipants = participants.filter((p) => p.isActive)

    const [form, setForm] = useState<FormState>(() =>
        buildDefaultForm(activeParticipants, defaultCurrency, prefill)
    )
    const [submitting, setSubmitting] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<keyof SpaceSettlementData | 'form', string>>>({})

    useEffect(() => {
        if (!open) return
        setForm(buildDefaultForm(activeParticipants, defaultCurrency, prefill))
        setErrors({})
        setSubmitting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const currencies = Array.from(
        new Set([defaultCurrency, reportingCurrency])
    )

    const payerName =
        activeParticipants.find((p) => extractId(p._id) === form.payerId)?.displayName ?? ''
    const receiverName =
        activeParticipants.find((p) => extractId(p._id) === form.receiverId)?.displayName ?? ''

    async function handleSubmit() {
        const result = spaceSettlementSchema.safeParse({
            payerId: form.payerId,
            receiverId: form.receiverId,
            amount: form.amount,
            currency: form.currency,
            date: form.date,
            notes: form.notes || undefined,
        })

        if (!result.success) {
            const fieldErrors: typeof errors = {}
            for (const issue of result.error.issues) {
                const key = issue.path[0] as keyof SpaceSettlementData
                if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
            }
            setErrors(fieldErrors)
            return
        }

        const data = result.data
        const title = `Pago de ${payerName} a ${receiverName}`

        const entryData: SpaceEntryFormData = {
            type: 'settlement',
            title,
            amount: data.amount,
            currency: data.currency,
            date: data.date,
            paidByParticipantId: data.payerId,
            sharedWithParticipantIds: [data.receiverId],
            splitMode: 'none',
            notes: data.notes,
        }

        setSubmitting(true)
        setErrors({})
        try {
            await onSubmit(entryData)
            onOpenChange(false)
        } catch {
            toastError('No se pudo registrar el pago')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-h-[90vh] sm:max-w-lg">
                <DialogHeader className="border-b border-border/60 px-5 py-4">
                    <DialogTitle className="text-base font-semibold">Registrar pago</DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto px-5 py-5">
                    <div className="space-y-4">
                        <SpaceDialogPanel>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <SpaceDialogField label="Quién pagó">
                                    <Select
                                        value={form.payerId}
                                        onValueChange={(value) => {
                                            setForm((prev) => ({
                                                ...prev,
                                                payerId: value,
                                                receiverId: prev.receiverId === value ? prev.payerId : prev.receiverId,
                                            }))
                                        }}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Elegí un participante" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeParticipants.map((participant) => (
                                                <SelectItem
                                                    key={extractId(participant._id)}
                                                    value={extractId(participant._id) ?? ''}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <SpaceInitialsAvatar
                                                            name={participant.displayName}
                                                            className="h-6 w-6 text-[10px]"
                                                        />
                                                        <span>{participant.displayName}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.payerId ? (
                                        <p className="text-xs text-destructive">{errors.payerId}</p>
                                    ) : null}
                                </SpaceDialogField>

                                <SpaceDialogField label="A quién le pagó">
                                    <Select
                                        value={form.receiverId}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({ ...prev, receiverId: value }))
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Elegí un participante" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {activeParticipants
                                                .filter((p) => extractId(p._id) !== form.payerId)
                                                .map((participant) => (
                                                    <SelectItem
                                                        key={extractId(participant._id)}
                                                        value={extractId(participant._id) ?? ''}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <SpaceInitialsAvatar
                                                                name={participant.displayName}
                                                                className="h-6 w-6 text-[10px]"
                                                            />
                                                            <span>{participant.displayName}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.receiverId ? (
                                        <p className="text-xs text-destructive">{errors.receiverId}</p>
                                    ) : null}
                                </SpaceDialogField>
                            </div>
                        </SpaceDialogPanel>

                        <SpaceDialogPanel>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <SpaceDialogField label="Monto">
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        step="any"
                                        value={form.amount}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, amount: e.target.value }))
                                        }
                                        placeholder="0"
                                    />
                                    {errors.amount ? (
                                        <p className="text-xs text-destructive">{errors.amount}</p>
                                    ) : null}
                                </SpaceDialogField>

                                <SpaceDialogField label="Moneda">
                                    <Select
                                        value={form.currency}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({ ...prev, currency: value }))
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {currencies.map((currency) => (
                                                <SelectItem key={currency} value={currency}>
                                                    {currency}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SpaceDialogField>
                            </div>

                            <div className="mt-4">
                                <SpaceDialogField label="Fecha">
                                    <Input
                                        type="date"
                                        value={form.date}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, date: e.target.value }))
                                        }
                                    />
                                    {errors.date ? (
                                        <p className="text-xs text-destructive">{errors.date}</p>
                                    ) : null}
                                </SpaceDialogField>
                            </div>
                        </SpaceDialogPanel>

                        <SpaceDialogPanel>
                            <SpaceDialogField label="Notas" hint="Opcional">
                                <SpaceDialogTextArea
                                    value={form.notes}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                                    }
                                    placeholder="Ej. Transferencia por el alquiler de abril"
                                    className="min-h-[80px]"
                                />
                            </SpaceDialogField>
                        </SpaceDialogPanel>
                    </div>
                </div>

                <DialogFooter className="border-t border-border/60 px-5 py-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Registrando…' : 'Registrar pago'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
