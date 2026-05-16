'use client'

import { useEffect, useState } from 'react'
import { apiJson } from '@/lib/client/auth-client'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { spaceEntryConfirmSchema, type SpaceEntryConfirmData } from '@/lib/validations'
import { extractId } from '@/lib/utils/spaces'
import type { ISpaceEntry, ITransaction } from '@/types'
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
import { SpaceAmountInline } from '@/components/spaces/SpaceUi'

export function ConfirmSpaceEntryDialog({
    open,
    onOpenChange,
    entry,
    onSubmit,
}: DialogProps & {
    entry: ISpaceEntry | null
    onSubmit: (data: SpaceEntryConfirmData) => Promise<unknown>
}) {
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const [form, setForm] = useState<SpaceEntryConfirmData>({
        mode: 'create',
        description: entry?.title ?? '',
        categoryId: undefined,
        accountId: undefined,
        linkedTransactionId: undefined,
    })
    const [recentTransactions, setRecentTransactions] = useState<ITransaction[]>([])
    const [loadingTransactions, setLoadingTransactions] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !entry) return

        setForm({
            mode: 'create',
            description: entry.title,
            categoryId: undefined,
            accountId: undefined,
            linkedTransactionId: undefined,
        })
        setSubmitting(false)
        setError(null)
    }, [entry, open])

    useEffect(() => {
        if (!open || !entry) return

        let cancelled = false

        const fetchRecentTransactions = async () => {
            try {
                setLoadingTransactions(true)
                const data = await apiJson<{ transactions: ITransaction[] }>(
                    `/api/transactions?limit=25&sort=date_desc&currency=${entry.currency}`
                )
                if (cancelled) return
                setRecentTransactions(
                    data.transactions.filter(
                        (transaction) => Math.abs(transaction.amount - entry.amount) < 0.01
                    )
                )
            } catch {
                if (!cancelled) {
                    setRecentTransactions([])
                }
            } finally {
                if (!cancelled) {
                    setLoadingTransactions(false)
                }
            }
        }

        void fetchRecentTransactions()

        return () => {
            cancelled = true
        }
    }, [entry, open])

    const handleSubmit = async () => {
        const parsed = spaceEntryConfirmSchema.safeParse(form)
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revisá la confirmación del movimiento.')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            await onSubmit(parsed.data)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos confirmar el movimiento.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="max-w-[640px] gap-0 overflow-hidden p-0 sm:max-h-[92vh] sm:max-w-[640px]"
            >
                <div className="flex h-full min-h-0 flex-col sm:h-auto sm:max-h-[inherit]">
                    <div className="border-b border-border/70 bg-background/92 px-5 py-5 backdrop-blur sm:px-6">
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="text-2xl tracking-tight">Confirmar movimiento</DialogTitle>
                            <DialogDescription>
                                Elegí si querés crear una transacción nueva o vincular una existente sin perder el contexto del espacio.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="space-y-5">
                            {entry ? (
                                <SpaceDialogPanel>
                                    <div className="space-y-2">
                                        <SpaceDialogSectionEyebrow>Movimiento pendiente</SpaceDialogSectionEyebrow>
                                        <p className="text-lg font-semibold tracking-tight text-foreground">
                                            {entry.title}
                                        </p>
                                        <SpaceAmountInline
                                            amount={entry.amount}
                                            currency={entry.currency}
                                            hidden={false}
                                            className="text-xl font-semibold"
                                        />
                                    </div>
                                </SpaceDialogPanel>
                            ) : null}

                            <SpaceDialogPanel>
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <SpaceDialogSectionEyebrow>Modo</SpaceDialogSectionEyebrow>
                                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                            Cómo querés resolverlo
                                        </h3>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <SpaceDialogChoice
                                            active={form.mode === 'create'}
                                            onClick={() =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    mode: 'create',
                                                    linkedTransactionId: undefined,
                                                }))
                                            }
                                        >
                                            Crear nueva transacción
                                        </SpaceDialogChoice>
                                        <SpaceDialogChoice
                                            active={form.mode === 'link'}
                                            onClick={() =>
                                                setForm((previous) => ({
                                                    ...previous,
                                                    mode: 'link',
                                                    accountId: undefined,
                                                }))
                                            }
                                        >
                                            Vincular existente
                                        </SpaceDialogChoice>
                                    </div>

                                    {form.mode === 'create' ? (
                                        <div className="grid gap-4">
                                            <SpaceDialogField label="Cuenta">
                                                <Select
                                                    value={form.accountId ?? ''}
                                                    onValueChange={(value) =>
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            accountId: value,
                                                        }))
                                                    }
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="Elegí una cuenta" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {accounts
                                                            .filter((account) =>
                                                                entry
                                                                    ? (
                                                                          account.supportedCurrencies ?? [
                                                                              account.currency,
                                                                          ]
                                                                      ).includes(entry.currency as never)
                                                                    : true
                                                            )
                                                            .map((account) => (
                                                                <SelectItem
                                                                    key={extractId(account._id)}
                                                                    value={extractId(account._id) ?? ''}
                                                                >
                                                                    {account.name}
                                                                </SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </SpaceDialogField>

                                            <SpaceDialogField label="Descripción">
                                                <Input
                                                    value={form.description ?? ''}
                                                    onChange={(event) =>
                                                        setForm((previous) => ({
                                                            ...previous,
                                                            description: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Descripción para tu contabilidad personal"
                                                />
                                            </SpaceDialogField>
                                        </div>
                                    ) : (
                                        <SpaceDialogField label="Transacción existente">
                                            <Select
                                                value={form.linkedTransactionId ?? ''}
                                                onValueChange={(value) =>
                                                    setForm((previous) => ({
                                                        ...previous,
                                                        linkedTransactionId: value,
                                                    }))
                                                }
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue
                                                        placeholder={
                                                            loadingTransactions
                                                                ? 'Buscando transacciones...'
                                                                : 'Elegí una transacción'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {recentTransactions.map((transaction) => (
                                                        <SelectItem
                                                            key={extractId(transaction._id)}
                                                            value={extractId(transaction._id) ?? ''}
                                                        >
                                                            {transaction.description}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </SpaceDialogField>
                                    )}
                                </div>
                            </SpaceDialogPanel>

                            <SpaceDialogPanel>
                                <SpaceDialogField label="Categoría">
                                    <Select
                                        value={form.categoryId ?? 'none'}
                                        onValueChange={(value) =>
                                            setForm((previous) => ({
                                                ...previous,
                                                categoryId: value === 'none' ? undefined : value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Sin categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Sin categoría</SelectItem>
                                            {categories.map((category) => (
                                                <SelectItem
                                                    key={extractId(category._id)}
                                                    value={extractId(category._id) ?? ''}
                                                >
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </SpaceDialogField>
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
                            {submitting ? 'Confirmando...' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
