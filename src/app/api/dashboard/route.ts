import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, ScheduledCommitment, CommitmentApplication, InstallmentPlan, User } from '@/lib/models'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { parseFinancialPeriod, getCurrentFinancialPeriod } from '@/lib/utils/period'
import { buildMonthlyCardPaymentSummary, getInstallmentStatusForMonth, isCreditCardPaymentType } from '@/lib/utils/credit-card'
import { getInitialBalancesByCurrency, getPrimaryCurrency, normalizeSupportedCurrencies } from '@/lib/utils/accounts'
import {
    clampRangeStartToOperationalStart,
    hasOperationalCoverage,
    parseOperationalStartDate,
    startsOnOrAfterOperationalStart,
} from '@/lib/utils/operational-start'

type PopulatedCategoryRef = {
    _id: { toString: () => string }
    name: string
    color?: string
}

type CurrencyTotals = {
    ars: number
    usd: number
}

function emptyCurrencyTotals(): CurrencyTotals {
    return { ars: 0, usd: 0 }
}

function addCurrencyAmount(totals: CurrencyTotals, currency: string, amount: number) {
    if (currency === 'USD') totals.usd += amount
    else totals.ars += amount
}

function subtractCurrencyTotals(income: CurrencyTotals, expense: CurrencyTotals): CurrencyTotals {
    return {
        ars: income.ars - expense.ars,
        usd: income.usd - expense.usd,
    }
}

