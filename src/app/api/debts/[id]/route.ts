import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Debt, DebtMovement } from '@/lib/models'
import { adjustDebtSchema } from '@/lib/validations/debt'
import { DEBT_STATUSES, DEBT_MOVEMENT_TYPES } from '@/lib/constants'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params

        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: session.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

        const movements = await DebtMovement.find({ debtId: id, userId: session.user.id })
            .sort({ createdAt: 1 })

        return NextResponse.json({ debt, movements })
    } catch (error) {
        console.error('Error al obtener deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { id } = await params
        const body = await request.json()
        const parsed = adjustDebtSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const debt = await Debt.findOne({ _id: id, userId: session.user.id })
        if (!debt) return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 })

        if (debt.sourceType !== 'manual') {
            return NextResponse.json(
                { error: 'Solo se pueden ajustar deudas manuales' },
                { status: 400 }
            )
        }

        if (debt.status === DEBT_STATUSES.CANCELLED) {
            return NextResponse.json({ error: 'La deuda ya está cancelada' }, { status: 400 })
        }

        const now = new Date()

        if (parsed.data.status === 'cancelled') {
            await Debt.updateOne(
                { _id: id },
                { $set: { status: DEBT_STATUSES.CANCELLED } }
            )

            await DebtMovement.create({
                userId: session.user.id,
                debtId: id,
                type: DEBT_MOVEMENT_TYPES.CANCELLATION,
                amount: debt.remainingAmount,
                currency: debt.currency,
                date: now,
                notes: parsed.data.notes,
            })
        } else if (parsed.data.amount !== undefined) {
            const newAmount = parsed.data.amount
            const amountPaid = Math.max(0, debt.amount - debt.remainingAmount)
            const newRemaining = Math.max(0, newAmount - amountPaid)

            let newStatus = debt.status
            if (newRemaining <= 0.01) {
                newStatus = DEBT_STATUSES.PAID
            } else if (amountPaid > 0.01) {
                newStatus = DEBT_STATUSES.PARTIALLY_PAID
            } else {
                newStatus = DEBT_STATUSES.ACTIVE
            }

            await Debt.updateOne(
                { _id: id },
                {
                    $set: {
                        amount: newAmount,
                        remainingAmount: newRemaining,
                        status: newStatus,
                        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
                    },
                }
            )

            await DebtMovement.create({
                userId: session.user.id,
                debtId: id,
                type: DEBT_MOVEMENT_TYPES.ADJUSTMENT,
                amount: newAmount,
                currency: debt.currency,
                date: now,
                notes: parsed.data.notes,
            })
        } else if (parsed.data.notes !== undefined) {
            await Debt.updateOne({ _id: id }, { $set: { notes: parsed.data.notes } })
        }

        const updated = await Debt.findById(id)
        return NextResponse.json({ debt: updated })
    } catch (error) {
        console.error('Error al ajustar deuda:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
