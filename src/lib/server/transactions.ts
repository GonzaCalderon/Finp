import { Account, Transaction, TransactionRule } from '@/lib/models'
import { transactionSchema, type TransactionFormData } from '@/lib/validations'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { CREDIT_CARD_PAYMENT_TYPES, normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { getCommonSupportedCurrencies, getInitialBalancesByCurrency, supportsCurrency } from '@/lib/utils/accounts'
import { normalizeManualExchange } from '@/lib/utils/exchange'
import { resolveTransactionDescription } from '@/lib/utils/transaction-description'
import { evaluateRules, previewRuleActions } from '@/lib/utils/rules'
import { ServiceError } from '@/lib/server/errors'
import type {
    CreatedFrom,
    ImportSourceType,
    TransactionStatus,
} from '@/lib/constants'
import type { ITransaction } from '@/types'

type CreateTransactionOptions = {
    createdFrom?: CreatedFrom
    status?: TransactionStatus
    metadata?: {
        installmentPlanId?: ITransaction['installmentPlanId']
        importBatchId?: ITransaction['importBatchId']
        importedAt?: Date
        importSourceType?: ImportSourceType
        spaceNameSnapshot?: string
        operationalAmount?: number
    }
}

export type CreateTransactionInput = TransactionFormData | Record<string, unknown>

export async function createTransactionForUser(
    userId: string,
    input: CreateTransactionInput,
    options: CreateTransactionOptions = {}
) {
    const parsed = transactionSchema.safeParse(input)

    if (!parsed.success) {
        throw new ServiceError(
            400,
            'INVALID_TRANSACTION_DATA',
            'Datos de transaccion invalidos',
            parsed.error.flatten()
        )
    }

    const initialData = {
        ...parsed.data,
        type: normalizeLegacyTransactionType(parsed.data.type) ?? parsed.data.type,
    }

    let data = initialData
    let appliedRuleId: string | undefined
    let appliedRuleNameSnapshot: string | undefined
    let appliedRuleMatchSnapshot: ReturnType<typeof evaluateRules>['match']
    const appliedRuleActions: {
        categoryId?: string
        setType?: 'expense' | 'income'
        normalizeMerchant?: string
    } = {}

    if (['expense', 'income', 'credit_card_expense'].includes(initialData.type)) {
        const ruleType = initialData.type === 'credit_card_expense' ? 'expense' : initialData.type
        const rules = await TransactionRule.find({
            userId,
            isActive: true,
        }).sort({ priority: -1, createdAt: -1 })

        const { matched, rule, match } = evaluateRules(rules, {
            type: ruleType,
            description: initialData.description,
            merchant: initialData.merchant,
        })

        if (matched && rule) {
            appliedRuleId = rule._id.toString()
            appliedRuleNameSnapshot = rule.name
            appliedRuleMatchSnapshot = match

            const nextData = { ...initialData }
            const preview = previewRuleActions(rule, {
                type: initialData.type,
                description: initialData.description,
                merchant: initialData.merchant,
                categoryId: initialData.categoryId,
            })
            Object.assign(appliedRuleActions, preview.appliedActions)

            if (preview.appliedActions.setType) {
                const accountId =
                    initialData.type === 'expense'
                        ? initialData.sourceAccountId
                        : initialData.destinationAccountId

                nextData.type = preview.appliedActions.setType
                if (preview.appliedActions.setType === 'income') {
                    nextData.sourceAccountId = undefined
                    nextData.destinationAccountId = accountId
                } else {
                    nextData.sourceAccountId = accountId
                    nextData.destinationAccountId = undefined
                }
            }

            if (preview.appliedActions.categoryId) {
                nextData.categoryId = preview.appliedActions.categoryId
            }

            if (preview.appliedActions.normalizeMerchant) {
                nextData.merchant = preview.appliedActions.normalizeMerchant
            }

            const resolved = transactionSchema.safeParse(nextData)
            if (!resolved.success) {
                throw new ServiceError(
                    400,
                    'INVALID_RULE_RESULT',
                    `La regla "${rule.name}" produjo una transaccion invalida.`,
                    resolved.error.flatten()
                )
            }

            data = resolved.data
        }
    }

    const accountIds = [data.sourceAccountId, data.destinationAccountId].filter(Boolean)
    const relatedAccounts = accountIds.length > 0
        ? await Account.find({
            _id: { $in: accountIds },
            userId,
        })
        : []
    const accountMap = new Map(relatedAccounts.map((account) => [account._id.toString(), account]))
    const sourceAccount = data.sourceAccountId ? accountMap.get(data.sourceAccountId) : null
    const destinationAccount = data.destinationAccountId ? accountMap.get(data.destinationAccountId) : null

    if (data.sourceAccountId && !sourceAccount) {
        throw new ServiceError(404, 'SOURCE_ACCOUNT_NOT_FOUND', 'La cuenta origen no existe o no pertenece al usuario.')
    }

    if (data.destinationAccountId && !destinationAccount) {
        throw new ServiceError(404, 'DESTINATION_ACCOUNT_NOT_FOUND', 'La cuenta destino no existe o no pertenece al usuario.')
    }

    if (data.type === 'transfer' && sourceAccount && destinationAccount) {
        const commonCurrencies = getCommonSupportedCurrencies([sourceAccount, destinationAccount])
        if (commonCurrencies.length === 0) {
            throw new ServiceError(
                400,
                'TRANSFER_REQUIRES_EXCHANGE',
                'La transferencia entre cuentas de distinta moneda debe registrarse como un cambio manual.'
            )
        }
    }

    if (sourceAccount && !supportsCurrency(sourceAccount, data.currency)) {
        throw new ServiceError(400, 'SOURCE_ACCOUNT_CURRENCY_UNSUPPORTED', `La cuenta "${sourceAccount.name}" no opera en ${data.currency}.`)
    }

    if (
        data.type === 'exchange' &&
        destinationAccount &&
        data.destinationCurrency &&
        !supportsCurrency(destinationAccount, data.destinationCurrency)
    ) {
        throw new ServiceError(400, 'DESTINATION_ACCOUNT_CURRENCY_UNSUPPORTED', `La cuenta "${destinationAccount.name}" no opera en ${data.destinationCurrency}.`)
    }

    if (data.type !== 'exchange' && destinationAccount && !supportsCurrency(destinationAccount, data.currency)) {
        throw new ServiceError(400, 'DESTINATION_ACCOUNT_CURRENCY_UNSUPPORTED', `La cuenta "${destinationAccount.name}" no opera en ${data.currency}.`)
    }

    if (sourceAccount?.allowNegativeBalance === false) {
        const balances = await calculateAccountBalancesByCurrency(
            sourceAccount._id,
            sourceAccount.userId,
            {
                initialBalances: getInitialBalancesByCurrency(sourceAccount),
            }
        )
        const balance = balances[data.currency]

        if (balance - data.amount < 0) {
            throw new ServiceError(
                400,
                'INSUFFICIENT_FUNDS',
                `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: data.currency,
                    maximumFractionDigits: 0,
                }).format(balance)}`
            )
        }
    }

    let normalizedExchange: ReturnType<typeof normalizeManualExchange> | undefined
    if (data.type === 'exchange') {
        try {
            normalizedExchange = normalizeManualExchange({
                sourceCurrency: data.currency,
                sourceAmount: data.amount,
                destinationCurrency: data.destinationCurrency!,
                destinationAmount: data.destinationAmount!,
                exchangeRate: data.exchangeRate!,
            })
        } catch (error) {
            throw new ServiceError(
                400,
                'INVALID_MANUAL_EXCHANGE',
                error instanceof Error ? error.message : 'Datos de cambio manual invalidos.'
            )
        }
    }

    const description = resolveTransactionDescription({
        type: data.type,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        destinationCurrency: data.destinationCurrency,
        sourceAccount,
        destinationAccount,
    })

    const transaction = await Transaction.create({
        userId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        date: data.date,
        description,
        categoryId: data.categoryId,
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        destinationAmount: data.type === 'exchange' ? data.destinationAmount : undefined,
        destinationCurrency: data.type === 'exchange' ? data.destinationCurrency : undefined,
        exchangeRate: normalizedExchange?.exchangeRate,
        paymentGroupId: data.paymentGroupId,
        notes: data.notes,
        merchant: data.merchant,
        status: options.status ?? 'confirmed',
        createdFrom: options.createdFrom ?? 'web',
        appliedRuleId,
        appliedRuleNameSnapshot,
        appliedRuleMatchSnapshot,
        appliedRuleActions:
            Object.keys(appliedRuleActions).length > 0 ? appliedRuleActions : undefined,
        spaceId: data.spaceId,
        spaceEntryId: data.spaceEntryId,
        ...options.metadata,
    })

    if (appliedRuleId) {
        try {
            await TransactionRule.updateOne(
                { _id: appliedRuleId, userId },
                {
                    $inc: { matchCount: 1 },
                    $set: { lastMatchedAt: new Date() },
                }
            )
        } catch (error) {
            // The transaction already contains the durable rule snapshot. Aggregate
            // counters are useful telemetry, but must never invalidate the movement.
            console.error('No se pudieron actualizar las metricas de la regla:', error)
        }
    }

    const populated = await Transaction.findById(transaction._id)
        .populate('categoryId', 'name color type')
        .populate('sourceAccountId', 'name type currency supportedCurrencies color')
        .populate('destinationAccountId', 'name type currency supportedCurrencies color')

    if (!populated) {
        throw new ServiceError(
            500,
            'TRANSACTION_READ_AFTER_CREATE_FAILED',
            'La transaccion se creo, pero no se pudo recuperar.'
        )
    }

    return populated
}

export function getTransactionListTypeFilter(type: string) {
    const normalizedType = normalizeLegacyTransactionType(type)
    return normalizedType === 'credit_card_payment'
        ? { $in: [...CREDIT_CARD_PAYMENT_TYPES] }
        : normalizedType
}