function getPopulatedCategoryRef(value: unknown): PopulatedCategoryRef | null {
    if (!value || typeof value !== 'object' || typeof (value as { name?: unknown }).name !== 'string') {
        return null
    }

    const candidate = value as {
        _id?: { toString?: () => string }
        name: string
        color?: unknown
    }

    if (!candidate._id || typeof candidate._id.toString !== 'function') {
        return null
    }

    return {
        _id: candidate._id as { toString: () => string },
        name: candidate.name,
        color: typeof candidate.color === 'string' ? candidate.color : undefined,
    }
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const now = new Date()

        await connectDB()

        const userId = session.user.id

        // Leer preferencias del usuario para respetar el inicio del mes financiero
        const userDoc = await User.findById(userId, {
            'preferences.monthStartDay': 1,
            'preferences.operationalStartDate': 1,
        })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const operationalStartDate = userDoc?.preferences?.operationalStartDate
        const operationalStart = parseOperationalStartDate(operationalStartDate)

        const monthParam = searchParams.get('month')
        const month = monthParam ?? getCurrentFinancialPeriod(now, monthStartDay)
        const [year, m] = month.split('-').map(Number)

        const { start: startOfMonth, end: endOfMonth } = parseFinancialPeriod(month, monthStartDay)

        // Período anterior (mismo desplazamiento)
        const prevM = m === 1 ? 12 : m - 1
        const prevY = m === 1 ? year - 1 : year
        const prevPeriod = `${prevY}-${String(prevM).padStart(2, '0')}`
        const { start: startOfPrevMonth, end: endOfPrevMonth } = parseFinancialPeriod(prevPeriod, monthStartDay)

        // Transacciones del mes actual
        const currentPeriodHasCoverage = hasOperationalCoverage(startOfMonth, endOfMonth, operationalStartDate)

        const transactions = await Transaction.find({
            userId,
            date: {
                $gte: clampRangeStartToOperationalStart(startOfMonth, operationalStartDate),
                $lt: endOfMonth,
            },
        })
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')

        // Transacciones del mes anterior
        const prevTransactions = await Transaction.find({
            userId,
            date: {
                $gte: clampRangeStartToOperationalStart(startOfPrevMonth, operationalStartDate),
                $lt: endOfPrevMonth,
            },
        })
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')

        const allPlans = await InstallmentPlan.find({ userId })
            .populate('accountId', 'name type currency color')
            .populate('categoryId', 'name color type')

        const currentCardSummary = buildMonthlyCardPaymentSummary({
            month,
            monthStartDay,
            plans: allPlans,
            transactions,
            operationalStartDate,
        })

        const totalCreditCardExpense = currentCardSummary.reduce((totals, item) => {
            item.items.forEach((charge) => addCurrencyAmount(totals, charge.currency, charge.amount))
            return totals
        }, emptyCurrencyTotals())

        const totalCardPayments = transactions
            .filter((transaction) => isCreditCardPaymentType(transaction.type))
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())

        const totalRemainingDebt = {
            ars: Math.max(0, totalCreditCardExpense.ars - totalCardPayments.ars),
            usd: Math.max(0, totalCreditCardExpense.usd - totalCardPayments.usd),
        }

        const totalIncome = transactions
            .filter((t) => t.type === 'income')
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())

        const regularExpense = transactions
            .filter((t) => t.type === 'expense' && !t.installmentPlanId)
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())
        const totalExpense = {
            ars: regularExpense.ars + totalCardPayments.ars,
            usd: regularExpense.usd + totalCardPayments.usd,
        }

        const prevIncome = prevTransactions
            .filter((t) => t.type === 'income')
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())

        const prevRegularExpense = prevTransactions
            .filter((t) => t.type === 'expense' && !t.installmentPlanId)
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())
        const prevCardPayments = prevTransactions
            .filter((transaction) => isCreditCardPaymentType(transaction.type))
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())
        const prevExpense = {
            ars: prevRegularExpense.ars + prevCardPayments.ars,
            usd: prevRegularExpense.usd + prevCardPayments.usd,
        }
        const currentBalance = subtractCurrencyTotals(totalIncome, totalExpense)
        const prevBalance = subtractCurrencyTotals(prevIncome, prevExpense)

        // Calcular tendencias (% de cambio)
        const calcTrend = (current: number, previous: number) => {
            if (previous === 0) return null
            return Math.round(((current - previous) / previous) * 100)
        }

        const hasPreviousFullBase = startsOnOrAfterOperationalStart(startOfPrevMonth, operationalStartDate)
        const trends = {
            income: hasPreviousFullBase ? calcTrend(totalIncome.ars, prevIncome.ars) : null,
            expense: hasPreviousFullBase ? calcTrend(totalExpense.ars, prevExpense.ars) : null,
            balance: hasPreviousFullBase ? calcTrend(currentBalance.ars, prevBalance.ars) : null,
        }

        // Gastos por categoría (incluye gasto común y el impacto mensual de TC)
        const expenseByCategory: Record<string, { key: string; name: string; color?: string; ars: number; usd: number }> = {}
        transactions
            .filter((t) => t.type === 'expense' && t.categoryId)
            .forEach((t) => {
                const cat = getPopulatedCategoryRef(t.categoryId)
                if (!cat) return
                const key = cat._id.toString()
                if (!expenseByCategory[key]) {
                    expenseByCategory[key] = { key, name: cat.name, color: cat.color, ars: 0, usd: 0 }
                }
                addCurrencyAmount(expenseByCategory[key], t.currency, t.amount)
            })
        currentCardSummary.forEach((cardSummary) => {
            cardSummary.items.forEach((item) => {
                if (!item.categoryId || !item.categoryName) return

                const key = item.categoryId
                if (!expenseByCategory[key]) {
                    expenseByCategory[key] = {
                        key,
                        name: item.categoryName,
                        color: item.categoryColor,
                        ars: 0,
                        usd: 0,
                    }
                }

                addCurrencyAmount(expenseByCategory[key], item.currency, item.amount)
            })
        })

        // Cuentas activas con saldo calculado
        const accounts = await Account.find({ userId, isActive: true })

        const accountsWithBalance = await Promise.all(
            accounts.map(async (account) => {
                const supportedCurrencies = normalizeSupportedCurrencies(
                    account.supportedCurrencies,
                    account.currency,
                    account.type
                )
                const primaryCurrency = getPrimaryCurrency({
                    type: account.type,
                    currency: account.currency,
                    supportedCurrencies,
                })
                const balancesByCurrency = await calculateAccountBalancesByCurrency(
                    account._id,
                    account.userId,
                    {
                        initialBalances: getInitialBalancesByCurrency(account),
                        sinceDate: operationalStart,
                        includeCreditCardInstallmentDebt: account.type === 'credit_card',
                        monthStartDay,
                        operationalStartDate,
                    }
                )

                return {
                    _id: account._id,
                    name: account.name,
                    type: account.type,
                    currency: primaryCurrency,
                    supportedCurrencies,
                    color: account.color,
                    includeInNetWorth: account.includeInNetWorth,
                    balancesByCurrency,
                    balance: balancesByCurrency[primaryCurrency],
                }
            })
        )

        // Patrimonio
        const netWorthAccounts = accountsWithBalance.filter((a) => a.includeInNetWorth)
        const assets = netWorthAccounts
            .filter((a) => !['credit_card', 'debt'].includes(a.type))
            .reduce((totals, account) => {
                totals.ars += account.balancesByCurrency.ARS
                totals.usd += account.balancesByCurrency.USD
                return totals
            }, emptyCurrencyTotals())
        const liabilities = netWorthAccounts
            .filter((a) => a.type === 'debt')
            .reduce((totals, account) => {
                totals.ars += Math.abs(account.balancesByCurrency.ARS)
                totals.usd += Math.abs(account.balancesByCurrency.USD)
                return totals
            }, emptyCurrencyTotals())
        const netWorth = subtractCurrencyTotals(assets, liabilities)

        // Compromisos pendientes del mes
        const activeCommitments = await ScheduledCommitment.find({ userId, isActive: true })
        const appliedThisMonth = await CommitmentApplication.find({ userId, period: month })
        const appliedIds = new Set(appliedThisMonth.map((a) => a.commitmentId.toString()))
        const pendingCommitments = (currentPeriodHasCoverage ? activeCommitments : [])
            .filter((c) => c.recurrence === 'monthly' && !appliedIds.has(c._id.toString()))
            .map((c) => ({
                _id: c._id,
                description: c.description,
                amount: c.amount,
                currency: c.currency,
                dayOfMonth: c.dayOfMonth,
            }))

        const installmentsThisMonth = (currentPeriodHasCoverage ? allPlans : [])
            .filter((plan) => plan.installmentCount > 1)
            .map((plan) => {
                const status = getInstallmentStatusForMonth(plan, month)
                if (status.state !== 'active') return null

                return {
                    _id: plan._id,
                    description: plan.description,
                    installmentAmount: plan.installmentAmount,
                    currency: plan.currency,
                    firstClosingMonth: plan.firstClosingMonth,
                    installmentCount: plan.installmentCount,
                    installmentNumber: status.current,
                }
            })
            .filter(Boolean)
            .sort((a, b) => (b?.installmentAmount ?? 0) - (a?.installmentAmount ?? 0))

        return NextResponse.json({
            month,
            summary: {
                totalIncome,
                totalExpense,
                balance: currentBalance,
                totalCreditCardExpense,
                totalDebt: totalRemainingDebt,
                operationalStartDate,
            },
            trends,
            expenseByCategory: Object.values(expenseByCategory).sort((a, b) => (b.ars + b.usd) - (a.ars + a.usd)),
            accounts: accountsWithBalance,
            netWorth: {
                assets,
                liabilities,
                total: netWorth,
            },
            pendingCommitments,
            installmentsThisMonth,
            creditCardMonthly: currentCardSummary,
        })
    } catch (error) {
        console.error('Error en dashboard:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
