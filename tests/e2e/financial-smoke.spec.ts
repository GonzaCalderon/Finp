import { expect, test, type APIResponse, type Page, type TestInfo } from '@playwright/test'

import {
    buildFinancialSmokePeriods,
    deriveFinancialSmokeEmail,
    FINANCIAL_SMOKE_EXPECTED,
    FINANCIAL_SMOKE_IDS,
    FINANCIAL_SMOKE_NAMES,
} from './helpers/financial-smoke'
import { TEST_USER } from './helpers/auth'

type CurrencyTotals = { ars: number; usd: number }
type AccountBalances = { ARS: number; USD: number }

type DashboardPayload = {
    summary: {
        totalIncome: CurrencyTotals
        totalExpense: CurrencyTotals
        balance: CurrencyTotals
        availableBalance: CurrencyTotals
        totalCreditCardExpense: CurrencyTotals
        totalDebt: CurrencyTotals
    }
    accounts: Array<{
        _id: string
        name: string
        balancesByCurrency: AccountBalances
    }>
    netWorth: {
        assets: CurrencyTotals
        liabilities: CurrencyTotals
        total: CurrencyTotals
    }
}

type TransactionsPayload = {
    transactions: Array<{ _id: string; description: string }>
    summary: {
        income: CurrencyTotals
        expense: CurrencyTotals
        creditCardExpense: CurrencyTotals
        balance: CurrencyTotals
        availableBalance: CurrencyTotals
    }
}

type AccountsPayload = {
    accounts: Array<{
        _id: string
        name: string
        balancesByCurrency: AccountBalances
    }>
}

type DebtsPayload = {
    debts: Array<{
        _id: string
        status: string
        remainingAmount: number
        counterpartyNameSnapshot: string
    }>
}

type DebtSummaryPayload = {
    summary: {
        payable: { byCurrency: Record<string, number> }
        receivable: { byCurrency: Record<string, number> }
    }
}

async function json<T>(response: APIResponse): Promise<T> {
    expect(response.ok(), await response.text()).toBe(true)
    return response.json() as Promise<T>
}

async function loginAsFinancialSmokeUser(page: Page) {
    await page.goto('/login')
    await page.getByTestId('login-email').fill(
        deriveFinancialSmokeEmail(TEST_USER.email)
    )
    await page.getByTestId('login-password').fill(TEST_USER.password)
    await page.getByTestId('login-submit').click()
    await page.waitForURL('**/dashboard', { timeout: 10_000 })
}

