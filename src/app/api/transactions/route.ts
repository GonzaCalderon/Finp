import { NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, User, TransactionRule } from '@/lib/models'
import { transactionSchema } from '@/lib/validations'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { parseFinancialPeriod } from '@/lib/utils/period'
import { evaluateRules } from '@/lib/utils/rules'
import { CREDIT_CARD_PAYMENT_TYPES, normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { getCommonSupportedCurrencies, getInitialBalancesByCurrency, supportsCurrency } from '@/lib/utils/accounts'
import { normalizeManualExchange } from '@/lib/utils/exchange'
import type { Currency } from '@/lib/constants'

const PAGE_LIMIT = 30

type CurrencySummary = {
    ars: number
    usd: number
}

function emptyCurrencySummary(): CurrencySummary {
    return { ars: 0, usd: 0 }
}

function toCurrencySummary(
    rows: Array<{ _id: Currency; total: number }>
): CurrencySummary {
    return rows.reduce<CurrencySummary>((acc, row) => {
        if (row._id === 'USD') acc.usd = row.total
        else acc.ars = row.total
        return acc
    }, emptyCurrencySummary())
}

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const month = searchParams.get('month')
        const type = searchParams.get('type')
        const categoryId = searchParams.get('categoryId')
        const accountId = searchParams.get('accountId')
        const currency = searchParams.get('currency')
        const noInstallmentPlan = searchParams.get('noInstallmentPlan') === 'true'
        const sort = searchParams.get('sort') ?? 'date_desc'
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
        const limit = parseInt(searchParams.get('limit') ?? String(PAGE_LIMIT), 10)

        await connectDB()

        // ── Base filter (shared by list and summary) ──────────────────────────
        const baseFilter: Record<string, unknown> = { userId: session.user.id }

        if (month) {
            const [year, m] = month.split('-').map(Number)
            if (!Number.isNaN(year) && !Number.isNaN(m)) {
                const userDoc = await User.findById(session.user.id, { 'preferences.monthStartDay': 1 })
                const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
                const { start, end } = parseFinancialPeriod(month, monthStartDay)
                baseFilter.date = { $gte: start, $lt: end }
            }
        }

        // ── Summary: computed from full month, no user-applied filters ────────
        const summaryFilter = {
            ...baseFilter,
            userId: new Types.ObjectId(session.user.id),
        }
        const [incomeAgg, expenseAgg, ccExpenseAgg] = await Promise.all([
            Transaction.aggregate([
                { $match: { ...summaryFilter, type: 'income' } },
                { $group: { _id: '$currency', total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
                { $match: { ...summaryFilter, type: 'expense' } },
                { $group: { _id: '$currency', total: { $sum: '$amount' } } },
            ]),
            Transaction.aggregate([
                { $match: { ...summaryFilter, type: 'credit_card_expense' } },
                { $group: { _id: '$currency', total: { $sum: '$amount' } } },
            ]),
        ])

        const summary = {
            income: toCurrencySummary(incomeAgg),
            expense: toCurrencySummary(expenseAgg),
            creditCardExpense: toCurrencySummary(ccExpenseAgg),
        }

        // ── List filter: base + user-applied filters ───────────────────────────
        const filter: Record<string, unknown> = { ...baseFilter }

        if (type) {
            const normalizedType = normalizeLegacyTransactionType(type)
            filter.type = normalizedType === 'credit_card_payment'
                ? { $in: [...CREDIT_CARD_PAYMENT_TYPES] }
                : normalizedType
        }
        if (categoryId) filter.categoryId = categoryId
        if (currency && ['ARS', 'USD'].includes(currency)) filter.currency = currency
        if (accountId) {
            filter.$or = [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
        }
        if (noInstallmentPlan) {
            filter.installmentPlanId = { $exists: false }
        }

        const sortMap: Record<string, Record<string, 1 | -1>> = {
            date_desc: { date: -1 },
            date_asc: { date: 1 },
            amount_desc: { amount: -1 },
            amount_asc: { amount: 1 },
            description_asc: { description: 1 },
        }
        const sortQuery = sortMap[sort] ?? { date: -1 }

        const total = await Transaction.countDocuments(filter)
        const skip = (page - 1) * limit

        const transactions = await Transaction.find(filter)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency supportedCurrencies color')
            .populate('destinationAccountId', 'name type currency supportedCurrencies color')
            .populate('installmentPlanId', 'installmentCount')

        return NextResponse.json({
            transactions,
            total,
            page,
            limit,
            hasMore: skip + transactions.length < total,
            summary,
        })
    } catch (error) {
        console.error('Error al obtener transacciones:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const body = await request.json()
        const parsed = transactionSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Datos de transacción inválidos', details: parsed.error.flatten() },
                { status: 400 }
            )
        }

        await connectDB()

        const data = {
            ...parsed.data,
            type: normalizeLegacyTransactionType(parsed.data.type) ?? parsed.data.type,
        }

        const accountIds = [data.sourceAccountId, data.destinationAccountId].filter(Boolean)
        const relatedAccounts = accountIds.length > 0
            ? await Account.find({
                _id: { $in: accountIds },
                userId: session.user.id,
            })
            : []
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

        // Validar saldo si la cuenta no permite saldo negativo
        if (sourceAccount) {
            if (sourceAccount.allowNegativeBalance === false) {
                const balances = await calculateAccountBalancesByCurrency(
                    sourceAccount._id,
                    sourceAccount.userId,
                    {
                        initialBalances: getInitialBalancesByCurrency(sourceAccount),
                    }
                )
                const balance = balances[data.currency]

                if (balance - data.amount < 0) {
                    return NextResponse.json(
                        {
                            error: `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: data.currency,
                                maximumFractionDigits: 0,
                            }).format(balance)}`,
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

        // Evaluate categorization rules (for expense, income, and credit_card_expense)
        let resolvedCategoryId = data.categoryId
        let resolvedMerchant = data.merchant
        let appliedRuleId: string | undefined
        let appliedRuleNameSnapshot: string | undefined

        if (data.type === 'expense' || data.type === 'income' || data.type === 'credit_card_expense') {
            const ruleType = data.type === 'credit_card_expense' ? 'expense' : data.type
            const rules = await TransactionRule.find({
                userId: session.user.id,
                isActive: true,
            }).sort({ priority: -1 })

            const { matched, rule } = evaluateRules(rules, {
                type: ruleType,
                description: data.description,
                merchant: data.merchant,
            })

            if (matched && rule) {
                appliedRuleId = rule._id.toString()
                appliedRuleNameSnapshot = rule.name
                if (!resolvedCategoryId && rule.categoryId) {
                    resolvedCategoryId = rule.categoryId.toString()
                }
                if (!resolvedMerchant && rule.normalizeMerchant) {
                    resolvedMerchant = rule.normalizeMerchant
                }
            }
        }

        const transaction = await Transaction.create({
            userId: session.user.id,
            type: data.type,
            amount: data.amount,
            currency: data.currency,
            date: data.date,
            description: data.description,
            categoryId: resolvedCategoryId,
            sourceAccountId: data.sourceAccountId,
            destinationAccountId: data.destinationAccountId,
            destinationAmount: data.type === 'exchange' ? data.destinationAmount : undefined,
            destinationCurrency: data.type === 'exchange' ? data.destinationCurrency : undefined,
            exchangeRate: data.type === 'exchange' ? data.exchangeRate : undefined,
            paymentGroupId: data.paymentGroupId,
            notes: data.notes,
            merchant: resolvedMerchant,
            status: 'confirmed',
            createdFrom: 'web',
            appliedRuleId,
            appliedRuleNameSnapshot,
        })

        const populated = await Transaction.findById(transaction._id)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency supportedCurrencies color')
            .populate('destinationAccountId', 'name type currency supportedCurrencies color')

        return NextResponse.json({ transaction: populated }, { status: 201 })
    } catch (error) {
        console.error('Error al crear transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
