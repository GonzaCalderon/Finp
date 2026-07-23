import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction } from '@/lib/models'
import { rankCategoryHistory } from '@/lib/utils/category-ranking'
import { buildDescriptionIntelligence } from '@/lib/utils/transaction-description-intelligence'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const searchParams = new URL(request.url).searchParams
        const type = searchParams.get('type')
        if (type !== 'expense' && type !== 'income') {
            return NextResponse.json({ error: 'Tipo de categoria invalido' }, { status: 400 })
        }

        const description = searchParams.get('description')?.slice(0, 200) ?? ''
        const merchant = searchParams.get('merchant')?.slice(0, 120) ?? ''
        const categoryId = searchParams.get('categoryId') ?? undefined
        const currentTransactionId = searchParams.get('transactionId') ?? undefined
        const currencyParam = searchParams.get('currency')
        const currency = currencyParam === 'ARS' || currencyParam === 'USD' ? currencyParam : undefined
        const amountParam = Number(searchParams.get('amount'))
        const amount = Number.isFinite(amountParam) && amountParam > 0 ? amountParam : undefined
        const dateParam = searchParams.get('date')
        const date = dateParam && !Number.isNaN(new Date(dateParam).getTime()) ? dateParam : undefined

        await connectDB()

        const transactions = await Transaction.find({
            userId: session.user.id,
            type: type === 'income' ? 'income' : { $in: ['expense', 'credit_card_expense'] },
            categoryId: { $exists: true, $ne: null },
        })
            .select('_id type categoryId sourceAccountId destinationAccountId description merchant amount currency date')
            .sort({ date: -1, createdAt: -1 })
            .limit(250)
            .lean()

        const history = transactions.map((transaction) => ({
            transactionId: transaction._id.toString(),
            type: transaction.type,
            categoryId: transaction.categoryId?.toString(),
            sourceAccountId: transaction.sourceAccountId?.toString(),
            destinationAccountId: transaction.destinationAccountId?.toString(),
            description: transaction.description,
            merchant: transaction.merchant,
            amount: transaction.amount,
            currency: transaction.currency,
            occurredAt: transaction.date,
        }))

        const ranking = rankCategoryHistory(
            history.map((transaction) => ({
                categoryId: transaction.categoryId?.toString() ?? '',
                description: transaction.description,
                merchant: transaction.merchant,
                occurredAt: transaction.occurredAt,
            })),
            { description, merchant }
        )
        const signals = buildDescriptionIntelligence(history, {
            description,
            merchant,
            categoryId,
            amount,
            currency,
            date,
            currentTransactionId,
        })

        return NextResponse.json(
            { ranking, signals },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (error) {
        console.error('Error al ordenar categorias:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
