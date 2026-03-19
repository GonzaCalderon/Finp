import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Transaction } from '@/lib/models'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const accounts = await Account.find({
            userId: session.user.id,
            isActive: true,
        }).sort({ createdAt: -1 })

        // Calcular saldo de cada cuenta
        const accountsWithBalance = await Promise.all(
            accounts.map(async (account) => {
                const received = await Transaction.aggregate([
                    {
                        $match: {
                            userId: account.userId,
                            destinationAccountId: account._id,
                            type: { $in: ['income', 'transfer', 'credit_card_payment', 'debt_payment'] },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])

                const sent = await Transaction.aggregate([
                    {
                        $match: {
                            userId: account.userId,
                            sourceAccountId: account._id,
                            type: { $in: ['expense', 'transfer', 'credit_card_payment', 'debt_payment', 'adjustment'] },
                        },
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } },
                ])

                const balance =
                    (account.initialBalance ?? 0) +
                    (received[0]?.total ?? 0) -
                    (sent[0]?.total ?? 0)

                return {
                    ...account.toObject(),
                    balance,
                }
            })
        )

        return NextResponse.json({ accounts: accountsWithBalance })
    } catch (error) {
        console.error('Error al obtener cuentas:', error)
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
        const { name, type, currency, institution, description, initialBalance, creditCardConfig, debtConfig, includeInNetWorth, color } = body

        if (!name || !type || !currency) {
            return NextResponse.json(
                { error: 'Nombre, tipo y moneda son requeridos' },
                { status: 400 }
            )
        }

        await connectDB()

        const account = await Account.create({
            userId: session.user.id,
            name,
            type,
            currency,
            institution,
            description,
            initialBalance: initialBalance ?? 0,
            includeInNetWorth: includeInNetWorth ?? true,
            creditCardConfig: type === 'credit_card' ? creditCardConfig : undefined,
            debtConfig: type === 'debt' ? debtConfig : undefined,
            color,
            isActive: true,
        })

        return NextResponse.json({ account }, { status: 201 })
    } catch (error) {
        console.error('Error al crear cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}