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
        const month = searchParams.get('month') // formato YYYY-MM
        const type = searchParams.get('type')
        const categoryId = searchParams.get('categoryId')
        const accountId = searchParams.get('accountId')
        const limit = parseInt(searchParams.get('limit') ?? '50')

        await connectDB()

        const filter: Record<string, unknown> = { userId: session.user.id }

        if (month) {
            const [year, m] = month.split('-').map(Number)
            const start = new Date(year, m - 1, 1)
            const end = new Date(year, m, 1)
            filter.date = { $gte: start, $lt: end }
        }

        if (type) filter.type = type
        if (categoryId) filter.categoryId = categoryId
        if (accountId) {
            filter.$or = [
                { sourceAccountId: accountId },
                { destinationAccountId: accountId },
            ]
        }

        const transactions = await Transaction.find(filter)
            .sort({ date: -1 })
            .limit(limit)
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
        const {
            type,
            amount,
            currency,
            date,
            description,
            categoryId,
            sourceAccountId,
            destinationAccountId,
            notes,
            tags,
            merchant,
            status,
        } = body

        if (!type || !amount || !currency || !date || !description) {
            return NextResponse.json(
                { error: 'Tipo, monto, moneda, fecha y descripción son requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const transaction = await Transaction.create({
            userId: session.user.id,
            type,
            amount,
            currency,
            date: new Date(date),
            description,
            categoryId: categoryId || undefined,
            sourceAccountId: sourceAccountId || undefined,
            destinationAccountId: destinationAccountId || undefined,
            notes: notes || undefined,
            merchant: merchant || undefined,
            status: status ?? 'confirmed',
            createdFrom: 'web',
        })

        return NextResponse.json({ transaction }, { status: 201 })
    } catch (error) {
        console.error('Error al crear transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}