import {
    getCurrentFinancialPeriod,
    parseFinancialPeriod,
    shiftFinancialPeriod,
} from '../../../src/lib/utils/period'

export const FINANCIAL_SMOKE_TAG = 'e2e-financial-smoke'
export const FINANCIAL_SMOKE_USER_NAME = 'Financial Smoke User'

export const FINANCIAL_SMOKE_IDS = {
    bankAccount: '700000000000000000000001',
    negativeAccount: '700000000000000000000002',
    creditCard: '700000000000000000000003',
    partialDebt: '700000000000000000000011',
    paidDebt: '700000000000000000000012',
    installmentPlan: '700000000000000000000021',
    historicalIncome: '700000000000000000000031',
    historicalExpenseArs: '700000000000000000000032',
    historicalExpenseUsd: '700000000000000000000033',
    currentIncome: '700000000000000000000034',
    currentExpenseArs: '700000000000000000000035',
    currentExpenseUsd: '700000000000000000000036',
    currentExchange: '700000000000000000000037',
    negativeExpense: '700000000000000000000038',
    partialDebtPayment: '700000000000000000000039',
    paidDebtCollect: '70000000000000000000003a',
    installmentPurchase: '70000000000000000000003b',
    partialDebtCreation: '700000000000000000000041',
    partialDebtMovement: '700000000000000000000042',
    paidDebtCreation: '700000000000000000000043',
    paidDebtMovement: '700000000000000000000044',
} as const

export const FINANCIAL_SMOKE_NAMES = {
    bankAccount: 'E2E Smoke Bimonetaria',
    negativeAccount: 'E2E Smoke Saldo Negativo',
    creditCard: 'E2E Smoke Tarjeta',
    partialDebt: 'E2E Smoke Préstamo Parcial',
    paidDebt: 'E2E Smoke Préstamo Saldado',
    installment: 'E2E Smoke Notebook 3 cuotas',
    historicalIncome: 'E2E Smoke ingreso histórico',
    historicalExpenseArs: 'E2E Smoke gasto histórico ARS',
    historicalExpenseUsd: 'E2E Smoke gasto histórico USD',
    currentIncome: 'E2E Smoke sueldo actual',
    currentExpenseArs: 'E2E Smoke gasto actual ARS',
    currentExpenseUsd: 'E2E Smoke gasto actual USD',
    currentExchange: 'E2E Smoke cambio ARS USD',
    negativeExpense: 'E2E Smoke saldo negativo',
    partialDebtPayment: 'E2E Smoke pago parcial préstamo',
    paidDebtCollect: 'E2E Smoke cobro total préstamo',
} as const

export const FINANCIAL_SMOKE_EXPECTED = {
    current: {
        income: { ars: 200_000, usd: 0 },
        expense: { ars: 75_000, usd: 300 },
        creditCardExpense: { ars: 40_000, usd: 0 },
        balance: { ars: 115_000, usd: -290 },
        availableBalance: { ars: 235_000, usd: 760 },
        cardDebt: { ars: 40_000, usd: 0 },
    },
    historical: {
        income: { ars: 50_000, usd: 0 },
        expense: { ars: 20_000, usd: 100 },
        creditCardExpense: { ars: 0, usd: 0 },
        balance: { ars: 30_000, usd: -100 },
        availableBalance: { ars: 140_000, usd: 900 },
    },
    accounts: {
        bank: { ARS: 250_000, USD: 760 },
        negative: { ARS: -15_000, USD: 0 },
        creditCard: { ARS: -120_000, USD: 0 },
    },
    debts: {
        payable: { ARS: 80_000 },
        partialRemaining: 80_000,
        paidRemaining: 0,
    },
    netWorth: {
        assets: { ars: 235_000, usd: 760 },
        liabilities: { ars: 200_000, usd: 0 },
        total: { ars: 35_000, usd: 760 },
    },
} as const

export function deriveFinancialSmokeEmail(email: string): string {
    const normalized = email.trim().toLowerCase()
    const separator = normalized.lastIndexOf('@')
    if (separator <= 0 || separator === normalized.length - 1) {
        throw new Error('TEST_USER_EMAIL no permite derivar el usuario financiero.')
    }

    return `${normalized.slice(0, separator)}+financial-smoke${normalized.slice(separator)}`
}

function dateInsidePeriod(period: string, offsetDays: number): Date {
    const { start } = parseFinancialPeriod(period)
    const value = new Date(start)
    value.setDate(value.getDate() + offsetDays)
    value.setHours(12, 0, 0, 0)
    return value
}

export function buildFinancialSmokePeriods(now = new Date()) {
    const current = getCurrentFinancialPeriod(now)
    const historical = shiftFinancialPeriod(current, -1)

    return {
        current,
        historical,
        dates: {
            historicalIncome: dateInsidePeriod(historical, 2),
            historicalExpenseArs: dateInsidePeriod(historical, 4),
            historicalExpenseUsd: dateInsidePeriod(historical, 6),
            currentIncome: dateInsidePeriod(current, 2),
            currentExpenseArs: dateInsidePeriod(current, 4),
            currentExpenseUsd: dateInsidePeriod(current, 6),
            currentExchange: dateInsidePeriod(current, 8),
            negativeExpense: dateInsidePeriod(current, 10),
            partialDebtPayment: dateInsidePeriod(current, 12),
            paidDebtCollect: dateInsidePeriod(current, 14),
            installmentPurchase: dateInsidePeriod(current, 1),
        },
    }
}
