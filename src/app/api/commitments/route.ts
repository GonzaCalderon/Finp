import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const commitments = await ScheduledCommitment.find({
            userId: session.user.id,
            isActive: true,
        })
            .populate('categoryId', 'name color')
            .populate('accountId', 'name type')
            .sort({ createdAt: -1 })

        return NextResponse.json({ commitments })
    } catch (error) {
        console.error('Error al obtener compromisos:', error)
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
        const { description, amount, currency, categoryId, recurrence, dayOfMonth, applyMode } = body

        if (!description || !amount || !currency || !recurrence) {
            return NextResponse.json(
                { error: 'Descripción, monto, moneda y recurrencia son requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const commitment = await ScheduledCommitment.create({
            userId: session.user.id,
            description,
            amount,
            currency,
            categoryId: categoryId || undefined,
            recurrence,
            dayOfMonth: dayOfMonth || undefined,
            applyMode: applyMode ?? 'manual',
            isActive: true,
        })

        return NextResponse.json({ commitment }, { status: 201 })
    } catch (error) {
        console.error('Error al crear compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}