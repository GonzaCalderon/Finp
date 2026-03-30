import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, InstallmentPlan } from '@/lib/models'
import { transactionSchema } from '@/lib/validations'
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

        const transaction = await Transaction.findOne({
            _id: id,
            userId: session.user.id,
        })
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency')
            .populate('destinationAccountId', 'name type currency')
            .populate('installmentPlanId', 'installmentCount')

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ transaction })
    } catch (error) {
        console.error('Error al obtener transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

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

        const parsed = transactionSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de transacción inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        await connectDB()

        const data = parsed.data

        // Validar saldo si la cuenta destino del débito no permite saldo negativo
        if (data.sourceAccountId) {
            const [oldTransaction, sourceAccount] = await Promise.all([
                Transaction.findOne({ _id: id, userId: session.user.id }),
                Account.findOne({ _id: data.sourceAccountId, userId: session.user.id }),
            ])

            if (sourceAccount?.allowNegativeBalance === false) {
                const currentBalance = await calculateAccountBalance(
                    sourceAccount._id,
                    sourceAccount.userId,
                    sourceAccount.initialBalance ?? 0
                )

                // Si la transacción anterior ya debitaba de esta misma cuenta,
                // devolver ese monto al saldo para evaluar el nuevo débito limpiamente
                const previousDebit =
                    oldTransaction?.sourceAccountId?.toString() === data.sourceAccountId
                        ? oldTransaction.amount
                        : 0

                if (currentBalance + previousDebit - data.amount < 0) {
                    return NextResponse.json(
                        {
                            error: `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: sourceAccount.currency,
                                maximumFractionDigits: 0,
                            }).format(currentBalance + previousDebit)}`,
                        },
                        { status: 400 }
                    )
                }
            }
        }

        const existingTransaction = await Transaction.findOne({
            _id: id,
            userId: session.user.id,
        })

        const transaction = await Transaction.findOneAndUpdate(
            {
                _id: id,
                userId: session.user.id,
            },
            {
                $set: {
                    type: data.type,
                    amount: data.amount,
                    currency: data.currency,
                    date: data.date,
                    description: data.description,
                    categoryId: data.categoryId,
                    sourceAccountId: data.sourceAccountId,
                    destinationAccountId: data.destinationAccountId,
                    notes: data.notes,
                    merchant: data.merchant,
                },
            },
            {
                new: true,
            }
        )
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency')
            .populate('destinationAccountId', 'name type currency')
            .populate('installmentPlanId', 'installmentCount')

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        if (existingTransaction?.installmentPlanId) {
            const currentPlan = await InstallmentPlan.findOne({
                _id: existingTransaction.installmentPlanId,
                userId: session.user.id,
            })

            if (currentPlan) {
                const installmentAmount = data.amount / currentPlan.installmentCount
                await InstallmentPlan.updateOne(
                    {
                        _id: currentPlan._id,
                        userId: session.user.id,
                    },
                    {
                        $set: {
                            accountId: data.sourceAccountId,
                            categoryId: data.categoryId,
                            description: data.description,
                            merchant: data.merchant,
                            currency: data.currency,
                            totalAmount: data.amount,
                            installmentAmount,
                            purchaseDate: data.date,
                        },
                    }
                )
            }
        }

        return NextResponse.json({ transaction })
    } catch (error) {
        console.error('Error al actualizar transacción:', error)
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

        const transaction = await Transaction.findOneAndDelete({
            _id: id,
            userId: session.user.id,
        })

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        return NextResponse.json({ message: 'Transacción eliminada correctamente' })
    } catch (error) {
        console.error('Error al eliminar transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
