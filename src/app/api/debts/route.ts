import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Debt, DebtMovement } from '@/lib/models'
import { createManualDebtSchema } from '@/lib/validations/debt'
import { DEBT_STATUSES, DEBT_MOVEMENT_TYPES } from '@/lib/constants'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const direction = searchParams.get('direction')
        const status = searchParams.get('status')
        const sourceType = searchParams.get('sourceType')
        const currency = searchParams.get('currency')
        const includeIgnored = searchParams.get('includeIgnored') === 'true'

        await connectDB()

        const query: Record<string, unknown> = { userId: session.user.id }

        if (direction) query.direction = direction
        if (sourceType) query.sourceType = sourceType
        if (currency) query.currency = currency

        if (status) {
            query.status = status
        } else if (!includeIgnored) {
            // Por defecto excluir ignored, paid, cancelled
            query.status = { $in: [DEBT_STATUSES.ACTIVE, DEBT_STATUSES.PARTIALLY_PAID] }
        }

        const debts = await Debt.find(query).sort({ createdAt: -1 })

        return NextResponse.json({ debts, total: debts.length })
    } catch (error) {
        console.error('Error al listar deudas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const parsed = createManualDebtSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const debt = await Debt.create({
            userId: session.user.id,
            direction: parsed.data.direction,
            sourceType: 'manual',
            counterpartyNameSnapshot: parsed.data.counterpartyName,
            amount: parsed.data.amount,
            remainingAmount: parsed.data.amount,
            currency: parsed.data.currency,
            status: DEBT_STATUSES.ACTIVE,
            notes: parsed.data.notes,
        })

        await DebtMovement.create({
            userId: session.user.id,
            debtId: debt._id,
            type: DEBT_MOVEMENT_TYPES.CREATION,
            amount: parsed.data.amount,
            currency: parsed.data.currency,
            date: parsed.data.date,
            notes: parsed.data.notes,
        })

        return NextResponse.json({ debt }, { status: 201 })
    } catch (error) {
        console.error('Error al crear deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
