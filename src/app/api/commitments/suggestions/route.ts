import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
    FunctionalSuggestionDismissal,
    ScheduledCommitment,
    Transaction,
    Category,
} from '@/lib/models'
import { buildCommitmentSuggestions } from '@/lib/utils/commitment-suggestions'
import type { Currency } from '@/lib/constants'

export async function GET() {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        await connectDB()

        const since = new Date()
        since.setMonth(since.getMonth() - 18)

        const [transactions, commitments, dismissals, categories] = await Promise.all([
            Transaction.find({
                userId: session.user.id,
                type: { $in: ['expense', 'credit_card_expense'] },
                date: { $gte: since },
                commitmentId: { $exists: false },
                installmentPlanId: { $exists: false },
                spaceId: { $exists: false },
                paymentGroupId: { $exists: false },
            })
                .select(
                    '_id description merchant amount currency date categoryId sourceAccountId'
                )
                .sort({ date: -1, createdAt: -1 })
                .limit(800)
                .lean(),
            ScheduledCommitment.find({ userId: session.user.id })
                .select('description normalizedDescription aliases currency')
                .lean(),
            FunctionalSuggestionDismissal.find({
                userId: session.user.id,
                intent: 'create_commitment',
            })
                .select('subjectKey')
                .lean<Array<{ subjectKey: string }>>(),
            Category.find({ userId: session.user.id, type: 'expense' })
                .select('_id name')
                .lean<Array<{ _id: { toString(): string }; name: string }>>(),
        ])
        const categoryNameById = new Map(
            categories.map((category) => [category._id.toString(), category.name])
        )

        const suggestions = buildCommitmentSuggestions({
            history: transactions.map((transaction) => ({
                transactionId: transaction._id.toString(),
                description: transaction.description,
                merchant: transaction.merchant,
                amount: transaction.amount,
                currency: transaction.currency as Currency,
                occurredAt: transaction.date,
                categoryId: transaction.categoryId?.toString(),
                categoryName: transaction.categoryId
                    ? categoryNameById.get(transaction.categoryId.toString())
                    : undefined,
                accountId: transaction.sourceAccountId?.toString(),
            })),
            existingCommitments: commitments.map((commitment) => ({
                description: commitment.description,
                normalizedDescription: commitment.normalizedDescription,
                aliases: commitment.aliases,
                currency: commitment.currency as Currency,
            })),
            dismissedSubjectKeys: dismissals.map((dismissal) => dismissal.subjectKey),
        })

        return NextResponse.json(
            { suggestions },
            { headers: { 'Cache-Control': 'private, no-store' } }
        )
    } catch (error) {
        console.error('Error al generar sugerencias de compromisos:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
