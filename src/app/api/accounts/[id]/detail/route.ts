import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Transaction, InstallmentPlan } from '@/lib/models'
import { calculateAccountBalance } from '@/lib/utils/balance'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        await connectDB()

        const account = await Account.findOne({ _id: id, userId: session.user.id })
        if (!account) {
            return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
        }

        // Calcular saldo actual usando la función compartida (fuente única de verdad)
        const balance = await calculateAccountBalance(
            account._id,
            account.userId,
            account.initialBalance ?? 0
        )

        // Últimas 10 transacciones de esta cuenta
        const recentTransactions = await Transaction.find({
            userId: session.user.id,
            $or: [
                { sourceAccountId: account._id },
                { destinationAccountId: account._id },
            ],
        })
            .sort({ date: -1 })
            .limit(10)
            .populate('categoryId', 'name color')

        // Cuotas activas (solo para tarjetas)
        let activeInstallments: object[] = []
        if (account.type === 'credit_card') {
            const now = new Date()
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

            const plans = await InstallmentPlan.find({
                userId: session.user.id,
                accountId: account._id,
            }).populate('categoryId', 'name color')

            activeInstallments = plans
                .filter((plan) => {
                    const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                    const lastMonth = new Date(fy, fm - 1 + plan.installmentCount - 1, 1)
                    const current = new Date(now.getFullYear(), now.getMonth(), 1)
                    return current <= lastMonth
                })
                .map((plan) => {
                    const [fy, fm] = plan.firstClosingMonth.split('-').map(Number)
                    const now = new Date()
                    const paidInstallments = Math.max(
                        0,
                        (now.getFullYear() - fy) * 12 + (now.getMonth() + 1 - fm) + 1
                    )
                    const remainingInstallments = plan.installmentCount - paidInstallments
                    const remainingAmount = remainingInstallments * plan.installmentAmount

                    return {
                        _id: plan._id,
                        description: plan.description,
                        merchant: plan.merchant,
                        totalAmount: plan.totalAmount,
                        installmentAmount: plan.installmentAmount,
                        installmentCount: plan.installmentCount,
                        paidInstallments,
                        remainingInstallments,
                        remainingAmount,
                        currency: plan.currency,
                        firstClosingMonth: plan.firstClosingMonth,
                        category: plan.categoryId,
                    }
                })
        }

        return NextResponse.json({
            account: {
                ...account.toObject(),
                balance,
            },
            recentTransactions,
            activeInstallments,
        })
    } catch (error) {
        console.error('Error al obtener detalle de cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}