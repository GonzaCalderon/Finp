import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, ScheduledCommitment, CommitmentApplication, InstallmentPlan, User } from '@/lib/models'
import { calculateAccountBalance } from '@/lib/utils/balance'
import { parseFinancialPeriod, getCurrentFinancialPeriod } from '@/lib/utils/period'
import { buildMonthlyCardPaymentSummary, getInstallmentStatusForMonth } from '@/lib/utils/credit-card'

type PopulatedCategoryRef = {
    _id: { toString: () => string }
    name: string
    color?: string
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
        const userDoc = await User.findById(userId, { 'preferences.monthStartDay': 1 })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1

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
        const transactions = await Transaction.find({
            userId,
            date: { $gte: startOfMonth, $lt: endOfMonth },
        })
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')

        // Transacciones del mes anterior
        const prevTransactions = await Transaction.find({
            userId,
            date: { $gte: startOfPrevMonth, $lt: endOfPrevMonth },
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
        })

        const prevCardSummary = buildMonthlyCardPaymentSummary({
            month: prevPeriod,
            monthStartDay,
            plans: allPlans,
            transactions: prevTransactions,
        })

        const totalCreditCardExpense = currentCardSummary.reduce((sum, item) => sum + item.due, 0)
        const prevCreditCardExpense = prevCardSummary.reduce((sum, item) => sum + item.due, 0)

        const totalIncome = transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)

        const regularExpense = transactions
            .filter((t) => t.type === 'expense' && !t.installmentPlanId)
            .reduce((sum, t) => sum + t.amount, 0)
        const totalExpense = regularExpense + totalCreditCardExpense

        const prevIncome = prevTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)

        const prevRegularExpense = prevTransactions
            .filter((t) => t.type === 'expense' && !t.installmentPlanId)
            .reduce((sum, t) => sum + t.amount, 0)
        const prevExpense = prevRegularExpense + prevCreditCardExpense

        // Calcular tendencias (% de cambio)
        const calcTrend = (current: number, previous: number) => {
            if (previous === 0) return null
            return Math.round(((current - previous) / previous) * 100)
        }

        const trends = {
            income: calcTrend(totalIncome, prevIncome),
            expense: calcTrend(totalExpense, prevExpense),
            balance: calcTrend(totalIncome - totalExpense, prevIncome - prevExpense),
        }

        // Gastos por categoría
        const expenseByCategory: Record<string, { key: string; name: string; color?: string; total: number }> = {}
        transactions
            .filter((t) => t.type === 'expense' && t.categoryId)
            .forEach((t) => {
                const cat = getPopulatedCategoryRef(t.categoryId)
                if (!cat) return
                const key = cat._id.toString()
                if (!expenseByCategory[key]) {
                    expenseByCategory[key] = { key, name: cat.name, color: cat.color, total: 0 }
                }
                expenseByCategory[key].total += t.amount
            })

        currentCardSummary.forEach((card) => {
            card.items.forEach((item) => {
                const key = item.categoryId || (item.categoryName ? `name:${item.categoryName}` : 'sin-categoria')
                if (!expenseByCategory[key]) {
                    expenseByCategory[key] = {
                        key,
                        name: item.categoryName ?? 'Sin categoría',
                        color: item.categoryColor,
                        total: 0,
                    }
                }
                expenseByCategory[key].total += item.amount
            })
        })

        // Cuentas activas con saldo calculado
        const accounts = await Account.find({ userId, isActive: true })

        const accountsWithBalance = await Promise.all(
            accounts.map(async (account) => {
                const balance = await calculateAccountBalance(
                    account._id,
                    account.userId,
                    account.initialBalance ?? 0
                )

                return {
                    _id: account._id,
                    name: account.name,
                    type: account.type,
                    currency: account.currency,
                    color: account.color,
                    includeInNetWorth: account.includeInNetWorth,
                    balance,
                }
            })
        )

        // Patrimonio
        const netWorthAccounts = accountsWithBalance.filter((a) => a.includeInNetWorth)
        const assets = netWorthAccounts
            .filter((a) => !['credit_card', 'debt'].includes(a.type))
            .reduce((sum, a) => sum + a.balance, 0)
        const liabilities = netWorthAccounts
            .filter((a) => ['credit_card', 'debt'].includes(a.type))
            .reduce((sum, a) => sum + Math.abs(a.balance), 0)
        const netWorth = assets - liabilities

        // Compromisos pendientes del mes
        const activeCommitments = await ScheduledCommitment.find({ userId, isActive: true })
        const appliedThisMonth = await CommitmentApplication.find({ userId, period: month })
        const appliedIds = new Set(appliedThisMonth.map((a) => a.commitmentId.toString()))
        const pendingCommitments = activeCommitments
            .filter((c) => c.recurrence === 'monthly' && !appliedIds.has(c._id.toString()))
            .map((c) => ({
                _id: c._id,
                description: c.description,
                amount: c.amount,
                currency: c.currency,
                dayOfMonth: c.dayOfMonth,
            }))

        const installmentsThisMonth = allPlans
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

        return NextResponse.json({
            month,
            summary: {
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
                totalCreditCardExpense,
                totalDebt: accountsWithBalance
                    .filter((a) => a.balance < 0)
                    .reduce((sum, a) => sum + Math.abs(a.balance), 0),
            },
            trends,
            expenseByCategory: Object.values(expenseByCategory).sort((a, b) => b.total - a.total),
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
