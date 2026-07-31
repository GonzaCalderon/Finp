import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { Account, InstallmentPlan, Transaction, User } from '@/lib/models'
import {
    buildMonthlyCardPaymentSummary,
    deriveCardPaymentState,
    type CardCurrencyPaymentBreakdown,
    type MonthlyCardPaymentSummary,
} from '@/lib/utils/credit-card'
import { getCurrentFinancialPeriod, parseFinancialPeriod } from '@/lib/utils/period'
import { clampRangeStartToOperationalStart } from '@/lib/utils/operational-start'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const cardId = searchParams.get('cardId')

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

        const [transactions, plans, cards] = await Promise.all([
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
            InstallmentPlan.find({
                userId: session.user.id,
                ...(cardId ? { accountId: cardId } : {}),
            })
                .populate('accountId', 'name type currency color creditCardConfig.dueDay')
                .populate('categoryId', 'name color type'),
            Account.find({
                userId: session.user.id,
                type: 'credit_card',
                ...(cardId ? { _id: cardId } : {}),
            }, 'name currency supportedCurrencies color creditCardConfig.dueDay'),
        ])

        const rawSummaries = buildMonthlyCardPaymentSummary({
            month,
            monthStartDay,
            plans,
            transactions,
            operationalStartDate,
        })

        const emptyBreakdown = (): CardCurrencyPaymentBreakdown => ({
            due: 0,
            paid: 0,
            pending: 0,
            credit: 0,
            state: deriveCardPaymentState(0, 0),
        })
        const summaries = cards.map((card): MonthlyCardPaymentSummary => {
            const existing = rawSummaries.find((item) => item.cardId === card._id.toString())
            if (existing) return existing
            return {
                cardId: card._id.toString(),
                cardName: card.name,
                cardColor: card.color,
                cardDueDay: card.creditCardConfig?.dueDay,
                period: month,
                byCurrency: {
                    ars: emptyBreakdown(),
                    usd: emptyBreakdown(),
                },
                due: { ars: 0, usd: 0 },
                paid: { ars: 0, usd: 0 },
                pending: { ars: 0, usd: 0 },
                credit: { ars: 0, usd: 0 },
                state: 'no_charges',
                items: [],
                payments: [],
            }
        })

        if (!cardId) {
            return NextResponse.json({ month, summaries })
        }

        const card = cards[0]
        if (!card) {
            return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })
        }

        const rawSummary = summaries[0]
        const target = currency === 'USD' ? rawSummary.byCurrency.usd : rawSummary.byCurrency.ars
        const byCurrency = {
            ARS: {
                ...rawSummary.byCurrency.ars,
                currency: 'ARS',
                items: rawSummary.items.filter((item) => item.currency === 'ARS'),
            },
            USD: {
                ...rawSummary.byCurrency.usd,
                currency: 'USD',
                items: rawSummary.items.filter((item) => item.currency === 'USD'),
            },
        }
        return NextResponse.json({
            month,
            summary: {
                cardId,
                cardName: rawSummary.cardName ?? card.name,
                cardColor: rawSummary.cardColor ?? card.color,
                ...target,
                currency,
                state: target.state,
                items: rawSummary.items.filter((item) => item.currency === currency),
                byCurrency,
            },
        })
    } catch (error) {
        console.error('Error al obtener resumen de pago de tarjeta:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}
