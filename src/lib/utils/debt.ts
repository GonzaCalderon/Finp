import type { IDebt } from '@/types/debt'
import type { SpaceBalanceItem, ISpaceParticipant } from '@/types'
import { simplifyDebts } from '@/lib/utils/space-debts'
import type { DebtDirection } from '@/lib/constants'

export interface SpaceDebtItem {
    counterpartyParticipantId: string
    counterpartyDisplayName: string
    amount: number
    currency: string
    direction: DebtDirection
}

export interface ConsolidatedDebtByPerson {
    counterpartyNameSnapshot: string
    counterpartyUserId?: string
    counterpartyParticipantId?: string
    payable: Record<string, number>    // currency -> amount
    receivable: Record<string, number>
}

export interface DebtSummaryByCurrency {
    byCurrency: Record<string, number>
}

export interface DebtSummary {
    payable: DebtSummaryByCurrency
    receivable: DebtSummaryByCurrency
    byPerson: ConsolidatedDebtByPerson[]
}

/**
 * Calcula deudas netas desde balances de espacio usando el algoritmo simplificado (greedy).
 * Reutiliza simplifyDebts() de space-debts.ts para minimizar número de transacciones.
 *
 * Retorna solo las deudas que involucran al usuario actual.
 */
export function computeSimplifiedSpaceDebts(
    balances: SpaceBalanceItem[],
    participants: ISpaceParticipant[],
    currentUserParticipantId: string,
    currency: string
): SpaceDebtItem[] {
    const payments = simplifyDebts(balances)
    const items: SpaceDebtItem[] = []

    for (const payment of payments) {
        const fromId = payment.fromParticipantId
        const toId = payment.toParticipantId

        if (fromId === currentUserParticipantId) {
            // El usuario actual debe pagarle a alguien
            const creditor = participants.find((p) => p._id.toString() === toId)
            items.push({
                counterpartyParticipantId: toId,
                counterpartyDisplayName: creditor?.displayName ?? toId,
                amount: payment.amount,
                currency,
                direction: 'payable',
            })
        } else if (toId === currentUserParticipantId) {
            // Alguien le debe pagar al usuario actual
            const debtor = participants.find((p) => p._id.toString() === fromId)
            items.push({
                counterpartyParticipantId: fromId,
                counterpartyDisplayName: debtor?.displayName ?? fromId,
                amount: payment.amount,
                currency,
                direction: 'receivable',
            })
        }
    }

    return items
}

/**
 * Calcula deudas desde balances de espacio usando el criterio directo (proporcional).
 * Cada deudor paga a cada acreedor en proporción a su crédito sobre el total de créditos.
 *
 * Retorna solo las deudas que involucran al usuario actual.
 */
export function computeDirectSpaceDebts(
    balances: SpaceBalanceItem[],
    participants: ISpaceParticipant[],
    currentUserParticipantId: string,
    currency: string
): SpaceDebtItem[] {
    const debtors = balances.filter((b) => b.balanceReporting < 0)
    const creditors = balances.filter((b) => b.balanceReporting > 0)
    const totalCredit = creditors.reduce((sum, c) => sum + c.balanceReporting, 0)

    const items: SpaceDebtItem[] = []

    if (totalCredit <= 0.01) return items

    for (const debtor of debtors) {
        const debtAbs = Math.abs(debtor.balanceReporting)
        for (const creditor of creditors) {
            const proportional = Math.round((debtAbs * (creditor.balanceReporting / totalCredit)) * 100) / 100
            if (proportional <= 0.01) continue

            const fromId = debtor.participantId
            const toId = creditor.participantId

            if (fromId === currentUserParticipantId) {
                const creditorParticipant = participants.find((p) => p._id.toString() === toId)
                items.push({
                    counterpartyParticipantId: toId,
                    counterpartyDisplayName: creditorParticipant?.displayName ?? toId,
                    amount: proportional,
                    currency,
                    direction: 'payable',
                })
            } else if (toId === currentUserParticipantId) {
                const debtorParticipant = participants.find((p) => p._id.toString() === fromId)
                items.push({
                    counterpartyParticipantId: fromId,
                    counterpartyDisplayName: debtorParticipant?.displayName ?? fromId,
                    amount: proportional,
                    currency,
                    direction: 'receivable',
                })
            }
        }
    }

    return items
}

/**
 * Consolida deudas activas agrupando por contraparte y moneda.
 */
export function consolidateDebtsByPerson(debts: IDebt[]): ConsolidatedDebtByPerson[] {
    const byKey = new Map<string, ConsolidatedDebtByPerson>()

    for (const debt of debts) {
        const key = debt.counterpartyUserId?.toString() ?? debt.counterpartyParticipantId?.toString() ?? debt.counterpartyNameSnapshot
        const existing = byKey.get(key) ?? {
            counterpartyNameSnapshot: debt.counterpartyNameSnapshot,
            counterpartyUserId: debt.counterpartyUserId?.toString(),
            counterpartyParticipantId: debt.counterpartyParticipantId?.toString(),
            payable: {},
            receivable: {},
        }

        if (debt.direction === 'payable') {
            existing.payable[debt.currency] = (existing.payable[debt.currency] ?? 0) + debt.remainingAmount
        } else {
            existing.receivable[debt.currency] = (existing.receivable[debt.currency] ?? 0) + debt.remainingAmount
        }

        byKey.set(key, existing)
    }

    return Array.from(byKey.values())
}

/**
 * Construye resumen de deudas separando payable/receivable por moneda.
 * Solo considera deudas con status active o partially_paid.
 */
export function buildDebtSummary(debts: IDebt[]): DebtSummary {
    const active = debts.filter((d) => d.status === 'active' || d.status === 'partially_paid')
    const payable: Record<string, number> = {}
    const receivable: Record<string, number> = {}

    for (const debt of active) {
        if (debt.direction === 'payable') {
            payable[debt.currency] = (payable[debt.currency] ?? 0) + debt.remainingAmount
        } else {
            receivable[debt.currency] = (receivable[debt.currency] ?? 0) + debt.remainingAmount
        }
    }

    return {
        payable: { byCurrency: payable },
        receivable: { byCurrency: receivable },
        byPerson: consolidateDebtsByPerson(active),
    }
}

/**
 * Verifica que la moneda de la cuenta es compatible con la moneda de la deuda.
 * Retorna true si la cuenta soporta la moneda requerida.
 */
export function isAccountCurrencyCompatible(
    accountCurrency: string,
    accountSupportedCurrencies: string[] | undefined,
    debtCurrency: string
): boolean {
    if (accountCurrency === debtCurrency) return true
    if (accountSupportedCurrencies?.includes(debtCurrency)) return true
    return false
}
