import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Transaction, Account, User, TransactionRule } from '@/lib/models'
import { transactionSchema } from '@/lib/validations'
import { calculateAccountBalance } from '@/lib/utils/balance'
import { parseFinancialPeriod } from '@/lib/utils/period'
import { evaluateRules } from '@/lib/utils/rules'

const PAGE_LIMIT = 30

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const month = searchParams.get('month')
        const type = searchParams.get('type')
        const categoryId = searchParams.get('categoryId')
        const accountId = searchParams.get('accountId')
        const sort = searchParams.get('sort') ?? 'date_desc'
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
        const limit = parseInt(searchParams.get('limit') ?? String(PAGE_LIMIT), 10)

        await connectDB()

        const filter: Record<string, unknown> = { userId: session.user.id }

        if (month) {
            const [year, m] = month.split('-').map(Number)
            if (!Number.isNaN(year) && !Number.isNaN(m)) {
                const userDoc = await User.findById(session.user.id, { 'preferences.monthStartDay': 1 })
                const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
                const { start, end } = parseFinancialPeriod(month, monthStartDay)
                filter.date = { $gte: start, $lt: end }
            }
        }

        if (type) filter.type = type
        if (categoryId) filter.categoryId = categoryId
        if (accountId) {
            filter.$or = [{ sourceAccountId: accountId }, { destinationAccountId: accountId }]
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
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')

        return NextResponse.json({
            transactions,
            total,
            page,
            limit,
            hasMore: skip + transactions.length < total,
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

        const data = parsed.data

        // Validar saldo si la cuenta no permite saldo negativo
        if (data.sourceAccountId) {
            const sourceAccount = await Account.findOne({
                _id: data.sourceAccountId,
                userId: session.user.id,
            })

            if (sourceAccount?.allowNegativeBalance === false) {
                const balance = await calculateAccountBalance(
                    sourceAccount._id,
                    sourceAccount.userId,
                    sourceAccount.initialBalance ?? 0
                )

                if (balance - data.amount < 0) {
                    return NextResponse.json(
                        {
                            error: `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: sourceAccount.currency,
                                maximumFractionDigits: 0,
                            }).format(balance)}`,
                        },
                        { status: 400 }
                    )
                }
            }
        }

        // Evaluate categorization rules (only for expense/income)
        let resolvedCategoryId = data.categoryId
        let resolvedMerchant = data.merchant
        let appliedRuleId: string | undefined
        let appliedRuleNameSnapshot: string | undefined

        if (data.type === 'expense' || data.type === 'income') {
            const rules = await TransactionRule.find({
                userId: session.user.id,
                isActive: true,
            }).sort({ priority: -1 })

            const { matched, rule } = evaluateRules(rules, {
                type: data.type,
                description: data.description,
                merchant: data.merchant,
            })

            if (matched && rule) {
                appliedRuleId = rule._id.toString()
                appliedRuleNameSnapshot = rule.name
                // Apply rule actions only when user hasn't provided those values
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
            notes: data.notes,
            merchant: resolvedMerchant,
            status: 'confirmed',
            createdFrom: 'web',
            appliedRuleId,
            appliedRuleNameSnapshot,
        })

        const populated = await Transaction.findById(transaction._id)
            .populate('categoryId', 'name color type')
            .populate('sourceAccountId', 'name type currency color')
            .populate('destinationAccountId', 'name type currency color')

        return NextResponse.json({ transaction: populated }, { status: 201 })
    } catch (error) {
        console.error('Error al crear transacción:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}