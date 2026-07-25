import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, InstallmentPlan } from '@/lib/models'
import { transactionSchema } from '@/lib/validations'
import { isNonOperationalTransactionType } from '@/lib/utils/operational-amount'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { getCommonSupportedCurrencies, getInitialBalancesByCurrency, supportsCurrency } from '@/lib/utils/accounts'
import { normalizeManualExchange } from '@/lib/utils/exchange'
import { resolveTransactionDescription } from '@/lib/utils/transaction-description'
import { getBalanceBeforeReplacingTransaction } from '@/lib/utils/transaction-account-impact'
import { recordTransactionLearningEvent } from '@/lib/server/quick-capture-learning'
import { unlinkTransactionDependents } from '@/lib/server/transaction-teardown'
import { resolveRuleTraceForEdit } from '@/lib/server/transactions'
import { syncApplicationSnapshotFromTransaction } from '@/lib/server/commitments'

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

        await connectDB()

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

        if (oldTransaction && isNonOperationalTransactionType(oldTransaction.type)) {
            return NextResponse.json(
                {
                    error: 'Esta transacción se gestiona desde Deudas y no puede editarse como transacción común.',
                    code: 'NON_EDITABLE_TRANSACTION',
                },
                { status: 422 }
            )
        }

        const accountMap = new Map(relatedAccounts.map((account) => [account._id.toString(), account]))
        const sourceAccount = data.sourceAccountId ? accountMap.get(data.sourceAccountId) : null
        const destinationAccount = data.destinationAccountId ? accountMap.get(data.destinationAccountId) : null
        const description = resolveTransactionDescription({
            type: data.type,
            description: data.description,
            amount: data.amount,
            currency: data.currency,
            destinationCurrency: data.destinationCurrency,
            sourceAccount,
            destinationAccount,
        })

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

                const availableBalance = getBalanceBeforeReplacingTransaction({
                    currentBalance,
                    previousTransaction: oldTransaction,
                    accountId: data.sourceAccountId!,
                    currency: data.currency,
                })

                if (availableBalance - data.amount < 0) {
                    return NextResponse.json(
                        {
                            error: `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: data.currency,
                                maximumFractionDigits: 0,
                            }).format(availableBalance)}`,
                        },
                        { status: 400 }
                    )
                }
            }
        }

        let normalizedExchange: ReturnType<typeof normalizeManualExchange> | undefined
        if (data.type === 'exchange') {
            try {
                normalizedExchange = normalizeManualExchange({
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

        // La traza de regla se recalcula en cada edición: si no, el pill de
        // procedencia sigue mostrando la regla del alta aunque ya no coincida.
        const ruleTrace = await resolveRuleTraceForEdit(session.user.id, {
            type: data.type,
            description,
            merchant: data.merchant,
            categoryId: data.categoryId,
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
                    description,
                    categoryId: data.categoryId,
                    sourceAccountId: data.sourceAccountId,
                    destinationAccountId: data.destinationAccountId,
                    ...(data.type === 'exchange'
                        ? {
                            destinationAmount: data.destinationAmount,
                            destinationCurrency: data.destinationCurrency,
                            exchangeRate: normalizedExchange?.exchangeRate,
                        }
                        : {}),
                    paymentGroupId: data.paymentGroupId ?? existingTransaction?.paymentGroupId,
                    notes: data.notes,
                    merchant: data.merchant,
                    ...(ruleTrace.matched
                        ? {
                            appliedRuleId: ruleTrace.appliedRuleId,
                            appliedRuleNameSnapshot: ruleTrace.appliedRuleNameSnapshot,
                            appliedRuleMatchSnapshot: ruleTrace.appliedRuleMatchSnapshot,
                            appliedRuleActions:
                                Object.keys(ruleTrace.appliedRuleActions).length > 0
                                    ? ruleTrace.appliedRuleActions
                                    : undefined,
                        }
                        : {}),
                },
                $unset: {
                    ...(data.type !== 'exchange'
                        ? {
                            destinationAmount: 1,
                            destinationCurrency: 1,
                            exchangeRate: 1,
                        }
                        : {}),
                    // Ya ninguna regla coincide: la traza se borra en vez de mentir.
                    ...(ruleTrace.matched
                        ? {}
                        : {
                            appliedRuleId: 1,
                            appliedRuleNameSnapshot: 1,
                            appliedRuleMatchSnapshot: 1,
                            appliedRuleActions: 1,
                        }),
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
                            description,
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

        // Si la transacción nació de un compromiso, la foto de la aplicación se
        // actualiza para reflejar lo que realmente pasó en ese período. La
        // plantilla NO se toca: cambiar los próximos períodos es una acción
        // explícita y aparte.
        let commitmentTemplateUpdateAvailable = false
        if (transaction.commitmentApplicationId) {
            try {
                commitmentTemplateUpdateAvailable = await syncApplicationSnapshotFromTransaction(
                    session.user.id,
                    transaction._id.toString(),
                    {
                        amount: data.amount,
                        currency: data.currency,
                        description,
                        categoryId: data.categoryId,
                        accountId: data.sourceAccountId,
                    }
                )
            } catch (snapshotError) {
                console.error('No se pudo sincronizar la aplicación del compromiso:', snapshotError)
            }
        }

        try {
            await recordTransactionLearningEvent({
                userId: session.user.id,
                type: 'transaction_edited',
                transaction,
                eventId: `transaction_edited:${transaction._id.toString()}:${transaction.updatedAt?.getTime() ?? Date.now()}`,
            })
        } catch (learningError) {
            console.error(
                'No se pudo registrar el aprendizaje de la edición:',
                learningError
            )
        }

        return NextResponse.json({ transaction, commitmentTemplateUpdateAvailable })
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

        const existing = await Transaction.findOne({
            _id: id,
            userId: session.user.id,
        }).lean<{
            _id: { toString(): string }
            type: string
            currency?: string
            description?: string
            merchant?: string
            sourceAccountId?: unknown
            destinationAccountId?: unknown
            categoryId?: unknown
            paymentGroupId?: string | null
            updatedAt?: Date
        } | null>()

        if (!existing) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        if (isNonOperationalTransactionType(existing.type)) {
            return NextResponse.json(
                {
                    error: 'Esta transacción es parte de un pago/cobro de deuda. Gestionala desde Deudas.',
                    code: 'NON_DELETABLE_TRANSACTION',
                },
                { status: 422 }
            )
        }

        // Se desvincula antes de borrar: si el borrado falla, no queda una
        // aplicación revertida apuntando a una transacción que sigue viva... y si
        // se hiciera después, un fallo dejaría los huérfanos que había hasta ahora.
        const teardown = await unlinkTransactionDependents(session.user.id, existing)

        const transaction = await Transaction.findOneAndDelete({
            _id: id,
            userId: session.user.id,
        })

        if (!transaction) {
            return NextResponse.json({ error: 'Transacción no encontrada' }, { status: 404 })
        }

        try {
            const isUndo =
                new URL(request.url).searchParams.get('reason') ===
                'quick_capture_undo'
            await recordTransactionLearningEvent({
                userId: session.user.id,
                type: isUndo ? 'transaction_undone' : 'transaction_deleted',
                transaction,
                eventId: `${isUndo ? 'transaction_undone' : 'transaction_deleted'}:${transaction._id.toString()}`,
            })
        } catch (learningError) {
            console.error(
                'No se pudo registrar el aprendizaje del borrado:',
                learningError
            )
        }

        // Se devuelve qué se revirtió para que el toast pueda explicarlo en vez
        // de que el usuario descubra el efecto colateral por su cuenta.
        return NextResponse.json({
            message: 'Transacción eliminada correctamente',
            reverted: {
                commitment: teardown.revertedCommitment ?? null,
                personalImpact: teardown.unlinkedPersonalImpact,
                notifications: teardown.resolvedNotifications,
                orphanPaymentSiblingId: teardown.orphanPaymentSiblingId ?? null,
            },
        })
    } catch (error) {
        console.error('Error al eliminar transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
