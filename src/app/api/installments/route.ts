import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { InstallmentPlan, Transaction } from '@/lib/models'
import { installmentSchema } from '@/lib/validations'

export async function GET() {
    try {
        const session = await auth()

        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const plans = await InstallmentPlan.find({ userId: session.user.id })
            .populate('accountId', 'name type currency')
            .populate('categoryId', 'name color type')
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
        const parsed = installmentSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de plan de cuotas inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        await connectDB()

        const data = parsed.data
        const installmentAmount = data.totalAmount / data.installmentCount

        const plan = await InstallmentPlan.create({
            userId: session.user.id,
            accountId: data.accountId,
            categoryId: data.categoryId,
            description: data.description,
            merchant: data.merchant,
            currency: data.currency,
            totalAmount: data.totalAmount,
            installmentCount: data.installmentCount,
            installmentAmount,
            purchaseDate: data.purchaseDate,
            firstClosingMonth: data.firstClosingMonth,
        })

        const transaction = await Transaction.create({
            userId: session.user.id,
            type: 'credit_card_expense',
            amount: data.totalAmount,
            currency: data.currency,
            date: data.purchaseDate,
            description: data.description,
            categoryId: data.categoryId,
            sourceAccountId: data.accountId,
            notes: data.notes,
            merchant: data.merchant,
            installmentPlanId: plan._id,
            status: 'confirmed',
            createdFrom: 'web',
        })

        const populatedPlan = await InstallmentPlan.findById(plan._id)
            .populate('accountId', 'name type currency')
            .populate('categoryId', 'name color type')

        return NextResponse.json({ plan: populatedPlan, transaction }, { status: 201 })
    } catch (error) {
        console.error('Error al crear plan de cuotas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}