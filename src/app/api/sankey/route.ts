import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, InstallmentPlan } from '@/lib/models'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const months = Math.max(1, parseInt(searchParams.get('months') ?? '1'))

        await connectDB()

        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        // ── Build list of months in the period ────────────────────────────────
        const monthsInPeriod: { year: number; month: number; date: Date }[] = []
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            monthsInPeriod.push({ year: d.getFullYear(), month: d.getMonth() + 1, date: d })
        }

        // ── Fetch data in parallel ─────────────────────────────────────────────
        const [transactions, ccPayments, installmentPlans] = await Promise.all([
            // Regular income/expense transactions (not installment plan lump-sums)
            Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
                type: { $in: ['income', 'expense'] },
                installmentPlanId: { $exists: false },
            })
                .populate('categoryId', 'name color')
                .populate('sourceAccountId', 'name type color'),

            // Credit card payments in the period (for prorrateo)
            Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
                type: 'credit_card_payment',
            }).select('amount destinationAccountId'),

            // Installment plans: use projection logic to find cuotas per month
            InstallmentPlan.find({ userId: session.user.id })
                .populate('accountId', 'name type color')
                .populate('categoryId', 'name color'),
        ])

        // ── Process regular transactions ───────────────────────────────────────
        const incomeMap: Record<string, { name: string; amount: number; color: string }> = {}
        const expenseMap: Record<string, { name: string; amount: number; color: string }> = {}
        const ccExpenseByCard: Record<string, { name: string; color: string; totalExpenses: number }> = {}

        transactions.forEach((t) => {
            const cat = t.categoryId as { _id: { toString: () => string }; name: string; color?: string } | null
            const key = cat?._id?.toString() ?? 'sin-categoria'
            const name = cat?.name ?? 'Sin categoría'
            const color = cat?.color ?? '#9CA3AF'

            if (t.type === 'income') {
                if (!incomeMap[key]) incomeMap[key] = { name, amount: 0, color }
                incomeMap[key].amount += t.amount
            } else {
                if (!expenseMap[key]) expenseMap[key] = { name, amount: 0, color }
                expenseMap[key].amount += t.amount

                // Track expenses charged to credit card
                const src = t.sourceAccountId as {
                    _id: { toString: () => string }
                    type: string
                    name: string
                    color?: string
                } | null

                if (src?.type === 'credit_card') {
                    const cardKey = src._id.toString()
                    if (!ccExpenseByCard[cardKey]) {
                        ccExpenseByCard[cardKey] = { name: src.name, color: src.color ?? '#6366F1', totalExpenses: 0 }
                    }
                    ccExpenseByCard[cardKey].totalExpenses += t.amount
                }
            }
        })

        // ── Process installment plan cuotas per month (projection logic) ───────
        // For each month in the period, check which installments are active
        // and add installmentAmount to expenses/ccExpenseByCard
        for (const { year, month, date: monthDate } of monthsInPeriod) {
            for (const plan of installmentPlans) {
                if (!plan.firstClosingMonth) continue

                const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                const firstMonth = new Date(fy, fm - 1, 1)
                const lastMonth = new Date(fy, fm - 1 + plan.installmentCount - 1, 1)

                // Check if this month has an active installment for this plan
                if (monthDate < firstMonth || monthDate > lastMonth) continue

                const cat = plan.categoryId as { _id: { toString: () => string }; name: string; color?: string } | null
                const catKey = cat?._id?.toString() ?? 'sin-categoria'
                const catName = cat?.name ?? 'Sin categoría'
                const catColor = cat?.color ?? '#9CA3AF'

                // Add installment amount to expense category
                if (!expenseMap[catKey]) expenseMap[catKey] = { name: catName, amount: 0, color: catColor }
                expenseMap[catKey].amount += plan.installmentAmount

                // Add to credit card tracking (installments always use credit cards)
                const account = plan.accountId as {
                    _id: { toString: () => string }
                    type: string
                    name: string
                    color?: string
                } | null

                if (account?.type === 'credit_card') {
                    const cardKey = account._id.toString()
                    if (!ccExpenseByCard[cardKey]) {
                        ccExpenseByCard[cardKey] = {
                            name: account.name,
                            color: account.color ?? '#6366F1',
                            totalExpenses: 0,
                        }
                    }
                    ccExpenseByCard[cardKey].totalExpenses += plan.installmentAmount
                }
            }
        }

        // ── Credit card payments grouped by destination account ────────────────
        const ccPaymentByCard: Record<string, number> = {}
        for (const t of ccPayments) {
            const destId = String(t.destinationAccountId)
            if (destId) {
                ccPaymentByCard[destId] = (ccPaymentByCard[destId] ?? 0) + t.amount
            }
        }

        // ── Prorrateo: net owed per card = expenses - payments ─────────────────
        // netOwed = 0 if payments exceed expenses in the period
        const creditCards = Object.entries(ccExpenseByCard)
            .map(([id, card]) => {
                const totalPaid = ccPaymentByCard[id] ?? 0
                const netOwed = Math.max(0, card.totalExpenses - totalPaid)
                return {
                    id,
                    name: card.name,
                    color: card.color,
                    totalExpenses: card.totalExpenses,
                    totalPaid,
                    netOwed,
                }
            })
            .filter((cc) => cc.totalExpenses > 0)

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
        })
    } catch (error) {
        console.error('Error en sankey:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
