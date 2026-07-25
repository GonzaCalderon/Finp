import { Account, Category, QuickCaptureAlias, Transaction } from '@/lib/models'
import { Types } from 'mongoose'
import { normalizeQuickCaptureTerm } from '@/lib/utils/quick-capture'
import { isSimpleTransactionAccountType } from '@/lib/utils/accounts'
import { ServiceError } from '@/lib/server/errors'
import type {
    QuickCaptureAliasDto,
    QuickCaptureAliasTargetType,
    QuickCaptureFrequent,
} from '@/types'
import type { Currency } from '@/lib/constants'

type AliasDocumentLike = {
    _id: { toString(): string }
    term: string
    normalizedTerm: string
    targetType: QuickCaptureAliasTargetType
    targetId?: { toString(): string }
    targetValue?: string
    usageCount?: number
    lastUsedAt?: Date
    createdAt: Date
    updatedAt: Date
}

export type QuickCaptureHistoryRow = {
    _id: { toString(): string }
    type: 'expense' | 'income'
    amount: number
    currency: Currency
    description: string
    merchant?: string
    sourceAccountId?: { toString(): string }
    destinationAccountId?: { toString(): string }
    categoryId?: { toString(): string }
    date: Date
    createdAt?: Date
    updatedAt?: Date
    createdFrom?: string
    importBatchId?: unknown
}

export async function serializeQuickCaptureAliases(
    userId: string,
    aliases: AliasDocumentLike[]
): Promise<QuickCaptureAliasDto[]> {
    const accountIds = aliases
        .filter((alias) => alias.targetType === 'account' && alias.targetId)
        .map((alias) => alias.targetId!.toString())
    const categoryIds = aliases
        .filter((alias) => alias.targetType === 'category' && alias.targetId)
        .map((alias) => alias.targetId!.toString())

    const [accounts, categories] = await Promise.all([
        accountIds.length
            ? Account.find({ _id: { $in: accountIds }, userId })
                .select('_id name color isActive type')
                .lean<Array<{
                    _id: { toString(): string }
                    name: string
                    color?: string
                    isActive?: boolean
                    type: string
                }>>()
            : [],
        categoryIds.length
            ? Category.find({ _id: { $in: categoryIds }, userId })
                .select('_id name color isArchived')
                .lean<Array<{ _id: { toString(): string }; name: string; color?: string; isArchived?: boolean }>>()
            : [],
    ])
    const accountMap = new Map(accounts.map((account) => [account._id.toString(), account]))
    const categoryMap = new Map(categories.map((category) => [category._id.toString(), category]))

    return aliases.map((alias) => {
        const targetId = alias.targetId?.toString()
        const account = alias.targetType === 'account' && targetId
            ? accountMap.get(targetId)
            : undefined
        const category = alias.targetType === 'category' && targetId
            ? categoryMap.get(targetId)
            : undefined
        const targetLabel =
            account?.name ||
            category?.name ||
            alias.targetValue ||
            'Destino no disponible'
        const isStale =
            (
                alias.targetType === 'account' &&
                (
                    !account ||
                    account.isActive === false ||
                    !isSimpleTransactionAccountType(account.type)
                )
            ) ||
            (alias.targetType === 'category' && (!category || category.isArchived === true))

        return {
            _id: alias._id.toString(),
            term: alias.term,
            normalizedTerm: alias.normalizedTerm,
            targetType: alias.targetType,
            targetId,
            targetValue: alias.targetValue,
            targetLabel,
            targetColor: account?.color || category?.color,
            isStale,
            usageCount: alias.usageCount ?? 0,
            lastUsedAt: alias.lastUsedAt?.toISOString(),
            createdAt: alias.createdAt.toISOString(),
            updatedAt: alias.updatedAt.toISOString(),
        }
    })
}

export async function validateQuickCaptureAliasTarget(params: {
    userId: string
    targetType: QuickCaptureAliasTargetType
    targetId?: string
    targetValue?: string
}) {
    const { userId, targetType, targetId, targetValue } = params
    if (targetType === 'account') {
        if (!targetId || !Types.ObjectId.isValid(targetId)) {
            throw new ServiceError(400, 'ALIAS_TARGET_REQUIRED', 'Selecciona una cuenta.')
        }
        const account = await Account.findOne({ _id: targetId, userId, isActive: true })
        if (!account) {
            throw new ServiceError(404, 'ALIAS_ACCOUNT_NOT_FOUND', 'La cuenta no existe o esta inactiva.')
        }
        if (!isSimpleTransactionAccountType(account.type)) {
            throw new ServiceError(
                400,
                'ALIAS_ACCOUNT_REQUIRES_FULL_FLOW',
                'Esta cuenta requiere el formulario completo.'
            )
        }
        return
    }
    if (targetType === 'category') {
        if (!targetId || !Types.ObjectId.isValid(targetId)) {
            throw new ServiceError(400, 'ALIAS_TARGET_REQUIRED', 'Selecciona una categoria.')
        }
        const category = await Category.findOne({ _id: targetId, userId, isArchived: { $ne: true } })
        if (!category) {
            throw new ServiceError(404, 'ALIAS_CATEGORY_NOT_FOUND', 'La categoria no existe o esta archivada.')
        }
        return
    }
    if (!targetValue?.trim()) {
        throw new ServiceError(400, 'ALIAS_VALUE_REQUIRED', 'Define el texto que debe interpretar Finp.')
    }
}

