import type { IInstallmentPlan, ITransaction } from '@/types'
import { buildMonthlyCardPaymentSummary, isCreditCardPaymentType } from '@/lib/utils/credit-card'
import { getOperationalExpenseAmount, getOperationalIncomeAmount } from '@/lib/utils/operational-amount'
import {
    addCurrencyAmount,
    addCurrencyTotals,
    emptyCurrencyTotals,
    subtractCurrencyTotals,
    type CurrencyTotals,
} from '@/lib/utils/currency-totals'

export {
    addCurrencyAmount,
    addCurrencyTotals,
    emptyCurrencyTotals,
    subtractCurrencyTotals,
    type CurrencyTotals,
} from '@/lib/utils/currency-totals'

export interface TransactionPeriodSummary {
    income: CurrencyTotals
    expense: CurrencyTotals
    creditCardExpense: CurrencyTotals
    balance: CurrencyTotals
}

export function buildTransactionPeriodSummary({
    month,
    monthStartDay = 1,
    transactions,
    plans,
    operationalStartDate,
}: {
    month: string
    monthStartDay?: number
    transactions: ITransaction[]
    plans: IInstallmentPlan[]
    operationalStartDate?: string | Date
}): TransactionPeriodSummary {
    const income = transactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((totals, transaction) => {
            addCurrencyAmount(totals, transaction.currency, getOperationalIncomeAmount(transaction))
            return totals
        }, emptyCurrencyTotals())

    const regularExpense = transactions
        .filter((transaction) => transaction.type === 'expense' && !transaction.installmentPlanId)
        .reduce((totals, transaction) => {
            addCurrencyAmount(totals, transaction.currency, getOperationalExpenseAmount(transaction))
            return totals
        }, emptyCurrencyTotals())

    const creditCardPayments = transactions
        .filter((transaction) => isCreditCardPaymentType(transaction.type))
        .reduce((totals, transaction) => {
            addCurrencyAmount(totals, transaction.currency, transaction.amount)
            return totals
        }, emptyCurrencyTotals())

    const creditCardMonthlySummary = buildMonthlyCardPaymentSummary({
        month,
        monthStartDay,
        plans,
        transactions,
        operationalStartDate,
    })

    const creditCardExpense = creditCardMonthlySummary.reduce((totals, cardSummary) => {
        cardSummary.items.forEach((charge) => {
            addCurrencyAmount(totals, charge.currency, charge.amount)
        })
        return totals
    }, emptyCurrencyTotals())

    const exchangeNet = transactions
        .filter((transaction) => transaction.type === 'exchange')
        .reduce((totals, transaction) => {
            addCurrencyAmount(totals, transaction.currency, -transaction.amount)

            if (transaction.destinationCurrency && typeof transaction.destinationAmount === 'number') {
                addCurrencyAmount(totals, transaction.destinationCurrency, transaction.destinationAmount)
            }

            return totals
        }, emptyCurrencyTotals())

    const loanNet = transactions
        .filter((transaction) => transaction.type === 'transfer')
        .reduce((totals, transaction) => {
            const sourceType =
                transaction.sourceAccountId &&
                typeof transaction.sourceAccountId === 'object' &&
                'type' in transaction.sourceAccountId
                    ? transaction.sourceAccountId.type
                    : undefined
            const destinationType =
                transaction.destinationAccountId &&
                typeof transaction.destinationAccountId === 'object' &&
                'type' in transaction.destinationAccountId
                    ? transaction.destinationAccountId.type
                    : undefined

            if (sourceType === 'debt') {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
            }
            if (destinationType === 'debt') {
                addCurrencyAmount(totals, transaction.currency, -transaction.amount)
            }
            return totals
        }, emptyCurrencyTotals())

    const expense = addCurrencyTotals(regularExpense, creditCardPayments)

    return {
        income,
        expense,
        creditCardExpense,
        balance: addCurrencyTotals(
            addCurrencyTotals(subtractCurrencyTotals(income, expense), exchangeNet),
            loanNet
        ),
    }
}
