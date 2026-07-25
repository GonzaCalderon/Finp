import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { TransactionRule } from '@/lib/models'
import { transactionRuleInputSchema } from '@/lib/validations/transaction-rule'

export async function GET() {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        await connectDB()

        const rules = await TransactionRule.find({ userId: session.user.id })
            .sort({ priority: -1, createdAt: -1 })
            .populate('categoryId', 'name color type')

        return NextResponse.json({ rules })
    } catch (error) {
        console.error('Error al obtener reglas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const parsed = transactionRuleInputSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de regla inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const rule = await TransactionRule.create({
            userId: session.user.id,
            ...parsed.data,
        })

        const populated = await TransactionRule.findById(rule._id).populate(
            'categoryId',
            'name color type'
        )

        return NextResponse.json({ rule: populated }, { status: 201 })
    } catch (error) {
        console.error('Error al crear regla:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
