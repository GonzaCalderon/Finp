import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Debt, DebtMovement } from '@/lib/models'
import { DEBT_STATUSES, DEBT_MOVEMENT_TYPES } from '@/lib/constants'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID de deuda inválido' }, { status: 400 })
        }

        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: session.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

        if (debt.sourceType !== 'space') {
            return NextResponse.json(
                { error: 'Solo se pueden ignorar deudas derivadas de Espacios' },
                { status: 400 }
            )
        }

        if (debt.status === DEBT_STATUSES.IGNORED) {
            return NextResponse.json({ error: 'La deuda ya está ignorada' }, { status: 400 })
        }

        await Debt.updateOne({ _id: id }, { $set: { status: DEBT_STATUSES.IGNORED } })

        await DebtMovement.create({
            userId: session.user.id,
            debtId: id,
            type: DEBT_MOVEMENT_TYPES.IGNORE,
            amount: debt.remainingAmount,
            currency: debt.currency,
            spaceId: debt.spaceId,
            date: new Date(),
        })

        const updated = await Debt.findById(id)
        return NextResponse.json({ debt: updated })
    } catch (error) {
        console.error('Error al ignorar deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'ID de deuda inválido' }, { status: 400 })
        }

        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: session.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

        if (debt.status !== DEBT_STATUSES.IGNORED) {
            return NextResponse.json({ error: 'La deuda no está ignorada' }, { status: 400 })
        }

        const amountPaid = Math.max(0, debt.amount - debt.remainingAmount)
        const newStatus =
            debt.remainingAmount <= 0.01
                ? DEBT_STATUSES.PAID
                : amountPaid > 0.01
                    ? DEBT_STATUSES.PARTIALLY_PAID
                    : DEBT_STATUSES.ACTIVE

        await Debt.updateOne({ _id: id }, { $set: { status: newStatus } })

        await DebtMovement.create({
            userId: session.user.id,
            debtId: id,
            type: DEBT_MOVEMENT_TYPES.RESTORE,
            amount: debt.remainingAmount,
            currency: debt.currency,
            spaceId: debt.spaceId,
            date: new Date(),
        })

        const updated = await Debt.findById(id)
        return NextResponse.json({ debt: updated })
    } catch (error) {
        console.error('Error al restaurar deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
