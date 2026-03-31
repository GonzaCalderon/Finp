import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, InstallmentPlan, Transaction, User } from '@/lib/models'
import { buildMonthlyCardPaymentSummary } from '@/lib/utils/credit-card'
import { getCurrentFinancialPeriod, parseFinancialPeriod } from '@/lib/utils/period'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const cardId = searchParams.get('cardId')
        if (!cardId) {
            return NextResponse.json({ error: 'La tarjeta es requerida' }, { status: 400 })
        }

        await connectDB()

        const userDoc = await User.findById(session.user.id, { 'preferences.monthStartDay': 1 })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const month = searchParams.get('month') ?? getCurrentFinancialPeriod(new Date(), monthStartDay)
        const { start, end } = parseFinancialPeriod(month, monthStartDay)

        const [transactions, plans, card] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                date: { $gte: start, $lt: end },
            })
                .populate('categoryId', 'name color type')
                .populate('sourceAccountId', 'name type currency color')
                .populate('destinationAccountId', 'name type currency color'),
            InstallmentPlan.find({ userId: session.user.id, accountId: cardId })
                .populate('accountId', 'name type currency color')
                .populate('categoryId', 'name color type'),
            Account.findOne({ _id: cardId, userId: session.user.id }, 'name currency color'),
        ])

        const summary = buildMonthlyCardPaymentSummary({
            month,
            monthStartDay,
            plans,
            transactions,
        }).find((item) => item.cardId === cardId)

        return NextResponse.json({
            month,
            summary: summary ?? {
                cardId,
                cardName: card?.name,
                cardColor: card?.color,
                due: 0,
                paid: 0,
                pending: 0,
                currency: card?.currency ?? 'ARS',
                items: [],
            },
        })
    } catch (error) {
        console.error('Error al obtener resumen de pago de tarjeta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
