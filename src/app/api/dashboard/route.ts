import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, ScheduledCommitment, CommitmentApplication, InstallmentPlan, User } from '@/lib/models'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { parseFinancialPeriod, getCurrentFinancialPeriod } from '@/lib/utils/period'
import {
    buildMonthlyCardPaymentSummary,
    getInstallmentStatusForMonth,
    getRefColor,
    getRefId,
    getRefName,
    isCreditCardPaymentType,
    normalizeLegacyTransactionType,
} from '@/lib/utils/credit-card'
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

type CreditCardOverview = {
    accountId: string
    name: string
    institution?: string
    processor?: string
    color?: string
    currency: string
    supportedCurrencies?: string[]
    balancesByCurrency: { ARS: number; USD: number }
    monthlyDue: CurrencyTotals
    monthlyPaid: CurrencyTotals
    monthlyPending: CurrencyTotals
    activeInstallments: number
    activeCharges: number
    latestPurchaseDate?: string
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

function addCurrencyTotals(left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals {
    return {
        ars: left.ars + right.ars,
        usd: left.usd + right.usd,
    }
}

function compareCurrencyTotals(left: CurrencyTotals, right: CurrencyTotals): number {
    return right.ars + right.usd - (left.ars + left.usd)
}

function getExchangeNet(
    transactions: Array<{
        type?: string
        currency: string
        amount: number
        destinationCurrency?: string
        destinationAmount?: number
    }>
): CurrencyTotals {
    return transactions
        .filter((transaction) => transaction.type === 'exchange')
        .reduce((totals, transaction) => {
            addCurrencyAmount(totals, transaction.currency, -transaction.amount)

            if (transaction.destinationCurrency && typeof transaction.destinationAmount === 'number') {
                addCurrencyAmount(totals, transaction.destinationCurrency, transaction.destinationAmount)
            }

            return totals
        }, emptyCurrencyTotals())
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

function buildRecentTransactionContext(transaction: {
    type?: string
    amount: number
    description: string
    currency: string
    date: Date | string
    merchant?: string
    installmentPlanId?: unknown
    categoryId?: unknown
    sourceAccountId?: unknown
    destinationAccountId?: unknown
}) {
    const normalizedType = normalizeLegacyTransactionType(transaction.type)
    const sourceId = getRefId(transaction.sourceAccountId)
    const destinationId = getRefId(transaction.destinationAccountId)

    const categoryRef = getPopulatedCategoryRef(transaction.categoryId)
    const sourceAccountName = getRefName(transaction.sourceAccountId)
    const sourceAccountColor = getRefColor(transaction.sourceAccountId)
    const destinationAccountName = getRefName(transaction.destinationAccountId)
    const destinationAccountColor = getRefColor(transaction.destinationAccountId)
    const installmentPlan =
        transaction.installmentPlanId &&
        typeof transaction.installmentPlanId === 'object' &&
        'installmentCount' in (transaction.installmentPlanId as Record<string, unknown>)
            ? (transaction.installmentPlanId as { installmentCount?: number })
            : null

    const impact =
        normalizedType === 'income'
            ? 'positive'
            : normalizedType === 'transfer' || normalizedType === 'exchange'
                ? 'neutral'
                : normalizedType === 'adjustment'
                    ? transaction.amount >= 0
                        ? 'positive'
                        : 'negative'
                    : 'negative'

    const primaryAccount =
        normalizedType === 'income'
            ? {
                _id: destinationId,
                name: destinationAccountName,
                color: destinationAccountColor,
            }
            : {
                _id: sourceId,
                name: sourceAccountName,
                color: sourceAccountColor,
            }

    return {
        impact,
        category: categoryRef
            ? {
                key: categoryRef._id.toString(),
                name: categoryRef.name,
                color: categoryRef.color,
            }
            : null,
        sourceAccount: sourceId
            ? {
                _id: sourceId,
                name: sourceAccountName ?? 'Cuenta',
                color: sourceAccountColor,
            }
            : null,
        destinationAccount: destinationId
            ? {
                _id: destinationId,
                name: destinationAccountName ?? 'Cuenta',
                color: destinationAccountColor,
            }
            : null,
        primaryAccount: primaryAccount._id
            ? {
                _id: primaryAccount._id,
                name: primaryAccount.name ?? 'Cuenta',
                color: primaryAccount.color,
            }
            : null,
        installmentCount: installmentPlan?.installmentCount,
        merchant: typeof transaction.merchant === 'string' ? transaction.merchant : undefined,
    }
}

function inferCardProcessor(name?: string, institution?: string) {
    const haystack = `${name ?? ''} ${institution ?? ''}`.toLowerCase()
    if (haystack.includes('visa')) return 'visa'
    if (haystack.includes('master')) return 'mastercard'
    if (haystack.includes('amex') || haystack.includes('american express')) return 'amex'
    if (haystack.includes('cabal')) return 'cabal'
    if (haystack.includes('diners')) return 'diners'
    return 'generic'
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
            .populate('installmentPlanId', 'installmentCount')

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
        const prevCardSummary = buildMonthlyCardPaymentSummary({
            month: prevPeriod,
            monthStartDay,
            plans: allPlans,
            transactions: prevTransactions,
            operationalStartDate,
        })

        const totalCreditCardExpense = currentCardSummary.reduce((totals, item) => {
            item.items.forEach((charge) => addCurrencyAmount(totals, charge.currency, charge.amount))
            return totals
        }, emptyCurrencyTotals())
        const prevTotalCreditCardExpense = prevCardSummary.reduce((totals, item) => {
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

        const isLoanIncome = (t: { type?: string; destinationAccountId?: unknown }) => {
            if (t.type !== 'income') return false
            const dest = t.destinationAccountId as { type?: string } | null
            return dest?.type === 'debt'
        }

        // Para el balance: todos los ingresos (incluye préstamos recibidos = dinero real)
        const allIncome = transactions
            .filter((t) => t.type === 'income')
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())

        // Para el KPI de Ingresos: excluye préstamos (no son ingreso genuino)
        const totalIncome = transactions
            .filter((t) => !isLoanIncome(t) && t.type === 'income')
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

        const prevAllIncome = prevTransactions
            .filter((t) => t.type === 'income')
            .reduce((totals, transaction) => {
                addCurrencyAmount(totals, transaction.currency, transaction.amount)
                return totals
            }, emptyCurrencyTotals())

        const prevIncome = prevTransactions
            .filter((t) => !isLoanIncome(t) && t.type === 'income')
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
        const currentBalance = addCurrencyTotals(
            subtractCurrencyTotals(allIncome, totalExpense),
            getExchangeNet(transactions)
        )
        const prevBalance = addCurrencyTotals(
            subtractCurrencyTotals(prevAllIncome, prevExpense),
            getExchangeNet(prevTransactions)
        )

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
            debt: hasPreviousFullBase ? calcTrend(totalCreditCardExpense.ars, prevTotalCreditCardExpense.ars) : null,
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
                    institution: account.institution,
                    type: account.type,
                    currency: primaryCurrency,
                    supportedCurrencies,
                    color: account.color,
                    includeInNetWorth: account.includeInNetWorth,
                    creditCardConfig: account.creditCardConfig,
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

        // Total de compromisos mensuales fijos (aplicados o pendientes)
        const totalMonthlyCommitments = activeCommitments
            .filter((c) => c.recurrence === 'monthly')
            .reduce((totals, c) => {
                addCurrencyAmount(totals, c.currency, c.amount)
                return totals
            }, emptyCurrencyTotals())

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

        const creditCards = accountsWithBalance
            .filter((account) => account.type === 'credit_card')
            .map<CreditCardOverview>((account) => {
                const summary = currentCardSummary.find((item) => item.cardId === account._id.toString())
                const monthlyDue = (summary?.items ?? []).reduce((totals, item) => {
                    addCurrencyAmount(totals, item.currency, item.amount)
                    return totals
                }, emptyCurrencyTotals())
                const monthlyPaid = transactions
                    .filter(
                        (transaction) =>
                            isCreditCardPaymentType(transaction.type) &&
                            getRefId(transaction.destinationAccountId) === account._id.toString()
                    )
                    .reduce((totals, transaction) => {
                        addCurrencyAmount(totals, transaction.currency, transaction.amount)
                        return totals
                    }, emptyCurrencyTotals())

                const monthlyPending = {
                    ars: Math.max(0, monthlyDue.ars - monthlyPaid.ars),
                    usd: Math.max(0, monthlyDue.usd - monthlyPaid.usd),
                }

                const latestTransactionDate = transactions.reduce<string | undefined>((latest, transaction) => {
                    const normalizedType = normalizeLegacyTransactionType(transaction.type)
                    if (normalizedType !== 'credit_card_expense') return latest
                    if (getRefId(transaction.sourceAccountId) !== account._id.toString()) return latest

                    const current = transaction.date instanceof Date
                        ? transaction.date.toISOString()
                        : new Date(transaction.date).toISOString()

                    if (!latest) return current
                    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest
                }, undefined)

                const latestSummaryDate = summary?.items.reduce<string | undefined>((latest, item) => {
                    const current = item.purchaseDate instanceof Date
                        ? item.purchaseDate.toISOString()
                        : new Date(item.purchaseDate).toISOString()

                    if (!latest) return current
                    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest
                }, undefined)

                const latestPurchaseDate = latestTransactionDate ?? latestSummaryDate

                return {
                    accountId: account._id.toString(),
                    name: account.name,
                    institution: account.institution,
                    processor: inferCardProcessor(account.name, account.institution),
                    color: account.color,
                    currency: account.currency,
                    supportedCurrencies: account.supportedCurrencies,
                    balancesByCurrency: account.balancesByCurrency,
                    monthlyDue,
                    monthlyPaid,
                    monthlyPending,
                    activeInstallments:
                        summary?.items.filter((item) => item.kind === 'installment').length ?? 0,
                    activeCharges: summary?.items.length ?? 0,
                    latestPurchaseDate,
                }
            })
            .sort((a, b) => {
                const pendingDiff = compareCurrencyTotals(a.monthlyPending, b.monthlyPending)
                if (pendingDiff !== 0) return pendingDiff
                const dueDiff = compareCurrencyTotals(a.monthlyDue, b.monthlyDue)
                if (dueDiff !== 0) return dueDiff
                return b.activeInstallments - a.activeInstallments
            })

        const recentTransactions = [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 6)
            .map((transaction) => {
                const context = buildRecentTransactionContext(transaction)

                return {
                    _id: transaction._id.toString(),
                    type: normalizeLegacyTransactionType(transaction.type) ?? transaction.type,
                    description: transaction.description,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    date: transaction.date instanceof Date
                        ? transaction.date.toISOString()
                        : new Date(transaction.date).toISOString(),
                    impact: context.impact,
                    merchant: context.merchant,
                    category: context.category,
                    primaryAccount: context.primaryAccount,
                    sourceAccount: context.sourceAccount,
                    destinationAccount: context.destinationAccount,
                    installmentCount: context.installmentCount,
                }
            })

        return NextResponse.json({
            month,
            summary: {
                totalIncome,
                totalExpense,
                balance: currentBalance,
                totalCreditCardExpense,
                totalDebt: totalRemainingDebt,
                totalMonthlyCommitments,
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
            creditCards,
            recentTransactions,
            creditCardMonthly: currentCardSummary,
        })
    } catch (error) {
        console.error('Error en dashboard:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
