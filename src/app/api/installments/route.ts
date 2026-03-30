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

        const parentTransactions = await Transaction.find({
            userId: session.user.id,
            installmentPlanId: { $in: plans.map((plan) => plan._id) },
        })
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')
            .populate('installmentPlanId', 'installmentCount')

        const getInstallmentPlanKey = (value: unknown) => {
            if (!value) return ''
            if (typeof value === 'string') return value
            if (typeof value === 'object' && '_id' in value) {
                const candidate = value as { _id?: { toString(): string } }
                return candidate._id?.toString() ?? ''
            }
            return typeof value?.toString === 'function' ? value.toString() : ''
        }

        const transactionsByPlanId = new Map(
            parentTransactions.map((transaction) => [getInstallmentPlanKey(transaction.installmentPlanId), transaction])
        )

        const plansWithTransaction = plans.map((plan) => ({
            ...plan.toObject(),
            parentTransaction: transactionsByPlanId.get(plan._id.toString()) ?? null,
        }))

        return NextResponse.json({ plans: plansWithTransaction })
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

        const populatedTransaction = await Transaction.findById(transaction._id)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')
            .populate('installmentPlanId', 'installmentCount')

        return NextResponse.json({
            plan: populatedPlan
                ? {
                    ...populatedPlan.toObject(),
                    parentTransaction: populatedTransaction,
                }
                : null,
            transaction: populatedTransaction,
        }, { status: 201 })
    } catch (error) {
        console.error('Error al crear plan de cuotas:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
