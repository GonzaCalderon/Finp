import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    RuleSuggestionDismissal,
    Transaction,
    TransactionRule,
} from '@/lib/models'
import { buildTransactionRuleSuggestions } from '@/lib/utils/rule-suggestions'
import type { ITransactionRule } from '@/types'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const [transactions, existingRules, dismissed] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                type: { $in: ['expense', 'income', 'credit_card_expense'] },
                categoryId: { $exists: true, $ne: null },
            })
                .select('_id type categoryId description merchant date')
                .sort({ date: -1, createdAt: -1 })
                .limit(500)
                .lean(),
            TransactionRule.find({ userId: session.user.id }).lean<ITransactionRule[]>(),
            RuleSuggestionDismissal.find({ userId: session.user.id })
                .select('key')
                .lean(),
        ])

        const suggestions = buildTransactionRuleSuggestions({
            history: transactions.map((transaction) => ({
                transactionId: transaction._id.toString(),
                type: transaction.type,
                categoryId: transaction.categoryId!.toString(),
                description: transaction.description,
                merchant: transaction.merchant,
                occurredAt: transaction.date,
            })),
            existingRules,
            dismissedKeys: dismissed.map((item) => item.key),
        })

        return NextResponse.json(
            { suggestions },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (error) {
        console.error('Error al generar sugerencias de reglas:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
