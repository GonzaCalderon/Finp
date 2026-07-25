import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { TransactionRule } from '@/lib/models'
import { transactionRuleSimulationSchema } from '@/lib/validations/transaction-rule'
import {
    detectRuleConflicts,
    findMatchingRules,
    normalizeRuleText,
    previewRuleActions,
} from '@/lib/utils/rules'
import type { ITransactionRule } from '@/types'

function getRuleId(rule: ITransactionRule) {
    return rule._id.toString()
}

function summarizeRule(
    rule: ITransactionRule,
    sample: {
        type: string
        description?: string
        merchant?: string
        categoryId?: string
    },
    candidateId: string
) {
    return {
        id: getRuleId(rule),
        name: rule.name,
        priority: rule.priority,
        isCandidate: getRuleId(rule) === candidateId,
        actions: previewRuleActions(rule, sample),
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const parsed = transactionRuleSimulationSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Datos de simulación inválidos',
                    details: parsed.error.flatten(),
                },
                { status: 400 }
            )
        }

        await connectDB()

        const { rule: inputRule, sample, editingRuleId } = parsed.data
        const storedRules = await TransactionRule.find({
            userId: session.user.id,
        })
            .sort({ priority: -1, createdAt: -1 })
            .lean<ITransactionRule[]>()
        const originalRule = editingRuleId
            ? storedRules.find((rule) => getRuleId(rule) === editingRuleId)
            : undefined
        const existingRules = storedRules.filter(
            (rule) => getRuleId(rule) !== editingRuleId
        )

        const candidateId = editingRuleId || '__candidate__'
        const candidate = {
            ...inputRule,
            _id: { toString: () => candidateId },
            userId: { toString: () => session.user.id },
            isActive: true,
            createdAt: originalRule?.createdAt ?? new Date(),
            updatedAt: new Date(),
        } as unknown as ITransactionRule

        const orderedRules = [candidate, ...existingRules].sort(
            (left, right) =>
                right.priority - left.priority ||
                new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        )
        const matchingRules = findMatchingRules(
            orderedRules,
            sample
        )
        const winner = matchingRules[0]?.rule

        return NextResponse.json({
            normalizedSample: {
                description: normalizeRuleText(sample.description),
                merchant: normalizeRuleText(sample.merchant),
            },
            candidateMatches: matchingRules.some(
                ({ rule }) => getRuleId(rule) === candidateId
            ),
            matchedRules: matchingRules.map(({ rule, match }) => ({
                ...summarizeRule(rule, sample, candidateId),
                match,
            })),
            winner: winner
                ? summarizeRule(winner, sample, candidateId)
                : null,
            conflicts: detectRuleConflicts(candidate, existingRules),
        })
    } catch (error) {
        console.error('Error al simular regla:', error)
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        )
    }
}
