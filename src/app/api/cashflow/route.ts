import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, InstallmentPlan, User } from '@/lib/models'
import { buildMonthlyCardPaymentSummary } from '@/lib/utils/credit-card'
import { getCurrentFinancialPeriod, parseFinancialPeriod, shiftFinancialPeriod } from '@/lib/utils/period'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const months = parseInt(searchParams.get('months') ?? '6')

        await connectDB()

        const now = new Date()
        const userDoc = await User.findById(session.user.id, { 'preferences.monthStartDay': 1 })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const currentPeriod = getCurrentFinancialPeriod(now, monthStartDay)
        const periods = Array.from({ length: months }, (_, index) =>
            shiftFinancialPeriod(currentPeriod, -(months - 1 - index))
        )

        const firstRange = parseFinancialPeriod(periods[0], monthStartDay)
        const lastRange = parseFinancialPeriod(periods[periods.length - 1], monthStartDay)

        const [transactions, plans] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                date: { $gte: firstRange.start, $lt: lastRange.end },
            })
                .populate('sourceAccountId', 'name type currency color')
                .populate('destinationAccountId', 'name type currency color'),
            InstallmentPlan.find({ userId: session.user.id })
                .populate('accountId', 'name type currency color')
                .populate('categoryId', 'name color type'),
        ])

        const result = periods.map((period) => {
            const { start, end } = parseFinancialPeriod(period, monthStartDay)
            const monthTransactions = transactions.filter((transaction) => transaction.date >= start && transaction.date < end)
            const cardSummary = buildMonthlyCardPaymentSummary({
                month: period,
                monthStartDay,
                plans,
                transactions: monthTransactions,
            })

            const income = monthTransactions
                .filter((t) => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0)

            const expense = monthTransactions
                .filter((t) => t.type === 'expense' && !t.installmentPlanId)
                .reduce((sum, t) => sum + t.amount, 0) + cardSummary.reduce((sum, item) => sum + item.due, 0)

            return {
                month: period,
                label: start.toLocaleDateString('es-AR', { month: 'short' }),
                income,
                expense,
                balance: income - expense,
            }
        })

        return NextResponse.json({ cashflow: result })
    } catch (error) {
        console.error('Error en cashflow:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
