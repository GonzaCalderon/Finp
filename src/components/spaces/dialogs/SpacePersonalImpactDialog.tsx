'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Link2, WalletCards } from 'lucide-react'
import { apiJson } from '@/lib/client/auth-client'
import {
    invalidateData,
    SPACE_INVALIDATION_TAGS,
} from '@/lib/client/data-sync'
import { fetchLinkCandidatesForImpact } from '@/lib/client/space-personal-impact'
import { fadeInFast, staggerContainer, staggerItem } from '@/lib/utils/animations'
import { extractId } from '@/lib/utils/spaces'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import type { ISpaceEntry, ISpaceEntryPersonalImpact, SpaceLinkCandidateDto } from '@/types'
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
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
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
    SpaceLinkCandidateList,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'

type Suggestion = {
    amount: number
    currency: string
    impactKind: SpacePersonalImpactKind
    categoryId?: string
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
    initialImpact,
    onCreated,
}: DialogProps & {
    spaceId: string
    entry: ISpaceEntry | null
    initialImpact?: ISpaceEntryPersonalImpact
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
    const [linkCandidates, setLinkCandidates] = useState<SpaceLinkCandidateDto[]>([])
    const [linkCandidatesLoading, setLinkCandidatesLoading] = useState(false)
    const [linkCandidatesError, setLinkCandidatesError] = useState<string | null>(null)
    const [linkCandidatesExcluded, setLinkCandidatesExcluded] = useState(0)
    const [linkCandidatesRetryNonce, setLinkCandidatesRetryNonce] = useState(0)
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
    const requiresPersonalAccount = entry?.contractVersion === 2
        ? (initialImpact?.accountImpactAmount ?? 0) > 0
        : true

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
            setLinkCandidates([])
            setLinkCandidatesError(null)
            setLinkCandidatesExcluded(0)

            try {
                if (currentEntry.contractVersion !== 2 || !initialImpact) {
                    // Todo movimiento v2 con impacto para este usuario llega con
                    // initialImpact ya resuelto (ver SpaceEntryDetailSheet). Si no lo
                    // trae, no hay nada que registrar: fallar explícito en vez de
                    // intentar un contrato de escritura legacy que el servidor ya no
                    // acepta (retirado en PR 38, ver docs/producto/espacios.md #14).
                    throw new Error('Este movimiento no tiene un impacto personal para registrar.')
                }
                const impactAmount = initialImpact.accountImpactAmount || initialImpact.ownShareAmount || initialImpact.amount
                setExistingImpact(initialImpact.status === 'linked' ? initialImpact : null)
                setSuggestion({
                    amount: impactAmount,
                    currency: initialImpact.currency,
                    impactKind: initialImpact.impactKind,
                    categoryId: extractId(initialImpact.categoryId),
                })
                setAmount(String(impactAmount))
                // Los candidatos v2 tienen su propio efecto y su propio error: un
                // fallo ahí no debe tapar el resto del contexto ya cargado.
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
    }, [entry, entryId, initialImpact, open, spaceId])

    const impactId = extractId(initialImpact?._id)

    useEffect(() => {
        if (!open || !spaceId || !entryId || entry?.contractVersion !== 2 || !impactId) {
            return
        }
        let cancelled = false
        setLinkCandidatesLoading(true)
        setLinkCandidatesError(null)
        fetchLinkCandidatesForImpact({ spaceId, entryId, impactId }).then((result) => {
            if (cancelled) return
            setLinkCandidates(result.candidates)
            setLinkCandidatesExcluded(
                result.excluded.amountMismatch
                + result.excluded.operationalMismatch
                + result.excluded.accountMismatch
                + result.excluded.alreadyLinked
            )
        }).catch((err) => {
            if (cancelled) return
            setLinkCandidates([])
            setLinkCandidatesError(err instanceof Error ? err.message : 'No pudimos cargar tus transacciones.')
        }).finally(() => {
            if (!cancelled) setLinkCandidatesLoading(false)
        })
        return () => {
            cancelled = true
        }
    }, [entry?.contractVersion, entryId, impactId, linkCandidatesRetryNonce, open, spaceId])

    useEffect(() => {
        if (!linkedTransactionId || linkCandidatesLoading) return
        const selectedStillMatches = linkCandidates.some(
            (candidate) => candidate.transactionId === linkedTransactionId
        )
        if (selectedStillMatches) return
        setLinkedTransactionId(undefined)
    }, [linkCandidates, linkCandidatesLoading, linkedTransactionId])

    async function handleSubmit() {
        if (!entryId) return
        setSubmitting(true)
        setError(null)

        try {
            if (entry?.contractVersion !== 2 || !initialImpact) {
                // Ver el mismo guard en loadContext: sin un impacto v2 resuelto no
                // hay decisión válida que enviar.
                throw new Error('Este movimiento no tiene un impacto personal para registrar.')
            }
            const response = await apiJson<{
                data?: { impactId: string; status: 'linked' }
            }>(`/api/spaces/${spaceId}/entries/${entryId}/personal-impact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': crypto.randomUUID(),
                },
                body: JSON.stringify({
                    impactId: extractId(initialImpact._id),
                    expectedRevision: initialImpact.revision ?? 0,
                    decision: mode === 'link_existing'
                        ? { type: 'link_existing', transactionId: linkedTransactionId }
                        : {
                            type: 'create_transaction',
                            accountId,
                            categoryId,
                            description: entry.title,
                        },
                }),
            })
            const impact = {
                ...initialImpact,
                status: response.data?.status ?? 'linked',
                revision: (initialImpact.revision ?? 0) + 1,
            } as ISpaceEntryPersonalImpact
            invalidateData(SPACE_INVALIDATION_TAGS)
            onCreated?.(impact)
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
                className="max-w-[640px] gap-0 overflow-hidden p-0 [&_[data-slot=dialog-close]]:size-11 sm:max-h-[92vh] sm:max-w-[640px] sm:[&_[data-slot=dialog-close]]:size-7"
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
                                        {suggestion?.impactKind === 'participant_share' &&
                                            entry?.amount &&
                                            suggestion?.amount &&
                                            Math.abs(suggestion.amount - entry.amount) > 0.001 ? (
                                            <p className="text-xs text-muted-foreground">
                                                Total del gasto:{' '}
                                                <SpaceAmountInline
                                                    amount={entry.amount}
                                                    currency={entry.currency}
                                                    hidden={false}
                                                    className="text-xs font-medium text-foreground"
                                                />
                                            </p>
                                        ) : null}
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
                                                <div
                                                    className="flex flex-wrap gap-2"
                                                    role="radiogroup"
                                                    aria-label="Cómo querés registrarlo"
                                                >
                                                    <SpaceDialogChoice
                                                        active={mode === 'create_transaction'}
                                                        role="radio"
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
                                                        role="radio"
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
                                                    !requiresPersonalAccount ? (
                                                        <div className="rounded-[22px] border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-foreground">
                                                            Tu parte se registra como gasto operacional sin mover ninguna cuenta personal.
                                                        </div>
                                                    ) : compatibleAccounts.length === 0 ? (
                                                        <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                                                            <p className="font-medium">Para registrar esto en tu Finp necesitás crear una cuenta.</p>
                                                            <div className="mt-3 flex flex-wrap gap-2">
                                                                <Button asChild size="sm">
                                                                    <Link href="/accounts">Crear cuenta</Link>
                                                                </Button>
                                                                <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                                                                    Más tarde
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <SpaceDialogField id="personal-impact-account" label="Cuenta">
                                                            <Select
                                                                value={accountId ?? ''}
                                                                onValueChange={setAccountId}
                                                            >
                                                                <SelectTrigger id="personal-impact-account" className="w-full">
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
                                                    )
                                                ) : (
                                                    <SpaceDialogField label="Transaccion existente">
                                                        <SpaceLinkCandidateList
                                                            candidates={linkCandidates}
                                                            loading={linkCandidatesLoading}
                                                            error={linkCandidatesError}
                                                            excludedCount={linkCandidatesExcluded}
                                                            selectedId={linkedTransactionId}
                                                            onSelect={setLinkedTransactionId}
                                                            onRetry={() => setLinkCandidatesRetryNonce((current) => current + 1)}
                                                        />
                                                    </SpaceDialogField>
                                                )}

                                                <FormattedAmountInput
                                                    id="personal-impact-amount"
                                                    label="Monto"
                                                    value={amount ? Number(amount) : undefined}
                                                    currency={entry?.currency ?? suggestion?.currency ?? 'ARS'}
                                                    onValueChangeAction={(value) =>
                                                        setAmount(value ? String(value) : '')
                                                    }
                                                    disabled={entry?.contractVersion === 2}
                                                />

                                                <SpaceDialogField
                                                    id="personal-impact-category"
                                                    label="Categoria personal"
                                                    hint="Solo se guarda en tu Finp personal."
                                                >
                                                    <Select
                                                        value={categoryId ?? 'none'}
                                                        onValueChange={(value) =>
                                                            setCategoryId(value === 'none' ? undefined : value)
                                                        }
                                                    >
                                                        <SelectTrigger id="personal-impact-category" className="w-full">
                                                            <SelectValue placeholder="Sin categoria" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sin categoria</SelectItem>
                                                            {personalCategories.map((category) => (
                                                                <SelectItem
                                                                    key={extractId(category._id)}
                                                                    value={extractId(category._id) ?? ''}
                                                                >
                                                                    <span className="inline-flex items-center gap-2">
                                                                        {category.name}
                                                                        {category.isVirtual || category.sourceType === 'space' ? (
                                                                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                                                                Espacio
                                                                            </span>
                                                                        ) : null}
                                                                    </span>
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
                                    role="alert"
                                    className="rounded-[22px] border border-destructive/15 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                                >
                                    {error}
                                </motion.p>
                            ) : null}
                        </div>
                    </motion.div>

                    <DialogFooter className="shrink-0 border-t border-border/70 bg-background/96 px-5 py-4 safe-area-pb sm:px-6">
                        <Button
                            variant="outline"
                            className="min-h-11 rounded-full"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cerrar
                        </Button>
                        {!existingImpact ? (
                            <Button
                                className="min-h-11 rounded-full"
                                onClick={() => void handleSubmit()}
                                disabled={
                                    submitting ||
                                    loading ||
                                    !entry ||
                                    (mode === 'create_transaction' &&
                                        requiresPersonalAccount &&
                                        compatibleAccounts.length === 0)
                                }
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
