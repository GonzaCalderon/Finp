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
    getAccountCurrencyLabel,
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
    title: string
    subtitle: string
}

type CurrencyOption = TransactionFormInput['currency']

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

const QUICK_TYPES: TransactionFormInput['type'][] = ['expense', 'income']
const SECONDARY_TYPES: TransactionFormInput['type'][] = ['transfer', 'exchange', 'credit_card_payment', 'adjustment']
const SECONDARY_TYPE_LABELS: Partial<Record<TransactionFormInput['type'], string>> = {
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
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
    const steps: TransactionStep[] = [
        {
            id: 'main',
            title: 'Descripcion, monto y fecha',
            subtitle: isEditing
                ? 'Los datos principales van primero para revisar mas rapido.'
                : 'Arrancamos con el dato principal para ayudar a las reglas.',
        },
        {
            id: 'type',
            title: 'Que queres registrar',
            subtitle: isEditing
                ? 'El tipo queda visible pero fijo para no alterar el historial.'
                : 'Despues elegis el tipo del movimiento.',
        },
    ]

    if (type === 'income') {
        steps.push({ id: 'details', title: 'Donde entra', subtitle: 'Elegi la cuenta que recibe este ingreso.' })
    } else if (isExpense) {
        steps.push({ id: 'details', title: 'Como lo pagaste', subtitle: 'Te mostramos solo lo necesario para ese medio de pago.' })
    } else if (type === 'transfer') {
        steps.push({ id: 'details', title: 'Entre que cuentas', subtitle: 'Elegi origen y destino para registrar el pase.' })
    } else if (type === 'exchange') {
        steps.push({ id: 'details', title: 'Como fue el cambio', subtitle: 'Guardamos origen, destino y cotizacion para que quede claro.' })
    } else if (type === 'credit_card_payment') {
        steps.push({ id: 'details', title: 'Que tarjeta pagaste', subtitle: 'Vas a elegir la tarjeta y el origen del pago.' })
    } else if (type === 'adjustment') {
        steps.push({ id: 'details', title: 'Donde impacta', subtitle: 'Elegis la cuenta y el impacto del ajuste.' })
    }

    if (showClassification) {
        steps.push({ id: 'classification', title: 'Categoria', subtitle: 'Elegi la categoria con sugerencias y busqueda simple.' })
    }

    steps.push({
        id: 'review',
        title: isEditing ? 'Revisar cambios' : 'Revisar',
        subtitle: 'Un ultimo vistazo antes de guardar.',
    })

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
    const [exchangeDestinationAmount, setExchangeDestinationAmount] = useState(0)
    const [exchangeDestinationCurrency, setExchangeDestinationCurrency] = useState<TransactionFormInput['currency']>('USD')
    const [exchangeRate, setExchangeRate] = useState(0)
    const [exchangeRecalcMode, setExchangeRecalcMode] = useState<'destinationAmount' | 'exchangeRate'>('destinationAmount')
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [navigationDirection, setNavigationDirection] = useState(1)
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)
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
    const hasReachedDetailsStep = detailsStepIndex >= 0 && currentStepIndex >= detailsStepIndex
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

    const allowedExchangeDestinationCurrencies = useMemo(() => {
        return (['ARS', 'USD'] as const).filter((candidate) => {
            if (candidate === currency) return false
            if (!selectedDestinationAccount) return true
            return supportsCurrency(selectedDestinationAccount, candidate)
        })
    }, [currency, selectedDestinationAccount])

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

    const secondaryCardPaymentSummary = secondaryCardPaymentCurrency
        ? paymentSummary?.byCurrency?.[secondaryCardPaymentCurrency] ?? null
        : null

    const canUseDualCardPayment =
        !isEditing &&
        type === 'credit_card_payment' &&
        Boolean(secondaryCardPaymentCurrency)

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
        setAppliedRuleName(null)
        setCategoryQuery('')
        setShowAllCategories(false)
        setFirstMonthError(null)
        setInstallmentQuoteAmount(0)
        setAdditionalCardPaymentEnabled(false)
        setSecondaryCardPaymentAmount(0)
        setExchangeDestinationAmount(0)
        setExchangeDestinationCurrency('USD')
        setExchangeRate(0)
        setExchangeRecalcMode('destinationAmount')
        setNavigationDirection(1)
        setCurrentStepIndex(0)

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
        if (!showCategory && categoryId) {
            setValue('categoryId', undefined, { shouldValidate: true })
            setCategoryManuallySet(false)
        }
    }, [categoryId, setValue, showCategory])

    useEffect(() => {
        if (type !== 'credit_card_payment' || !destinationAccountId || !paymentMonth) {
            setPaymentSummary(null)
            return
        }

        let cancelled = false

        const fetchPaymentSummary = async () => {
            try {
                const response = await fetch(
                    `/api/credit-cards/payment-summary?cardId=${destinationAccountId}&month=${paymentMonth}&currency=${currency}`
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
    }, [currency, destinationAccountId, paymentMonth, type])

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

        setValue('destinationCurrency', exchangeDestinationCurrency, { shouldValidate: true })
        setValue('destinationAmount', exchangeDestinationAmount || undefined, { shouldValidate: true })
        setValue('exchangeRate', exchangeRate || undefined, { shouldValidate: true })

        if (!description.trim()) {
            setValue('description', 'Cambio manual', { shouldValidate: true })
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
        if (!isExchange) return

        const nextDestinationCurrency =
            allowedExchangeDestinationCurrencies.includes(exchangeDestinationCurrency)
                ? exchangeDestinationCurrency
                : allowedExchangeDestinationCurrencies[0]

        if (nextDestinationCurrency && nextDestinationCurrency !== exchangeDestinationCurrency) {
            setExchangeDestinationCurrency(nextDestinationCurrency)
            setValue('destinationCurrency', nextDestinationCurrency, { shouldValidate: true, shouldDirty: true })
        }
    }, [
        allowedExchangeDestinationCurrencies,
        exchangeDestinationCurrency,
        isExchange,
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
        if (transaction || !isQuickFlow || categoryManuallySet) return

        const activeRules = rules.filter((rule) => rule.isActive)
        if (activeRules.length === 0) return

        const { matched, rule } = evaluateRules(activeRules, { type: primaryFlowType, description, merchant })
        if (matched && rule) {
            const ruleCategoryId = resolveId(rule.categoryId)
            if (ruleCategoryId) setValue('categoryId', ruleCategoryId, { shouldValidate: true })
            if (!merchant && rule.normalizeMerchant) {
                setValue('merchant', rule.normalizeMerchant, { shouldValidate: true })
            }
            setAppliedRuleName(rule.name)
        } else {
            setAppliedRuleName(null)
        }
    }, [
        categoryManuallySet,
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
        setCategoryManuallySet(false)
        setAppliedRuleName(null)
    }, [isEditing, paymentMethod, setValue])

    const handleSelectCategory = useCallback((nextCategoryId: string) => {
        setValue('categoryId', nextCategoryId, { shouldValidate: true, shouldDirty: true })
        setCategoryManuallySet(true)
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

    const handleNegativeInputDetected = useCallback(() => {
        if (type === 'adjustment') setAdjustmentSign('-')
    }, [type])

    const handleCurrencyChange = useCallback((value: TransactionFormInput['currency']) => {
        setValue('currency', value, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

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

    const handleExchangeDestinationCurrencyChange = useCallback((nextCurrency: TransactionFormInput['currency']) => {
        setExchangeRecalcMode('destinationAmount')
        setExchangeDestinationCurrency(nextCurrency)
        setValue('destinationCurrency', nextCurrency, { shouldValidate: true, shouldDirty: true })
    }, [setValue])

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

    const handleUseAmountFromSummary = useCallback((pendingAmount: number, summaryItemCurrency: string) => {
        if (summaryItemCurrency === currency) {
            setValue('amount', pendingAmount, { shouldValidate: true, shouldDirty: true })
            return
        }
        setAdditionalCardPaymentEnabled(true)
        setSecondaryCardPaymentAmount(pendingAmount)
    }, [currency, setValue])

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
            if (type === 'income') return trigger(['destinationAccountId'])
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
            if (type === 'transfer') return trigger(['sourceAccountId', 'destinationAccountId'])
            if (type === 'exchange') {
                return trigger(['sourceAccountId', 'destinationAccountId', 'destinationAmount', 'destinationCurrency', 'exchangeRate'])
            }
            if (type === 'credit_card_payment') return trigger(['sourceAccountId', 'destinationAccountId'])
            if (type === 'adjustment') return trigger(['sourceAccountId'])
        }

        if (currentStep.id === 'classification') return true
        return true
    }, [
        currentStep,
        description,
        descriptionIsOptional,
        focusDescriptionField,
        firstClosingMonth,
        isExpense,
        trigger,
        type,
        usesCardExpensePlanFlow,
    ])

    const handleNextStep = useCallback(async () => {
        const isValid = await validateCurrentStep()
        if (!isValid || isLastStep) return
        setNavigationDirection(1)
        setCurrentStepIndex((previous) => Math.min(previous + 1, steps.length - 1))
    }, [isLastStep, steps.length, validateCurrentStep])

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
            adjustmentSign={adjustmentSign}
            headerSurface={headerSurface}
            appliedRuleName={appliedRuleName}
            transaction={transaction}
            rules={rules}
            isDatePopoverOpen={isDatePopoverOpen}
            descriptionError={errors.description?.message}
            amountError={errors.amount?.message}
            onDescriptionChange={handleDescriptionChange}
            onAmountChange={handleAmountChange}
            onNegativeInputDetected={handleNegativeInputDetected}
            onCurrencyChange={handleCurrencyChange}
            onDateChange={handleDateChange}
            onDatePopoverOpenChange={setIsDatePopoverOpen}
            onAdjustmentSignChange={setAdjustmentSign}
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
            exchangeDestinationAmount={exchangeDestinationAmount}
            exchangeDestinationCurrency={exchangeDestinationCurrency}
            exchangeRate={exchangeRate}
            exchangeRecalcMode={exchangeRecalcMode}
            allowedExchangeDestinationCurrencies={allowedExchangeDestinationCurrencies}
            currency={currency}
            destinationAmountError={errors.destinationAmount?.message}
            exchangeRateError={errors.exchangeRate?.message}
            paymentSummary={paymentSummary}
            canUseDualCardPayment={canUseDualCardPayment}
            secondaryCardPaymentCurrency={secondaryCardPaymentCurrency}
            additionalCardPaymentEnabled={additionalCardPaymentEnabled}
            secondaryCardPaymentAmount={secondaryCardPaymentAmount}
            secondaryCardPaymentSummary={secondaryCardPaymentSummary}
            fmtCurrency={fmtCurrency}
            onSourceAccountChange={handleSourceAccountChange}
            onDestinationAccountChange={handleDestinationAccountChange}
            onSwitchToExchange={() => handleTypeSelection('exchange')}
            onDestinationAmountChange={handleDestinationAmountChange}
            onExchangeDestinationCurrencyChange={handleExchangeDestinationCurrencyChange}
            onExchangeRateChange={handleExchangeRateChange}
            onRecalcModeChange={setExchangeRecalcMode}
            onUseAmountFromSummary={handleUseAmountFromSummary}
            onAdditionalCardPaymentToggle={setAdditionalCardPaymentEnabled}
            onSecondaryCardPaymentAmountChange={setSecondaryCardPaymentAmount}
        />
    )

    const renderClassificationStep = () => (
        <TransactionClassificationStep
            type={type}
            showCategory={showCategory}
            categoryId={categoryId}
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
            paymentSummary={paymentSummary}
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
        if (currentStep.id === 'main') return renderAmountStep()
        if (currentStep.id === 'type') return renderTypeStep()
        if (currentStep.id === 'details') return isExpense ? renderExpenseDetails() : renderOtherDetails()
        if (currentStep.id === 'classification') return renderClassificationStep()
        return renderReviewStep()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent variant="fullscreen-mobile" showCloseButton={false} className="overflow-hidden p-0 sm:max-w-4xl sm:h-[min(92vh,860px)]">
                <DialogHeader
                    className="shrink-0 border-b px-4 pb-4 pt-5 md:px-6"
                    style={{
                        borderColor: 'var(--border)',
                        background: 'color-mix(in srgb, var(--background) 92%, transparent)',
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <DialogTitle className="text-[1.12rem] tracking-tight">{transaction ? 'Editar transaccion' : 'Nueva transaccion'}</DialogTitle>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 font-medium" style={{ background: headerSurface.background, color: headerSurface.color }}>
                                    {primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                                </span>
                                {showHeaderPaymentMethod && <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{paymentMethodLabel}</span>}
                                {showHeaderInstallmentSummary && <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{installmentPlanSummary}</span>}
                            </div>
                        </div>

                        <div className="space-y-2 text-right">
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Cancelar
                            </button>
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Paso {currentStepIndex + 1} de {steps.length}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{currentStep?.title}</p>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                        {steps.map((step, index) => {
                            const completed = index < currentStepIndex
                            const active = index === currentStepIndex

                            return (
                                <div
                                    key={step.id}
                                    className="h-2 flex-1 rounded-full transition-all"
                                    style={{
                                        background: completed ? 'var(--sky)' : active ? 'color-mix(in srgb, var(--sky) 48%, var(--border))' : 'var(--border)',
                                    }}
                                />
                            )
                        })}
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit(handleFormSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-4 md:px-6 md:pb-32">
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

                    <div className="shrink-0 border-t bg-background/95 px-4 pb-4 pt-3 backdrop-blur md:px-6 md:pb-5" style={{ borderColor: 'var(--border)', boxShadow: '0 -14px 34px rgba(0,0,0,0.12)' }}>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" className="h-11 flex-1" onClick={handleBackStep} data-testid="transaction-step-back">
                                {canGoBack ? 'Atras' : 'Cancelar'}
                            </Button>

                            {isLastStep ? (
                                <Button
                                    type="button"
                                    className="h-11 flex-[1.3]"
                                    disabled={isSubmitting}
                                    data-testid="transaction-step-submit"
                                    onClick={() => { void handleSubmit(handleFormSubmit)() }}
                                >
                                    {isSubmitting ? <><Spinner className="mr-2" />Guardando...</> : submitLabel}
                                </Button>
                            ) : (
                                <Button type="button" className="h-11 flex-[1.3]" onClick={() => { void handleNextStep() }} data-testid="transaction-step-next">
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

