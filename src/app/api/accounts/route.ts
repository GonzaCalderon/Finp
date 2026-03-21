import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, Transaction } from '@/lib/models'

type BalanceBucket = {
    _id: string
    total: number
}

type TransactionFlowsResult = {
    incoming: BalanceBucket[]
    outgoing: BalanceBucket[]
}

type AccountBalanceMap = Record<string, number>

export async function GET() {
    try {
        const session = await auth()

        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const accounts = await Account.find({ userId: session.user.id })
            .sort({ createdAt: 1 })
            .lean()

        if (accounts.length === 0) {
            return NextResponse.json({ accounts: [] })
        }

        const accountIds = accounts.map((account) => account._id)

        const transactionFlows = await Transaction.aggregate<TransactionFlowsResult>([
            {
                $match: {
                    userId: accounts[0].userId,
                    $or: [
                        { sourceAccountId: { $in: accountIds } },
                        { destinationAccountId: { $in: accountIds } },
                    ],
                },
            },
            {
                $project: {
                    amount: 1,
                    incomingAccountId: '$destinationAccountId',
                    outgoingAccountId: '$sourceAccountId',
                },
            },
            {
                $facet: {
                    incoming: [
                        {
                            $match: {
                                incomingAccountId: { $ne: null },
                            },
                        },
                        {
                            $group: {
                                _id: '$incomingAccountId',
                                total: { $sum: '$amount' },
                            },
                        },
                    ],
                    outgoing: [
                        {
                            $match: {
                                outgoingAccountId: { $ne: null },
                            },
                        },
                        {
                            $group: {
                                _id: '$outgoingAccountId',
                                total: { $sum: '$amount' },
                            },
                        },
                    ],
                },
            },
        ])

        const balanceMap: AccountBalanceMap = {}
        const flowResult = transactionFlows[0]

        for (const bucket of flowResult?.incoming ?? []) {
            balanceMap[String(bucket._id)] = (balanceMap[String(bucket._id)] ?? 0) + bucket.total
        }

        for (const bucket of flowResult?.outgoing ?? []) {
            balanceMap[String(bucket._id)] = (balanceMap[String(bucket._id)] ?? 0) - bucket.total
        }

        const accountsWithBalance = accounts.map((account) => ({
            ...account,
            balance: (account.initialBalance ?? 0) + (balanceMap[String(account._id)] ?? 0),
        }))

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
        const { name, type, currency, initialBalance, color, icon, bankName, lastFourDigits } = body

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
            initialBalance: initialBalance || 0,
            color,
            icon,
            bankName,
            lastFourDigits,
        })

        return NextResponse.json({ account }, { status: 201 })
    } catch (error) {
        console.error('Error al crear cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}