import type { Currency } from '@/lib/constants'
import type { Types } from 'mongoose'
import { Transaction } from '@/lib/models'
import { buildCurrencyBalances, normalizeInitialBalances } from '@/lib/utils/accounts'

type BalanceBucket = {
    _id: Currency
    total: number
}

type BalanceFacet = {
    regularIncoming: BalanceBucket[]
    exchangeIncoming: BalanceBucket[]
    outgoing: BalanceBucket[]
}

/**
 * Calcula el saldo actual de una cuenta sumando todas sus transacciones.
 *
 * Lógica tipo-agnóstica: cualquier transacción que mueva dinero hacia o desde
 * la cuenta afecta el saldo sin importar el tipo (income, expense, transfer, etc.).
 *   - incoming (+): transacciones donde esta cuenta es destinationAccountId
 *   - outgoing (-): transacciones donde esta cuenta es sourceAccountId
 *
 * Esta función es la fuente de verdad para el cálculo de saldo en toda la app.
 * Todos los endpoints que muestren el saldo de una cuenta deben usar esta función.
 */
export async function calculateAccountBalance(
    accountId: Types.ObjectId,
    userId: Types.ObjectId,
    initialBalance = 0,
    initialCurrency: Currency = 'ARS',
    targetCurrency: Currency = initialCurrency
): Promise<number> {
    const balances = await calculateAccountBalancesByCurrency(accountId, userId, {
        initialBalance,
        initialCurrency,
    })

    return balances[targetCurrency]
}

export async function calculateAccountBalancesByCurrency(
    accountId: Types.ObjectId,
    userId: Types.ObjectId,
    options?: {
        initialBalance?: number
        initialCurrency?: Currency
        initialBalances?: Partial<Record<Currency, number>>
        sinceDate?: Date
        untilDate?: Date
    }
): Promise<Record<Currency, number>> {
    const dateRange = {
        ...(options?.sinceDate ? { $gte: options.sinceDate } : {}),
        ...(options?.untilDate ? { $lt: options.untilDate } : {}),
    }

    const result = await Transaction.aggregate<BalanceFacet>([
        {
            $match: {
                userId,
                ...(Object.keys(dateRange).length > 0 ? { date: dateRange } : {}),
                $or: [
                    { sourceAccountId: accountId },
                    { destinationAccountId: accountId },
                ],
            },
        },
        {
            $facet: {
                regularIncoming: [
                    {
                        $match: {
                            destinationAccountId: accountId,
                            $or: [
                                { type: { $ne: 'exchange' } },
                                { destinationCurrency: { $exists: false } },
                            ],
                        },
                    },
                    {
                        $group: {
                            _id: '$currency',
                            total: { $sum: '$amount' },
                        },
                    },
                ],
                exchangeIncoming: [
                    {
                        $match: {
                            type: 'exchange',
                            destinationAccountId: accountId,
                            destinationCurrency: { $exists: true },
                            destinationAmount: { $exists: true },
                        },
                    },
                    {
                        $group: {
                            _id: '$destinationCurrency',
                            total: { $sum: '$destinationAmount' },
                        },
                    },
                ],
                outgoing: [
                    {
                        $match: {
                            sourceAccountId: accountId,
                        },
                    },
                    {
                        $group: {
                            _id: '$currency',
                            total: { $sum: '$amount' },
                        },
                    },
                ],
            },
        },
    ])

    const balances = buildCurrencyBalances(
        normalizeInitialBalances(
            options?.initialBalances,
            options?.initialBalance,
            options?.initialCurrency
        )
    )

    const buckets = result[0]

    for (const bucket of buckets?.regularIncoming ?? []) {
        balances[bucket._id] += bucket.total ?? 0
    }

    for (const bucket of buckets?.exchangeIncoming ?? []) {
        balances[bucket._id] += bucket.total ?? 0
    }

    for (const bucket of buckets?.outgoing ?? []) {
        balances[bucket._id] -= bucket.total ?? 0
    }

    return balances
}

export function sumAvailableAccountBalances(
    accounts: Array<{
        type: string
        balancesByCurrency: Partial<Record<Currency, number>>
    }>
): { ars: number; usd: number } {
    return accounts
        .filter((account) => !['credit_card', 'debt'].includes(account.type))
        .reduce(
            (totals, account) => ({
                ars: totals.ars + (account.balancesByCurrency.ARS ?? 0),
                usd: totals.usd + (account.balancesByCurrency.USD ?? 0),
            }),
            { ars: 0, usd: 0 }
        )
}
