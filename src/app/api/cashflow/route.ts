import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, User } from '@/lib/models'
import { getCurrentFinancialPeriod, parseFinancialPeriod, shiftFinancialPeriod } from '@/lib/utils/period'

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

        const transactions = await Transaction.find({
            userId: session.user.id,
            date: { $gte: firstRange.start, $lt: lastRange.end },
        })
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')

        const result = periods.map((period) => {
            const { start, end } = parseFinancialPeriod(period, monthStartDay)
            const monthTransactions = transactions.filter((transaction) => transaction.date >= start && transaction.date < end)

            const income = monthTransactions
                .filter((t) => t.type === 'income')
                .reduce((totals, transaction) => {
                    addCurrencyAmount(totals, transaction.currency, transaction.amount)
                    return totals
                }, emptyCurrencyTotals())

            const expense = monthTransactions
                .filter((t) => t.type === 'expense' && !t.installmentPlanId)
                .reduce((totals, transaction) => {
                    addCurrencyAmount(totals, transaction.currency, transaction.amount)
                    return totals
                }, emptyCurrencyTotals())

            return {
                month: period,
                label: start.toLocaleDateString('es-AR', { month: 'short' }),
                income,
                expense,
                balance: {
                    ars: income.ars - expense.ars,
                    usd: income.usd - expense.usd,
                },
            }
        })

        return NextResponse.json({ cashflow: result })
    } catch (error) {
        console.error('Error en cashflow:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
