import { moneyFromDecimal } from '@/lib/utils/money'
import { financialDateKeyFromInstant } from '@/lib/utils/space-financial-v2'
import { extractId } from '@/lib/utils/spaces'
import type { ITransaction } from '@/types'

/**
 * Autoridad única de "qué transacción personal puede vincularse a este
 * impacto". Alta (`space-entry-service-v2.ts`), edición/resolución
 * (`space-personal-impact-service-v2.ts`) y preview/candidatos
 * (`space-financial-preview-v2.ts`, `link-candidates`) invocan esta misma
 * evaluación en vez de repetirla — antes cada superficie tenía su propia
 * copia, con reglas distintas: sólo el alta validaba la cuenta, sólo el
 * resolve exigía el monto operacional exacto y ninguna de las dos aceptaba
 * `credit_card_expense` como equivalente a `expense`, algo que el alta sí
 * aceptaba (decisión 0012: el pago con tarjeta en un pago crea
 * `credit_card_expense`, la salida real legítima de ese pagador).
 *
 * No decide "ya vinculada a otra cosa": esa exclusión depende de una
 * consulta (`buildLinkCandidateQuery`) porque compara contra el documento
 * antes de traerlo, no contra el ya traído.
 */

export type LinkImpactVariant =
    | 'payer_expense'
    | 'participant_expense'
    | 'advance'
    | 'settlement_paid'
    | 'settlement_received'

export type LinkAccountRule = 'none' | 'source_required' | 'destination_required'

export function resolveLinkImpactVariant(input: {
    kind: 'personal_expense' | 'advance' | 'settlement_paid' | 'settlement_received'
    isPayer: boolean
}): LinkImpactVariant {
    if (input.kind === 'advance') return 'advance'
    if (input.kind === 'settlement_paid') return 'settlement_paid'
    if (input.kind === 'settlement_received') return 'settlement_received'
    return input.isPayer ? 'payer_expense' : 'participant_expense'
}

export function expectedLinkTransactionType(variant: LinkImpactVariant): ITransaction['type'] {
    if (variant === 'settlement_paid') return 'personal_debt_payment'
    if (variant === 'settlement_received') return 'personal_debt_collect'
    return 'expense'
}

export function linkAccountRuleForVariant(variant: LinkImpactVariant): LinkAccountRule {
    if (variant === 'participant_expense') return 'none'
    if (variant === 'settlement_received') return 'destination_required'
    return 'source_required'
}

export type LinkRequirementV2 = {
    transactionType: ITransaction['type']
    currency: string
    amount: number
    operationalAmount: number
    accountRule: LinkAccountRule
    /** Ausente cuando el llamador no puede evaluar el día financiero (preview
     *  no recibe fecha del movimiento); el chequeo se omite, no falla. */
    dateKey?: string
    timezone?: string
}

export type LinkCandidateIssue =
    | 'type_mismatch'
    | 'currency_mismatch'
    | 'amount_mismatch'
    | 'operational_mismatch'
    | 'date_mismatch'
    | 'account_mismatch'

type AssessableTransaction = Pick<
    ITransaction,
    'type' | 'currency' | 'amount' | 'operationalAmount' | 'date' | 'sourceAccountId' | 'destinationAccountId'
>

/** `expense` y `credit_card_expense` son la misma salida real desde la
 *  perspectiva de un vínculo: la decisión 0012 hace que un pago con tarjeta
 *  en un pago sea, para el Espacio, el equivalente de un `expense` pagado
 *  con cuenta. */
function transactionTypeMatches(actual: ITransaction['type'], expected: ITransaction['type']): boolean {
    if (actual === expected) return true
    return expected === 'expense' && actual === 'credit_card_expense'
}

