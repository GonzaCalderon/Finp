import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, InstallmentPlan } from '@/lib/models'
import { transactionSchema } from '@/lib/validations'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { getCommonSupportedCurrencies, getInitialBalancesByCurrency, supportsCurrency } from '@/lib/utils/accounts'
import { normalizeManualExchange } from '@/lib/utils/exchange'

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
            .populate('sourceAccountId', 'name type currency supportedCurrencies')
            .populate('destinationAccountId', 'name type currency supportedCurrencies')
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

        const data = {
            ...parsed.data,
            type: normalizeLegacyTransactionType(parsed.data.type) ?? parsed.data.type,
        }

        const accountIds = [data.sourceAccountId, data.destinationAccountId].filter(Boolean)
        const [oldTransaction, relatedAccounts] = await Promise.all([
            Transaction.findOne({ _id: id, userId: session.user.id }),
            accountIds.length > 0
                ? Account.find({
                    _id: { $in: accountIds },
                    userId: session.user.id,
                })
                : Promise.resolve([]),
        ])

        const accountMap = new Map(relatedAccounts.map((account) => [account._id.toString(), account]))
        const sourceAccount = data.sourceAccountId ? accountMap.get(data.sourceAccountId) : null
        const destinationAccount = data.destinationAccountId ? accountMap.get(data.destinationAccountId) : null

        if (data.sourceAccountId && !sourceAccount) {
            return NextResponse.json({ error: 'La cuenta origen no existe o no pertenece al usuario.' }, { status: 400 })
        }

        if (data.destinationAccountId && !destinationAccount) {
            return NextResponse.json({ error: 'La cuenta destino no existe o no pertenece al usuario.' }, { status: 400 })
        }

        if (data.type === 'transfer' && sourceAccount && destinationAccount) {
            const commonCurrencies = getCommonSupportedCurrencies([sourceAccount, destinationAccount])
            if (commonCurrencies.length === 0) {
                return NextResponse.json(
                    {
                        error: 'La transferencia entre cuentas de distinta moneda debe registrarse como un cambio manual.',
                    },
                    { status: 400 }
                )
            }
        }

        if (sourceAccount && !supportsCurrency(sourceAccount, data.currency)) {
            return NextResponse.json(
                { error: `La cuenta "${sourceAccount.name}" no opera en ${data.currency}.` },
                { status: 400 }
            )
        }

        if (
            data.type === 'exchange' &&
            destinationAccount &&
            data.destinationCurrency &&
            !supportsCurrency(destinationAccount, data.destinationCurrency)
        ) {
            return NextResponse.json(
                { error: `La cuenta "${destinationAccount.name}" no opera en ${data.destinationCurrency}.` },
                { status: 400 }
            )
        }

        if (data.type !== 'exchange' && destinationAccount && !supportsCurrency(destinationAccount, data.currency)) {
            return NextResponse.json(
                { error: `La cuenta "${destinationAccount.name}" no opera en ${data.currency}.` },
                { status: 400 }
            )
        }

        // Validar saldo si la cuenta destino del débito no permite saldo negativo
        if (sourceAccount) {
            if (sourceAccount.allowNegativeBalance === false) {
                const currentBalances = await calculateAccountBalancesByCurrency(
                    sourceAccount._id,
                    sourceAccount.userId,
                    {
                        initialBalances: getInitialBalancesByCurrency(sourceAccount),
                    }
                )
                const currentBalance = currentBalances[data.currency]

                // Si la transacción anterior ya debitaba de esta misma cuenta,
                // devolver ese monto al saldo para evaluar el nuevo débito limpiamente
                const previousDebit =
                    oldTransaction &&
                    oldTransaction.sourceAccountId?.toString() === data.sourceAccountId &&
                    oldTransaction.currency === data.currency
                        ? oldTransaction.amount
                        : 0

                if (currentBalance + previousDebit - data.amount < 0) {
                    return NextResponse.json(
                        {
                            error: `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: data.currency,
                                maximumFractionDigits: 0,
                            }).format(currentBalance + previousDebit)}`,
                        },
                        { status: 400 }
                    )
                }
            }
        }

        if (data.type === 'exchange') {
            try {
                normalizeManualExchange({
                    sourceCurrency: data.currency,
                    sourceAmount: data.amount,
                    destinationCurrency: data.destinationCurrency!,
                    destinationAmount: data.destinationAmount!,
                    exchangeRate: data.exchangeRate!,
                })
            } catch (error) {
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : 'Datos de cambio manual inválidos.' },
                    { status: 400 }
                )
            }
        }

        const existingTransaction = oldTransaction

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
                    destinationAmount: data.type === 'exchange' ? data.destinationAmount : undefined,
                    destinationCurrency: data.type === 'exchange' ? data.destinationCurrency : undefined,
                    exchangeRate: data.type === 'exchange' ? data.exchangeRate : undefined,
                    paymentGroupId: data.paymentGroupId ?? existingTransaction?.paymentGroupId,
                    notes: data.notes,
                    merchant: data.merchant,
                },
            },
            {
                new: true,
            }
        )
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency supportedCurrencies')
            .populate('destinationAccountId', 'name type currency supportedCurrencies')
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
