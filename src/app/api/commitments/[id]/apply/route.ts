import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment, CommitmentApplication, Transaction } from '@/lib/models'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const { period, amount, accountId, date, notes } = body

        if (!period || !amount || !accountId) {
            return NextResponse.json(
                { error: 'Período, monto y cuenta son requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const commitment = await ScheduledCommitment.findOne({
            _id: id,
            userId: session.user.id,
        })

        if (!commitment) {
            return NextResponse.json({ error: 'Compromiso no encontrado' }, { status: 404 })
        }

        // Verificar que no esté ya aplicado en este período
        const existing = await CommitmentApplication.findOne({
            userId: session.user.id,
            commitmentId: id,
            period,
        })

        if (existing) {
            return NextResponse.json(
                { error: 'Este compromiso ya fue aplicado en este período' },
                { status: 409 }
            )
        }

        // Crear transacción
        const transaction = await Transaction.create({
            userId: session.user.id,
            type: 'expense',
            amount,
            currency: commitment.currency,
            date: date ? new Date(date) : new Date(),
            description: commitment.description,
            categoryId: commitment.categoryId ?? undefined,
            sourceAccountId: accountId,
            notes: notes || undefined,
            status: 'confirmed',
            createdFrom: 'web',
        })

        // Registrar aplicación
        const application = await CommitmentApplication.create({
            userId: session.user.id,
            commitmentId: id,
            period,
            transactionId: transaction._id,
            appliedAt: new Date(),
            appliedBy: 'manual',
        })

        return NextResponse.json({ transaction, application }, { status: 201 })
    } catch (error) {
        console.error('Error al aplicar compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}