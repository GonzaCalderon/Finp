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
        const months = parseInt(searchParams.get('months') ?? '6')

        await connectDB()

        const now = new Date()
        const result = []

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const start = new Date(date.getFullYear(), date.getMonth(), 1)
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

            const transactions = await Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
                type: { $in: ['income', 'expense'] },
                installmentPlanId: { $exists: false },
            })

            const income = transactions
                .filter((t) => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0)

            const expense = transactions
                .filter((t) => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0)

            result.push({
                month: monthKey,
                label: date.toLocaleDateString('es-AR', { month: 'short' }),
                income,
                expense,
                balance: income - expense,
            })
        }

        return NextResponse.json({ cashflow: result })
    } catch (error) {
        console.error('Error en cashflow:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}