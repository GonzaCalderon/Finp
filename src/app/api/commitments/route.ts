import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { ScheduledCommitment, CommitmentApplication } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const now = new Date()
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        const commitments = await ScheduledCommitment.find({
            userId: session.user.id,
            isActive: true,
        })
            .populate('categoryId', 'name color')
            .populate('accountId', 'name type')
            .sort({ createdAt: -1 })

        // Obtener aplicaciones del mes actual
        const applications = await CommitmentApplication.find({
            userId: session.user.id,
            period: currentPeriod,
        })

        const appliedIds = new Set(applications.map((a) => a.commitmentId.toString()))

        const commitmentsWithStatus = commitments.map((c) => ({
            ...c.toObject(),
            appliedThisMonth: appliedIds.has(c._id.toString()),
        }))

        return NextResponse.json({ commitments: commitmentsWithStatus })
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
        const { description, amount, currency, categoryId, recurrence, dayOfMonth, applyMode, startDate, endDate } = body

        if (!description || !amount || !currency || !recurrence || !startDate) {
            return NextResponse.json(
                { error: 'Descripción, monto, moneda, recurrencia y fecha de inicio son requeridos' },
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
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            isActive: true,
        })

        return NextResponse.json({ commitment }, { status: 201 })
    } catch (error) {
        console.error('Error al crear compromiso:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}