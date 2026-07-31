import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { InstallmentPlan, Transaction } from '@/lib/models'
import { installmentSchema } from '@/lib/validations'
import {
    unlinkTransactionDependents,
    type TransactionTeardownResult,
} from '@/lib/server/transaction-teardown'

export async function PATCH(
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

        const plan = await InstallmentPlan.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            {
                $set: {
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
                },
            },
            { new: true }
        )
            .populate('accountId', 'name type currency color')
            .populate('categoryId', 'name color type')

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        const parentTransaction = await Transaction.findOneAndUpdate(
            { installmentPlanId: id, userId: session.user.id },
            {
                $set: {
                    type: 'credit_card_expense',
                    amount: data.totalAmount,
                    currency: data.currency,
                    date: data.purchaseDate,
                    description: data.description,
                    categoryId: data.categoryId,
                    sourceAccountId: data.accountId,
                    notes: data.notes,
                    merchant: data.merchant,
                },
            },
            { new: true }
        )
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')
            .populate('installmentPlanId', 'installmentCount')

        return NextResponse.json({
            plan: {
                ...plan.toObject(),
                parentTransaction,
            },
        })
    } catch (error) {
        console.error('Error al actualizar plan:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function DELETE(
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

        const plan = await InstallmentPlan.findOne({
            _id: id,
            userId: session.user.id,
        }).select({ _id: 1 })

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        // Borrar el plan arrastra su compra originaria, y esa compra puede tener
        // dependientes (aplicación de compromiso, impacto personal de Espacios,
        // notificaciones pendientes). Se reutiliza el teardown del DELETE de
        // transacciones en vez de mantener una versión paralela más pobre.
        const parentTransaction = await Transaction.findOne({
            installmentPlanId: id,
            userId: session.user.id,
        })

        let teardown: TransactionTeardownResult | null = null
        if (parentTransaction) {
            teardown = await unlinkTransactionDependents(session.user.id, parentTransaction)
            await Transaction.deleteOne({
                _id: parentTransaction._id,
                userId: session.user.id,
            })
        }

        // El teardown ya elimina el plan cuando la compra lo apuntaba; esto cubre
        // el plan sin compra asociada y es idempotente.
        await InstallmentPlan.deleteOne({ _id: id, userId: session.user.id })

        return NextResponse.json({
            message: 'Plan eliminado correctamente',
            reverted: {
                commitment: teardown?.revertedCommitment ?? null,
                personalImpact: teardown?.unlinkedPersonalImpact ?? false,
                notifications: teardown?.resolvedNotifications ?? 0,
            },
        })
    } catch (error) {
        console.error('Error al eliminar plan:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