export function assessLinkCandidateV2(
    transaction: AssessableTransaction,
    requirement: LinkRequirementV2
): { compatible: boolean; issues: LinkCandidateIssue[] } {
    const issues: LinkCandidateIssue[] = []

    if (!transactionTypeMatches(transaction.type, requirement.transactionType)) {
        issues.push('type_mismatch')
    }
    if (transaction.currency !== requirement.currency) {
        issues.push('currency_mismatch')
    }
    if (
        moneyFromDecimal(requirement.currency, transaction.amount).minorUnits !==
        moneyFromDecimal(requirement.currency, requirement.amount).minorUnits
    ) {
        issues.push('amount_mismatch')
    }
    if (
        moneyFromDecimal(requirement.currency, transaction.operationalAmount ?? transaction.amount).minorUnits !==
        moneyFromDecimal(requirement.currency, requirement.operationalAmount).minorUnits
    ) {
        issues.push('operational_mismatch')
    }
    if (
        requirement.dateKey && requirement.timezone &&
        financialDateKeyFromInstant(transaction.date, requirement.timezone) !== requirement.dateKey
    ) {
        issues.push('date_mismatch')
    }

    const sourceAccountId = extractId(transaction.sourceAccountId)
    const destinationAccountId = extractId(transaction.destinationAccountId)
    if (requirement.accountRule === 'none' && (sourceAccountId || destinationAccountId)) {
        issues.push('account_mismatch')
    }
    if (requirement.accountRule === 'source_required' && !sourceAccountId) {
        issues.push('account_mismatch')
    }
    if (requirement.accountRule === 'destination_required' && !destinationAccountId) {
        issues.push('account_mismatch')
    }

    return { compatible: issues.length === 0, issues }
}

/** Mensaje único por issue, en el mismo orden de prioridad que usaba cada
 *  copia manual: tipo/moneda primero, después monto, operacional, fecha y
 *  cuenta. `resolve` lanza sobre el primero; preview y candidatos reportan
 *  la lista completa. */
export function describeLinkIssue(issue: LinkCandidateIssue, accountRule: LinkAccountRule): string {
    switch (issue) {
        case 'type_mismatch':
        case 'currency_mismatch':
            return 'Tipo o moneda incompatibles con el Espacio.'
        case 'amount_mismatch':
        case 'operational_mismatch':
            return 'La transacción elegida no coincide con el impacto esperado.'
        case 'date_mismatch':
            return 'La fecha no coincide con el día financiero del Espacio.'
        case 'account_mismatch':
            if (accountRule === 'none') return 'La parte de un no pagador no debe mover una cuenta.'
            if (accountRule === 'source_required') return 'La salida real exige cuenta origen.'
            return 'La entrada real exige cuenta destino.'
    }
}

const ISSUE_PRIORITY: LinkCandidateIssue[] = [
    'type_mismatch',
    'currency_mismatch',
    'amount_mismatch',
    'operational_mismatch',
    'date_mismatch',
    'account_mismatch',
]

/** El primer issue por prioridad, para un llamador (como `resolve`) que
 *  debe fallar con un único código y mensaje. */
export function firstLinkIssue(issues: LinkCandidateIssue[]): LinkCandidateIssue | undefined {
    return ISSUE_PRIORITY.find((candidate) => issues.includes(candidate))
}

/** Código de error estable por issue, igual al que ya exponía cada copia
 *  manual — tipo y moneda comparten uno solo, como antes. */
export function linkIssueErrorCode(issue: LinkCandidateIssue): string {
    switch (issue) {
        case 'type_mismatch':
        case 'currency_mismatch':
            return 'SPACE_TRANSACTION_TYPE_MISMATCH'
        case 'amount_mismatch':
            return 'SPACE_TRANSACTION_AMOUNT_MISMATCH'
        case 'operational_mismatch':
            return 'SPACE_TRANSACTION_OPERATIONAL_MISMATCH'
        case 'date_mismatch':
            return 'SPACE_TRANSACTION_DATE_MISMATCH'
        case 'account_mismatch':
            return 'SPACE_TRANSACTION_ACCOUNT_MISMATCH'
    }
}
