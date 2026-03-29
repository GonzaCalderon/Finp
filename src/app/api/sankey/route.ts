import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction } from '@/lib/models'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const months = parseInt(searchParams.get('months') ?? '1')

        await connectDB()

        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        // Ingresos/gastos del período (sin cuotas de planes)
        // + sourceAccountId para detectar gastos en tarjeta de crédito
        const [transactions, ccPayments] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
                type: { $in: ['income', 'expense'] },
                installmentPlanId: { $exists: false },
            })
                .populate('categoryId', 'name color')
                .populate('sourceAccountId', 'name type color'),

            // Pagos de tarjeta del período (para prorrateo de deuda)
            Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
                type: 'credit_card_payment',
            }).select('amount destinationAccountId'),
        ])

        const incomeMap: Record<string, { name: string; amount: number; color: string }> = {}
        const expenseMap: Record<string, { name: string; amount: number; color: string }> = {}

        // Gastos en tarjeta de crédito por cuenta (para prorrateo)
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

                // Rastrear gastos imputados a tarjeta de crédito
                const src = t.sourceAccountId as {
                    _id: { toString: () => string }
                    type: string
                    name: string
                    color?: string
                } | null

                if (src?.type === 'credit_card') {
                    const cardKey = src._id.toString()
                    if (!ccExpenseByCard[cardKey]) {
                        ccExpenseByCard[cardKey] = {
                            name: src.name,
                            color: src.color ?? '#6366F1',
                            totalExpenses: 0,
                        }
                    }
                    ccExpenseByCard[cardKey].totalExpenses += t.amount
                }
            }
        })

        // Pagos de tarjeta agrupados por cuenta destino
        const ccPaymentByCard: Record<string, number> = {}
        for (const t of ccPayments) {
            const destId = String(t.destinationAccountId)
            if (destId) {
                ccPaymentByCard[destId] = (ccPaymentByCard[destId] ?? 0) + t.amount
            }
        }

        // Prorrateo: deuda neta por tarjeta = gastos en tarjeta - pagos realizados en el período
        // Si se pagó más de lo gastado en el período, netOwed = 0 (cubre deuda anterior también)
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
            .filter((cc) => cc.totalExpenses > 0) // solo tarjetas usadas en el período

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
