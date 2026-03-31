import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account } from '@/lib/models'
import { accountSchema } from '@/lib/validations'
import type { IAccount } from '@/types'
import {
    buildCurrencyBalances,
    getInitialBalancesByCurrency,
    getPrimaryCurrency,
    normalizeInitialBalances,
    normalizeSupportedCurrencies,
} from '@/lib/utils/accounts'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'

export async function GET() {
    try {
        const session = await auth()

        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const accounts = await Account.find({ userId: session.user.id })
            .sort({ createdAt: 1 })
            .lean<IAccount[]>()

        if (accounts.length === 0) {
            return NextResponse.json({ accounts: [] })
        }

        const accountsWithBalance = accounts.map((account) => {
            const supportedCurrencies = normalizeSupportedCurrencies(
                account.supportedCurrencies,
                account.currency,
                account.type
            )
            const primaryCurrency = getPrimaryCurrency({
                type: account.type,
                currency: account.currency,
                supportedCurrencies,
            })
            const initialBalances = normalizeInitialBalances(
                account.initialBalances,
                account.initialBalance,
                account.currency,
                supportedCurrencies,
                account.type
            )
            return {
                ...account,
                supportedCurrencies,
                currency: primaryCurrency,
                initialBalances,
                primaryCurrency,
            }
        })

        const balancesByAccount = await Promise.all(
            accountsWithBalance.map(async (account) => ({
                accountId: String(account._id),
                balancesByCurrency: await calculateAccountBalancesByCurrency(
                    account._id,
                    account.userId,
                    { initialBalances: account.initialBalances }
                ),
            }))
        )

        const balanceMap = new Map(
            balancesByAccount.map((item) => [item.accountId, buildCurrencyBalances(item.balancesByCurrency)])
        )

        const hydratedAccounts = accountsWithBalance.map((account) => {
            const balancesByCurrency = balanceMap.get(String(account._id)) ?? buildCurrencyBalances()

            return {
                ...account,
                balancesByCurrency,
                balance: balancesByCurrency[account.primaryCurrency],
            }
        })

        return NextResponse.json({ accounts: hydratedAccounts })
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
        const parsed = accountSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de cuenta inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const account = await Account.create({
            userId: session.user.id,
            ...parsed.data,
            initialBalance: parsed.data.initialBalance ?? 0,
            initialBalances: getInitialBalancesByCurrency(parsed.data),
        })

        return NextResponse.json({ account }, { status: 201 })
    } catch (error) {
        console.error('Error al crear cuenta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
