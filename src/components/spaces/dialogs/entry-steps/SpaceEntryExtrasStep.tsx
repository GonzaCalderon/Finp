'use client'

import Link from 'next/link'
import {
    Banknote,
    Building2,
    CircleDollarSign,
    CreditCard,
    Link2,
    PiggyBank,
    Wallet,
    WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    SpaceDialogChoice,
    SpaceDialogField,
    SpaceDialogPanel,
    SpaceDialogSectionEyebrow,
    SpaceLinkCandidateList,
} from '@/components/spaces/dialogs/SpaceDialogPrimitives'
import { SpaceDraftAttachmentsUploader } from '@/components/spaces/dialogs/SpaceDraftAttachmentsUploader'
import { SpaceEntryNotesPanel } from './SpaceEntryNotesPanel'
import { extractId } from '@/lib/utils/spaces'
import { formatCurrencyAmount } from '@/lib/utils/currency-format'
import type { AccountType } from '@/lib/constants'
import type {
    IAccount,
    ICategory,
    SpaceEntryDraftAttachmentDto,
    SpaceLinkCandidateDto,
} from '@/types'
import type { SpaceEntryPersonalIntent } from './types'

function getAccountTypeMeta(type: AccountType): { label: string; icon: LucideIcon } {
    switch (type) {
        case 'bank':
            return { label: 'Cuenta bancaria', icon: Building2 }
        case 'cash':
            return { label: 'Efectivo', icon: Banknote }
        case 'wallet':
            return { label: 'Billetera', icon: Wallet }
        case 'credit_card':
            return { label: 'Tarjeta de crédito', icon: CreditCard }
        case 'savings':
            return { label: 'Caja de ahorro', icon: PiggyBank }
        default:
            return { label: 'Cuenta', icon: CircleDollarSign }
    }
}

/**
 * Paso «Extras»: efecto en Mi Finp, adjuntos y notas.
 *
 * Las tres formas de impacto personal son excluyentes y se eligen con las
 * mismas píldoras que `SpacePersonalImpactDialog` usa desde el detalle
 * (`espacios.md` §10). Antes eran un `Select` con una opción «Solo registrar en
 * el espacio» más un toggle de texto para el vínculo avanzado: dos controles
 * para una sola decisión, y la exclusividad quedaba implícita en los efectos.
 *
 * Sólo se ofrece al pagador. Un no pagador decide su impacto personal desde el
 * detalle del movimiento, con la misma regla y la misma lista de candidatos.
 */
