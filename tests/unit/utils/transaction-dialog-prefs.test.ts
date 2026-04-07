import { beforeEach, describe, expect, it } from 'vitest'

import {
    getRecentCategoryIds,
    getStoredAccountId,
    getStoredExpensePaymentMethod,
    getStoredTransactionType,
    persistTransactionDialogPrefs,
} from '@/components/shared/transaction-dialog-prefs'

describe('transaction-dialog-prefs', () => {
    beforeEach(() => {
        window.localStorage.clear()
    })

    it('guarda gasto con tarjeta como tipo principal gasto y payment method tarjeta', () => {
        persistTransactionDialogPrefs({
            type: 'credit_card_expense',
            paymentMethod: 'credit_card',
            sourceAccountId: 'card-1',
            categoryId: 'cat-1',
        })

        expect(getStoredTransactionType()).toBe('expense')
        expect(getStoredExpensePaymentMethod()).toBe('credit_card')
        expect(getStoredAccountId('expense:credit_card')).toBe('card-1')
        expect(getRecentCategoryIds('expense')).toEqual(['cat-1'])
    })

    it('mantiene categorias recientes unicas y limitadas', () => {
        ;['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-3'].forEach((categoryId) => {
            persistTransactionDialogPrefs({
                type: 'expense',
                paymentMethod: 'debit',
                sourceAccountId: 'bank-1',
                categoryId,
            })
        })

        expect(getRecentCategoryIds('expense')).toEqual(['cat-3', 'cat-7', 'cat-6', 'cat-5', 'cat-4', 'cat-2'])
    })

    it('guarda contexto de cuentas para transferencias', () => {
        persistTransactionDialogPrefs({
            type: 'transfer',
            sourceAccountId: 'bank-1',
            destinationAccountId: 'wallet-1',
        })

        expect(getStoredTransactionType()).toBe('transfer')
        expect(getStoredAccountId('transfer:source')).toBe('bank-1')
        expect(getStoredAccountId('transfer:destination')).toBe('wallet-1')
    })
})
