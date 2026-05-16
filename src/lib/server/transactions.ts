import { Account, Transaction, TransactionRule } from '@/lib/models'
import { transactionSchema, type TransactionFormData } from '@/lib/validations'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { CREDIT_CARD_PAYMENT_TYPES, normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { getCommonSupportedCurrencies, getInitialBalancesByCurrency, supportsCurrency } from '@/lib/utils/accounts'
import { normalizeManualExchange } from '@/lib/utils/exchange'
import { resolveTransactionDescription } from '@/lib/utils/transaction-description'
import { evaluateRules } from '@/lib/utils/rules'
import { ServiceError } from '@/lib/server/errors'
import type { CreatedFrom, TransactionStatus } from '@/lib/constants'

type CreateTransactionOptions = {
    createdFrom?: CreatedFrom
    status?: TransactionStatus
    skipRules?: boolean
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

    const data = {
        ...parsed.data,
        type: normalizeLegacyTransactionType(parsed.data.type) ?? parsed.data.type,
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
        sourceAccount,
        destinationAccount,
    })

    let resolvedCategoryId = data.categoryId
    let resolvedMerchant = data.merchant
    let appliedRuleId: string | undefined
    let appliedRuleNameSnapshot: string | undefined

    if (!options.skipRules && (data.type === 'expense' || data.type === 'income' || data.type === 'credit_card_expense')) {
        const ruleType = data.type === 'credit_card_expense' ? 'expense' : data.type
        const rules = await TransactionRule.find({
            userId,
            isActive: true,
        }).sort({ priority: -1 })

        const { matched, rule } = evaluateRules(rules, {
            type: ruleType,
            description,
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
        userId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        date: data.date,
        description,
        categoryId: resolvedCategoryId,
        sourceAccountId: data.sourceAccountId,
        destinationAccountId: data.destinationAccountId,
        destinationAmount: data.type === 'exchange' ? data.destinationAmount : undefined,
        destinationCurrency: data.type === 'exchange' ? data.destinationCurrency : undefined,
        exchangeRate: data.type === 'exchange' ? data.exchangeRate : undefined,
        paymentGroupId: data.paymentGroupId,
        notes: data.notes,
        merchant: resolvedMerchant,
        status: options.status ?? 'confirmed',
        createdFrom: options.createdFrom ?? 'web',
        appliedRuleId,
        appliedRuleNameSnapshot,
        spaceId: data.spaceId,
        spaceEntryId: data.spaceEntryId,
    })

    return Transaction.findById(transaction._id)
        .populate('categoryId', 'name color type')
        .populate('sourceAccountId', 'name type currency supportedCurrencies color')
        .populate('destinationAccountId', 'name type currency supportedCurrencies color')
}

export function getTransactionListTypeFilter(type: string) {
    const normalizedType = normalizeLegacyTransactionType(type)
    return normalizedType === 'credit_card_payment'
        ? { $in: [...CREDIT_CARD_PAYMENT_TYPES] }
        : normalizedType
}
