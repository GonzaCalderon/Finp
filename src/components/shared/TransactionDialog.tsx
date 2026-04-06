'use client'
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    ArrowLeftRight,
    Banknote,
    Building2,
    CalendarIcon,
    Check,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Minus,
    Plus,
    Search,
    Wand2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

import { Spinner } from '@/components/shared/Spinner'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
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

type TransactionStepId = 'type' | 'amount' | 'details' | 'classification' | 'review'

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
            id: 'amount',
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

function getTypeSurface(type: TransactionFormInput['type'], isExpense: boolean) {
    if (isExpense) {
        return { background: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.24)', color: '#DC2626' }
    }
    if (type === 'income') {
        return { background: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.24)', color: '#059669' }
    }
    return { background: 'rgba(74,158,204,0.10)', borderColor: 'rgba(74,158,204,0.24)', color: 'var(--sky)' }
}

const subtlePanelStyle = {
    borderColor: 'var(--border)',
    background: 'color-mix(in srgb, var(--card) 82%, transparent)',
}

function getSubtleSelectedStyle(selected: boolean) {
    return {
        borderColor: selected ? 'color-mix(in srgb, var(--border) 78%, var(--foreground) 22%)' : 'var(--border)',
        background: selected ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)' : 'transparent',
    }
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
            setShowMoreOptions(Boolean(transaction.notes || transaction.merchant || descriptionIsOptional))

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
        descriptionIsOptional,
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

    const validateCurrentStep = useCallback(async () => {
        if (!currentStep) return true
        if (currentStep.id === 'type') {
            const fieldsToValidate: Array<keyof TransactionFormInput> = ['amount', 'currency', 'date']
            if (!descriptionIsOptional) fieldsToValidate.unshift('description')

            const valid = await trigger(fieldsToValidate)
            if (!valid && !descriptionIsOptional && !description.trim()) {
                focusDescriptionField()
            }
            return valid
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
        <StepSection
            eyebrow="Paso 1"
            title="Descripcion, monto y fecha"
            subtitle="Arrancamos con el dato principal para que las reglas lleguen antes."
        >
            <div className="space-y-4">
                {!descriptionIsOptional && (
                    <div className="space-y-2 rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <Label htmlFor="description">Descripcion</Label>
                                <p className="text-xs text-muted-foreground">
                                    Es obligatoria. Una frase corta alcanza y nos ayuda a sugerir mejor la categoria.
                                </p>
                            </div>
                            {rules.length > 0 && !transaction && (
                                <span
                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                                    style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 92%, transparent)' }}
                                >
                                    <Wand2 className="h-3 w-3" />
                                    Reglas automaticas
                                </span>
                            )}
                        </div>

                        <Input
                            id="description"
                            value={description}
                            onChange={(event) =>
                                setValue('description', event.target.value, { shouldValidate: true, shouldDirty: true })
                            }
                            placeholder={type === 'income' ? 'Ej: Sueldo marzo' : 'Ej: Compra en kiosco'}
                            aria-invalid={Boolean(errors.description)}
                        />

                        {errors.description ? (
                            <p className="text-sm text-destructive">{errors.description.message}</p>
                        ) : appliedRuleName && !transaction ? (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Wand2 className="h-3 w-3" />
                                Regla aplicada: {appliedRuleName}
                            </p>
                        ) : null}
                    </div>
                )}

                <div
                    className="rounded-[2rem] border p-5"
                    style={{
                        borderColor: headerSurface.borderColor,
                        background: 'color-mix(in srgb, var(--card) 88%, transparent)',
                        boxShadow: 'var(--card-shadow)',
                    }}
                >
                    <FormattedAmountInput
                        id="amount"
                        label={isExchange ? 'Monto origen' : 'Monto'}
                        value={type === 'adjustment' && adjustmentSign === '-' ? -amount : amount}
                        currency={currency}
                        error={errors.amount?.message}
                        autoFocus
                        allowNegative={type === 'adjustment'}
                        onNegativeInputDetectedAction={() => {
                            if (type === 'adjustment') setAdjustmentSign('-')
                        }}
                        onValueChangeAction={(nextAmount) => {
                            const normalizedAmount = type === 'adjustment' ? Math.abs(nextAmount) : nextAmount
                            setValue('amount', normalizedAmount, { shouldValidate: true, shouldDirty: true })
                        }}
                    />
                </div>

                <div className={`grid gap-3 ${type === 'adjustment' ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]'}`}>
                    <div className="space-y-2">
                        <Label>{isExchange ? 'Moneda origen' : 'Moneda'}</Label>
                        <Select
                            value={currency}
                            onValueChange={(value) =>
                                setValue('currency', value as TransactionFormInput['currency'], {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                })
                            }
                            disabled={allowedCurrencies.length === 1}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allowedCurrencies.map((allowedCurrency) => (
                                    <SelectItem key={allowedCurrency} value={allowedCurrency}>
                                        {allowedCurrency}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {allowedCurrencies.length === 1 && (
                            <p className="text-xs text-muted-foreground">Se fija automaticamente segun la cuenta elegida.</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left">
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent forceMount className="w-auto p-0">
                                <AnimatePresence initial={false}>
                                    {isDatePopoverOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.normal, ease: easeSmooth } }}
                                            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: DURATION.fast, ease: easeSoft } }}
                                        >
                                            <Calendar mode="single" selected={date} onSelect={handleDateChange} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {type === 'adjustment' && (
                    <div className="rounded-3xl border p-4" style={subtlePanelStyle}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Impacto del ajuste</p>
                                <p className="text-xs text-muted-foreground">Positivo suma saldo. Negativo descuenta saldo.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: adjustmentSign === '-' ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                                    Negativo
                                </span>
                                <Switch
                                    checked={adjustmentSign === '+'}
                                    onCheckedChange={(checked) => setAdjustmentSign(checked ? '+' : '-')}
                                    aria-label="Cambiar impacto del ajuste"
                                />
                                <span className="text-xs font-medium" style={{ color: adjustmentSign === '+' ? '#059669' : 'var(--muted-foreground)' }}>
                                    Positivo
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </StepSection>
    )

    const renderTypeStep = () => {
        if (isEditing) {
            return (
                <StepSection
                    eyebrow="Paso 2"
                    title={primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                    subtitle="En la edicion mantenemos este tipo fijo para no romper el historial."
                >
                    <div
                        className="rounded-3xl border p-5"
                        style={{ background: headerSurface.background, borderColor: headerSurface.borderColor }}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
                                style={{ color: headerSurface.color, borderColor: headerSurface.borderColor }}
                            >
                                {primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                            </span>
                            {isExpense && (
                                <span className="inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                                    {paymentMethodLabel}
                                </span>
                            )}
                            {type === 'credit_card_expense' && existingInstallmentCount && (
                                <span className="inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                                    {existingInstallmentCount} cuota{existingInstallmentCount === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                    </div>
                </StepSection>
            )
        }

        return (
            <StepSection
                eyebrow="Paso 2"
                title="Que queres registrar"
                subtitle="Ahora elegi el tipo del movimiento."
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    {QUICK_TYPES.map((option) => {
                        const selected = primaryFlowType === option
                        const surface = getTypeSurface(option, option === 'expense')

                        return (
                            <ChoiceCard
                                key={option}
                                title={TRANSACTION_TYPE_LABELS[option]}
                                description={
                                    option === 'expense'
                                        ? 'Compra, pago o salida habitual.'
                                        : 'Entrada de dinero a una cuenta.'
                                }
                                selected={selected}
                                onClick={() => handleTypeSelection(option)}
                                dataTestId={`transaction-type-${option}`}
                                surface={surface}
                            />
                        )
                    })}
                </div>

                <div
                    className="space-y-3 rounded-3xl border p-4"
                    data-testid="transaction-more-types"
                    style={subtlePanelStyle}
                >
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Otros movimientos</p>
                        <p className="mt-1 text-sm text-muted-foreground">Siguen disponibles, solo con menos protagonismo visual.</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                        {SECONDARY_TYPES.map((option) => {
                            const selected = type === option
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => handleTypeSelection(option)}
                                    aria-pressed={selected}
                                    className="rounded-2xl border px-4 py-3 text-left transition-colors"
                                    data-testid={`transaction-type-${option}`}
                                    style={getSubtleSelectedStyle(selected)}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium">{SECONDARY_TYPE_LABELS[option]}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {option === 'transfer' && 'Mover entre cuentas propias.'}
                                                {option === 'exchange' && 'Registrar ARS/USD con cotizacion.'}
                                                {option === 'credit_card_payment' && 'Pagar resumen o deuda asociada.'}
                                                {option === 'adjustment' && 'Corregir un saldo puntual.'}
                                            </p>
                                        </div>
                                        {selected && (
                                            <span
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                                                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </StepSection>
        )
    }

    const renderExpenseDetails = () => (
        <StepSection
            eyebrow="Paso 3"
            title="Como lo pagaste"
            subtitle="Elegi el medio de pago y te mostramos solo lo necesario para ese caso."
        >
            <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-3">
                    {PAYMENT_METHODS.map((method) => {
                        const selected = paymentMethod === method.value
                        return (
                            <button
                                key={method.value}
                                type="button"
                                onClick={() => handlePaymentMethodChange(method.value)}
                                className="rounded-2xl border px-4 py-3 text-left transition-colors"
                                data-testid={`transaction-payment-${method.value}`}
                                style={{
                                    ...getSubtleSelectedStyle(selected),
                                    background: selected ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)' : 'var(--background)',
                                }}
                            >
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    {method.icon}
                                    <span>{method.label}</span>
                                </div>
                            </button>
                        )
                    })}
                </div>

                {isCardExpense ? (
                    <div className="space-y-4 rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        <div className="space-y-2">
                            <Label>Tarjeta</Label>
                            <Select
                                value={sourceAccountId}
                                onValueChange={(value) =>
                                    setValue('sourceAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona tarjeta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {expenseAccounts.map((account) => (
                                        <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                            {account.name} · {getAccountCurrencyLabel(account)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.sourceAccountId && <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p>}
                        </div>
                        {!isEditing && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Cuotas</Label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setInstallmentCount((previous) => Math.max(1, previous - 1))}
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors hover:bg-background"
                                                style={{ borderColor: 'var(--border)' }}
                                                aria-label="Reducir cuotas"
                                            >
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={installmentCount}
                                                onChange={(event) =>
                                                    setInstallmentCount(Math.max(1, parseInt(event.target.value, 10) || 1))
                                                }
                                                className="text-center text-base"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setInstallmentCount((previous) => previous + 1)}
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors hover:bg-background"
                                                style={{ borderColor: 'var(--border)' }}
                                                aria-label="Aumentar cuotas"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Primera cuota</Label>
                                        <Select
                                            value={firstClosingMonth}
                                            onValueChange={(value) => {
                                                setFirstClosingMonth(value)
                                                setFirstMonthError(null)
                                            }}
                                        >
                                            <SelectTrigger style={{ borderColor: firstMonthError ? 'var(--destructive)' : undefined }}>
                                                <SelectValue placeholder="Selecciona mes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {monthOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {firstMonthError && <p className="text-sm text-destructive">{firstMonthError}</p>}
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                    <FormattedAmountInput
                                        id="installmentQuoteAmount"
                                        label="Valor de cuota"
                                        value={installmentQuoteAmount}
                                        currency={currency}
                                        placeholder="Ej. valor del resumen"
                                        onValueChangeAction={setInstallmentQuoteAmount}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 self-end"
                                        onClick={handleApplyInstallmentQuoteAmount}
                                        disabled={installmentQuoteAmount <= 0}
                                    >
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        {installmentCount > 1 ? 'Calcular total' : 'Usar como monto'}
                                    </Button>
                                </div>
                            </>
                        )}

                        <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Resumen del plan</p>
                            <p className="mt-1 text-base font-semibold">{installmentPlanSummary}</p>
                            {installmentAmount > 0 && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {installmentCount} x {fmtCurrency(installmentAmount)}
                                </p>
                            )}
                            {planMonthsLabel && <p className="mt-1 text-xs text-muted-foreground">{planMonthsLabel}</p>}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2 rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        <Label>{paymentMethod === 'cash' ? 'Cuenta de efectivo' : 'Cuenta'}</Label>
                        <Select
                            value={sourceAccountId}
                            onValueChange={(value) =>
                                setValue('sourceAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={paymentMethod === 'cash' ? 'Selecciona cuenta de efectivo' : 'Selecciona cuenta'} />
                            </SelectTrigger>
                            <SelectContent>
                                {expenseAccounts.map((account) => (
                                    <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                        {account.name} · {getAccountCurrencyLabel(account)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.sourceAccountId && <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p>}
                    </div>
                )}
            </div>
        </StepSection>
    )

    const renderOtherDetails = () => (
        <StepSection
            eyebrow="Paso 3"
            title={
                type === 'income'
                    ? 'Donde entra'
                    : type === 'transfer'
                        ? 'Entre que cuentas'
                        : type === 'exchange'
                            ? 'Como fue el cambio'
                            : type === 'credit_card_payment'
                                ? 'Que tarjeta pagaste'
                                : 'Donde impacta'
            }
            subtitle={
                type === 'income'
                    ? 'Elegi la cuenta que recibe este ingreso.'
                    : type === 'transfer'
                        ? 'Elegi origen y destino. Si cambia la moneda, te proponemos usar cambio manual.'
                        : type === 'exchange'
                            ? 'Guardamos origen, destino y cotizacion para que quede bien registrado.'
                            : type === 'credit_card_payment'
                                ? 'Tomamos el saldo del mes y, si hace falta, te dejamos sumar un segundo pago.'
                                : 'Defini en que cuenta impacta este ajuste.'
            }
        >
            <div className="space-y-4">
                {!isExpense && showSource && (
                    <div className="space-y-2">
                        <Label>{type === 'exchange' ? 'Cuenta origen' : 'Cuenta de origen'}</Label>
                        <Select
                            value={sourceAccountId}
                            onValueChange={(value) =>
                                setValue('sourceAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona cuenta de origen" />
                            </SelectTrigger>
                            <SelectContent>
                                {suggestedAccounts.map((account) => (
                                    <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                        {account.name} · {getAccountCurrencyLabel(account)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.sourceAccountId && <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p>}
                    </div>
                )}

                {showDestination && type === 'income' && (
                    <div className="space-y-2">
                        <Label>Cuenta destino</Label>
                        <Select
                            value={destinationAccountId}
                            onValueChange={(value) =>
                                setValue('destinationAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona cuenta destino" />
                            </SelectTrigger>
                            <SelectContent>
                                {destinationAccounts.map((account) => (
                                    <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                        {account.name} · {getAccountCurrencyLabel(account)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.destinationAccountId && <p className="text-sm text-destructive">{errors.destinationAccountId.message}</p>}
                    </div>
                )}

                {showDestination && type !== 'income' && (
                    <div className="space-y-2">
                        <Label>{type === 'credit_card_payment' ? 'Tarjeta a pagar' : 'Cuenta destino'}</Label>
                        <Select
                            value={destinationAccountId}
                            onValueChange={(value) =>
                                setValue('destinationAccountId', value || undefined, { shouldValidate: true, shouldDirty: true })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={type === 'credit_card_payment' ? 'Selecciona tarjeta' : 'Selecciona cuenta destino'} />
                            </SelectTrigger>
                            <SelectContent>
                                {destinationAccounts.map((account) => (
                                    <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                        {account.name} · {getAccountCurrencyLabel(account)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.destinationAccountId && <p className="text-sm text-destructive">{errors.destinationAccountId.message}</p>}
                    </div>
                )}
                {hasCrossCurrencyTransferConflict && (
                    <div className="rounded-3xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.10)' }}>
                        <p className="text-amber-700 dark:text-amber-300">
                            Estas cuentas no comparten moneda. Conviene registrarlo como cambio manual para guardar la cotizacion usada.
                        </p>
                        <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => handleTypeSelection('exchange')}>
                            Pasar a cambio manual
                        </Button>
                    </div>
                )}

                {type === 'exchange' && (
                    <div className="space-y-4 rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                                Cambio manual ARS / USD
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className="rounded-full border px-3 py-1 text-xs font-medium"
                                    style={{
                                        borderColor: exchangeRecalcMode === 'destinationAmount' ? 'rgba(74,158,204,0.35)' : 'var(--border)',
                                        background: exchangeRecalcMode === 'destinationAmount' ? 'rgba(74,158,204,0.10)' : 'transparent',
                                    }}
                                    onClick={() => setExchangeRecalcMode('destinationAmount')}
                                >
                                    Recalcular destino
                                </button>
                                <button
                                    type="button"
                                    className="rounded-full border px-3 py-1 text-xs font-medium"
                                    style={{
                                        borderColor: exchangeRecalcMode === 'exchangeRate' ? 'rgba(74,158,204,0.35)' : 'var(--border)',
                                        background: exchangeRecalcMode === 'exchangeRate' ? 'rgba(74,158,204,0.10)' : 'transparent',
                                    }}
                                    onClick={() => setExchangeRecalcMode('exchangeRate')}
                                >
                                    Recalcular cotizacion
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                            <FormattedAmountInput
                                id="destinationAmount"
                                label="Monto destino"
                                value={exchangeDestinationAmount}
                                currency={exchangeDestinationCurrency}
                                error={errors.destinationAmount?.message}
                                onValueChangeAction={(nextAmount) => {
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
                                }}
                            />

                            <div className="space-y-2">
                                <Label>Moneda destino</Label>
                                <Select
                                    value={exchangeDestinationCurrency}
                                    onValueChange={(value) => {
                                        const nextCurrency = value as TransactionFormInput['currency']
                                        setExchangeRecalcMode('destinationAmount')
                                        setExchangeDestinationCurrency(nextCurrency)
                                        setValue('destinationCurrency', nextCurrency, { shouldValidate: true, shouldDirty: true })
                                    }}
                                    disabled={allowedExchangeDestinationCurrencies.length <= 1}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allowedExchangeDestinationCurrencies.map((allowedCurrency) => (
                                            <SelectItem key={allowedCurrency} value={allowedCurrency}>
                                                {allowedCurrency}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="exchangeRate">Cotizacion manual</Label>
                            <Input
                                id="exchangeRate"
                                type="number"
                                step="0.01"
                                placeholder="Ej: 1250"
                                value={exchangeRate || ''}
                                onChange={(event) => {
                                    const nextRate = event.target.value === '' ? 0 : Number(event.target.value)
                                    setExchangeRecalcMode('destinationAmount')
                                    setExchangeRate(nextRate)
                                    setValue('exchangeRate', nextRate || undefined, { shouldValidate: true, shouldDirty: true })

                                    if (amount > 0 && nextRate > 0 && exchangeDestinationCurrency !== currency) {
                                        const destinationAmount = currency === 'ARS' ? amount / nextRate : amount * nextRate
                                        setExchangeDestinationAmount(destinationAmount)
                                        setValue('destinationAmount', destinationAmount, { shouldValidate: true, shouldDirty: true })
                                    }
                                }}
                            />
                            <p className="text-xs text-muted-foreground">Guardamos la cotizacion usada para reconstruir el cambio en el futuro.</p>
                            {errors.exchangeRate && <p className="text-sm text-destructive">{errors.exchangeRate.message}</p>}
                        </div>
                    </div>
                )}

                {type === 'credit_card_payment' && paymentSummary && destinationAccountId && (
                    <div className="space-y-3 rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        {(Object.values(paymentSummary.byCurrency ?? {
                            [paymentSummary.currency as 'ARS' | 'USD']: paymentSummary,
                        }) as Array<{ due: number; paid: number; pending: number; currency: string }>).map((summaryItem) => {
                            const active = summaryItem.currency === currency

                            return (
                                <div
                                    key={summaryItem.currency}
                                    className="rounded-2xl border p-3"
                                    style={{
                                        borderColor: active ? 'rgba(74,158,204,0.35)' : 'var(--border)',
                                        background: active ? 'rgba(74,158,204,0.08)' : 'transparent',
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-medium">{summaryItem.currency}</span>
                                        {active && <span className="text-muted-foreground">moneda elegida</span>}
                                    </div>
                                    <SummaryLine label="Corresponde pagar este mes" value={fmtCurrency(summaryItem.due, summaryItem.currency as TransactionFormInput['currency'])} />
                                    <SummaryLine label="Ya pagado" value={fmtCurrency(summaryItem.paid, summaryItem.currency as TransactionFormInput['currency'])} />
                                    <SummaryLine label="Pendiente" value={fmtCurrency(summaryItem.pending, summaryItem.currency as TransactionFormInput['currency'])} />
                                    {summaryItem.pending > 0 && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-3 h-8 text-xs"
                                            onClick={() => {
                                                if (summaryItem.currency === currency) {
                                                    setValue('amount', summaryItem.pending, { shouldValidate: true, shouldDirty: true })
                                                    return
                                                }

                                                setAdditionalCardPaymentEnabled(true)
                                                setSecondaryCardPaymentAmount(summaryItem.pending)
                                            }}
                                        >
                                            Usar pendiente {summaryItem.currency}
                                        </Button>
                                    )}
                                </div>
                            )
                        })}

                        {canUseDualCardPayment && secondaryCardPaymentCurrency && (
                            <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold">Pago dual en una sola confirmacion</p>
                                        <p className="text-xs text-muted-foreground">
                                            Suma tambien un pago en {secondaryCardPaymentCurrency} sin salir de este flujo.
                                        </p>
                                    </div>
                                    <Switch checked={additionalCardPaymentEnabled} onCheckedChange={setAdditionalCardPaymentEnabled} />
                                </div>

                                {additionalCardPaymentEnabled && (
                                    <div className="mt-3 space-y-2">
                                        <FormattedAmountInput
                                            id="secondaryCardPaymentAmount"
                                            label={`Monto adicional en ${secondaryCardPaymentCurrency}`}
                                            value={secondaryCardPaymentAmount}
                                            currency={secondaryCardPaymentCurrency}
                                            placeholder="0"
                                            onValueChangeAction={setSecondaryCardPaymentAmount}
                                        />
                                        {secondaryCardPaymentSummary && (
                                            <SummaryLine
                                                label={`Pendiente ${secondaryCardPaymentCurrency}`}
                                                value={fmtCurrency(secondaryCardPaymentSummary.pending, secondaryCardPaymentCurrency)}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </StepSection>
    )

    const renderClassificationStep = () => (
        <StepSection
            eyebrow="Paso 4"
            title="Elegi la categoria"
            subtitle="Primero ves las mas probables y, si hace falta, abris el resto sin ruido."
        >
            <div className="space-y-5">
                {showCategory && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label>Categorias</Label>
                                <p className="text-xs text-muted-foreground">
                                    {type === 'income' ? 'Mostramos ingresos compatibles.' : 'Mostramos gastos compatibles.'}
                                </p>
                            </div>
                            {selectedCategory && (
                                <span
                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                                    style={{ background: selectedCategory.color || 'rgba(74,158,204,0.10)', color: '#fff' }}
                                >
                                    {selectedCategory.name}
                                </span>
                            )}
                        </div>

                        {filteredCategories.length > 6 && (
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={categoryQuery}
                                    onChange={(event) => setCategoryQuery(event.target.value)}
                                    placeholder="Buscar categoria"
                                    className="pl-9"
                                />
                            </div>
                        )}

                        {recentCategories.length > 0 && normalizedCategoryQuery.length === 0 && (
                            <div className="space-y-2">
                                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Recientes</p>
                                <div className="flex flex-wrap gap-2">
                                    {recentCategories.map((category) => (
                                        <CategoryChip
                                            key={`recent-${category._id.toString()}`}
                                            category={category}
                                            selected={categoryId === category._id.toString()}
                                            onClick={() => handleSelectCategory(category._id.toString())}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                {normalizedCategoryQuery.length > 0 ? 'Resultados' : 'Sugeridas'}
                            </p>
                            {suggestedCategories.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {suggestedCategories.map((category) => (
                                        <CategoryChip
                                            key={category._id.toString()}
                                            category={category}
                                            selected={categoryId === category._id.toString()}
                                            onClick={() => handleSelectCategory(category._id.toString())}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {normalizedCategoryQuery.length > 0
                                        ? `No encontramos categorias para "${categoryQuery}".`
                                        : 'No hay categorias para este tipo.'}
                                </p>
                            )}
                        </div>

                        {extraCategories.length > 0 && normalizedCategoryQuery.length === 0 && (
                            <div className="space-y-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAllCategories((previous) => !previous)}
                                    className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                                    data-testid="transaction-toggle-all-categories"
                                >
                                    <span>{showAllCategories ? 'Ver menos' : `Ver mas (${extraCategories.length})`}</span>
                                    {showAllCategories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>

                                <AnimatePresence initial={false}>
                                    {showAllCategories && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto', transition: { duration: DURATION.normal, ease: easeSmooth } }}
                                            exit={{ opacity: 0, height: 0, transition: { duration: DURATION.fast, ease: easeSoft } }}
                                            className="flex flex-wrap gap-2 overflow-hidden rounded-3xl border p-4"
                                            style={subtlePanelStyle}
                                        >
                                            {extraCategories.map((category) => (
                                                <CategoryChip
                                                    key={`extra-${category._id.toString()}`}
                                                    category={category}
                                                    selected={categoryId === category._id.toString()}
                                                    onClick={() => handleSelectCategory(category._id.toString())}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </StepSection>
    )

    const renderReviewStep = () => (
        <StepSection
            eyebrow={transaction ? 'Ultimo paso' : 'Antes de guardar'}
            title={transaction ? 'Revisa el cambio antes de confirmar' : 'Revisa antes de guardar'}
            subtitle="Chequea lo importante y, si queres, completa las opciones extra abajo."
        >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4 rounded-[2rem] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 88%, transparent)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                            style={{ borderColor: headerSurface.borderColor, color: headerSurface.color, background: headerSurface.background }}
                        >
                            {primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                        </span>
                        {isExpense && <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{paymentMethodLabel}</span>}
                        {usesCardExpensePlanFlow && <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{installmentPlanSummary}</span>}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <SummaryCard title="Monto" value={fmtCurrency(type === 'adjustment' ? Math.abs(amount) : amount)} />
                        <SummaryCard title="Fecha" value={date ? date.toLocaleDateString('es-AR') : '-'} />
                        {showSource && <SummaryCard title="Origen" value={selectedSourceAccount?.name ?? 'Sin definir'} />}
                        {showDestination && <SummaryCard title={type === 'credit_card_payment' ? 'Tarjeta' : 'Destino'} value={selectedDestinationAccount?.name ?? 'Sin definir'} />}
                        {showCategory && <SummaryCard title="Categoria" value={selectedCategory?.name ?? 'Sin categoria'} />}
                        {!descriptionIsOptional && <SummaryCard title="Descripcion" value={description || 'Sin descripcion'} />}
                        {type === 'exchange' && (
                            <>
                                <SummaryCard title="Monto destino" value={fmtCurrency(exchangeDestinationAmount, exchangeDestinationCurrency)} />
                                <SummaryCard title="Cotizacion" value={exchangeRate > 0 ? String(exchangeRate) : 'Sin definir'} />
                            </>
                        )}
                        {type === 'credit_card_payment' && paymentSummary && <SummaryCard title="Pendiente del mes" value={fmtCurrency(paymentSummary.pending, currency)} />}
                        {type === 'adjustment' && <SummaryCard title="Impacto" value={adjustmentSign === '+' ? 'Suma saldo' : 'Descuenta saldo'} />}
                        {type === 'credit_card_expense' && existingInstallmentCount && (
                            <SummaryCard title="Plan actual" value={`${existingInstallmentCount} cuota${existingInstallmentCount === 1 ? '' : 's'}`} />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        <button
                            type="button"
                            onClick={() => setShowMoreOptions((previous) => !previous)}
                            className="flex w-full items-center justify-between text-left"
                            data-testid="transaction-more-options"
                        >
                            <div>
                                <p className="text-sm font-semibold">Mas opciones</p>
                                <p className="text-xs text-muted-foreground">Comercio, notas y descripcion opcional viven aca para no distraer antes.</p>
                            </div>
                            {showMoreOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <AnimatePresence initial={false}>
                            {showMoreOptions && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto', transition: { duration: DURATION.normal, ease: easeSmooth } }}
                                    exit={{ opacity: 0, height: 0, transition: { duration: DURATION.fast, ease: easeSoft } }}
                                    className="mt-4 space-y-4 overflow-hidden"
                                >
                                    {descriptionIsOptional && (
                                        <div className="space-y-2">
                                            <Label htmlFor="descriptionOptional">Descripcion (opcional)</Label>
                                            <Input
                                                id="descriptionOptional"
                                                value={description}
                                                placeholder={type === 'credit_card_payment' ? 'Ej: Pago resumen marzo' : type === 'transfer' ? 'Ej: Pase a ahorro' : type === 'exchange' ? 'Ej: Compra de USD' : 'Descripcion'}
                                                onChange={(event) =>
                                                    setValue('description', event.target.value, { shouldValidate: true, shouldDirty: true })
                                                }
                                            />
                                            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                                        <Input
                                            id="merchant"
                                            value={merchant}
                                            onChange={(event) =>
                                                setValue('merchant', event.target.value, { shouldValidate: true, shouldDirty: true })
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Notas (opcional)</Label>
                                        <Input
                                            id="notes"
                                            value={notes}
                                            onChange={(event) =>
                                                setValue('notes', event.target.value, { shouldValidate: true, shouldDirty: true })
                                            }
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {usesCardExpensePlanFlow && (
                        <div className="rounded-[2rem] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                            <p className="text-sm font-semibold">Plan de cuotas</p>
                            <p className="mt-1 text-sm text-muted-foreground">{installmentPlanSummary}</p>
                            {installmentAmount > 0 && <p className="mt-2 text-sm">{installmentCount} x {fmtCurrency(installmentAmount)}</p>}
                            {planMonthsLabel && <p className="mt-1 text-xs text-muted-foreground">{planMonthsLabel}</p>}
                        </div>
                    )}
                </div>
            </div>
        </StepSection>
    )

    const renderCurrentStep = () => {
        if (!currentStep) return null
        if (currentStep.id === 'amount') return renderAmountStep()
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

function StepSection({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: ReactNode }) {
    return (
        <section className="mx-auto w-full max-w-3xl space-y-5 sm:min-h-[480px]">
            <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-tight sm:text-[2rem]">{title}</h2>
                    <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{subtitle}</p>
                </div>
            </div>
            {children}
        </section>
    )
}

function ChoiceCard({
    title,
    description,
    selected,
    onClick,
    dataTestId,
    surface,
}: {
    title: string
    description: string
    selected: boolean
    onClick: () => void
    dataTestId?: string
    surface: { background: string; borderColor: string; color: string }
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={dataTestId}
            className="rounded-[1.75rem] border px-5 py-5 text-left transition-all duration-200"
            style={{
                borderColor: selected ? surface.borderColor : 'var(--border)',
                background: selected ? surface.background : 'var(--card)',
                boxShadow: selected ? '0 10px 30px rgba(0,0,0,0.08)' : 'none',
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-base font-semibold" style={{ color: selected ? surface.color : 'var(--foreground)' }}>{title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                {selected && (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--background)', color: surface.color }}>
                        <Check className="h-4 w-4" />
                    </span>
                )}
            </div>
        </button>
    )
}

function CategoryChip({ category, selected, onClick }: { category: ICategory; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-full border px-3 py-2 text-sm font-medium transition-colors"
            style={{
                background: selected ? category.color || 'var(--sky)' : category.type === 'income' ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                color: selected ? '#fff' : category.type === 'income' ? '#059669' : '#DC2626',
                borderColor: selected ? category.color || 'var(--sky)' : category.type === 'income' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)',
            }}
        >
            {category.name}
        </button>
    )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
    return (
        <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
        </div>
    )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
        </div>
    )
}