async function attachPageEvidence(
    page: Page,
    testInfo: TestInfo,
    name: string
) {
    await expect(page.locator('body')).not.toContainText('Error al cargar')
    await testInfo.attach(`${testInfo.project.name}-${name}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
    })
}

test.describe('Smoke financiero real', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsFinancialSmokeUser(page)
    })

    test('coinciden Dashboard, Transacciones, Cuentas y Deudas', async ({
        page,
    }, testInfo) => {
        const periods = buildFinancialSmokePeriods()
        const [dashboard, transactions, accounts, debts, debtSummary] =
            await Promise.all([
                json<DashboardPayload>(
                    await page.request.get(`/api/dashboard?month=${periods.current}`)
                ),
                json<TransactionsPayload>(
                    await page.request.get(
                        `/api/transactions?month=${periods.current}&limit=200`
                    )
                ),
                json<AccountsPayload>(await page.request.get('/api/accounts')),
                json<DebtsPayload>(
                    await page.request.get('/api/debts?includeIgnored=true')
                ),
                json<DebtSummaryPayload>(
                    await page.request.get('/api/debts/summary')
                ),
            ])

        expect(dashboard.summary.totalIncome).toEqual(
            FINANCIAL_SMOKE_EXPECTED.current.income
        )
        expect(dashboard.summary.totalExpense).toEqual(
            FINANCIAL_SMOKE_EXPECTED.current.expense
        )
        expect(dashboard.summary.totalCreditCardExpense).toEqual(
            FINANCIAL_SMOKE_EXPECTED.current.creditCardExpense
        )
        expect(dashboard.summary.balance).toEqual(
            FINANCIAL_SMOKE_EXPECTED.current.balance
        )
        expect(dashboard.summary.availableBalance).toEqual(
            FINANCIAL_SMOKE_EXPECTED.current.availableBalance
        )
        expect(dashboard.summary.totalDebt).toEqual(
            FINANCIAL_SMOKE_EXPECTED.current.cardDebt
        )

        expect(transactions.summary).toEqual({
            income: FINANCIAL_SMOKE_EXPECTED.current.income,
            expense: FINANCIAL_SMOKE_EXPECTED.current.expense,
            creditCardExpense:
                FINANCIAL_SMOKE_EXPECTED.current.creditCardExpense,
            balance: FINANCIAL_SMOKE_EXPECTED.current.balance,
            availableBalance:
                FINANCIAL_SMOKE_EXPECTED.current.availableBalance,
        })

        const accountById = new Map(
            accounts.accounts.map((account) => [account._id, account])
        )
        expect(
            accountById.get(FINANCIAL_SMOKE_IDS.bankAccount)?.balancesByCurrency
        ).toEqual(FINANCIAL_SMOKE_EXPECTED.accounts.bank)
        expect(
            accountById.get(FINANCIAL_SMOKE_IDS.negativeAccount)
                ?.balancesByCurrency
        ).toEqual(FINANCIAL_SMOKE_EXPECTED.accounts.negative)
        expect(
            accountById.get(FINANCIAL_SMOKE_IDS.creditCard)?.balancesByCurrency
        ).toEqual(FINANCIAL_SMOKE_EXPECTED.accounts.creditCard)

        for (const dashboardAccount of dashboard.accounts) {
            const account = accountById.get(dashboardAccount._id)
            expect(account?.balancesByCurrency).toEqual(
                dashboardAccount.balancesByCurrency
            )
        }

        expect(debtSummary.summary.payable.byCurrency).toEqual(
            FINANCIAL_SMOKE_EXPECTED.debts.payable
        )
        expect(debtSummary.summary.receivable.byCurrency).toEqual({})
        expect(dashboard.netWorth).toEqual(FINANCIAL_SMOKE_EXPECTED.netWorth)

        const partialDebt = debts.debts.find(
            (debt) => debt._id === FINANCIAL_SMOKE_IDS.partialDebt
        )
        const paidDebt = debts.debts.find(
            (debt) => debt._id === FINANCIAL_SMOKE_IDS.paidDebt
        )
        expect(partialDebt).toMatchObject({
            status: 'partially_paid',
            remainingAmount:
                FINANCIAL_SMOKE_EXPECTED.debts.partialRemaining,
        })
        expect(paidDebt).toMatchObject({
            status: 'paid',
            remainingAmount: FINANCIAL_SMOKE_EXPECTED.debts.paidRemaining,
        })

        await page.goto('/dashboard')
        await expect(
            page.getByText(FINANCIAL_SMOKE_NAMES.paidDebtCollect, { exact: true })
        ).toBeVisible()
        await attachPageEvidence(page, testInfo, 'dashboard')

        await page.goto(`/transactions?month=${periods.current}`)
        await expect(
            page.getByText(FINANCIAL_SMOKE_NAMES.partialDebtPayment, {
                exact: true,
            })
        ).toBeVisible()
        await attachPageEvidence(page, testInfo, 'transactions')

        await page.goto('/accounts')
        await expect(
            page.getByText(FINANCIAL_SMOKE_NAMES.bankAccount, { exact: true })
        ).toBeVisible()
        await expect(
            page.getByText(FINANCIAL_SMOKE_NAMES.negativeAccount, {
                exact: true,
            })
        ).toBeVisible()
        await attachPageEvidence(page, testInfo, 'accounts')

        await page.goto('/debts')
        await expect(
            page
                .locator('p:visible')
                .filter({ hasText: FINANCIAL_SMOKE_NAMES.partialDebt })
                .first()
        ).toBeVisible()
        await attachPageEvidence(page, testInfo, 'debts')
    })

    test('el histórico conserva resultados y saldos acumulados', async ({
        page,
    }) => {
        const periods = buildFinancialSmokePeriods()
        const [dashboard, transactions] = await Promise.all([
            json<DashboardPayload>(
                await page.request.get(
                    `/api/dashboard?month=${periods.historical}`
                )
            ),
            json<TransactionsPayload>(
                await page.request.get(
                    `/api/transactions?month=${periods.historical}&limit=200`
                )
            ),
        ])

        expect(dashboard.summary).toMatchObject({
            totalIncome: FINANCIAL_SMOKE_EXPECTED.historical.income,
            totalExpense: FINANCIAL_SMOKE_EXPECTED.historical.expense,
            totalCreditCardExpense:
                FINANCIAL_SMOKE_EXPECTED.historical.creditCardExpense,
            balance: FINANCIAL_SMOKE_EXPECTED.historical.balance,
            availableBalance:
                FINANCIAL_SMOKE_EXPECTED.historical.availableBalance,
        })
        expect(transactions.summary).toEqual({
            income: FINANCIAL_SMOKE_EXPECTED.historical.income,
            expense: FINANCIAL_SMOKE_EXPECTED.historical.expense,
            creditCardExpense:
                FINANCIAL_SMOKE_EXPECTED.historical.creditCardExpense,
            balance: FINANCIAL_SMOKE_EXPECTED.historical.balance,
            availableBalance:
                FINANCIAL_SMOKE_EXPECTED.historical.availableBalance,
        })
        expect(
            transactions.transactions.map((transaction) => transaction.description)
        ).toEqual(
            expect.arrayContaining([
                FINANCIAL_SMOKE_NAMES.historicalIncome,
                FINANCIAL_SMOKE_NAMES.historicalExpenseArs,
                FINANCIAL_SMOKE_NAMES.historicalExpenseUsd,
            ])
        )
    })
})
