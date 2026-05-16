import { describe, expect, it } from 'vitest'
import {
    getOperationalAmount,
    getOperationalExpenseAmount,
    getOperationalIncomeAmount,
    getPrimaryDisplayAmount,
    isNonOperationalTransactionType,
    isSplitTransaction,
} from '@/lib/utils/operational-amount'

describe('operational amount helpers', () => {
    it('gasto de espacio pagado por mí: reporting usa operationalAmount / mi parte', () => {
        const transaction = {
            type: 'expense' as const,
            amount: 1000,
            operationalAmount: 400,
        }

        expect(getOperationalAmount(transaction)).toBe(400)
        expect(getOperationalExpenseAmount(transaction)).toBe(400)
        expect(getPrimaryDisplayAmount(transaction)).toBe(400)
        expect(isSplitTransaction(transaction)).toBe(true)
    })

    it('gasto de espacio donde no pago: monto operativo es mi parte', () => {
        const transaction = {
            type: 'expense' as const,
            amount: 250,
            operationalAmount: 250,
        }

        expect(getOperationalAmount(transaction)).toBe(250)
        expect(getOperationalExpenseAmount(transaction)).toBe(250)
        expect(isSplitTransaction(transaction)).toBe(false)
    })

    it('transacción sin operationalAmount usa amount normal', () => {
        const transaction = {
            type: 'expense' as const,
            amount: 700,
        }

        expect(getOperationalAmount(transaction)).toBe(700)
        expect(getPrimaryDisplayAmount(transaction)).toBe(700)
    })

    it('gasto normal no cambia comportamiento', () => {
        expect(getOperationalExpenseAmount({ type: 'expense', amount: 300 })).toBe(300)
        expect(getOperationalIncomeAmount({ type: 'income', amount: 300 })).toBe(300)
    })

    it('pagos/cobros de deuda mueven cuenta pero no son operativos', () => {
        expect(isNonOperationalTransactionType('personal_debt_payment')).toBe(true)
        expect(isNonOperationalTransactionType('personal_debt_collect')).toBe(true)
        expect(getOperationalAmount({ type: 'personal_debt_payment', amount: 1000 })).toBe(0)
        expect(getOperationalAmount({ type: 'personal_debt_collect', amount: 1000 })).toBe(0)
    })
})
