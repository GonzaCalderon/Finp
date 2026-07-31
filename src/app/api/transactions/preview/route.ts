import { NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { isServiceError } from '@/lib/server/errors'
import { prepareTransactionForUser } from '@/lib/server/transactions'
import type { TransactionPreviewResponse } from '@/types'

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        await connectDB()
        const prepared = await prepareTransactionForUser(session.user.id, body, {
            includePreviewSignals: true,
        })

        if (
            prepared.data.type !== 'expense' &&
            prepared.data.type !== 'income' &&
            prepared.data.type !== 'credit_card_expense'
        ) {
            return NextResponse.json(
                {
                    valid: false,
                    issues: [{
                        code: 'QUICK_CAPTURE_SIMPLE_TYPES_ONLY',
                        message: 'Este movimiento requiere el formulario completo.',
                        field: 'type',
                        severity: 'error',
                    }],
                } satisfies TransactionPreviewResponse
            )
        }

        const response: TransactionPreviewResponse = {
            valid: true,
            normalized: {
                type: prepared.data.type,
                amount: prepared.data.amount,
                currency: prepared.data.currency,
                date: prepared.data.date.toISOString(),
                description: prepared.description,
                sourceAccountId: prepared.data.sourceAccountId,
                destinationAccountId: prepared.data.destinationAccountId,
                categoryId: prepared.data.categoryId,
                merchant: prepared.data.merchant,
            },
            appliedRule:
                prepared.appliedRuleId && prepared.appliedRuleNameSnapshot
                    ? {
                        id: prepared.appliedRuleId,
                        name: prepared.appliedRuleNameSnapshot,
                    }
                    : undefined,
            category: prepared.category,
            accountImpact: prepared.accountImpact,
            duplicate: prepared.duplicate,
            issues: prepared.issues,
        }

        return NextResponse.json(response, {
            headers: { 'Cache-Control': 'private, no-store' },
        })
    } catch (error) {
        if (isServiceError(error)) {
            const details =
                error.details &&
                typeof error.details === 'object' &&
                'accountImpact' in error.details
                    ? error.details as {
                        accountImpact?: TransactionPreviewResponse['accountImpact']
                    }
                    : undefined
            const response: TransactionPreviewResponse = {
                valid: false,
                accountImpact: details?.accountImpact,
                issues: [{
                    code: error.code,
                    message: error.message,
                    severity: 'error',
                }],
            }
            return NextResponse.json(response)
        }

        console.error('Error al previsualizar transaccion:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
