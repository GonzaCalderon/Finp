import type { Currency } from '@/lib/constants'
import type { TransactionFormInput } from '@/lib/validations'

/**
 * Contrato de las sugerencias funcionales de Captura rápida.
 *
 * Dominio deliberadamente separado del aprendizaje semántico: recomendar un
 * módulo tiene umbrales y consecuencias distintas a completar un campo, aunque
 * ambos reutilicen la misma infraestructura de eventos, feedback y privacidad.
 */

/** Versión del sobre. Un borrador de otra versión se descarta al leerlo. */
export const CAPTURE_DRAFT_VERSION = 1

/** Cuánto vive un borrador transportado antes de considerarse obsoleto. */
export const CAPTURE_DRAFT_TTL_MS = 10 * 60 * 1000

export type CaptureIntent =
    | 'record_transaction'
    | 'apply_commitment'
    | 'create_commitment'
    | 'create_rule'
    | 'use_space'
    | 'record_debt'
    | 'use_installments'
    | 'import_transactions'

/**
 * Aceptar un CTA no es completar la función: son estados distintos y la métrica
 * que importa es la última.
 */
export type FunctionalSuggestionState =
    | 'shown'
    | 'accepted'
    | 'dismissed'
    | 'postponed'
    | 'completed'
    | 'expired'

/**
 * De dónde salió cada campo del borrador. Permite que el módulo destino
 * distinga lo que Finp interpretó de lo que es sólo un valor por defecto.
 */
export type DraftFieldSource =
    | 'text'
    | 'alias'
    | 'rule'
    | 'learned'
    | 'default'
    | 'commitment'

export interface CardPurchaseDraftFields {
    type: 'credit_card_expense'
    amount: number
    currency: Currency
    date: string
    description: string
    categoryId: string
    merchant: string
    cardAccountId: string
    installmentCount: number
    firstClosingMonth: string
}

export interface CardPaymentDraftFields {
    type: 'credit_card_payment'
    amount: number
    currency: Currency
    date: string
    description: string
    destinationAccountId: string
}

export type FunctionalSuggestionDraft =
    | {
        kind: 'commitment'
        fields: Partial<CommitmentDraftFields>
        provenance: Partial<Record<keyof CommitmentDraftFields, DraftFieldSource>>
    }
    | {
        kind: 'card_purchase'
        fields: Partial<CardPurchaseDraftFields>
        provenance: Partial<Record<keyof CardPurchaseDraftFields, DraftFieldSource>>
    }
    | {
        kind: 'card_payment'
        fields: Partial<CardPaymentDraftFields>
        provenance: Partial<Record<keyof CardPaymentDraftFields, DraftFieldSource>>
    }
    | {
        kind: 'card_review'
        fields: { href: string }
        provenance: Record<string, never>
    }

export type CaptureTransactionLaunchDraft = Partial<TransactionFormInput> & {
    installmentCount?: number
    firstClosingMonth?: string
    origin?: 'quick_capture'
    captureIntent?: CaptureIntent
    captureSessionId?: string
    allowPotentialDuplicate?: boolean
    requireSourceAccountSelection?: boolean
}

export interface CaptureDraftEnvelope<TFields> {
    version: number
    draftId: string
    intent: CaptureIntent
    origin: {
        surface: 'quick_capture' | 'commitments'
        sessionId: string
        createdAt: string
    }
    expiresAt: string
    fields: Partial<TFields>
    provenance: Partial<Record<keyof TFields, DraftFieldSource>>
    confidence: number
}

/** Campos que Captura rápida puede precargar en el alta de un compromiso. */
export interface CommitmentDraftFields {
    description: string
    amount: number
    currency: Currency
    recurrence: 'monthly' | 'weekly' | 'once'
    dayOfMonth: number
    accountId: string
    categoryId: string
    amountPolicy: 'fixed' | 'variable'
    startDate: string
}

export type CommitmentDraftEnvelope = CaptureDraftEnvelope<CommitmentDraftFields>

export type FunctionalSuggestionActionId =
    | 'primary'
    | 'record_simple'
    | 'dismiss'
    | 'never'

export interface FunctionalSuggestionAction {
    id: FunctionalSuggestionActionId
    label: string
}

export interface FunctionalSuggestion {
    id: string
    intent: CaptureIntent
    /** Clave estable de aquello sobre lo que se sugiere, para recordar descartes. */
    subjectKey: string
    title: string
    /** Por qué Finp propone esta función, en lenguaje del usuario. */
    reason: string
    evidence: string[]
    confidence: number
    /**
     * `inline` se resuelve dentro del diálogo; `route` deriva al módulo
     * responsable llevando el borrador.
     */
    destination: { kind: 'inline' } | { kind: 'route'; href: string }
    draft?: FunctionalSuggestionDraft
    /**
     * Campos y procedencia listos para transportar. El sobre lo arma el cliente,
     * que es quien conoce el `sessionId` de la captura en curso.
     */
    draftFields?: Partial<CommitmentDraftFields>
    draftProvenance?: Partial<Record<keyof CommitmentDraftFields, DraftFieldSource>>
    /** Las clasificaciones financieras obligatorias no se pueden silenciar. */
    canPersistDismissal?: boolean
    actions: FunctionalSuggestionAction[]
    state: FunctionalSuggestionState
    /** Datos de la aplicación pendiente, cuando la intención es aplicarla. */
    commitment?: {
        commitmentId: string
        description: string
        period: string
        currency: Currency
        resolvedAmount: number
        amountPolicy: 'fixed' | 'variable'
        accountId?: string
        categoryId?: string
    }
    card?: {
        operation: 'purchase' | 'payment' | 'existing_installment'
        candidateAccountIds: string[]
        accountId?: string
        installmentCount?: number
        firstClosingMonth?: string
    }
}
