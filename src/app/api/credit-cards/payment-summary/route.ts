import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, InstallmentPlan, Transaction, User } from '@/lib/models'
import { buildMonthlyCardPaymentSummary } from '@/lib/utils/credit-card'
import { getCurrentFinancialPeriod, parseFinancialPeriod } from '@/lib/utils/period'
import { clampRangeStartToOperationalStart } from '@/lib/utils/operational-start'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const cardId = searchParams.get('cardId')
        if (!cardId) {
            return NextResponse.json({ error: 'La tarjeta es requerida' }, { status: 400 })
        }

        await connectDB()

        const userDoc = await User.findById(session.user.id, {
            'preferences.monthStartDay': 1,
            'preferences.operationalStartDate': 1,
        })
        const monthStartDay: number = userDoc?.preferences?.monthStartDay ?? 1
        const operationalStartDate = userDoc?.preferences?.operationalStartDate
        const month = searchParams.get('month') ?? getCurrentFinancialPeriod(new Date(), monthStartDay)
        const currency = searchParams.get('currency') === 'USD' ? 'USD' : 'ARS'
        const { start, end } = parseFinancialPeriod(month, monthStartDay)

        const [transactions, plans, card] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                date: {
                    $gte: clampRangeStartToOperationalStart(start, operationalStartDate),
                    $lt: end,
                },
            })
                .populate('categoryId', 'name color type')
                .populate('sourceAccountId', 'name type currency color')
                .populate('destinationAccountId', 'name type currency color'),
            InstallmentPlan.find({ userId: session.user.id, accountId: cardId })
                .populate('accountId', 'name type currency color')
                .populate('categoryId', 'name color type'),
            Account.findOne({ _id: cardId, userId: session.user.id }, 'name currency supportedCurrencies color'),
        ])

        const rawSummary = buildMonthlyCardPaymentSummary({
            month,
            monthStartDay,
            plans,
            transactions,
            operationalStartDate,
        }).find((item) => item.cardId === cardId)

        const buildSummaryForCurrency = (targetCurrency: 'ARS' | 'USD') => {
            const due = rawSummary?.items
                .filter((item) => item.currency === targetCurrency)
                .reduce((sum, item) => sum + item.amount, 0) ?? 0
            const paid = transactions
                .filter((transaction) =>
                    transaction.destinationAccountId?.toString() === cardId &&
                    transaction.currency === targetCurrency &&
                    ['credit_card_payment', 'debt_payment'].includes(transaction.type)
                )
                .reduce((sum, transaction) => sum + transaction.amount, 0)

            return {
                due,
                paid,
                pending: Math.max(0, due - paid),
                currency: targetCurrency,
                items: rawSummary?.items.filter((item) => item.currency === targetCurrency) ?? [],
            }
        }

        const byCurrency = {
            ARS: buildSummaryForCurrency('ARS'),
            USD: buildSummaryForCurrency('USD'),
        }

        return NextResponse.json({
            month,
            summary: {
                cardId,
                cardName: rawSummary?.cardName ?? card?.name,
                cardColor: rawSummary?.cardColor ?? card?.color,
                ...byCurrency[currency],
                byCurrency,
            },
        })
    } catch (error) {
        console.error('Error al obtener resumen de pago de tarjeta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
