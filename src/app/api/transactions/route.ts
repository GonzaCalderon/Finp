import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Transaction, User, InstallmentPlan } from '@/lib/models'
import { parseFinancialPeriod } from '@/lib/utils/period'
import { buildTransactionPeriodSummary } from '@/lib/utils/transaction-summary'
import { clampRangeStartToOperationalStart, parseOperationalStartDate } from '@/lib/utils/operational-start'
import { calculateAccountBalancesByCurrency, sumAvailableAccountBalances } from '@/lib/utils/balance'
import { getInitialBalancesByCurrency } from '@/lib/utils/accounts'
import { createTransactionForUser, getTransactionListTypeFilter } from '@/lib/server/transactions'
import { isServiceError } from '@/lib/server/errors'
import type { Currency } from '@/lib/constants'
import type { IInstallmentPlan, ITransaction } from '@/types'

const PAGE_LIMIT = 30

type CurrencySummary = {
    ars: number
    usd: number
}

function emptyCurrencySummary(): CurrencySummary {
    return { ars: 0, usd: 0 }
}

function toCurrencySummary(
    rows: Array<{ _id: Currency; total: number }>
): CurrencySummary {
    return rows.reduce<CurrencySummary>((acc, row) => {
        if (row._id === 'USD') acc.usd = row.total
        else acc.ars = row.total
        return acc
    }, emptyCurrencySummary())
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const month = searchParams.get('month')
        const type = searchParams.get('type')
        const categoryId = searchParams.get('categoryId')
        const accountId = searchParams.get('accountId')
        const currency = searchParams.get('currency')
        const noInstallmentPlan = searchParams.get('noInstallmentPlan') === 'true'
        const sort = searchParams.get('sort') ?? 'date_desc'
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
        const rawLimit = parseInt(searchParams.get('limit') ?? String(PAGE_LIMIT), 10)
        const limit = Math.min(Math.max(rawLimit > 0 ? rawLimit : PAGE_LIMIT, 1), 200)

        await connectDB()

        // Base filter shared by list and summary.
        const baseFilter: Record<string, unknown> = { userId: session.user.id }

        const userDoc = await User.findById(session.user.id, {
            'preferences.monthStartDay': 1,
            'preferences.operationalStartDate': 1,
        })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const operationalStartDate = userDoc?.preferences?.operationalStartDate
        let summary: {
            income: CurrencySummary
            expense: CurrencySummary
            creditCardExpense: CurrencySummary
            balance: CurrencySummary
            availableBalance: CurrencySummary
        } | undefined
        let balanceUntilDate = new Date(Date.now() + 1)

        if (month) {
            const [year, m] = month.split('-').map(Number)
            if (!Number.isNaN(year) && !Number.isNaN(m)) {
                const { start, end } = parseFinancialPeriod(month, monthStartDay)
                baseFilter.date = { $gte: start, $lt: end }
                if (end < balanceUntilDate) balanceUntilDate = end

                const [summaryTransactions, installmentPlans] = await Promise.all([
                    Transaction.find({
                        userId: session.user.id,
                        date: {
                            $gte: clampRangeStartToOperationalStart(start, operationalStartDate),
                            $lt: end,
                        },
                    })
                        .populate('categoryId', 'name color type')
                        .populate('sourceAccountId', 'name type currency color')
                        .populate('destinationAccountId', 'name type currency color'),
                    InstallmentPlan.find({ userId: session.user.id })
                        .populate('accountId', 'name type currency color')
                        .populate('categoryId', 'name color type'),
                ])

                summary = {
                    ...buildTransactionPeriodSummary({
                        month,
                        monthStartDay,
                        transactions: summaryTransactions as unknown as ITransaction[],
                        plans: installmentPlans as unknown as IInstallmentPlan[],
                        operationalStartDate,
                    }),
                    availableBalance: emptyCurrencySummary(),
                }
            }
        }

        // Summary is computed from the full period, without user-applied filters.
        if (!summary) {
            const summaryFilter = {
                ...baseFilter,
                userId: new Types.ObjectId(session.user.id),
            }
            const [incomeAgg, expenseAgg, ccExpenseAgg] = await Promise.all([
                Transaction.aggregate([
                    { $match: { ...summaryFilter, type: 'income' } },
                    { $group: { _id: '$currency', total: { $sum: '$amount' } } },
                ]),
                Transaction.aggregate([
                    { $match: { ...summaryFilter, type: 'expense' } },
                    { $group: { _id: '$currency', total: { $sum: '$amount' } } },
                ]),
                Transaction.aggregate([
                    { $match: { ...summaryFilter, type: 'credit_card_expense' } },
                    { $group: { _id: '$currency', total: { $sum: '$amount' } } },
                ]),
            ])

            const income = toCurrencySummary(incomeAgg)
            const expense = toCurrencySummary(expenseAgg)

            summary = {
                income,
                expense,
                creditCardExpense: toCurrencySummary(ccExpenseAgg),
                balance: {
                    ars: income.ars - expense.ars,
                    usd: income.usd - expense.usd,
                },
                availableBalance: emptyCurrencySummary(),
            }
        }

        const operationalStart = parseOperationalStartDate(operationalStartDate)
        const activeAccounts = await Account.find({ userId: session.user.id, isActive: true })
        const accountBalances = await Promise.all(
            activeAccounts.map(async (account) => ({
                type: account.type,
                balancesByCurrency: await calculateAccountBalancesByCurrency(
                    account._id,
                    account.userId,
                    {
                        initialBalances: getInitialBalancesByCurrency(account),
                        sinceDate: operationalStart,
                        untilDate: balanceUntilDate,
                    }
                ),
            }))
        )
        summary.availableBalance = sumAvailableAccountBalances(accountBalances)

        // List filter: base plus user-applied filters.
        const filter: Record<string, unknown> = { ...baseFilter }

        if (type) {
            filter.type = getTransactionListTypeFilter(type)
        }
        if (categoryId) filter.categoryId = categoryId
        if (currency && ['ARS', 'USD'].includes(currency)) filter.currency = currency
        if (accountId) {
            filter.$or = [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
        }
        if (noInstallmentPlan) {
            filter.installmentPlanId = { $exists: false }
        }

        const sortMap: Record<string, Record<string, 1 | -1>> = {
            date_desc: { date: -1, createdAt: -1, _id: -1 },
            date_asc: { date: 1, createdAt: 1, _id: 1 },
            created_desc: { createdAt: -1, _id: -1 },
            created_asc: { createdAt: 1, _id: 1 },
            amount_desc: { amount: -1, createdAt: -1, _id: -1 },
            amount_asc: { amount: 1, createdAt: -1, _id: -1 },
            description_asc: { description: 1, createdAt: -1, _id: -1 },
        }
        const sortQuery = sortMap[sort] ?? { date: -1, createdAt: -1, _id: -1 }

        const total = await Transaction.countDocuments(filter)
        const skip = (page - 1) * limit

        const transactions = await Transaction.find(filter)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency supportedCurrencies color')
            .populate('destinationAccountId', 'name type currency supportedCurrencies color')
            .populate('installmentPlanId', 'installmentCount')

        return NextResponse.json({
            transactions,
            total,
            page,
            limit,
            hasMore: skip + transactions.length < total,
            summary,
        })
    } catch (error) {
        console.error('Error al obtener transacciones:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        await connectDB()

        const populated = await createTransactionForUser(session.user.id, body)

        return NextResponse.json({ transaction: populated }, { status: 201 })
    } catch (error) {
        if (isServiceError(error)) {
            return NextResponse.json(
                { error: error.message, code: error.code, details: error.details },
                { status: error.status }
            )
        }
        console.error('Error al crear transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
