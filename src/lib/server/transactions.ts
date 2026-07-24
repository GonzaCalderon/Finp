import { Account, Category, Transaction, TransactionRule, User } from '@/lib/models'
import { transactionSchema, type TransactionFormData } from '@/lib/validations'
import { calculateAccountBalancesByCurrency } from '@/lib/utils/balance'
import { CREDIT_CARD_PAYMENT_TYPES, normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { getCommonSupportedCurrencies, getInitialBalancesByCurrency, supportsCurrency } from '@/lib/utils/accounts'
import { normalizeManualExchange } from '@/lib/utils/exchange'
import { resolveTransactionDescription } from '@/lib/utils/transaction-description'
import { evaluateRules, previewRuleActions } from '@/lib/utils/rules'
import { getTextSimilarity } from '@/lib/utils/category-ranking'
import { parseOperationalStartDate } from '@/lib/utils/operational-start'
import { ServiceError } from '@/lib/server/errors'
import type {
    CreatedFrom,
    ImportSourceType,
    TransactionStatus,
} from '@/lib/constants'
import type { IAccount, ITransaction } from '@/types'
import type {
    TransactionAccountImpact,
    TransactionPreviewIssue,
} from '@/types'

type CreateTransactionOptions = {
    createdFrom?: CreatedFrom
    status?: TransactionStatus
    includePreviewSignals?: boolean
    allowPotentialDuplicate?: boolean
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

type PreparedTransaction = {
    data: TransactionFormData
    sourceAccount: IAccount | null
    destinationAccount: IAccount | null
    description: string
    normalizedExchange?: ReturnType<typeof normalizeManualExchange>
    appliedRuleId?: string
    appliedRuleNameSnapshot?: string
    appliedRuleMatchSnapshot?: ReturnType<typeof evaluateRules>['match']
    appliedRuleActions: {
        categoryId?: string
        setType?: 'expense' | 'income'
        normalizeMerchant?: string
    }
    category?: {
        id: string
        name: string
        color?: string
    }
    accountImpact?: TransactionAccountImpact
    duplicate?: {
        transactionId: string
        description: string
        date: string
    }
    issues: TransactionPreviewIssue[]
}

type PrepareTransactionOptions = {
    includePreviewSignals?: boolean
}

const SIMPLE_ACCOUNT_TYPES = new Set(['bank', 'cash', 'wallet', 'savings'])

async function calculateImpact(params: {
    account: NonNullable<PreparedTransaction['sourceAccount']>
    amount: number
    currency: TransactionFormData['currency']
    direction: 'debit' | 'credit'
}): Promise<TransactionAccountImpact> {
    const { account, amount, currency, direction } = params
    const balances = await calculateAccountBalancesByCurrency(
        account._id,
        account.userId,
        { initialBalances: getInitialBalancesByCurrency(account) }
    )
    const currentBalance = balances[currency]
    return {
        accountId: account._id.toString(),
        accountName: account.name,
        currency,
        currentBalance,
        resultingBalance:
            direction === 'debit'
                ? currentBalance - amount
                : currentBalance + amount,
        allowNegativeBalance: account.allowNegativeBalance !== false,
    }
}

export async function prepareTransactionForUser(
    userId: string,
    input: CreateTransactionInput,
    options: PrepareTransactionOptions = {}
): Promise<PreparedTransaction> {
    const parsed = transactionSchema.safeParse(input)

    if (!parsed.success) {
        throw new ServiceError(
            400,
            'INVALID_TRANSACTION_DATA',
            'Datos de transaccion invalidos',
            parsed.error.flatten()
        )
    }

    const initialData: TransactionFormData = {
        ...parsed.data,
        type: (normalizeLegacyTransactionType(parsed.data.type) ?? parsed.data.type) as TransactionFormData['type'],
    }

    let data = initialData
    let appliedRuleId: string | undefined
    let appliedRuleNameSnapshot: string | undefined
    let appliedRuleMatchSnapshot: ReturnType<typeof evaluateRules>['match']
    const appliedRuleActions: PreparedTransaction['appliedRuleActions'] = {}

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
        ? await Account.find({ _id: { $in: accountIds }, userId })
        : []
    const accountMap = new Map(relatedAccounts.map((account) => [account._id.toString(), account]))
    const sourceAccount = data.sourceAccountId ? accountMap.get(data.sourceAccountId) ?? null : null
    const destinationAccount = data.destinationAccountId ? accountMap.get(data.destinationAccountId) ?? null : null

    if (data.sourceAccountId && !sourceAccount) {
        throw new ServiceError(404, 'SOURCE_ACCOUNT_NOT_FOUND', 'La cuenta origen no existe o no pertenece al usuario.')
    }
    if (data.destinationAccountId && !destinationAccount) {
        throw new ServiceError(404, 'DESTINATION_ACCOUNT_NOT_FOUND', 'La cuenta destino no existe o no pertenece al usuario.')
    }
    if (sourceAccount?.isActive === false || destinationAccount?.isActive === false) {
        throw new ServiceError(400, 'ACCOUNT_INACTIVE', 'La cuenta seleccionada esta inactiva.')
    }

    const simpleAccount = data.type === 'expense' ? sourceAccount : data.type === 'income' ? destinationAccount : null
    if (simpleAccount && !SIMPLE_ACCOUNT_TYPES.has(simpleAccount.type)) {
        throw new ServiceError(
            400,
            'SPECIAL_ACCOUNT_REQUIRES_FULL_FLOW',
            simpleAccount.type === 'credit_card'
                ? 'Los gastos con tarjeta deben registrarse desde el flujo de tarjeta.'
                : 'Esta cuenta requiere el formulario completo.'
        )
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

    let category: PreparedTransaction['category']
    if (data.categoryId) {
        const categoryDocument = await Category.findOne({
            _id: data.categoryId,
            userId,
        }).lean<{ _id: { toString(): string }; name: string; color?: string; type: string; isArchived?: boolean } | null>()
        if (!categoryDocument) {
            throw new ServiceError(404, 'CATEGORY_NOT_FOUND', 'La categoria no existe o no pertenece al usuario.')
        }
        if (categoryDocument.isArchived) {
            throw new ServiceError(400, 'CATEGORY_ARCHIVED', `La categoria "${categoryDocument.name}" esta archivada.`)
        }
        const expectedType = data.type === 'credit_card_expense' ? 'expense' : data.type
        if (
            (expectedType === 'expense' || expectedType === 'income') &&
            categoryDocument.type !== expectedType
        ) {
            throw new ServiceError(
                400,
                'CATEGORY_TYPE_MISMATCH',
                `La categoria "${categoryDocument.name}" no corresponde a un ${expectedType === 'income' ? 'ingreso' : 'gasto'}.`
            )
        }
        category = {
            id: categoryDocument._id.toString(),
            name: categoryDocument.name,
            color: categoryDocument.color,
        }
    }

    let accountImpact: TransactionAccountImpact | undefined
    if (data.type === 'income' && destinationAccount && options.includePreviewSignals) {
        accountImpact = await calculateImpact({
            account: destinationAccount,
            amount: data.amount,
            currency: data.currency,
            direction: 'credit',
        })
    } else if (
        sourceAccount &&
        (options.includePreviewSignals || sourceAccount.allowNegativeBalance === false)
    ) {
        accountImpact = await calculateImpact({
            account: sourceAccount,
            amount: data.amount,
            currency: data.currency,
            direction: 'debit',
        })
        if (!accountImpact.allowNegativeBalance && accountImpact.resultingBalance < 0) {
            throw new ServiceError(
                400,
                'INSUFFICIENT_FUNDS',
                `Saldo insuficiente en "${sourceAccount.name}". Disponible: ${new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: data.currency,
                    maximumFractionDigits: 0,
                }).format(accountImpact.currentBalance)}. Faltan ${new Intl.NumberFormat('es-AR', {
                    style: 'currency',
                    currency: data.currency,
                    maximumFractionDigits: 0,
                }).format(Math.abs(accountImpact.resultingBalance))}.`,
                { accountImpact }
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

    const issues: TransactionPreviewIssue[] = []
    let duplicate: PreparedTransaction['duplicate']

    if (options.includePreviewSignals) {
        const now = new Date()
        if (data.date.getTime() > now.getTime()) {
            issues.push({
                code: 'FUTURE_DATE',
                message: 'La fecha es futura. Para un pago previsto conviene crear un compromiso.',
                field: 'date',
                severity: 'warning',
            })
        }

        const user = await User.findById(userId, {
            'preferences.operationalStartDate': 1,
        }).lean<{ preferences?: { operationalStartDate?: string } } | null>()
        const operationalStart = parseOperationalStartDate(user?.preferences?.operationalStartDate)
        if (operationalStart && data.date.getTime() < operationalStart.getTime()) {
            issues.push({
                code: 'BEFORE_OPERATIONAL_START',
                message: 'La fecha es anterior al inicio operativo y puede quedar fuera de los reportes habituales.',
                field: 'date',
                severity: 'warning',
            })
        }

        const rangeStart = new Date(data.date.getTime() - 36 * 60 * 60 * 1000)
        const rangeEnd = new Date(data.date.getTime() + 36 * 60 * 60 * 1000)
        const possibleDuplicates = await Transaction.find({
            userId,
            type: data.type,
            amount: data.amount,
            currency: data.currency,
            date: { $gte: rangeStart, $lte: rangeEnd },
        })
            .select('_id description merchant date')
            .sort({ date: -1 })
            .limit(10)
            .lean<Array<{ _id: { toString(): string }; description: string; merchant?: string; date: Date }>>()
        const currentText = [description, data.merchant].filter(Boolean).join(' ')
        const duplicateDocument = possibleDuplicates.find((candidate) =>
            getTextSimilarity(
                currentText,
                [candidate.description, candidate.merchant].filter(Boolean).join(' ')
            ) >= 0.72
        )
        if (duplicateDocument) {
            duplicate = {
                transactionId: duplicateDocument._id.toString(),
                description: duplicateDocument.description,
                date: duplicateDocument.date.toISOString(),
            }
            issues.push({
                code: 'POSSIBLE_DUPLICATE',
                message: 'Ya existe un movimiento muy parecido cerca de esta fecha.',
                severity: 'warning',
            })
        }

        if (accountImpact?.allowNegativeBalance && accountImpact.resultingBalance < 0) {
            issues.push({
                code: 'NEGATIVE_RESULTING_BALANCE',
                message: `La cuenta quedara con saldo negativo en ${data.currency}.`,
                field: data.type === 'income' ? 'destinationAccountId' : 'sourceAccountId',
                severity: 'warning',
            })
        }
    }

    return {
        data,
        sourceAccount,
        destinationAccount,
        description,
        normalizedExchange,
        appliedRuleId,
        appliedRuleNameSnapshot,
        appliedRuleMatchSnapshot,
        appliedRuleActions,
        category,
        accountImpact,
        duplicate,
        issues,
    }
}

export async function createTransactionForUser(
    userId: string,
    input: CreateTransactionInput,
    options: CreateTransactionOptions = {}
) {
    const prepared = await prepareTransactionForUser(userId, input, {
        includePreviewSignals: options.includePreviewSignals,
    })
    if (prepared.duplicate && !options.allowPotentialDuplicate) {
        throw new ServiceError(
            409,
            'DUPLICATE_CONFIRMATION_REQUIRED',
            'Ya existe un movimiento muy parecido. Confirmá que querés registrarlo de todos modos.'
        )
    }
    const {
        data,
        description,
        normalizedExchange,
        appliedRuleId,
        appliedRuleNameSnapshot,
        appliedRuleMatchSnapshot,
        appliedRuleActions,
    } = prepared

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
