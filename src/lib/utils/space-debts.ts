import type { SpaceBalanceItem } from '@/types'

export interface DebtPayment {
    fromParticipantId: string
    toParticipantId: string
    amount: number
}

/**
 * Minimiza la cantidad de pagos necesarios para saldar todos los balances.
 * Algoritmo greedy: cruza el deudor con mayor deuda contra el acreedor con mayor crédito.
 */
export function simplifyDebts(balances: SpaceBalanceItem[]): DebtPayment[] {
    const debtors = balances
        .filter((item) => item.balanceReporting < 0)
        .map((item) => ({ participantId: item.participantId, pending: Math.abs(item.balanceReporting) }))
        .sort((a, b) => b.pending - a.pending)

    const creditors = balances
        .filter((item) => item.balanceReporting > 0)
        .map((item) => ({ participantId: item.participantId, pending: item.balanceReporting }))
        .sort((a, b) => b.pending - a.pending)

    const payments: DebtPayment[] = []
    let di = 0
    let ci = 0

    while (debtors[di] && creditors[ci]) {
        const debtor = debtors[di]!
        const creditor = creditors[ci]!
        const amount = Math.round(Math.min(debtor.pending, creditor.pending) * 100) / 100

        if (amount > 0.01) {
            payments.push({
                fromParticipantId: debtor.participantId,
                toParticipantId: creditor.participantId,
                amount,
            })
        }

        debtor.pending = Math.round((debtor.pending - amount) * 100) / 100
        creditor.pending = Math.round((creditor.pending - amount) * 100) / 100

        if (debtor.pending <= 0.01) di++
        if (creditor.pending <= 0.01) ci++
    }

    return payments
}
