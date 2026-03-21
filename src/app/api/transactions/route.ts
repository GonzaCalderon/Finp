import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction } from '@/lib/models'
import { transactionSchema } from '@/lib/validations'

export async function GET(request: Request) {
    try {
        const session = await auth()

        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const month = searchParams.get('month') // formato YYYY-MM
        const type = searchParams.get('type')
        const categoryId = searchParams.get('categoryId')
        const accountId = searchParams.get('accountId')
        const limit = Number.parseInt(searchParams.get('limit') ?? '50', 10)

        await connectDB()

        const filter: Record<string, unknown> = {
            userId: session.user.id,
        }

        if (month) {
            const [year, m] = month.split('-').map(Number)

            if (!Number.isNaN(year) && !Number.isNaN(m)) {
                const start = new Date(year, m - 1, 1)
                const end = new Date(year, m, 1)
                filter.date = { $gte: start, $lt: end }
            }
        }

        if (type) filter.type = type
        if (categoryId) filter.categoryId = categoryId

        if (accountId) {
            filter.$or = [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
        }

        const transactions = await Transaction.find(filter)
            .sort({ date: -1 })
            .limit(Number.isNaN(limit) ? 50 : limit)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency')
            .populate('destinationAccountId', 'name type currency')

        return NextResponse.json({ transactions })
    } catch (error) {
        console.error('Error al obtener transacciones:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()

        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = transactionSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de transacción inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        await connectDB()

        const data = parsed.data

        const transaction = await Transaction.create({
            userId: session.user.id,
            type: data.type,
            amount: data.amount,
            currency: data.currency,
            date: data.date,
            description: data.description,
            categoryId: data.categoryId,
            sourceAccountId: data.sourceAccountId,
            destinationAccountId: data.destinationAccountId,
            notes: data.notes,
            merchant: data.merchant,
            status: 'confirmed',
            createdFrom: 'web',
        })

        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency')
            .populate('destinationAccountId', 'name type currency')

        return NextResponse.json({ transaction: populatedTransaction }, { status: 201 })
    } catch (error) {
        console.error('Error al crear transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}