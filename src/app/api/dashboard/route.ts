import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, ScheduledCommitment, CommitmentApplication, InstallmentPlan } from '@/lib/models'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const monthParam = searchParams.get('month')
        const now = new Date()
        const month = monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const [year, m] = month.split('-').map(Number)
        const startOfMonth = new Date(year, m - 1, 1)
        const endOfMonth = new Date(year, m, 1)

        // Mes anterior
        const prevDate = new Date(year, m - 2, 1)
        const startOfPrevMonth = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1)
        const endOfPrevMonth = new Date(year, m - 1, 1)

        await connectDB()

        const userId = session.user.id

        // Transacciones del mes actual
        const transactions = await Transaction.find({
            userId,
            date: { $gte: startOfMonth, $lt: endOfMonth },
        }).populate('categoryId', 'name color type')

        // Transacciones del mes anterior
        const prevTransactions = await Transaction.find({
            userId,
            date: { $gte: startOfPrevMonth, $lt: endOfPrevMonth },
        })

        const totalIncome = transactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)

        const totalExpense = transactions
            .filter((t) => t.type === 'expense' && !t.installmentPlanId)
            .reduce((sum, t) => sum + t.amount, 0)

        const prevIncome = prevTransactions
            .filter((t) => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)

        const prevExpense = prevTransactions
            .filter((t) => t.type === 'expense' && !t.installmentPlanId)
            .reduce((sum, t) => sum + t.amount, 0)

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
        const expenseByCategory: Record<string, { name: string; color?: string; total: number }> = {}
        transactions
            .filter((t) => t.type === 'expense' && t.categoryId)
            .forEach((t) => {
                const cat = t.categoryId as { _id: { toString: () => string }; name: string; color?: string }
                const key = cat._id.toString()
                if (!expenseByCategory[key]) {
                    expenseByCategory[key] = { name: cat.name, color: cat.color, total: 0 }
                }
                expenseByCategory[key].total += t.amount
            })

        // Cuentas activas con saldo calculado
        const accounts = await Account.find({ userId, isActive: true })

        const accountsWithBalance = await Promise.all(
            accounts.map(async (account) => {
                const received = await Transaction.aggregate([
                    {
                        $match: {
                            userId: account.userId,
                            destinationAccountId: account._id,
                            type: { $in: ['income', 'transfer', 'credit_card_payment', 'debt_payment'] },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])

                const sent = await Transaction.aggregate([
                    {
                        $match: {
                            userId: account.userId,
                            sourceAccountId: account._id,
                            type: { $in: ['expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment'] },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])

                const balance =
                    (account.initialBalance ?? 0) +
                    (received[0]?.total ?? 0) -
                    (sent[0]?.total ?? 0)

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

        // Cuotas del mes
        const allPlans = await InstallmentPlan.find({ userId })
        const installmentsThisMonth = allPlans
            .filter((plan) => {
                const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                const firstMonth = new Date(fy, fm - 1, 1)
                const lastMonth = new Date(fy, fm - 1 + plan.installmentCount - 1, 1)
                const current = new Date(year, m - 1, 1)
                return current >= firstMonth && current <= lastMonth
            })
            .map((plan) => ({
                _id: plan._id,
                description: plan.description,
                installmentAmount: plan.installmentAmount,
                currency: plan.currency,
                firstClosingMonth: plan.firstClosingMonth,
                installmentCount: plan.installmentCount,
            }))

        return NextResponse.json({
            month,
            summary: {
                totalIncome,
                totalExpense,
                balance: totalIncome - totalExpense,
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
        })
    } catch (error) {
        console.error('Error en dashboard:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}