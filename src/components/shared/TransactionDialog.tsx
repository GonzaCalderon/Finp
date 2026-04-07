'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banknote, Building2, CreditCard } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

import { Spinner } from '@/components/shared/Spinner'
import { getTypeSurface } from '@/components/shared/transaction-dialog/shared-ui'
import { TransactionMainStep } from '@/components/shared/transaction-dialog/TransactionMainStep'
import { TransactionTypeStep } from '@/components/shared/transaction-dialog/TransactionTypeStep'
import { TransactionExpenseDetailsStep } from '@/components/shared/transaction-dialog/TransactionExpenseDetailsStep'
import { TransactionOtherDetailsStep } from '@/components/shared/transaction-dialog/TransactionOtherDetailsStep'
import { TransactionClassificationStep } from '@/components/shared/transaction-dialog/TransactionClassificationStep'
import { TransactionReviewStep } from '@/components/shared/transaction-dialog/TransactionReviewStep'
import {
    transactionSchema,
    type TransactionFormInput,
    type TransactionFormData,
    type InstallmentFormData,
} from '@/lib/validations'
import type { ITransaction, IAccount, ICategory, ITransactionRule } from '@/types'
import { evaluateRules } from '@/lib/utils/rules'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
    getDefaultAccountForPaymentMethod,
    getAccountBalancesByCurrency,
    getCommonSupportedCurrencies,
    getSupportedCurrencies,
    supportsCurrency,
} from '@/lib/utils/accounts'
import { getArsPerUsdRate } from '@/lib/utils/exchange'
import { DURATION, easeSmooth, easeSoft } from '@/lib/utils/animations'
import {
    getRecentCategoryIds,
    getStoredAccountId,
    getStoredExpensePaymentMethod,
    getStoredTransactionType,
    persistTransactionDialogPrefs,
    type DialogAccountContext,
    type PaymentMethod,
} from '@/components/shared/transaction-dialog-prefs'

interface TransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transaction: ITransaction | null
    accounts: IAccount[]
    categories: ICategory[]
    onSubmit: (data: TransactionFormData) => Promise<void>
    onBatchSubmit?: (items: TransactionFormData[]) => Promise<void>
    onInstallmentSubmit?: (data: InstallmentFormData) => Promise<void>
    rules?: ITransactionRule[]
    defaultAccountId?: string
    monthStartDay?: number
}

type TransactionStepId = 'type' | 'main' | 'details' | 'classification' | 'review'

type TransactionStep = {
    id: TransactionStepId
}

type CurrencyOption = TransactionFormInput['currency']
type CardPaymentMode = 'full' | 'partial'
type CardPaymentSelection = 'ars' | 'usd' | 'ars_usd'
type CardPaymentDraft = {
    currency: CurrencyOption
    amount: number
    additionalEnabled: boolean
    secondaryAmount: number
}

const TRANSACTION_TYPE_LABELS: Record<TransactionFormInput['type'], string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    credit_card_expense: 'Gasto con TC',
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; icon: ReactNode }> = [
    { value: 'cash', label: 'Efectivo', icon: <Banknote className="h-4 w-4" /> },
    { value: 'debit', label: 'Debito / transferencia', icon: <Building2 className="h-4 w-4" /> },
    { value: 'credit_card', label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> },
]

function resolveId(value: unknown): string | undefined {
    if (!value) return undefined
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null && '_id' in value) {
        const nestedId = (value as { _id?: { toString(): string } | string })._id
        if (typeof nestedId === 'string') return nestedId
        return nestedId?.toString()
    }
    if (typeof (value as { toString?: () => string }).toString === 'function') {
        return (value as { toString(): string }).toString()
    }
    return undefined
}

function formatMonthValue(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions(anchorDate?: Date, selectedValue?: string): Array<{ value: string; label: string }> {
    const options: Array<{ value: string; label: string }> = []
    const baseDate = anchorDate ?? new Date()
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)

    for (let index = 0; index < 4; index += 1) {
        const current = new Date(start.getFullYear(), start.getMonth() + index, 1)
        options.push({
            value: formatMonthValue(current),
            label: current.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
        })
    }

    if (selectedValue && !options.some((option) => option.value === selectedValue)) {
        const [year, month] = selectedValue.split('-').map(Number)
        if (!Number.isNaN(year) && !Number.isNaN(month)) {
            const selectedDate = new Date(year, month - 1, 1)
            options.unshift({
                value: selectedValue,
                label: selectedDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
            })
        }
    }

    return options
}

function getInstallmentPlanMonths(firstClosingMonth: string, count: number) {
    if (!firstClosingMonth || count <= 0) return []
    const [year, month] = firstClosingMonth.split('-').map(Number)
    return Array.from({ length: count }, (_, index) => new Date(year, month - 1 + index, 1))
}

function formatPlanMonths(months: Date[]) {
    if (months.length === 0) return ''

    const first = months[0]
    const last = months[months.length - 1]

    if (months.length <= 4) {
        if (first.getFullYear() !== last.getFullYear()) {
            return months
                .map((date) => date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', ''))
                .join(' · ')
        }

        const names = months.map((date) => date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''))
        return `${names.join(' · ')} ${first.getFullYear()}`
    }

    const formatPoint = (date: Date) =>
        date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')

    return `${formatPoint(first)} -> ${formatPoint(last)}`
}

function formatMonthCompact(value?: string) {
    if (!value) return ''
    const [year, month] = value.split('-').map(Number)
    if (Number.isNaN(year) || Number.isNaN(month)) return value
    return new Date(year, month - 1, 1)
        .toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
        .replace('.', '')
}

function getInstallmentSummaryLabel(count: number, firstClosingMonth: string) {
    if (!firstClosingMonth) {
        return `${count} cuota${count === 1 ? '' : 's'}`
    }

    const months = getInstallmentPlanMonths(firstClosingMonth, count)
    if (count === 1) {
        return `1 cuota · impacta en ${formatMonthCompact(firstClosingMonth)}`
    }

    const lastMonth = months[months.length - 1]
    return `${count} cuotas · ${formatMonthCompact(firstClosingMonth)} -> ${formatMonthCompact(lastMonth ? formatMonthValue(lastMonth) : firstClosingMonth)}`
}

function buildSteps(params: {
    type: TransactionFormInput['type']
    isExpense: boolean
    showClassification: boolean
    isEditing: boolean
}): TransactionStep[] {
    const { type, isExpense, showClassification, isEditing } = params
    const steps: TransactionStep[] = [{ id: 'type' }]

    if (type !== 'income' && type !== 'credit_card_payment' && type !== 'exchange' && type !== 'transfer' && type !== 'adjustment') {
        steps.push({ id: 'main' })
    }

    if (type === 'income' || isExpense || type === 'transfer' || type === 'exchange' || type === 'credit_card_payment' || type === 'adjustment') {
        steps.push({ id: 'details' })
    }

    if (showClassification) {
        steps.push({ id: 'classification' })
    }

    steps.push({ id: 'review' })

    return steps
}

function getPrimaryFlowType(type: TransactionFormInput['type']) {
    if (type === 'credit_card_expense') return 'expense'
    if (type === 'debt_payment') return 'credit_card_payment'
    return type
}

function getSourceAccountContext(type: TransactionFormInput['type'], paymentMethod: PaymentMethod): DialogAccountContext | null {
    if (type === 'expense' || type === 'credit_card_expense') return `expense:${paymentMethod}`
    if (type === 'transfer') return 'transfer:source'
    if (type === 'exchange') return 'exchange:source'
    if (type === 'credit_card_payment') return 'credit_card_payment:source'
    if (type === 'adjustment') return 'adjustment:source'
    return null
}

function getDestinationAccountContext(type: TransactionFormInput['type']): DialogAccountContext | null {
    if (type === 'income') return 'income:destination'
    if (type === 'transfer') return 'transfer:destination'
    if (type === 'exchange') return 'exchange:destination'
    if (type === 'credit_card_payment') return 'credit_card_payment:destination'
    return null
}

const stepMotionVariants = {
    initial: (direction: number) => ({ opacity: 0, x: direction >= 0 ? 28 : -28, scale: 0.995 }),
    animate: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: { duration: DURATION.normal, ease: easeSmooth },
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction >= 0 ? -20 : 20,
        scale: 0.99,
        transition: { duration: DURATION.fast, ease: easeSoft },
    }),
}

