'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Link2, WalletCards } from 'lucide-react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { fadeInFast, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { extractId } from '@/lib/utils/spaces'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import type { ITransaction, ISpaceEntry, ISpaceEntryPersonalImpact } from '@/types'
import type { SpacePersonalImpactKind } from '@/lib/constants'
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
import { SpaceAmountInline } from '@/components/spaces/SpaceUi'
import {
    DialogProps,
    SpaceDialogChoice,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

type Suggestion = {
    amount: number
    currency: string
    impactKind: SpacePersonalImpactKind
}

function getImpactCopy(kind?: SpacePersonalImpactKind) {
    if (kind === 'participant_share') return 'Vas a registrar tu parte del gasto en tu Finp.'
    if (kind === 'settlement_paid' || kind === 'settlement_received') return 'Vas a registrar este pago en tu Finp.'
    return 'Vas a registrar el gasto completo en tu Finp.'
}

export function SpacePersonalImpactDialog({
    open,
    onOpenChange,
    spaceId,
    entry,
    onCreated,
}: DialogProps & {
    spaceId: string
    entry: ISpaceEntry | null
    onCreated?: (impact: ISpaceEntryPersonalImpact) => void
}) {
    const { accounts } = useAccounts()
    const { categories } = useCategories()
    const [mode, setMode] = useState<'create_transaction' | 'link_existing'>('create_transaction')
    const [accountId, setAccountId] = useState<string | undefined>()
    const [categoryId, setCategoryId] = useState<string | undefined>()
    const [linkedTransactionId, setLinkedTransactionId] = useState<string | undefined>()
    const [amount, setAmount] = useState('')
    const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
    const [existingImpact, setExistingImpact] = useState<ISpaceEntryPersonalImpact | null>(null)
    const [recentTransactions, setRecentTransactions] = useState<ITransaction[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const entryId = extractId(entry?._id)
    const compatibleAccounts = useMemo(
        () =>
            accounts.filter((account) =>
                entry
                    ? (account.supportedCurrencies ?? [account.currency]).includes(entry.currency as never)
                    : true
            ),
        [accounts, entry]
    )
    const personalCategories = useMemo(
        () => categories.filter((category) => !category.isArchived),
        [categories]
    )

    useEffect(() => {
        if (!open || !spaceId || !entryId || !entry) return

        let cancelled = false

        async function loadContext() {
            const currentEntry = entry
            if (!currentEntry) return
            setLoading(true)
            setError(null)
            setMode('create_transaction')
            setAccountId(undefined)
            setCategoryId(undefined)
            setLinkedTransactionId(undefined)
            setExistingImpact(null)

            try {
                const impactData = await apiJson<{
                    impact: ISpaceEntryPersonalImpact | null
                    pendingActions: ISpaceEntryPersonalImpact[]
                    suggestion: Suggestion | null
                }>(`/api/spaces/${spaceId}/entries/${entryId}/personal-impact`)
                if (cancelled) return
                // Solo el linkedImpact real bloquea el registro; pendingActions son informativos
                setExistingImpact(impactData.impact)
                setSuggestion(impactData.suggestion)
                setAmount(String(impactData.suggestion?.amount ?? currentEntry.amount))

                const transactionsData = await apiJson<{ transactions: ITransaction[] }>(
                    `/api/transactions?limit=25&sort=date_desc&currency=${currentEntry.currency}`
                )
                if (cancelled) return
                const targetAmount = impactData.suggestion?.amount ?? currentEntry.amount
                setRecentTransactions(
                    transactionsData.transactions.filter(
                        (transaction) => Math.abs(transaction.amount - targetAmount) < 0.01
                    )
                )
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'No pudimos cargar tu impacto personal.')
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadContext()

        return () => {
            cancelled = true
        }
    }, [entry, entryId, open, spaceId])

    async function handleSubmit() {
        if (!entryId) return
        setSubmitting(true)
        setError(null)

        try {
            const response = await apiJson<{ impact: ISpaceEntryPersonalImpact }>(
                `/api/spaces/${spaceId}/entries/${entryId}/personal-impact`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mode,
                        accountId,
                        categoryId,
                        linkedTransactionId,
                        impactKind: suggestion?.impactKind,
                        amount: Number(amount),
                    }),
                }
            )
            invalidateData(SPACE_INVALIDATION_TAGS)
            onCreated?.(response.impact)
            onOpenChange(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No pudimos registrar el movimiento en tu Finp.')
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
                            <DialogTitle className="text-2xl tracking-tight">Tu Finp</DialogTitle>
                            <DialogDescription>
                                Registralo en tu Finp personal sin cambiar el estado compartido del espacio.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <motion.div
                        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"
                        variants={staggerContainer}
                        initial="initial"
                        animate="animate"
                    >
                        <div className="space-y-5">
                            <motion.div variants={staggerItem}>
                                <SpaceDialogPanel>
                                    <div className="space-y-2">
                                        <SpaceDialogSectionEyebrow>Movimiento</SpaceDialogSectionEyebrow>
                                        <p className="text-lg font-semibold tracking-tight text-foreground">
                                            {entry?.title ?? 'Movimiento'}
                                        </p>
                                        <SpaceAmountInline
                                            amount={Number(amount) || suggestion?.amount || entry?.amount || 0}
                                            currency={entry?.currency ?? suggestion?.currency ?? ''}
                                            hidden={false}
                                            className="text-xl font-semibold"
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            {getImpactCopy(suggestion?.impactKind)}
                                        </p>
                                    </div>
                                </SpaceDialogPanel>
                            </motion.div>

                            {existingImpact ? (
                                <motion.div {...fadeInFast}>
                                    <div className="flex items-start gap-3 rounded-[22px] border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>Este movimiento ya esta registrado en tu Finp.</span>
                                    </div>
                                </motion.div>
                            ) : null}

                            {!existingImpact ? (
                                <>
                                    <motion.div variants={staggerItem}>
                                        <SpaceDialogPanel>
                                            <div className="space-y-4">
                                                <div className="space-y-1">
                                                    <SpaceDialogSectionEyebrow>Modo</SpaceDialogSectionEyebrow>
                                                    <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                                        Como queres registrarlo
                                                    </h3>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <SpaceDialogChoice
                                                        active={mode === 'create_transaction'}
                                                        onClick={() => {
                                                            setMode('create_transaction')
                                                            setLinkedTransactionId(undefined)
                                                        }}
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <WalletCards className="h-3.5 w-3.5" />
                                                            Crear transaccion
                                                        </span>
                                                    </SpaceDialogChoice>
                                                    <SpaceDialogChoice
                                                        active={mode === 'link_existing'}
                                                        onClick={() => {
                                                            setMode('link_existing')
                                                            setAccountId(undefined)
                                                        }}
                                                    >
                                                        <span className="inline-flex items-center gap-2">
                                                            <Link2 className="h-3.5 w-3.5" />
                                                            Vincular existente
                                                        </span>
                                                    </SpaceDialogChoice>
                                                </div>

                                                {mode === 'create_transaction' ? (
                                                    <SpaceDialogField label="Cuenta">
                                                        <Select
                                                            value={accountId ?? ''}
                                                            onValueChange={setAccountId}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue placeholder="Elegi una cuenta" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {compatibleAccounts.map((account) => (
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
                                                ) : (
                                                    <SpaceDialogField label="Transaccion existente">
                                                        <Select
                                                            value={linkedTransactionId ?? ''}
                                                            onValueChange={setLinkedTransactionId}
                                                        >
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue
                                                                    placeholder={
                                                                        loading
                                                                            ? 'Buscando transacciones...'
                                                                            : 'Elegi una transaccion'
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

                                                <SpaceDialogField label="Monto">
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={amount}
                                                        onChange={(event) => setAmount(event.target.value)}
                                                    />
                                                </SpaceDialogField>

                                                <SpaceDialogField
                                                    label="Categoria personal"
                                                    hint="Solo se guarda en tu Finp personal."
                                                >
                                                    <Select
                                                        value={categoryId ?? 'none'}
                                                        onValueChange={(value) =>
                                                            setCategoryId(value === 'none' ? undefined : value)
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Sin categoria" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sin categoria</SelectItem>
                                                            {personalCategories.map((category) => (
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
                                            </div>
                                        </SpaceDialogPanel>
                                    </motion.div>
                                </>
                            ) : null}

                            {error ? (
                                <motion.p
                                    {...fadeInFast}
                                    className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                                >
                                    {error}
                                </motion.p>
                            ) : null}
                        </div>
                    </motion.div>

                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 sm:px-6">
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cerrar
                        </Button>
                        {!existingImpact ? (
                            <Button
                                className="rounded-full"
                                onClick={() => void handleSubmit()}
                                disabled={submitting || loading || !entry}
                            >
                                {submitting ? 'Registrando...' : 'Registrar en mi Finp'}
                            </Button>
                        ) : null}
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
