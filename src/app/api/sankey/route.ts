import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Category } from '@/lib/models'

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

        const transactions = await Transaction.find({
            userId: session.user.id,
            date: { $gte: start, $lt: end },
            type: { $in: ['income', 'expense'] },
            installmentPlanId: { $exists: false },
        }).populate('categoryId', 'name color')

        // Agrupar ingresos por categoría
        const incomeMap: Record<string, { name: string; amount: number; color: string }> = {}
        const expenseMap: Record<string, { name: string; amount: number; color: string }> = {}

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
            }
        })

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
        })
    } catch (error) {
        console.error('Error en sankey:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}