export async function upsertQuickCaptureAlias(params: {
    userId: string
    term: string
    targetType: QuickCaptureAliasTargetType
    targetId?: string
    targetValue?: string
}) {
    const normalizedTerm = normalizeQuickCaptureTerm(params.term)
    if (normalizedTerm.length < 2) {
        throw new ServiceError(400, 'ALIAS_TERM_TOO_SHORT', 'El atajo debe tener al menos dos caracteres.')
    }
    await validateQuickCaptureAliasTarget(params)

    return QuickCaptureAlias.findOneAndUpdate(
        {
            userId: params.userId,
            normalizedTerm,
            targetType: params.targetType,
        },
        {
            $set: {
                term: params.term.trim(),
                targetId:
                    params.targetType === 'account' || params.targetType === 'category'
                        ? params.targetId
                        : undefined,
                targetValue:
                    params.targetType === 'merchant' || params.targetType === 'description'
                        ? params.targetValue?.trim()
                        : undefined,
                lastUsedAt: new Date(),
            },
            $setOnInsert: {
                userId: params.userId,
                normalizedTerm,
                targetType: params.targetType,
                usageCount: 0,
            },
        },
        { upsert: true, new: true }
    )
}

export async function getQuickCaptureHistoryRows(
    userId: string
): Promise<QuickCaptureHistoryRow[]> {
    return Transaction.find({
        userId,
        type: { $in: ['expense', 'income'] },
        status: { $in: ['confirmed', null] },
        installmentPlanId: { $exists: false },
        spaceId: { $exists: false },
    })
        .select(
            'type amount currency description merchant sourceAccountId destinationAccountId categoryId date createdAt updatedAt createdFrom importBatchId'
        )
        .sort({ updatedAt: -1, date: -1 })
        .limit(500)
        .lean<QuickCaptureHistoryRow[]>()
}

export function buildQuickCaptureFrequents(
    historyRows: QuickCaptureHistoryRow[]
): QuickCaptureFrequent[] {
    const transactions = [...historyRows]
        .sort((left, right) => {
            const dateDifference =
                right.date.getTime() - left.date.getTime()
            if (dateDifference !== 0) return dateDifference
            return (
                (right.createdAt?.getTime() ?? 0) -
                (left.createdAt?.getTime() ?? 0)
            )
        })
        .slice(0, 250)

    const groups = new Map<string, QuickCaptureFrequent & { recencyIndex: number }>()
    transactions.forEach((transaction, index) => {
        const accountId = (
            transaction.type === 'income'
                ? transaction.destinationAccountId
                : transaction.sourceAccountId
        )?.toString()
        const categoryId = transaction.categoryId?.toString()
        const normalizedDescription = normalizeQuickCaptureTerm(transaction.description)
        const normalizedMerchant = normalizeQuickCaptureTerm(transaction.merchant ?? '')
        const key = [
            transaction.type,
            transaction.currency,
            normalizedDescription,
            normalizedMerchant,
            accountId ?? '',
            categoryId ?? '',
        ].join('|')
        const current = groups.get(key)
        if (current) {
            current.occurrences += 1
            return
        }
        groups.set(key, {
            key,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            description: transaction.description,
            merchant: transaction.merchant,
            accountId,
            categoryId,
            occurrences: 1,
            lastUsedAt: transaction.date.toISOString(),
            recencyIndex: index,
        })
    })

    return Array.from(groups.values())
        .filter((frequent) => frequent.occurrences >= 2)
        .sort((left, right) => {
            const leftScore = left.occurrences * 20 - left.recencyIndex * 0.25
            const rightScore = right.occurrences * 20 - right.recencyIndex * 0.25
            return rightScore - leftScore
        })
        .slice(0, 5)
        .map((frequent) => {
            const output: Partial<typeof frequent> = { ...frequent }
            delete output.recencyIndex
            return output as QuickCaptureFrequent
        })
}

export async function recordQuickCaptureAliasUsage(
    userId: string,
    aliasIds: string[]
) {
    const validIds = Array.from(new Set(aliasIds))
        .filter((id) => Types.ObjectId.isValid(id))
        .slice(0, 20)
    if (validIds.length === 0) return
    await QuickCaptureAlias.updateMany(
        {
            _id: { $in: validIds },
            userId,
        },
        {
            $inc: { usageCount: 1 },
            $set: { lastUsedAt: new Date() },
        }
    )
}