export function TransactionDialog({
    open,
    onOpenChange,
    transaction,
    accounts,
    categories,
    onSubmit,
    onBatchSubmit,
    onInstallmentSubmit,
    rules = [],
    defaultAccountId,
    monthStartDay = 1,
}: TransactionDialogProps) {
    const {
        control,
        handleSubmit,
        setValue,
        trigger,
        reset,
        formState: { errors, isSubmitting, submitCount },
    } = useForm<TransactionFormInput, unknown, TransactionFormData>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            type: 'expense',
            amount: 0,
            currency: 'ARS',
            date: new Date(),
            description: '',
            categoryId: undefined,
            sourceAccountId: undefined,
            destinationAccountId: undefined,
            destinationAmount: undefined,
            destinationCurrency: undefined,
            exchangeRate: undefined,
            notes: '',
            merchant: '',
        },
    })

    const [showMoreOptions, setShowMoreOptions] = useState(false)
    const [categoryManuallySet, setCategoryManuallySet] = useState(false)
    const [autoSelectedCategoryId, setAutoSelectedCategoryId] = useState<string | null>(null)
    const [categoryRuleLocked, setCategoryRuleLocked] = useState(false)
    const [appliedRuleName, setAppliedRuleName] = useState<string | null>(null)
    const [categoryQuery, setCategoryQuery] = useState('')
    const [showAllCategories, setShowAllCategories] = useState(false)
    const [adjustmentSign, setAdjustmentSign] = useState<'+' | '-'>('+')
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('debit')
    const [installmentCount, setInstallmentCount] = useState(1)
    const [firstClosingMonth, setFirstClosingMonth] = useState('')
    const [firstMonthError, setFirstMonthError] = useState<string | null>(null)
    const [installmentQuoteAmount, setInstallmentQuoteAmount] = useState(0)
    const [paymentSummary, setPaymentSummary] = useState<{
        due: number
        paid: number
        pending: number
        currency: string
        byCurrency?: Record<'ARS' | 'USD', { due: number; paid: number; pending: number; currency: string }>
    } | null>(null)
    const [additionalCardPaymentEnabled, setAdditionalCardPaymentEnabled] = useState(false)
    const [secondaryCardPaymentAmount, setSecondaryCardPaymentAmount] = useState(0)
    const [cardPaymentMode, setCardPaymentMode] = useState<CardPaymentMode>('full')
    const [cardPaymentSelection, setCardPaymentSelection] = useState<CardPaymentSelection>('ars')
    const [exchangeDestinationAmount, setExchangeDestinationAmount] = useState(0)
    const [exchangeDestinationCurrency, setExchangeDestinationCurrency] = useState<TransactionFormInput['currency']>('USD')
    const [exchangeRate, setExchangeRate] = useState(0)
    const [exchangeRecalcMode, setExchangeRecalcMode] = useState<'destinationAmount' | 'exchangeRate'>('destinationAmount')
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [navigationDirection, setNavigationDirection] = useState(1)
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)
    const [stepErrorsVisible, setStepErrorsVisible] = useState<Partial<Record<TransactionStepId, boolean>>>({})

    const scrollRef = useRef<HTMLDivElement>(null)
    const cardPaymentPartialDraftRef = useRef<CardPaymentDraft | null>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    const watchedValues = useWatch({ control })
    const type = (normalizeLegacyTransactionType((watchedValues.type as string) || 'expense') ?? 'expense') as TransactionFormInput['type']
    const amount = typeof watchedValues.amount === 'number' ? watchedValues.amount : 0
    const date = watchedValues.date instanceof Date ? watchedValues.date : undefined
    const currency: TransactionFormInput['currency'] = watchedValues.currency === 'USD' ? 'USD' : 'ARS'
    const sourceAccountId = typeof watchedValues.sourceAccountId === 'string' ? watchedValues.sourceAccountId : ''
    const destinationAccountId = typeof watchedValues.destinationAccountId === 'string' ? watchedValues.destinationAccountId : ''
    const categoryId = typeof watchedValues.categoryId === 'string' ? watchedValues.categoryId : ''
    const description = typeof watchedValues.description === 'string' ? watchedValues.description : ''
    const merchant = typeof watchedValues.merchant === 'string' ? watchedValues.merchant : ''
    const notes = typeof watchedValues.notes === 'string' ? watchedValues.notes : ''

    const monthOptions = useMemo(() => getMonthOptions(date, firstClosingMonth), [date, firstClosingMonth])
    const isEditing = Boolean(transaction)
    const isExpense = type === 'expense' || type === 'credit_card_expense'
    const isExchange = type === 'exchange'
    const isCardExpense = isExpense && paymentMethod === 'credit_card'
    const usesCardExpensePlanFlow = isCardExpense && !isEditing && Boolean(onInstallmentSubmit)
    const showSource = ['expense', 'credit_card_expense', 'transfer', 'exchange', 'credit_card_payment', 'adjustment'].includes(type)
    const showDestination = ['income', 'transfer', 'exchange', 'credit_card_payment'].includes(type)
    const showCategory = ['income', 'expense', 'credit_card_expense'].includes(type)
    const showClassificationStep = showCategory
    const isQuickFlow = showCategory
    const descriptionIsOptional = ['transfer', 'exchange', 'credit_card_payment', 'adjustment'].includes(type)
    const primaryFlowType = getPrimaryFlowType(type)
    const steps = useMemo(
        () => buildSteps({ type, isExpense, showClassification: showClassificationStep, isEditing }),
        [type, isExpense, showClassificationStep, isEditing]
    )
    const detailsStepIndex = useMemo(() => steps.findIndex((step) => step.id === 'details'), [steps])
    const classificationStepIndex = useMemo(() => steps.findIndex((step) => step.id === 'classification'), [steps])
    const hasReachedDetailsStep = detailsStepIndex >= 0 && currentStepIndex >= detailsStepIndex
    const hasReachedClassificationStep = classificationStepIndex >= 0 && currentStepIndex >= classificationStepIndex
    const currentStep = steps[currentStepIndex] ?? steps[0]
    const isLastStep = currentStepIndex === steps.length - 1
    const canGoBack = currentStepIndex > 0

    const paymentMonth = date
        ? (() => {
            const effective = new Date(date)
            if (monthStartDay !== 1 && effective.getDate() < monthStartDay) {
                effective.setMonth(effective.getMonth() - 1)
            }
            return `${effective.getFullYear()}-${String(effective.getMonth() + 1).padStart(2, '0')}`
        })()
        : ''

    const expenseAccounts = useMemo(() => {
        if (paymentMethod === 'cash') return accounts.filter((account) => account.type === 'cash')
        if (paymentMethod === 'credit_card') return accounts.filter((account) => account.type === 'credit_card')
        return accounts.filter((account) => ['bank', 'wallet', 'savings'].includes(account.type))
    }, [accounts, paymentMethod])

    const suggestedAccounts = useMemo(() => {
        if (type === 'income') return accounts.filter((account) => account.type !== 'credit_card' && account.type !== 'debt')
        if (type === 'expense') return accounts.filter((account) => account.type !== 'debt')
        if (type === 'credit_card_expense') return accounts.filter((account) => account.type === 'credit_card')
        if (type === 'exchange') return accounts.filter((account) => account.type !== 'credit_card' && account.type !== 'debt')
        if (type === 'credit_card_payment') return accounts.filter((account) => account.type !== 'credit_card' && account.type !== 'debt')
        return accounts
    }, [accounts, type])

    const destinationAccounts = useMemo(() => {
        if (type === 'credit_card_payment') return accounts.filter((account) => account.type === 'credit_card' || account.type === 'debt')
        if (type === 'exchange') return accounts.filter((account) => account.type !== 'credit_card' && account.type !== 'debt')
        return accounts.filter((account) => account.type !== 'debt')
    }, [accounts, type])

    const selectedSourceAccount = useMemo(
        () => accounts.find((account) => account._id.toString() === sourceAccountId),
        [accounts, sourceAccountId]
    )
    const selectedDestinationAccount = useMemo(
        () => accounts.find((account) => account._id.toString() === destinationAccountId),
        [accounts, destinationAccountId]
    )
    const selectedCategory = useMemo(
        () => categories.find((category) => category._id.toString() === categoryId),
        [categories, categoryId]
    )

    const getPreselectedExpenseAccount = useCallback(
        (method: PaymentMethod) => getDefaultAccountForPaymentMethod(accounts, method, defaultAccountId),
        [accounts, defaultAccountId]
    )

    const resolveStoredAccount = useCallback((context: DialogAccountContext | null, candidates: IAccount[]) => {
        if (!context) return undefined
        const storedId = getStoredAccountId(context)
        if (!storedId) return undefined
        return candidates.find((account) => account._id.toString() === storedId)
    }, [])

    const allowedCurrencies = useMemo<CurrencyOption[]>(() => {
        if (!isEditing && !hasReachedDetailsStep) return ['ARS', 'USD']
        if (type === 'income') return getCommonSupportedCurrencies([selectedDestinationAccount])
        if (type === 'exchange') return getSupportedCurrencies(selectedSourceAccount)
        if (type === 'transfer' || type === 'credit_card_payment') {
            return getCommonSupportedCurrencies([selectedSourceAccount, selectedDestinationAccount])
        }
        if (showSource) return getCommonSupportedCurrencies([selectedSourceAccount])
        return ['ARS', 'USD'] as const
    }, [hasReachedDetailsStep, isEditing, selectedDestinationAccount, selectedSourceAccount, showSource, type])

    const exchangeSupportedDirections = useMemo<Array<{ source: CurrencyOption; destination: CurrencyOption }>>(() => {
        if (type !== 'exchange' || !selectedSourceAccount || !selectedDestinationAccount) return []

        const directions: Array<{ source: CurrencyOption; destination: CurrencyOption }> = []
        if (supportsCurrency(selectedSourceAccount, 'ARS') && supportsCurrency(selectedDestinationAccount, 'USD')) {
            directions.push({ source: 'ARS', destination: 'USD' })
        }
        if (supportsCurrency(selectedSourceAccount, 'USD') && supportsCurrency(selectedDestinationAccount, 'ARS')) {
            directions.push({ source: 'USD', destination: 'ARS' })
        }
        return directions
    }, [selectedDestinationAccount, selectedSourceAccount, type])

    const currentExchangeDirectionSupported = useMemo(() => {
        if (type !== 'exchange' || !selectedSourceAccount || !selectedDestinationAccount) return true
        return exchangeSupportedDirections.some(
            (direction) => direction.source === currency && direction.destination === exchangeDestinationCurrency
        )
    }, [
        currency,
        exchangeDestinationCurrency,
        exchangeSupportedDirections,
        selectedDestinationAccount,
        selectedSourceAccount,
        type,
    ])

    const canSwapExchangeDirection = useMemo(() => {
        if (type !== 'exchange' || !selectedSourceAccount || !selectedDestinationAccount) return false
        return exchangeSupportedDirections.some(
            (direction) => direction.source === exchangeDestinationCurrency && direction.destination === currency
        )
    }, [
        currency,
        exchangeDestinationCurrency,
        exchangeSupportedDirections,
        selectedDestinationAccount,
        selectedSourceAccount,
        type,
    ])

    const exchangeConfigurationError = useMemo(() => {
        if (type !== 'exchange' || !selectedSourceAccount || !selectedDestinationAccount) return null
        if (currentExchangeDirectionSupported) return null

        if (exchangeSupportedDirections.length === 0) {
            return 'Estas cuentas no permiten un cambio entre ARS y USD. Elegi una cuenta origen que pueda debitar una moneda y una destino que pueda recibir la otra.'
        }

        const problems: string[] = []
        if (!supportsCurrency(selectedSourceAccount, currency)) {
            problems.push(`La cuenta origen no puede debitar ${currency}`)
        }
        if (!supportsCurrency(selectedDestinationAccount, exchangeDestinationCurrency)) {
            problems.push(`La cuenta destino no puede recibir ${exchangeDestinationCurrency}`)
        }

        return `${problems.join('. ')}. Usa la doble flecha o cambia una cuenta.`
    }, [
        currency,
        currentExchangeDirectionSupported,
        exchangeDestinationCurrency,
        exchangeSupportedDirections.length,
        selectedDestinationAccount,
        selectedSourceAccount,
        type,
    ])

    const hasCrossCurrencyTransferConflict =
        type === 'transfer' &&
        !!selectedSourceAccount &&
        !!selectedDestinationAccount &&
        allowedCurrencies.length === 0

    const secondaryCardPaymentCurrency = useMemo(() => {
        if (type !== 'credit_card_payment') return undefined
        return (['ARS', 'USD'] as const).find(
            (candidate) => candidate !== currency && allowedCurrencies.includes(candidate)
        )
    }, [allowedCurrencies, currency, type])

    const arsCardPaymentSummary = useMemo(
        () => paymentSummary?.byCurrency?.ARS ?? (paymentSummary?.currency === 'ARS' ? paymentSummary : null),
        [paymentSummary]
    )
    const usdCardPaymentSummary = useMemo(
        () => paymentSummary?.byCurrency?.USD ?? (paymentSummary?.currency === 'USD' ? paymentSummary : null),
        [paymentSummary]
    )
    const arsCardPaymentPending = arsCardPaymentSummary?.pending ?? 0
    const usdCardPaymentPending = usdCardPaymentSummary?.pending ?? 0

    const canUseDualCardPayment =
        !isEditing &&
        type === 'credit_card_payment' &&
        Boolean(secondaryCardPaymentCurrency)

    const cardPaymentAvailableSelections = useMemo<CardPaymentSelection[]>(() => {
        if (type !== 'credit_card_payment') return []

        const options: CardPaymentSelection[] = []
        if (allowedCurrencies.includes('ARS') && arsCardPaymentPending > 0) options.push('ars')
        if (allowedCurrencies.includes('USD') && usdCardPaymentPending > 0) options.push('usd')
        if (
            canUseDualCardPayment &&
            allowedCurrencies.includes('ARS') &&
            allowedCurrencies.includes('USD') &&
            arsCardPaymentPending > 0 &&
            usdCardPaymentPending > 0
        ) {
            options.push('ars_usd')
        }
        return options
    }, [
        allowedCurrencies,
        arsCardPaymentPending,
        canUseDualCardPayment,
        type,
        usdCardPaymentPending,
    ])

    const installmentAmount =
        isCardExpense && installmentCount > 0 && amount > 0
            ? amount / installmentCount
            : 0
    const planMonths = useMemo(
        () => getInstallmentPlanMonths(firstClosingMonth, installmentCount),
        [firstClosingMonth, installmentCount]
    )
    const planMonthsLabel = useMemo(() => formatPlanMonths(planMonths), [planMonths])

    const filteredCategories = useMemo(
        () =>
            categories.filter((category) => {
                if (type === 'income') return category.type === 'income'
                if (type === 'expense' || type === 'credit_card_expense') return category.type === 'expense'
                return false
            }),
        [categories, type]
    )

    const categoryStorageType = type === 'income' ? 'income' : showCategory ? 'expense' : undefined
    const recentCategoryIds = useMemo(
        () => (categoryStorageType ? getRecentCategoryIds(categoryStorageType) : []),
        [categoryStorageType]
    )
    const recentCategories = useMemo(
        () =>
            recentCategoryIds
                .map((storedId) => filteredCategories.find((category) => category._id.toString() === storedId))
                .filter((category): category is ICategory => Boolean(category)),
        [filteredCategories, recentCategoryIds]
    )

    const normalizedCategoryQuery = categoryQuery.trim().toLowerCase()
    const matchingCategories = useMemo(
        () =>
            filteredCategories.filter((category) =>
                category.name.toLowerCase().includes(normalizedCategoryQuery)
            ),
        [filteredCategories, normalizedCategoryQuery]
    )

    const suggestedCategories = useMemo(() => {
        if (normalizedCategoryQuery) return matchingCategories

        const selected = categoryId
            ? filteredCategories.find((category) => category._id.toString() === categoryId)
            : undefined
        const ordered = [...recentCategories]

        if (selected && !ordered.some((category) => category._id.toString() === selected._id.toString())) {
            ordered.unshift(selected)
        }

        const remaining = filteredCategories.filter(
            (category) => !ordered.some((item) => item._id.toString() === category._id.toString())
        )

        return [...ordered, ...remaining.slice(0, 8)]
    }, [categoryId, filteredCategories, matchingCategories, normalizedCategoryQuery, recentCategories])

    const extraCategories = useMemo(() => {
        if (normalizedCategoryQuery) return []
        return filteredCategories.filter(
            (category) => !suggestedCategories.some((item) => item._id.toString() === category._id.toString())
        )
    }, [filteredCategories, normalizedCategoryQuery, suggestedCategories])

    const installmentPlanSummary = useMemo(
        () => getInstallmentSummaryLabel(installmentCount, firstClosingMonth),
        [firstClosingMonth, installmentCount]
    )

    const existingInstallmentCount = useMemo(() => {
        const plan = transaction?.installmentPlanId as { installmentCount?: number } | null | undefined
        return typeof plan?.installmentCount === 'number' ? plan.installmentCount : undefined
    }, [transaction])

    const paymentMethodLabel = PAYMENT_METHODS.find((item) => item.value === paymentMethod)?.label ?? 'Debito / transferencia'
    const showHeaderPaymentMethod = isExpense && (isEditing || hasReachedDetailsStep)
    const showHeaderInstallmentSummary = usesCardExpensePlanFlow && (isEditing || hasReachedDetailsStep)
    const headerSurface = getTypeSurface(type, isExpense)

    const fmtCurrency = useCallback(
        (value: number, forcedCurrency?: TransactionFormInput['currency']) =>
            new Intl.NumberFormat('es-AR', {
                style: 'currency',
                currency: forcedCurrency ?? currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
            }).format(value),
        [currency]
    )

    const transferBalanceCurrency = useMemo<TransactionFormInput['currency'] | undefined>(() => {
        if (type !== 'transfer') return undefined
        if (!selectedSourceAccount || !selectedDestinationAccount) return undefined
        if (!allowedCurrencies.includes(currency)) return undefined
        return currency
    }, [allowedCurrencies, currency, selectedDestinationAccount, selectedSourceAccount, type])

    const canShowTransferBalances = useMemo(() => (
        type === 'transfer' &&
        !!selectedSourceAccount &&
        !!selectedDestinationAccount &&
        sourceAccountId !== destinationAccountId &&
        !hasCrossCurrencyTransferConflict &&
        !!transferBalanceCurrency
    ), [
        destinationAccountId,
        hasCrossCurrencyTransferConflict,
        selectedDestinationAccount,
        selectedSourceAccount,
        sourceAccountId,
        transferBalanceCurrency,
        type,
    ])

    const transferSourceBalance = useMemo(() => {
        if (!canShowTransferBalances || !selectedSourceAccount || !transferBalanceCurrency) return null
        return getAccountBalancesByCurrency(selectedSourceAccount)[transferBalanceCurrency]
    }, [canShowTransferBalances, selectedSourceAccount, transferBalanceCurrency])

    const transferDestinationBalance = useMemo(() => {
        if (!canShowTransferBalances || !selectedDestinationAccount || !transferBalanceCurrency) return null
        return getAccountBalancesByCurrency(selectedDestinationAccount)[transferBalanceCurrency]
    }, [canShowTransferBalances, selectedDestinationAccount, transferBalanceCurrency])

    const transferSourceResultingBalance = useMemo(() => {
        if (transferSourceBalance === null) return null
        return transferSourceBalance - amount
    }, [amount, transferSourceBalance])

    const transferDestinationResultingBalance = useMemo(() => {
        if (transferDestinationBalance === null) return null
        return transferDestinationBalance + amount
    }, [amount, transferDestinationBalance])

    const transferBalanceError = useMemo(() => {
        if (
            type !== 'transfer' ||
            !selectedSourceAccount ||
            !transferBalanceCurrency ||
            transferSourceBalance === null ||
            amount <= 0 ||
            selectedSourceAccount.allowNegativeBalance !== false
        ) {
            return null
        }

        if (transferSourceResultingBalance !== null && transferSourceResultingBalance < 0) {
            return `Saldo insuficiente en "${selectedSourceAccount.name}". Disponible: ${fmtCurrency(transferSourceBalance, transferBalanceCurrency)}`
        }

        return null
    }, [
        amount,
        fmtCurrency,
        selectedSourceAccount,
        transferBalanceCurrency,
        transferSourceBalance,
        transferSourceResultingBalance,
        type,
    ])

    const submitLabel = transaction
        ? 'Guardar cambios'
        : usesCardExpensePlanFlow
            ? installmentCount > 1
                ? 'Registrar en cuotas'
                : 'Registrar gasto con tarjeta'
            : 'Guardar transaccion'

    useEffect(() => {
        if (!open) return

        setCategoryManuallySet(false)
        setAutoSelectedCategoryId(null)
        setCategoryRuleLocked(false)
        setAppliedRuleName(null)
        setCategoryQuery('')
        setShowAllCategories(false)
        setFirstMonthError(null)
        setInstallmentQuoteAmount(0)
        setAdditionalCardPaymentEnabled(false)
        setSecondaryCardPaymentAmount(0)
        setCardPaymentMode('full')
        setCardPaymentSelection('ars')
        cardPaymentPartialDraftRef.current = null
        setExchangeDestinationAmount(0)
        setExchangeDestinationCurrency('USD')
        setExchangeRate(0)
        setExchangeRecalcMode('destinationAmount')
        setNavigationDirection(1)
        setCurrentStepIndex(0)
        setStepErrorsVisible({})

        if (transaction) {
            const normalizedType =
                (normalizeLegacyTransactionType(transaction.type) ?? transaction.type) as TransactionFormInput['type']
            const sourceId = resolveId(transaction.sourceAccountId)
            const destinationId = resolveId(transaction.destinationAccountId)
            const sourceAccount = accounts.find((account) => account._id.toString() === sourceId)

            reset({
                type: normalizedType,
                amount: Math.abs(transaction.amount),
                currency: transaction.currency,
                date: new Date(transaction.date),
                description: transaction.description,
                categoryId: resolveId(transaction.categoryId),
                sourceAccountId: sourceId,
                destinationAccountId: destinationId,
                destinationAmount: transaction.destinationAmount,
                destinationCurrency: transaction.destinationCurrency,
                exchangeRate: transaction.exchangeRate,
                notes: transaction.notes ?? '',
                merchant: transaction.merchant ?? '',
            })

            setAdjustmentSign(transaction.type === 'adjustment' && transaction.amount > 0 ? '-' : '+')
            setExchangeDestinationAmount(transaction.destinationAmount ?? 0)
            setExchangeDestinationCurrency(transaction.destinationCurrency ?? (transaction.currency === 'ARS' ? 'USD' : 'ARS'))
            setExchangeRate(transaction.exchangeRate ?? 0)
            setCardPaymentMode(normalizedType === 'credit_card_payment' ? 'partial' : 'full')
            setCardPaymentSelection('ars')
            cardPaymentPartialDraftRef.current = normalizedType === 'credit_card_payment'
                ? {
                    currency: transaction.currency === 'USD' ? 'USD' : 'ARS',
                    amount: Math.abs(transaction.amount),
                    additionalEnabled: false,
                    secondaryAmount: 0,
                }
                : null
            const isDescOptionalForType = ['transfer', 'exchange', 'credit_card_payment', 'adjustment'].includes(normalizedType)
            setShowMoreOptions(Boolean(transaction.notes || transaction.merchant || isDescOptionalForType))

            if (sourceAccount?.type === 'cash') setPaymentMethod('cash')
            else if (sourceAccount?.type === 'credit_card') setPaymentMethod('credit_card')
            else setPaymentMethod('debit')

            setInstallmentCount(existingInstallmentCount ?? 1)
            setFirstClosingMonth('')
            return
        }

        const storedType = getStoredTransactionType()
        const initialType = storedType && TRANSACTION_TYPE_LABELS[storedType] ? storedType : 'expense'
        const initialPaymentMethod = initialType === 'expense' ? getStoredExpensePaymentMethod() ?? 'debit' : 'debit'

        const nextDefaults: Partial<TransactionFormData> = {
            type: initialType,
            amount: 0,
            currency: 'ARS',
            date: new Date(),
            description: '',
            categoryId: undefined,
            sourceAccountId: undefined,
            destinationAccountId: undefined,
            destinationAmount: undefined,
            destinationCurrency: undefined,
            exchangeRate: undefined,
            notes: '',
            merchant: '',
        }

        reset(nextDefaults as TransactionFormInput)
        setPaymentMethod(initialPaymentMethod)
        setInstallmentCount(1)
        setFirstClosingMonth('')
        setShowMoreOptions(false)
        setAdjustmentSign('+')
        setCardPaymentMode('full')
        setCardPaymentSelection('ars')
        cardPaymentPartialDraftRef.current = null
    }, [
        accounts,
        existingInstallmentCount,
        getPreselectedExpenseAccount,
        open,
        reset,
        resolveStoredAccount,
        transaction,
    ])

    useEffect(() => {
        if (currentStepIndex <= steps.length - 1) return
        setCurrentStepIndex(steps.length - 1)
    }, [currentStepIndex, steps.length])

    useEffect(() => {
        if (!hasReachedClassificationStep || categoryRuleLocked) return
        setCategoryRuleLocked(true)
    }, [categoryRuleLocked, hasReachedClassificationStep])

    useEffect(() => {
        if (!showCategory && categoryId) {
            setValue('categoryId', undefined, { shouldValidate: true })
            setCategoryManuallySet(false)
            setAutoSelectedCategoryId(null)
        }
    }, [categoryId, setValue, showCategory])

    useEffect(() => {
        if (!showCategory || !categoryId) return
        const categoryStillValid = filteredCategories.some((category) => category._id.toString() === categoryId)
        if (categoryStillValid) return

        setValue('categoryId', undefined, { shouldValidate: true })
        setCategoryManuallySet(false)
        setAutoSelectedCategoryId(null)
        setAppliedRuleName(null)
    }, [categoryId, filteredCategories, setValue, showCategory])

    useEffect(() => {
        if (type !== 'credit_card_payment' || !destinationAccountId || !paymentMonth) {
            setPaymentSummary(null)
            return
        }

        let cancelled = false

        const fetchPaymentSummary = async () => {
            try {
                const response = await fetch(
                    `/api/credit-cards/payment-summary?cardId=${destinationAccountId}&month=${paymentMonth}&currency=${currency}`,
                    { cache: 'no-store' }
                )
                const data = await response.json()
                if (!response.ok || cancelled) return
                setPaymentSummary(data.summary ?? null)
            } catch {
                if (!cancelled) setPaymentSummary(null)
            }
        }

        void fetchPaymentSummary()

        return () => {
            cancelled = true
        }
    }, [currency, destinationAccountId, open, paymentMonth, type])

    useEffect(() => {
        if (!showSource) setValue('sourceAccountId', undefined, { shouldValidate: true })
        if (!showDestination) setValue('destinationAccountId', undefined, { shouldValidate: true })
        if (type !== 'exchange') {
            setValue('destinationAmount', undefined, { shouldValidate: true })
            setValue('destinationCurrency', undefined, { shouldValidate: true })
            setValue('exchangeRate', undefined, { shouldValidate: true })
        }
    }, [setValue, showDestination, showSource, type])

    useEffect(() => {
        if (!isExpense || (!isEditing && !hasReachedDetailsStep)) return
        const defaultExpenseAccount =
            resolveStoredAccount(getSourceAccountContext('expense', paymentMethod), expenseAccounts)
            ?? getPreselectedExpenseAccount(paymentMethod)
        const compatible = expenseAccounts.some((account) => account._id.toString() === sourceAccountId)

        if (!sourceAccountId) {
            if (defaultExpenseAccount) {
                setValue('sourceAccountId', defaultExpenseAccount._id.toString(), { shouldValidate: true })
            }
            return
        }

        if (!compatible) {
            setValue('sourceAccountId', defaultExpenseAccount?._id.toString() ?? undefined, { shouldValidate: true })
        }
    }, [
        expenseAccounts,
        getPreselectedExpenseAccount,
        hasReachedDetailsStep,
        isExpense,
        isEditing,
        paymentMethod,
        resolveStoredAccount,
        setValue,
        sourceAccountId,
    ])

    useEffect(() => {
        if ((!isEditing && !hasReachedDetailsStep) || !open || isExpense) return

        if (showSource) {
            const sourceContext = getSourceAccountContext(type, paymentMethod)
            const preferredSource = resolveStoredAccount(sourceContext, suggestedAccounts) ?? suggestedAccounts[0]
            const isCurrentValid = suggestedAccounts.some((account) => account._id.toString() === sourceAccountId)

            if (!isCurrentValid) {
                setValue('sourceAccountId', preferredSource?._id.toString() ?? undefined, { shouldValidate: true })
            }
        }

        if (showDestination) {
            const destinationContext = getDestinationAccountContext(type)
            const preferredDestination = resolveStoredAccount(destinationContext, destinationAccounts) ?? destinationAccounts[0]
            const isCurrentValid = destinationAccounts.some((account) => account._id.toString() === destinationAccountId)

            if (!isCurrentValid) {
                setValue('destinationAccountId', preferredDestination?._id.toString() ?? undefined, { shouldValidate: true })
            }
        }
    }, [
        destinationAccountId,
        destinationAccounts,
        hasReachedDetailsStep,
        isEditing,
        isExpense,
        open,
        paymentMethod,
        resolveStoredAccount,
        setValue,
        showDestination,
        showSource,
        sourceAccountId,
        suggestedAccounts,
        type,
    ])

    useEffect(() => {
        if (allowedCurrencies.length > 0 && !allowedCurrencies.includes(currency)) {
            setValue('currency', allowedCurrencies[0], { shouldValidate: true })
        }
    }, [allowedCurrencies, currency, setValue])

    useEffect(() => {
        if (!isExchange) return

        setValue('destinationCurrency', exchangeDestinationCurrency)
        setValue('destinationAmount', exchangeDestinationAmount || undefined)
        setValue('exchangeRate', exchangeRate || undefined)

        if (!description.trim()) {
            setValue('description', 'Cambio manual')
        }
    }, [
        description,
        exchangeDestinationAmount,
        exchangeDestinationCurrency,
        exchangeRate,
        isExchange,
        setValue,
    ])

    useEffect(() => {
        if (
            !isExchange ||
            !selectedSourceAccount ||
            !selectedDestinationAccount ||
            currentExchangeDirectionSupported
        ) {
            return
        }

        const nextDirection =
            exchangeSupportedDirections.find(
                (direction) => direction.source === exchangeDestinationCurrency && direction.destination === currency
            ) ?? exchangeSupportedDirections[0]

        if (!nextDirection) return

        setExchangeRecalcMode('destinationAmount')
        setValue('currency', nextDirection.source, { shouldValidate: true, shouldDirty: true })
        setValue('amount', exchangeDestinationAmount, { shouldValidate: true, shouldDirty: true })
        setExchangeDestinationCurrency(nextDirection.destination)
        setValue('destinationCurrency', nextDirection.destination, { shouldValidate: true, shouldDirty: true })
        setExchangeDestinationAmount(amount)
        setValue('destinationAmount', amount || undefined, { shouldValidate: true, shouldDirty: true })
    }, [
        amount,
        currency,
        currentExchangeDirectionSupported,
        exchangeDestinationAmount,
        exchangeDestinationCurrency,
        exchangeSupportedDirections,
        isExchange,
        selectedDestinationAccount,
        selectedSourceAccount,
        setValue,
    ])

    useEffect(() => {
        if (!isExchange || exchangeDestinationCurrency === currency || amount <= 0) return

        if (exchangeRecalcMode === 'destinationAmount' && exchangeRate > 0) {
            const nextDestinationAmount = currency === 'ARS' ? amount / exchangeRate : amount * exchangeRate
            if (Math.abs(nextDestinationAmount - exchangeDestinationAmount) > 0.0001) {
                setExchangeDestinationAmount(nextDestinationAmount)
                setValue('destinationAmount', nextDestinationAmount, { shouldValidate: true, shouldDirty: true })
            }
            return
        }

        if (exchangeRecalcMode === 'exchangeRate' && exchangeDestinationAmount > 0) {
            const nextRate = getArsPerUsdRate({
                sourceCurrency: currency,
                sourceAmount: amount,
                destinationCurrency: exchangeDestinationCurrency,
                destinationAmount: exchangeDestinationAmount,
            })

            if (Math.abs(nextRate - exchangeRate) > 0.0001) {
                setExchangeRate(nextRate)
                setValue('exchangeRate', nextRate, { shouldValidate: true, shouldDirty: true })
            }
        }
    }, [
        amount,
        currency,
        exchangeDestinationAmount,
        exchangeDestinationCurrency,
        exchangeRate,
        exchangeRecalcMode,
        isExchange,
        setValue,
    ])

    useEffect(() => {
        if (!canUseDualCardPayment) {
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
        }
    }, [canUseDualCardPayment])

    useEffect(() => {
        if (type !== 'credit_card_payment') {
            setCardPaymentMode('full')
            setCardPaymentSelection('ars')
            cardPaymentPartialDraftRef.current = null
        }
    }, [type])

    useEffect(() => {
        if (type !== 'credit_card_payment' || cardPaymentMode !== 'partial') return

        cardPaymentPartialDraftRef.current = {
            currency,
            amount,
            additionalEnabled: additionalCardPaymentEnabled,
            secondaryAmount: secondaryCardPaymentAmount,
        }
    }, [additionalCardPaymentEnabled, amount, cardPaymentMode, currency, secondaryCardPaymentAmount, type])

    const applyCardPaymentSelection = useCallback((selection: CardPaymentSelection) => {
        if (selection === 'ars' && arsCardPaymentPending > 0) {
            setValue('currency', 'ARS', { shouldValidate: true, shouldDirty: true })
            setValue('amount', arsCardPaymentPending, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
            return
        }

        if (selection === 'usd' && usdCardPaymentPending > 0) {
            setValue('currency', 'USD', { shouldValidate: true, shouldDirty: true })
            setValue('amount', usdCardPaymentPending, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
            return
        }

        if (selection === 'ars_usd' && arsCardPaymentPending > 0 && usdCardPaymentPending > 0) {
            setValue('currency', 'ARS', { shouldValidate: true, shouldDirty: true })
            setValue('amount', arsCardPaymentPending, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(true)
            setSecondaryCardPaymentAmount(usdCardPaymentPending)
        }
    }, [arsCardPaymentPending, setValue, usdCardPaymentPending])

    useEffect(() => {
        if (type !== 'credit_card_payment' || cardPaymentMode !== 'full' || !destinationAccountId || !paymentSummary) return

        if (cardPaymentAvailableSelections.length === 0) {
            setCardPaymentMode('partial')
            return
        }

        const nextSelection = cardPaymentAvailableSelections.includes(cardPaymentSelection)
            ? cardPaymentSelection
            : cardPaymentAvailableSelections[0]

        if (nextSelection !== cardPaymentSelection) {
            setCardPaymentSelection(nextSelection)
            return
        }

        applyCardPaymentSelection(nextSelection)
    }, [
        applyCardPaymentSelection,
        cardPaymentAvailableSelections,
        cardPaymentMode,
        cardPaymentSelection,
        destinationAccountId,
        paymentSummary,
        type,
    ])

    useEffect(() => {
        if (transaction || !isQuickFlow || categoryManuallySet || categoryRuleLocked) return

        const activeRules = rules.filter((rule) => rule.isActive)
        if (activeRules.length === 0) {
            if (autoSelectedCategoryId && categoryId === autoSelectedCategoryId) {
                setValue('categoryId', undefined, { shouldValidate: true })
            }
            setAutoSelectedCategoryId(null)
            setAppliedRuleName(null)
            return
        }

        const { matched, rule } = evaluateRules(activeRules, { type: primaryFlowType, description, merchant })
        if (matched && rule) {
            const ruleCategoryId = resolveId(rule.categoryId)

            if (!ruleCategoryId) {
                if (autoSelectedCategoryId && categoryId === autoSelectedCategoryId) {
                    setValue('categoryId', undefined, { shouldValidate: true })
                }
                setAutoSelectedCategoryId(null)
                setAppliedRuleName(null)
                return
            }

            if (categoryId !== ruleCategoryId) {
                setValue('categoryId', ruleCategoryId, { shouldValidate: true })
            }

            setAutoSelectedCategoryId(ruleCategoryId)
            setAppliedRuleName(rule.name)
            return
        }

        if (autoSelectedCategoryId && categoryId === autoSelectedCategoryId) {
            setValue('categoryId', undefined, { shouldValidate: true })
        }
        setAutoSelectedCategoryId(null)
        setAppliedRuleName(null)
    }, [
        autoSelectedCategoryId,
        categoryId,
        categoryManuallySet,
        categoryRuleLocked,
        description,
        isQuickFlow,
        merchant,
        primaryFlowType,
        rules,
        setValue,
        transaction,
    ])

    useEffect(() => {
        if (!usesCardExpensePlanFlow || !date || firstClosingMonth) return
        const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
        const nextValue = formatMonthValue(next)
        if (monthOptions.some((option) => option.value === nextValue)) {
            setFirstClosingMonth(nextValue)
        }
    }, [date, firstClosingMonth, monthOptions, usesCardExpensePlanFlow])

    const handleDateChange = useCallback((selectedDate: Date | undefined) => {
        if (!selectedDate) return
        setValue('date', selectedDate, { shouldValidate: true, shouldDirty: true })
        setIsDatePopoverOpen(false)
        if (usesCardExpensePlanFlow && !firstClosingMonth) {
            const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
            setFirstClosingMonth(formatMonthValue(next))
            setFirstMonthError(null)
        }
    }, [firstClosingMonth, setValue, usesCardExpensePlanFlow])

    const handlePaymentMethodChange = useCallback((nextPaymentMethod: PaymentMethod) => {
        setPaymentMethod(nextPaymentMethod)
        const storedExpenseAccount =
            resolveStoredAccount(getSourceAccountContext('expense', nextPaymentMethod), expenseAccounts)
            ?? getPreselectedExpenseAccount(nextPaymentMethod)

        if (storedExpenseAccount) {
            setValue('sourceAccountId', storedExpenseAccount._id.toString(), {
                shouldValidate: true,
                shouldDirty: true,
            })
        }

        if (nextPaymentMethod !== 'credit_card') {
            setInstallmentCount(1)
            setFirstClosingMonth('')
            setFirstMonthError(null)
            setInstallmentQuoteAmount(0)
        }
    }, [expenseAccounts, getPreselectedExpenseAccount, resolveStoredAccount, setValue])

    const handleApplyInstallmentQuoteAmount = useCallback(() => {
        if (installmentCount <= 1 || installmentQuoteAmount <= 0) return
        setValue('amount', Number((installmentQuoteAmount * installmentCount).toFixed(2)), {
            shouldValidate: true,
            shouldDirty: true,
        })
    }, [installmentCount, installmentQuoteAmount, setValue])

    const handleTypeSelection = useCallback((nextType: TransactionFormInput['type']) => {
        setValue('type', nextType, { shouldValidate: true, shouldDirty: true })
        if (nextType === 'expense' && !isEditing) {
            setPaymentMethod(getStoredExpensePaymentMethod() ?? paymentMethod)
        }
        if (nextType === 'credit_card_payment') {
            setCardPaymentMode(isEditing ? 'partial' : 'full')
            setCardPaymentSelection('ars')
            cardPaymentPartialDraftRef.current = null
        }
        setCategoryManuallySet(false)
        setAutoSelectedCategoryId(null)
        setAppliedRuleName(null)
    }, [isEditing, paymentMethod, setValue])

    const handleSelectCategory = useCallback((nextCategoryId: string) => {
        setValue('categoryId', nextCategoryId, { shouldValidate: true, shouldDirty: true })
        setCategoryManuallySet(true)
        setAutoSelectedCategoryId(null)
        setAppliedRuleName(null)
    }, [setValue])

    const focusDescriptionField = useCallback(() => {
        const field = document.getElementById('description') as HTMLInputElement | null
        if (!field) return
        field.scrollIntoView({ behavior: 'smooth', block: 'center' })
        window.requestAnimationFrame(() => field.focus())
    }, [])

    const handleDescriptionChange = useCallback((value: string) => {
        setValue('description', value, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

    const handleAmountChange = useCallback((nextAmount: number) => {
        const normalizedAmount = type === 'adjustment' ? Math.abs(nextAmount) : nextAmount
        setValue('amount', normalizedAmount, { shouldValidate: true, shouldDirty: true })
    }, [setValue, type])

    const handleCurrencyChange = useCallback((value: TransactionFormInput['currency']) => {
        setValue('currency', value, { shouldValidate: true, shouldDirty: true })
        if (type === 'credit_card_payment' && additionalCardPaymentEnabled) {
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
        }
    }, [additionalCardPaymentEnabled, setValue, type])

    const handleSourceAccountChange = useCallback((value: string | undefined) => {
        setValue('sourceAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

    const handleDestinationAccountChange = useCallback((value: string | undefined) => {
        setValue('destinationAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

    const handleFirstClosingMonthChange = useCallback((value: string) => {
        setFirstClosingMonth(value)
        setFirstMonthError(null)
    }, [])

    const handleDestinationAmountChange = useCallback((nextAmount: number) => {
        setExchangeRecalcMode('exchangeRate')
        setExchangeDestinationAmount(nextAmount)
        setValue('destinationAmount', nextAmount, { shouldValidate: true, shouldDirty: true })

        if (amount > 0 && nextAmount > 0 && exchangeDestinationCurrency !== currency) {
            const nextRate = getArsPerUsdRate({
                sourceCurrency: currency,
                sourceAmount: amount,
                destinationCurrency: exchangeDestinationCurrency,
                destinationAmount: nextAmount,
            })
            setExchangeRate(nextRate)
            setValue('exchangeRate', nextRate, { shouldValidate: true, shouldDirty: true })
        }
    }, [amount, currency, exchangeDestinationCurrency, setValue])

    const handleExchangeRateChange = useCallback((nextRate: number) => {
        setExchangeRecalcMode('destinationAmount')
        setExchangeRate(nextRate)
        setValue('exchangeRate', nextRate || undefined, { shouldValidate: true, shouldDirty: true })

        if (amount > 0 && nextRate > 0 && exchangeDestinationCurrency !== currency) {
            const destAmount = currency === 'ARS' ? amount / nextRate : amount * nextRate
            setExchangeDestinationAmount(destAmount)
            setValue('destinationAmount', destAmount, { shouldValidate: true, shouldDirty: true })
        }
    }, [amount, currency, exchangeDestinationCurrency, setValue])

    const handleSwapExchangeDirection = useCallback(() => {
        if (!canSwapExchangeDirection) return

        const nextSourceCurrency = exchangeDestinationCurrency
        const nextSourceAmount = exchangeDestinationAmount
        const nextDestinationCurrency = currency
        const nextDestinationAmount = amount

        setExchangeRecalcMode('destinationAmount')
        setValue('currency', nextSourceCurrency, { shouldValidate: true, shouldDirty: true })
        setValue('amount', nextSourceAmount, { shouldValidate: true, shouldDirty: true })
        setExchangeDestinationCurrency(nextDestinationCurrency)
        setValue('destinationCurrency', nextDestinationCurrency, { shouldValidate: true, shouldDirty: true })
        setExchangeDestinationAmount(nextDestinationAmount)
        setValue('destinationAmount', nextDestinationAmount || undefined, { shouldValidate: true, shouldDirty: true })
        setValue('exchangeRate', exchangeRate || undefined, { shouldValidate: true, shouldDirty: true })
    }, [
        amount,
        canSwapExchangeDirection,
        currency,
        exchangeDestinationAmount,
        exchangeDestinationCurrency,
        exchangeRate,
        setValue,
    ])

    const handleCardPaymentModeChange = useCallback((nextMode: CardPaymentMode) => {
        if (nextMode === cardPaymentMode) return

        if (nextMode === 'partial') {
            const draft = cardPaymentPartialDraftRef.current ?? {
                currency,
                amount,
                additionalEnabled: additionalCardPaymentEnabled,
                secondaryAmount: secondaryCardPaymentAmount,
            }

            setCardPaymentMode('partial')
            setValue('currency', draft.currency, { shouldValidate: true, shouldDirty: true })
            setValue('amount', draft.amount, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(draft.additionalEnabled)
            setSecondaryCardPaymentAmount(draft.secondaryAmount)
            return
        }

        setCardPaymentMode('full')
        if (cardPaymentAvailableSelections.length > 0) {
            setCardPaymentSelection((currentSelection) =>
                cardPaymentAvailableSelections.includes(currentSelection)
                    ? currentSelection
                    : cardPaymentAvailableSelections[0]
            )
        }
    }, [
        additionalCardPaymentEnabled,
        amount,
        cardPaymentAvailableSelections,
        cardPaymentMode,
        currency,
        secondaryCardPaymentAmount,
        setValue,
    ])

    const handleCardPaymentSelectionChange = useCallback((nextSelection: CardPaymentSelection) => {
        setCardPaymentMode('full')
        setCardPaymentSelection(nextSelection)
    }, [])

    const handlePartialCardPaymentAmountChange = useCallback((targetCurrency: TransactionFormInput['currency'], nextAmount: number) => {
        const currentArsAmount =
            currency === 'ARS'
                ? amount
                : additionalCardPaymentEnabled && secondaryCardPaymentCurrency === 'ARS'
                    ? secondaryCardPaymentAmount
                    : 0
        const currentUsdAmount =
            currency === 'USD'
                ? amount
                : additionalCardPaymentEnabled && secondaryCardPaymentCurrency === 'USD'
                    ? secondaryCardPaymentAmount
                    : 0

        const nextArsAmount = targetCurrency === 'ARS' ? nextAmount : currentArsAmount
        const nextUsdAmount = targetCurrency === 'USD' ? nextAmount : currentUsdAmount
        const hasArsAmount = nextArsAmount > 0
        const hasUsdAmount = nextUsdAmount > 0

        if (hasArsAmount && hasUsdAmount && canUseDualCardPayment) {
            setValue('currency', 'ARS', { shouldValidate: true, shouldDirty: true })
            setValue('amount', nextArsAmount, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(true)
            setSecondaryCardPaymentAmount(nextUsdAmount)
            return
        }

        if (hasArsAmount) {
            setValue('currency', 'ARS', { shouldValidate: true, shouldDirty: true })
            setValue('amount', nextArsAmount, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
            return
        }

        if (hasUsdAmount) {
            setValue('currency', 'USD', { shouldValidate: true, shouldDirty: true })
            setValue('amount', nextUsdAmount, { shouldValidate: true, shouldDirty: true })
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
            return
        }

        setValue('currency', targetCurrency, { shouldValidate: true, shouldDirty: true })
        setValue('amount', 0, { shouldValidate: true, shouldDirty: true })
        setAdditionalCardPaymentEnabled(false)
        setSecondaryCardPaymentAmount(0)
    }, [
        additionalCardPaymentEnabled,
        amount,
        canUseDualCardPayment,
        currency,
        secondaryCardPaymentAmount,
        secondaryCardPaymentCurrency,
        setValue,
    ])

    const handleMerchantChange = useCallback((value: string) => {
        setValue('merchant', value, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

    const handleNotesChange = useCallback((value: string) => {
        setValue('notes', value, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

    const validateCurrentStep = useCallback(async () => {
        if (!currentStep) return true
        if (currentStep.id === 'main') {
            const fieldsToValidate: Array<keyof TransactionFormInput> = ['amount', 'currency', 'date']
            if (!descriptionIsOptional) fieldsToValidate.unshift('description')

            const valid = await trigger(fieldsToValidate)
            if (!valid && !descriptionIsOptional && !description.trim()) {
                focusDescriptionField()
            }
            return valid
        }

        if (currentStep.id === 'type') {
            return true
        }

        if (currentStep.id === 'details') {
            if (type === 'income') {
                const isValid = await trigger(['amount', 'currency', 'date', 'description', 'destinationAccountId'])
                if (!isValid && !description.trim()) {
                    focusDescriptionField()
                }
                return isValid
            }
            if (isExpense) {
                const valid = await trigger(['sourceAccountId'])
                if (!valid) return false
                if (usesCardExpensePlanFlow && !firstClosingMonth) {
                    setFirstMonthError('El mes de primera cuota es requerido')
                    return false
                }
                setFirstMonthError(null)
                return true
            }
            if (type === 'transfer') {
                const isValid = await trigger(['amount', 'currency', 'date', 'sourceAccountId', 'destinationAccountId'])
                if (!isValid) return false
                if (hasCrossCurrencyTransferConflict) return false
                return !transferBalanceError
            }
            if (type === 'exchange') {
                const isValid = await trigger(['amount', 'currency', 'date', 'sourceAccountId', 'destinationAccountId', 'destinationAmount', 'destinationCurrency', 'exchangeRate'])
                if (!isValid) return false
                return !exchangeConfigurationError
            }
            if (type === 'credit_card_payment') return trigger(['amount', 'currency', 'date', 'sourceAccountId', 'destinationAccountId'])
            if (type === 'adjustment') return trigger(['amount', 'currency', 'date', 'sourceAccountId'])
        }

        if (currentStep.id === 'classification') return true
        return true
    }, [
        currentStep,
        description,
        descriptionIsOptional,
        exchangeConfigurationError,
        focusDescriptionField,
        firstClosingMonth,
        hasCrossCurrencyTransferConflict,
        isExpense,
        transferBalanceError,
        trigger,
        type,
        usesCardExpensePlanFlow,
    ])

    const handleNextStep = useCallback(async () => {
        const isValid = await validateCurrentStep()
        if (!isValid) {
            if (currentStep) {
                setStepErrorsVisible((previous) => ({ ...previous, [currentStep.id]: true }))
            }
            return
        }
        if (isLastStep) return
        setNavigationDirection(1)
        setCurrentStepIndex((previous) => Math.min(previous + 1, steps.length - 1))
    }, [currentStep, isLastStep, steps.length, validateCurrentStep])

    const handleBackStep = useCallback(() => {
        if (!canGoBack) {
            onOpenChange(false)
            return
        }
        setNavigationDirection(-1)
        setCurrentStepIndex((previous) => Math.max(previous - 1, 0))
    }, [canGoBack, onOpenChange])

    const persistCreatePrefs = useCallback((
        payload: TransactionFormData,
        overrideType?: TransactionFormInput['type'],
        overridePaymentMethod?: PaymentMethod
    ) => {
        if (transaction) return
        persistTransactionDialogPrefs({
            type: overrideType ?? payload.type,
            paymentMethod: overridePaymentMethod ?? (isExpense ? paymentMethod : undefined),
            sourceAccountId: payload.sourceAccountId,
            destinationAccountId: payload.destinationAccountId,
            categoryId: payload.categoryId,
        })
    }, [isExpense, paymentMethod, transaction])

    const handleFormSubmit = async (data: TransactionFormData) => {
        if (usesCardExpensePlanFlow && onInstallmentSubmit) {
            if (!firstClosingMonth) {
                setFirstMonthError('El mes de primera cuota es requerido')
                return
            }

            setFirstMonthError(null)
            await onInstallmentSubmit({
                description: data.description ?? '',
                totalAmount: data.amount,
                currency: data.currency,
                installmentCount,
                accountId: data.sourceAccountId!,
                categoryId: data.categoryId,
                purchaseDate: data.date,
                firstClosingMonth,
                merchant: data.merchant,
                notes: data.notes,
            })

            if (!transaction) {
                persistTransactionDialogPrefs({
                    type: 'credit_card_expense',
                    paymentMethod: 'credit_card',
                    sourceAccountId: data.sourceAccountId,
                    categoryId: data.categoryId,
                })
            }
            return
        }

        if (data.type === 'exchange') {
            const finalExchangeData = {
                ...data,
                destinationAmount: exchangeDestinationAmount,
                destinationCurrency: exchangeDestinationCurrency,
                exchangeRate,
                description: data.description || 'Cambio manual',
            }

            await onSubmit(finalExchangeData)
            persistCreatePrefs(finalExchangeData)
            return
        }

        if (
            data.type === 'credit_card_payment' &&
            additionalCardPaymentEnabled &&
            secondaryCardPaymentCurrency &&
            secondaryCardPaymentAmount > 0 &&
            onBatchSubmit
        ) {
            const paymentGroupId = crypto.randomUUID()
            await onBatchSubmit([
                { ...data, paymentGroupId },
                {
                    ...data,
                    amount: secondaryCardPaymentAmount,
                    currency: secondaryCardPaymentCurrency,
                    paymentGroupId,
                },
            ])
            persistCreatePrefs(data)
            return
        }

        let finalData = data.type === 'expense' && paymentMethod === 'credit_card'
            ? { ...data, type: 'credit_card_expense' as TransactionFormInput['type'] }
            : data

        if (finalData.type === 'adjustment') {
            const absoluteAmount = Math.abs(finalData.amount)
            finalData = {
                ...finalData,
                amount: adjustmentSign === '+' ? -absoluteAmount : absoluteAmount,
            }
        }

        await onSubmit(finalData)
        persistCreatePrefs(finalData, finalData.type, isExpense ? paymentMethod : undefined)
    }

    const renderAmountStep = () => (
        <TransactionMainStep
            type={type}
            amount={amount}
            currency={currency}
            date={date}
            description={description}
            isExchange={isExchange}
            descriptionIsOptional={descriptionIsOptional}
            allowedCurrencies={allowedCurrencies}
            appliedRuleName={appliedRuleName}
            transaction={transaction}
            rules={rules}
            isDatePopoverOpen={isDatePopoverOpen}
            descriptionError={errors.description?.message}
            amountError={errors.amount?.message}
            onDescriptionChange={handleDescriptionChange}
            onAmountChange={handleAmountChange}
            onCurrencyChange={handleCurrencyChange}
            onDateChange={handleDateChange}
            onDatePopoverOpenChange={setIsDatePopoverOpen}
        />
    )

    const renderTypeStep = () => (
        <TransactionTypeStep
            type={type}
            primaryFlowType={primaryFlowType}
            isEditing={isEditing}
            isExpense={isExpense}
            paymentMethodLabel={paymentMethodLabel}
            existingInstallmentCount={existingInstallmentCount}
            headerSurface={headerSurface}
            onTypeSelect={handleTypeSelection}
        />
    )

    const renderExpenseDetails = () => (
        <TransactionExpenseDetailsStep
            paymentMethod={paymentMethod}
            isCardExpense={isCardExpense}
            sourceAccountId={sourceAccountId}
            expenseAccounts={expenseAccounts}
            sourceAccountIdError={errors.sourceAccountId?.message}
            isEditing={isEditing}
            installmentCount={installmentCount}
            firstClosingMonth={firstClosingMonth}
            firstMonthError={firstMonthError}
            monthOptions={monthOptions}
            installmentQuoteAmount={installmentQuoteAmount}
            installmentPlanSummary={installmentPlanSummary}
            installmentAmount={installmentAmount}
            planMonthsLabel={planMonthsLabel}
            currency={currency}
            fmtCurrency={fmtCurrency}
            onPaymentMethodChange={handlePaymentMethodChange}
            onSourceAccountChange={handleSourceAccountChange}
            onInstallmentCountChange={setInstallmentCount}
            onFirstClosingMonthChange={handleFirstClosingMonthChange}
            onInstallmentQuoteAmountChange={setInstallmentQuoteAmount}
            onApplyInstallmentQuoteAmount={handleApplyInstallmentQuoteAmount}
        />
    )


    const renderOtherDetails = () => (
        <TransactionOtherDetailsStep
            type={type}
            showSource={showSource}
            showDestination={showDestination}
            sourceAccountId={sourceAccountId}
            destinationAccountId={destinationAccountId}
            suggestedAccounts={suggestedAccounts}
            destinationAccounts={destinationAccounts}
            sourceAccountIdError={errors.sourceAccountId?.message}
            destinationAccountIdError={errors.destinationAccountId?.message}
            hasCrossCurrencyTransferConflict={hasCrossCurrencyTransferConflict}
            description={description}
            descriptionError={stepErrorsVisible.details || submitCount > 0 ? errors.description?.message : undefined}
            appliedRuleName={appliedRuleName}
            hasCategoryRules={rules.length > 0}
            exchangeDestinationAmount={exchangeDestinationAmount}
            exchangeDestinationCurrency={exchangeDestinationCurrency}
            exchangeRate={exchangeRate}
            currency={currency}
            destinationAmountError={errors.destinationAmount?.message}
            exchangeRateError={errors.exchangeRate?.message}
            paymentSummary={paymentSummary}
            allowCardPaymentFullMode={!isEditing}
            canUseDualCardPayment={canUseDualCardPayment}
            secondaryCardPaymentCurrency={secondaryCardPaymentCurrency}
            additionalCardPaymentEnabled={additionalCardPaymentEnabled}
            secondaryCardPaymentAmount={secondaryCardPaymentAmount}
            cardPaymentMode={cardPaymentMode}
            cardPaymentSelection={cardPaymentSelection}
            isEditing={isEditing}
            amount={amount}
            date={date}
            isDatePopoverOpen={isDatePopoverOpen}
            amountError={stepErrorsVisible.details || submitCount > 0 ? errors.amount?.message : undefined}
            dateError={stepErrorsVisible.details || submitCount > 0 ? errors.date?.message : undefined}
            exchangeConfigurationError={exchangeConfigurationError}
            canSwapExchangeDirection={canSwapExchangeDirection}
            transferSourceLabel={selectedSourceAccount?.name}
            transferDestinationLabel={selectedDestinationAccount?.name}
            transferBalanceCurrency={transferBalanceCurrency}
            transferSourceBalance={transferSourceBalance}
            transferDestinationBalance={transferDestinationBalance}
            transferSourceResultingBalance={transferSourceResultingBalance}
            transferDestinationResultingBalance={transferDestinationResultingBalance}
            transferBalanceError={transferBalanceError}
            allowedCurrencies={allowedCurrencies}
            adjustmentSign={adjustmentSign}
            showErrors={stepErrorsVisible.details || submitCount > 0}
            fmtCurrency={fmtCurrency}
            onAmountChange={handleAmountChange}
            onCurrencyChange={handleCurrencyChange}
            onDateChange={handleDateChange}
            onDatePopoverOpenChange={setIsDatePopoverOpen}
            onDescriptionChange={handleDescriptionChange}
            onCardPaymentModeChange={handleCardPaymentModeChange}
            onCardPaymentSelectionChange={handleCardPaymentSelectionChange}
            onPartialCardPaymentAmountChange={handlePartialCardPaymentAmountChange}
            onSourceAccountChange={handleSourceAccountChange}
            onDestinationAccountChange={handleDestinationAccountChange}
            onSwitchToExchange={() => handleTypeSelection('exchange')}
            onDestinationAmountChange={handleDestinationAmountChange}
            onExchangeRateChange={handleExchangeRateChange}
            onSwapExchangeDirection={handleSwapExchangeDirection}
            onAdjustmentSignChange={setAdjustmentSign}
        />
    )

    const renderClassificationStep = () => (
        <TransactionClassificationStep
            type={type}
            showCategory={showCategory}
            categoryId={categoryId}
            appliedRuleName={appliedRuleName}
            categoryQuery={categoryQuery}
            showAllCategories={showAllCategories}
            normalizedCategoryQuery={normalizedCategoryQuery}
            filteredCategories={filteredCategories}
            recentCategories={recentCategories}
            suggestedCategories={suggestedCategories}
            extraCategories={extraCategories}
            selectedCategory={selectedCategory}
            onCategorySelect={handleSelectCategory}
            onCategoryQueryChange={setCategoryQuery}
            onToggleShowAllCategories={() => setShowAllCategories((previous) => !previous)}
        />
    )

    const renderReviewStep = () => (
        <TransactionReviewStep
            type={type}
            primaryFlowType={primaryFlowType}
            isExpense={isExpense}
            isEditing={!!transaction}
            amount={amount}
            date={date}
            description={description}
            currency={currency}
            showSource={showSource}
            showDestination={showDestination}
            showCategory={showCategory}
            descriptionIsOptional={descriptionIsOptional}
            selectedSourceAccount={selectedSourceAccount}
            selectedDestinationAccount={selectedDestinationAccount}
            selectedCategory={selectedCategory}
            exchangeDestinationAmount={exchangeDestinationAmount}
            exchangeDestinationCurrency={exchangeDestinationCurrency}
            exchangeRate={exchangeRate}
            transferBalanceCurrency={transferBalanceCurrency}
            transferSourceBalance={transferSourceBalance}
            transferDestinationBalance={transferDestinationBalance}
            transferSourceResultingBalance={transferSourceResultingBalance}
            transferDestinationResultingBalance={transferDestinationResultingBalance}
            paymentSummary={paymentSummary}
            cardPaymentMode={cardPaymentMode}
            cardPaymentSelection={cardPaymentSelection}
            secondaryCardPaymentCurrency={secondaryCardPaymentCurrency}
            additionalCardPaymentEnabled={additionalCardPaymentEnabled}
            secondaryCardPaymentAmount={secondaryCardPaymentAmount}
            adjustmentSign={adjustmentSign}
            usesCardExpensePlanFlow={usesCardExpensePlanFlow}
            existingInstallmentCount={existingInstallmentCount}
            installmentPlanSummary={installmentPlanSummary}
            installmentCount={installmentCount}
            installmentAmount={installmentAmount}
            planMonthsLabel={planMonthsLabel}
            merchant={merchant}
            notes={notes}
            showMoreOptions={showMoreOptions}
            showOptionalDescriptionField={descriptionIsOptional && isEditing}
            headerSurface={headerSurface}
            paymentMethodLabel={paymentMethodLabel}
            descriptionError={errors.description?.message}
            fmtCurrency={fmtCurrency}
            onToggleMoreOptions={() => setShowMoreOptions((previous) => !previous)}
            onDescriptionChange={handleDescriptionChange}
            onMerchantChange={handleMerchantChange}
            onNotesChange={handleNotesChange}
        />
    )


    const renderCurrentStep = () => {
        if (!currentStep) return null
        if (currentStep.id === 'type') return renderTypeStep()
        if (currentStep.id === 'main') return renderAmountStep()
        if (currentStep.id === 'details') return isExpense ? renderExpenseDetails() : renderOtherDetails()
        if (currentStep.id === 'classification') return renderClassificationStep()
        return renderReviewStep()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" showCloseButton={false} className="overflow-hidden p-0 sm:h-[min(92vh,860px)] sm:max-w-[72rem]">
                <DialogHeader
                    className="shrink-0 border-b px-4 py-2 md:px-6 md:py-3"
                    style={{
                        borderColor: 'var(--border)',
                        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <DialogTitle className="text-[1.02rem] tracking-tight">{transaction ? 'Editar transaccion' : 'Nueva transaccion'}</DialogTitle>
                                <span className="inline-flex items-center rounded-full border border-border/70 bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                    {currentStepIndex + 1} / {steps.length}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span
                                    className="inline-flex items-center rounded-full border px-2.5 py-1 font-medium"
                                    style={{
                                        borderColor: 'color-mix(in srgb, var(--border) 78%, transparent)',
                                        background: 'color-mix(in srgb, var(--secondary) 80%, transparent)',
                                        color: headerSurface.color,
                                    }}
                                >
                                    {primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                                </span>
                                {showHeaderPaymentMethod && <span className="inline-flex items-center rounded-full border border-border/70 bg-secondary/45 px-2.5 py-1 text-muted-foreground">{paymentMethodLabel}</span>}
                                {showHeaderInstallmentSummary && <span className="inline-flex items-center rounded-full border border-border/70 bg-secondary/45 px-2.5 py-1 text-muted-foreground">{installmentPlanSummary}</span>}
                            </div>
                        </div>

                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>

                    <div className="mt-2 flex gap-1">
                        {steps.map((step, index) => {
                            const completed = index < currentStepIndex
                            const active = index === currentStepIndex

                            return (
                                <div
                                    key={step.id}
                                    className="h-1.5 flex-1 rounded-full transition-all"
                                    style={{
                                        background: active
                                            ? 'var(--sky)'
                                            : completed
                                                ? 'color-mix(in srgb, var(--sky) 42%, var(--border))'
                                                : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                    }}
                                />
                            )
                        })}
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-20 pt-3 md:px-6 md:pb-24 md:pt-4">
                        <AnimatePresence custom={navigationDirection} initial={false} mode="wait">
                            <motion.div
                                key={currentStep?.id}
                                custom={navigationDirection}
                                variants={stepMotionVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="min-h-full"
                                data-testid={`transaction-step-${currentStep?.id ?? 'unknown'}`}
                            >
                                {renderCurrentStep()}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="shrink-0 border-t bg-background/95 px-4 pb-3.5 pt-2.5 backdrop-blur md:px-6 md:pb-4" style={{ borderColor: 'var(--border)', boxShadow: '0 -12px 28px rgba(0,0,0,0.10)' }}>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 flex-1 rounded-[1rem] border-border/80 bg-[color-mix(in_srgb,var(--background)_88%,var(--card)_12%)] font-medium"
                                onClick={handleBackStep}
                                data-testid="transaction-step-back"
                            >
                                {canGoBack ? 'Atras' : 'Cancelar'}
                            </Button>

                            {isLastStep ? (
                                <Button
                                    type="button"
                                    className="h-10 flex-[1.25] rounded-[1rem] font-semibold shadow-[0_8px_20px_rgba(74,158,204,0.14)]"
                                    disabled={isSubmitting}
                                    data-testid="transaction-step-submit"
                                    onClick={() => { void handleSubmit(handleFormSubmit)() }}
                                >
                                    {isSubmitting ? <><Spinner className="mr-2" />Guardando...</> : submitLabel}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    className="h-10 flex-[1.25] rounded-[1rem] font-semibold shadow-[0_8px_20px_rgba(74,158,204,0.14)]"
                                    onClick={() => { void handleNextStep() }}
                                    data-testid="transaction-step-next"
                                >
                                    {currentStepIndex === steps.length - 2 ? 'Ver resumen' : 'Continuar'}
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
