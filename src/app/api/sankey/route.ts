import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, InstallmentPlan, User } from '@/lib/models'
import { buildMonthlyCardPaymentSummary } from '@/lib/utils/credit-card'
import { getCurrentFinancialPeriod, parseFinancialPeriod } from '@/lib/utils/period'

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
        const monthParam = searchParams.get('month')
        const currency = searchParams.get('currency') === 'USD' ? 'USD' : 'ARS'

        await connectDB()

        const now = new Date()
        const userDoc = await User.findById(session.user.id, { 'preferences.monthStartDay': 1 })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const month = monthParam ?? getCurrentFinancialPeriod(now, monthStartDay)
        const { start, end } = parseFinancialPeriod(month, monthStartDay)

        // ── Fetch data in parallel ─────────────────────────────────────────────
        const [transactions, installmentPlans] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
            })
                .populate('categoryId', 'name color')
                .populate('sourceAccountId', 'name type color currency')
                .populate('destinationAccountId', 'name type color currency'),

            InstallmentPlan.find({ userId: session.user.id })
                .populate('accountId', 'name type color currency')
                .populate('categoryId', 'name color'),
        ])

        // ── Process regular transactions ───────────────────────────────────────
        const incomeMap: Record<string, { name: string; amount: number; color: string }> = {}
        const expenseMap: Record<string, { name: string; amount: number; color: string }> = {}

        transactions.forEach((t) => {
            if (t.currency !== currency) return
            const cat = getPopulatedCategoryRef(t.categoryId)
            const key = cat?._id?.toString() ?? 'sin-categoria'
            const name = cat?.name ?? 'Sin categoría'
            const color = cat?.color ?? '#9CA3AF'

            if (t.type === 'income') {
                if (!incomeMap[key]) incomeMap[key] = { name, amount: 0, color }
                incomeMap[key].amount += t.amount
            } else if (t.type === 'expense' && !t.installmentPlanId) {
                if (!expenseMap[key]) expenseMap[key] = { name, amount: 0, color }
                expenseMap[key].amount += t.amount
            }
        })

        const creditCards = buildMonthlyCardPaymentSummary({
            month,
            monthStartDay,
            plans: installmentPlans,
            transactions,
        }).map((card) => {
            card.items.forEach((item) => {
                if (item.currency !== currency) return
                const key = item.categoryName ?? 'sin-categoria'
                if (!expenseMap[key]) {
                    expenseMap[key] = {
                        name: item.categoryName ?? 'Sin categoría',
                        amount: 0,
                        color: item.categoryColor ?? '#9CA3AF',
                    }
                }
                expenseMap[key].amount += item.amount
            })

            return {
                id: card.cardId,
                name: card.cardName ?? 'Tarjeta',
                color: card.cardColor ?? '#6366F1',
                totalExpenses: card.items
                    .filter((item) => item.currency === currency)
                    .reduce((sum, item) => sum + item.amount, 0),
                totalPaid: transactions
                    .filter((transaction) =>
                        transaction.destinationAccountId?.toString() === card.cardId &&
                        transaction.currency === currency &&
                        ['credit_card_payment', 'debt_payment'].includes(transaction.type)
                    )
                    .reduce((sum, transaction) => sum + transaction.amount, 0),
                netOwed: 0,
            }
        }).map((card) => ({
            ...card,
            netOwed: Math.max(0, card.totalExpenses - card.totalPaid),
        })).filter((cc) => cc.totalExpenses > 0)

        const income = Object.values(incomeMap).sort((a, b) => b.amount - a.amount)
        const expenses = Object.values(expenseMap).sort((a, b) => b.amount - a.amount)

        const totalIncome = income.reduce((sum, i) => sum + i.amount, 0)
        const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0)
        const balance = totalIncome - totalExpense

        return NextResponse.json({
            income,
            expenses,
            totalIncome,
            totalExpense,
            balance,
            creditCards,
            currency,
        })
    } catch (error) {
        console.error('Error en sankey:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
