import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { InstallmentPlan, Transaction } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const plans = await InstallmentPlan.find({ userId: session.user.id })
            .populate('accountId', 'name type')
            .populate('categoryId', 'name color')
            .sort({ purchaseDate: -1 })

        return NextResponse.json({ plans })
    } catch (error) {
        console.error('Error al obtener planes de cuotas:', error)
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
            description,
            totalAmount,
            installmentCount,
            currency,
            accountId,
            categoryId,
            purchaseDate,
            firstClosingMonth,
            merchant,
            notes,
        } = body

        if (!description || !totalAmount || !installmentCount || !currency || !accountId || !firstClosingMonth) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const installmentAmount = totalAmount / installmentCount

        // Crear plan de cuotas
        const plan = await InstallmentPlan.create({
            userId: session.user.id,
            accountId,
            categoryId: categoryId || undefined,
            description,
            merchant: merchant || undefined,
            currency,
            totalAmount,
            installmentCount,
            installmentAmount,
            purchaseDate: new Date(purchaseDate),
            firstClosingMonth,
        })

        // Crear transacción madre
        const transaction = await Transaction.create({
            userId: session.user.id,
            type: 'expense',
            amount: totalAmount,
            currency,
            date: new Date(purchaseDate),
            description,
            categoryId: categoryId || undefined,
            sourceAccountId: accountId,
            notes: notes || undefined,
            merchant: merchant || undefined,
            installmentPlanId: plan._id,
            status: 'confirmed',
            createdFrom: 'web',
        })

        return NextResponse.json({ plan, transaction }, { status: 201 })
    } catch (error) {
        console.error('Error al crear plan de cuotas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}