export function SpaceEntryExtrasStep({
    isCurrentUserPayer,
    intent,
    personalAccountId,
    categoryId,
    linkedTransactionId,
    currency,
    amount,
    requiresPersonalAccount,
    accounts,
    personalCategories,
    intentError,
    linkIncompatible,
    candidates,
    candidatesLoading,
    candidatesError,
    candidatesExcludedCount,
    attachments,
    attachmentsDisabled,
    onIntentChange,
    onPersonalAccountChange,
    onCategoryChange,
    onLinkedTransactionChange,
    onCandidatesRetry,
    onAttachmentUpload,
    onAttachmentRemove,
    onAttachmentsBlockingChange,
    notes,
    onNotesChange,
}: {
    isCurrentUserPayer: boolean
    intent: SpaceEntryPersonalIntent
    personalAccountId?: string
    categoryId?: string
    linkedTransactionId?: string
    currency: string
    amount: number
    requiresPersonalAccount: boolean
    accounts: IAccount[]
    personalCategories: ICategory[]
    intentError?: string
    linkIncompatible: boolean
    candidates: SpaceLinkCandidateDto[]
    candidatesLoading: boolean
    candidatesError: string | null
    candidatesExcludedCount: number
    attachments: SpaceEntryDraftAttachmentDto[]
    attachmentsDisabled: boolean
    onIntentChange: (intent: SpaceEntryPersonalIntent) => void
    onPersonalAccountChange: (accountId: string) => void
    onCategoryChange: (categoryId: string | undefined) => void
    onLinkedTransactionChange: (transactionId: string) => void
    onCandidatesRetry: () => void
    onAttachmentUpload: (file: File, idempotencyKey: string, attachmentId?: string) => Promise<void>
    onAttachmentRemove: (attachmentId: string) => Promise<void>
    onAttachmentsBlockingChange: (blocked: boolean) => void
    notes: string
    onNotesChange: (value: string) => void
}) {
    const selectedAccount = accounts.find((account) => extractId(account._id) === personalAccountId)

    return (
        <div className="space-y-5">
            {isCurrentUserPayer ? (
                <SpaceDialogPanel>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <SpaceDialogSectionEyebrow>Impacto personal</SpaceDialogSectionEyebrow>
                            <h3 className="text-lg font-semibold tracking-tight text-foreground">
                                Qué querés que pase en tu Finp
                            </h3>
                        </div>

                        <div
                            role="radiogroup"
                            aria-label="Efecto en tu Finp personal"
                            className="flex flex-wrap gap-2"
                        >
                            <SpaceDialogChoice
                                role="radio"
                                active={intent === 'space_only'}
                                onClick={() => onIntentChange('space_only')}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <CircleDollarSign className="h-3.5 w-3.5" />
                                    Sólo en el Espacio
                                </span>
                            </SpaceDialogChoice>
                            <SpaceDialogChoice
                                role="radio"
                                active={intent === 'create_transaction'}
                                onClick={() => onIntentChange('create_transaction')}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <WalletCards className="h-3.5 w-3.5" />
                                    Crear en Mi Finp
                                </span>
                            </SpaceDialogChoice>
                            <SpaceDialogChoice
                                role="radio"
                                active={intent === 'link_existing'}
                                onClick={() => onIntentChange('link_existing')}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <Link2 className="h-3.5 w-3.5" />
                                    Vincular existente
                                </span>
                            </SpaceDialogChoice>
                        </div>

                        {intent === 'space_only' ? (
                            <p className="rounded-[18px] border border-foreground/[0.07] bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                                El gasto queda registrado en el Espacio. Podés decidir su efecto en tu
                                Finp más tarde, desde el detalle del movimiento.
                            </p>
                        ) : null}

                        {intent === 'create_transaction' ? (
                            !requiresPersonalAccount ? (
                                <p className="rounded-[18px] border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground">
                                    Tu parte se registra como gasto operacional sin mover ninguna cuenta personal.
                                </p>
                            ) : accounts.length === 0 ? (
                                <div className="rounded-[18px] border border-warning-soft bg-warning-soft/40 px-3 py-3 text-xs text-warning-foreground">
                                    <p className="font-medium">
                                        Para impactarlo en tu Finp necesitás una cuenta en {currency}.
                                    </p>
                                    <Button asChild size="sm" variant="ghost" className="mt-2 h-8 rounded-full px-3">
                                        <Link href="/accounts">Crear cuenta</Link>
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <SpaceDialogField id="entry-personal-account" label="Cuenta o tarjeta">
                                        <Select
                                            value={personalAccountId ?? ''}
                                            onValueChange={onPersonalAccountChange}
                                        >
                                            <SelectTrigger id="entry-personal-account" className="w-full">
                                                <SelectValue placeholder="Elegí desde dónde pagaste" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accounts.map((account) => {
                                                    const meta = getAccountTypeMeta(account.type)
                                                    const Icon = meta.icon
                                                    return (
                                                        <SelectItem
                                                            key={extractId(account._id)}
                                                            value={extractId(account._id) ?? ''}
                                                            textValue={account.name}
                                                        >
                                                            <span className="flex items-center gap-2.5">
                                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-muted">
                                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                </span>
                                                                <span>
                                                                    <span className="block text-sm font-medium leading-tight">
                                                                        {account.name}
                                                                    </span>
                                                                    <span className="block text-xs leading-tight text-muted-foreground">
                                                                        {meta.label} · {account.currency}
                                                                    </span>
                                                                </span>
                                                            </span>
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </SpaceDialogField>

                                    {personalAccountId ? (
                                        <SpaceDialogField
                                            id="entry-personal-category"
                                            label="Categoría personal"
                                            hint="Solo impacta en tu Finp personal. La categoría del espacio se conserva aparte."
                                        >
                                            <Select
                                                value={categoryId ?? 'none'}
                                                onValueChange={(value) =>
                                                    onCategoryChange(value === 'none' ? undefined : value)
                                                }
                                            >
                                                <SelectTrigger id="entry-personal-category" className="w-full">
                                                    <SelectValue placeholder="Sin categoría" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Sin categoría</SelectItem>
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
                                    ) : null}

                                    {selectedAccount?.type === 'credit_card' ? (
                                        <p className="text-xs text-muted-foreground">
                                            Se registrará un consumo en un pago por{' '}
                                            {formatCurrencyAmount(amount, currency)} en la tarjeta. Tu gasto
                                            personal seguirá siendo tu parte.
                                        </p>
                                    ) : null}
                                </>
                            )
                        ) : null}

                        {intent === 'link_existing' ? (
                            <>
                                <SpaceDialogField id="entry-linked-transaction" label="Transacción compatible">
                                    <SpaceLinkCandidateList
                                        candidates={candidates}
                                        loading={candidatesLoading}
                                        error={candidatesError}
                                        excludedCount={candidatesExcludedCount}
                                        selectedId={linkedTransactionId}
                                        onSelect={onLinkedTransactionChange}
                                        onRetry={onCandidatesRetry}
                                    />
                                </SpaceDialogField>
                                {linkIncompatible ? (
                                    <p className="text-xs font-medium text-destructive" tabIndex={-1}>
                                        La transacción no coincide en monto o moneda con este impacto.
                                    </p>
                                ) : null}
                            </>
                        ) : null}

                        {/*
                          * El error pertenece a la decisión, no a un campo: si no hay
                          * cuentas compatibles el `Select` ni siquiera se renderiza y
                          * colgarlo de ahí lo dejaba sin superficie donde aparecer.
                          */}
                        {intentError ? (
                            <p className="text-xs font-medium text-destructive" tabIndex={-1}>
                                {intentError}
                            </p>
                        ) : null}
                    </div>
                </SpaceDialogPanel>
            ) : null}

            <SpaceDraftAttachmentsUploader
                attachments={attachments}
                disabled={attachmentsDisabled}
                onUpload={onAttachmentUpload}
                onRemove={onAttachmentRemove}
                onBlockingChange={onAttachmentsBlockingChange}
            />

            <SpaceEntryNotesPanel notes={notes} onNotesChange={onNotesChange} />
        </div>
    )
}
