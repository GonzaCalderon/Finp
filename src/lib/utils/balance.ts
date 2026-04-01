import type { Currency } from '@/lib/constants'
import type { Types } from 'mongoose'
import { InstallmentPlan, Transaction } from '@/lib/models'
import { buildCurrencyBalances, normalizeInitialBalances } from '@/lib/utils/accounts'
import { getRemainingDebtForMonth } from '@/lib/utils/credit-card'
import { getCurrentFinancialPeriod } from '@/lib/utils/period'
import { getOperationalStartFinancialPeriod } from '@/lib/utils/operational-start'

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
        includeCreditCardInstallmentDebt?: boolean
        monthStartDay?: number
        operationalStartDate?: string | Date
    }
): Promise<Record<Currency, number>> {
    const result = await Transaction.aggregate<BalanceFacet>([
        {
            $match: {
                userId,
                ...(options?.sinceDate ? { date: { $gte: options.sinceDate } } : {}),
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

    if (options?.includeCreditCardInstallmentDebt) {
        const monthStartDay = options.monthStartDay ?? 1
        const currentPeriod = getCurrentFinancialPeriod(new Date(), monthStartDay)
        const operationalStartPeriod = getOperationalStartFinancialPeriod(
            options.operationalStartDate,
            monthStartDay
        )
        const referencePeriod =
            operationalStartPeriod && operationalStartPeriod > currentPeriod
                ? operationalStartPeriod
                : currentPeriod

        const plans = await InstallmentPlan.find({
            userId,
            accountId,
        })

        for (const plan of plans) {
            const currency: Currency = plan.currency === 'USD' ? 'USD' : 'ARS'
            balances[currency] -= getRemainingDebtForMonth(plan, referencePeriod)
        }
    }

    return balances
}
