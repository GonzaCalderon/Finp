'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    ArrowLeftRight,
    Banknote,
    Building2,
    CalendarIcon,
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

import {
    transactionSchema,
    type TransactionFormInput,
    type TransactionFormData,
    type InstallmentFormData,
} from '@/lib/validations'
import type { ITransaction, IAccount, ICategory, ITransactionRule } from '@/types'
import { Spinner } from '@/components/shared/Spinner'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { evaluateRules } from '@/lib/utils/rules'
import { normalizeLegacyTransactionType } from '@/lib/utils/credit-card'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
    getDefaultAccountForPaymentMethod,
    getAccountCurrencyLabel,
    getCommonSupportedCurrencies,
    getPrimaryCurrency,
    getSupportedCurrencies,
    supportsCurrency,
} from '@/lib/utils/accounts'
import { getArsPerUsdRate } from '@/lib/utils/exchange'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMethod = 'cash' | 'debit' | 'credit_card'

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

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSACTION_TYPE_LABELS: Record<TransactionFormInput['type'], string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    credit_card_expense: 'Gasto con TC',
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de tarjeta',   // backwards compat
    adjustment: 'Ajuste',
}

const QUICK_TYPES: TransactionFormInput['type'][] = ['expense', 'income']
// debt_payment removed from selector — unified into credit_card_payment
const SECONDARY_TYPES: TransactionFormInput['type'][] = ['transfer', 'exchange', 'credit_card_payment', 'adjustment']
const SECONDARY_TYPE_LABELS: Partial<Record<TransactionFormInput['type'], string>> = {
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'cash', label: 'Efectivo', icon: <Banknote className="w-3.5 h-3.5" /> },
    { value: 'debit', label: 'Débito', icon: <Building2 className="w-3.5 h-3.5" /> },
    { value: 'credit_card', label: 'Tarjeta', icon: <CreditCard className="w-3.5 h-3.5" /> },
]

// ─── Month/installment helpers ────────────────────────────────────────────────

function formatMonthValue(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthOptions(anchorDate?: Date, selectedValue?: string): { value: string; label: string }[] {
    const options: { value: string; label: string }[] = []
    const baseDate = anchorDate ?? new Date()
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)

    for (let i = 0; i < 3; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
        const value = formatMonthValue(d)
        const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        options.push({ value, label })
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

function getInstallmentPlanMonths(firstClosingMonth: string, count: number): Date[] {
    if (!firstClosingMonth || count <= 0) return []
    const [year, month] = firstClosingMonth.split('-').map(Number)
    return Array.from({ length: count }, (_, i) => new Date(year, month - 1 + i, 1))
}

function formatPlanMonths(months: Date[]): string {
    if (months.length === 0) return ''
    const first = months[0]
    const last = months[months.length - 1]
    const firstYear = first.getFullYear()
    const lastYear = last.getFullYear()

    if (months.length <= 4) {
        const names = months.map(d => d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''))
        if (firstYear !== lastYear) {
            return months.map(d =>
                d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')
            ).join(' · ')
        }
        return `${names.join(' · ')} ${firstYear}`
    }

    const fmt = (d: Date) =>
        d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' }).replace('.', '')
    return `${fmt(first)} → ${fmt(last)}`
}

// ─── Component ────────────────────────────────────────────────────────────────

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
        handleSubmit,
        setValue,
        watch,
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
            notes: '',
            merchant: '',
        },
    })

    const [showMoreOptions, setShowMoreOptions] = useState(false)
    const [categoryManuallySet, setCategoryManuallySet] = useState(false)
    const [appliedRuleName, setAppliedRuleName] = useState<string | null>(null)
    const [categoryQuery, setCategoryQuery] = useState('')
    const [showAllCategories, setShowAllCategories] = useState(false)

    // Adjustment sign state
    const [adjustmentSign, setAdjustmentSign] = useState<'+' | '-'>('+')

    // Installment / payment method state (expense only)
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

    const scrollRef = useRef<HTMLDivElement>(null)
    useScrollToFirstError(submitCount, Object.keys(errors).length > 0, scrollRef)

    // ─── Watched values ───────────────────────────────────────────────────────

    const watchedValues = watch()
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

    // ─── Derived flags ────────────────────────────────────────────────────────

    const isEditing = Boolean(transaction)
    const isExpense = type === 'expense' || type === 'credit_card_expense'
    const isExchange = type === 'exchange'
    const isQuickFlow = type === 'income' || type === 'expense' || type === 'credit_card_expense'
    const descriptionIsOptional = ['transfer', 'exchange', 'credit_card_payment', 'adjustment'].includes(type)

    // Payment method section for all expenses (new and editing)
    const showPaymentMethod = isExpense
    const isCardExpense = isExpense && paymentMethod === 'credit_card'
    // New credit card expenses should always preserve first closing month,
    // even when they are a single installment.
    const usesCardExpensePlanFlow = isCardExpense && !isEditing && Boolean(onInstallmentSubmit)

    const showSource = ['expense', 'credit_card_expense', 'transfer', 'exchange', 'credit_card_payment', 'adjustment'].includes(type)
    const showDestination = ['income', 'transfer', 'exchange', 'credit_card_payment'].includes(type)
    const showCategory = ['income', 'expense', 'credit_card_expense'].includes(type)
    const paymentMonth = date
        ? (() => {
            const effective = new Date(date)
            if (monthStartDay !== 1 && effective.getDate() < monthStartDay) {
                effective.setMonth(effective.getMonth() - 1)
            }
            return `${effective.getFullYear()}-${String(effective.getMonth() + 1).padStart(2, '0')}`
        })()
        : ''

    // ─── Account lists ────────────────────────────────────────────────────────

    // Accounts for each payment method (expense + new)
    const expenseAccounts = useMemo(() => {
        if (paymentMethod === 'cash') return accounts.filter(a => a.type === 'cash')
        if (paymentMethod === 'credit_card') return accounts.filter(a => a.type === 'credit_card')
        return accounts.filter(a => ['bank', 'wallet', 'savings'].includes(a.type))
    }, [accounts, paymentMethod])

    // Accounts for editing an expense / other types
    const suggestedAccounts = useMemo(() => {
        if (type === 'income') return accounts.filter(a => a.type !== 'credit_card' && a.type !== 'debt')
        if (type === 'expense') return accounts.filter(a => a.type !== 'debt')
        if (type === 'credit_card_expense') return accounts.filter(a => a.type === 'credit_card')
        if (type === 'exchange') return accounts.filter(a => a.type !== 'credit_card' && a.type !== 'debt')
        if (type === 'credit_card_payment')
            return accounts.filter(a => a.type !== 'credit_card' && a.type !== 'debt')
        return accounts
    }, [accounts, type])

    const destinationAccounts = useMemo(() => {
        if (type === 'credit_card_payment') return accounts.filter(a => a.type === 'credit_card' || a.type === 'debt')
        if (type === 'exchange') return accounts.filter(a => a.type !== 'credit_card' && a.type !== 'debt')
        return accounts
    }, [accounts, type])

    // ─── Installment plan preview ─────────────────────────────────────────────

    const installmentAmount = isCardExpense && installmentCount > 0 && amount > 0
        ? amount / installmentCount
        : 0

    const planMonths = useMemo(
        () => getInstallmentPlanMonths(firstClosingMonth, installmentCount),
        [firstClosingMonth, installmentCount]
    )
    const planMonthsLabel = useMemo(() => formatPlanMonths(planMonths), [planMonths])

    const filteredCategories = useMemo(
        () => categories.filter(c => {
            if (type === 'income') return c.type === 'income'
            if (type === 'expense' || type === 'credit_card_expense') return c.type === 'expense'
            return false
        }),
        [categories, type]
    )
    const normalizedCategoryQuery = categoryQuery.trim().toLowerCase()
    const visibleCategories = useMemo(() => {
        const matching = filteredCategories.filter((category) =>
            category.name.toLowerCase().includes(normalizedCategoryQuery)
        )

        if (normalizedCategoryQuery) return matching
        if (showAllCategories || matching.length <= 10) return matching

        const selected = categoryId
            ? matching.find((category) => category._id.toString() === categoryId)
            : undefined
        const remainder = matching.filter((category) => category._id.toString() !== categoryId)

        return selected
            ? [selected, ...remainder.slice(0, 9)]
            : matching.slice(0, 10)
    }, [categoryId, filteredCategories, normalizedCategoryQuery, showAllCategories])
    const hiddenCategoryCount =
        normalizedCategoryQuery.length > 0 || showAllCategories
            ? 0
            : Math.max(0, filteredCategories.length - visibleCategories.length)

    const selectedSourceAccount = useMemo(
        () => accounts.find((account) => account._id.toString() === sourceAccountId),
        [accounts, sourceAccountId]
    )

    const selectedDestinationAccount = useMemo(
        () => accounts.find((account) => account._id.toString() === destinationAccountId),
        [accounts, destinationAccountId]
    )

    const getPreselectedExpenseAccount = useCallback(
        (method: PaymentMethod) => getDefaultAccountForPaymentMethod(accounts, method, defaultAccountId),
        [accounts, defaultAccountId]
    )

    const allowedCurrencies = useMemo(() => {
        if (type === 'income') return getCommonSupportedCurrencies([selectedDestinationAccount])
        if (type === 'exchange') return getSupportedCurrencies(selectedSourceAccount)
        if (type === 'transfer' || type === 'credit_card_payment') {
            return getCommonSupportedCurrencies([selectedSourceAccount, selectedDestinationAccount])
        }
        if (showSource) return getCommonSupportedCurrencies([selectedSourceAccount])
        return ['ARS', 'USD'] as const
    }, [selectedDestinationAccount, selectedSourceAccount, showSource, type])

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
        return (['ARS', 'USD'] as const).find((candidate) => candidate !== currency && allowedCurrencies.includes(candidate))
    }, [allowedCurrencies, currency, type])

    const secondaryCardPaymentSummary = secondaryCardPaymentCurrency
        ? paymentSummary?.byCurrency?.[secondaryCardPaymentCurrency] ?? null
        : null

    const canUseDualCardPayment =
        !isEditing &&
        type === 'credit_card_payment' &&
        Boolean(secondaryCardPaymentCurrency)
    const dialogContext = useMemo(() => {
        if (type === 'credit_card_payment') {
            return destinationAccountId
                ? `Pagá el resumen mensual de ${selectedDestinationAccount?.name ?? 'tu tarjeta'}`
                : 'Registrá el pago del resumen de una tarjeta'
        }

        if (type === 'exchange') {
            return 'Mové saldo entre ARS y USD guardando la cotización usada'
        }

        if (type === 'transfer') {
            return sourceAccountId && destinationAccountId
                ? `Mové dinero entre ${selectedSourceAccount?.name ?? 'origen'} y ${selectedDestinationAccount?.name ?? 'destino'}`
                : 'Mové dinero entre tus cuentas sin afectar ingresos ni gastos'
        }

        if (type === 'adjustment') {
            return 'Corregí un desvío puntual de saldo sin alterar tu historial'
        }

        if (isCardExpense) {
            return installmentCount > 1
                ? `Registrá una compra en ${installmentCount} cuotas`
                : 'Registrá una compra con tarjeta para su próximo resumen'
        }

        if (type === 'income') {
            return destinationAccountId
                ? `Sumá un ingreso a ${selectedDestinationAccount?.name ?? 'tu cuenta'}`
                : 'Registrá un ingreso en la cuenta que corresponda'
        }

        return sourceAccountId
            ? `Registrá un gasto desde ${selectedSourceAccount?.name ?? 'tu cuenta'}`
            : 'Registrá el movimiento principal de tus finanzas'
    }, [
        destinationAccountId,
        installmentCount,
        isCardExpense,
        selectedDestinationAccount?.name,
        selectedSourceAccount?.name,
        sourceAccountId,
        type,
    ])

    // ─── Effects ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!open) return

        setCategoryManuallySet(false)
        setAppliedRuleName(null)
        setCategoryQuery('')
        setShowAllCategories(false)
        setFirstMonthError(null)
        setFirstClosingMonth('')
        setInstallmentQuoteAmount(0)
        setAdditionalCardPaymentEnabled(false)
        setSecondaryCardPaymentAmount(0)
        setExchangeDestinationAmount(0)
        setExchangeDestinationCurrency('USD')
        setExchangeRate(0)
        setExchangeRecalcMode('destinationAmount')

        if (transaction) {
            setAdjustmentSign(transaction.type === 'adjustment' && transaction.amount > 0 ? '-' : '+')
            reset({
                type: (normalizeLegacyTransactionType(transaction.type) ?? transaction.type) as TransactionFormInput['type'],
                amount: Math.abs(transaction.amount),
                currency: transaction.currency,
                date: new Date(transaction.date),
                description: transaction.description,
                categoryId:
                    (transaction.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                    transaction.categoryId?.toString() ?? undefined,
                sourceAccountId:
                    (transaction.sourceAccountId as { _id?: { toString(): string } })?._id?.toString() ??
                    transaction.sourceAccountId?.toString() ?? undefined,
                destinationAccountId:
                    (transaction.destinationAccountId as { _id?: { toString(): string } })?._id?.toString() ??
                    transaction.destinationAccountId?.toString() ?? undefined,
                destinationAmount: transaction.destinationAmount,
                destinationCurrency: transaction.destinationCurrency,
                exchangeRate: transaction.exchangeRate,
                notes: transaction.notes ?? '',
                merchant: transaction.merchant ?? '',
            })
            setExchangeDestinationAmount(transaction.destinationAmount ?? 0)
            setExchangeDestinationCurrency(transaction.destinationCurrency ?? (transaction.currency === 'ARS' ? 'USD' : 'ARS'))
            setExchangeRate(transaction.exchangeRate ?? 0)
            setAdditionalCardPaymentEnabled(false)
            setSecondaryCardPaymentAmount(0)
            setShowMoreOptions(Boolean(transaction.description || transaction.notes || transaction.merchant))

            // Auto-detect payment method from account type
            const srcId =
                (transaction.sourceAccountId as { _id?: { toString(): string } })?._id?.toString() ??
                transaction.sourceAccountId?.toString()
            const srcAccount = accounts.find(a => a._id.toString() === srcId)
            if (srcAccount?.type === 'cash') setPaymentMethod('cash')
            else if (srcAccount?.type === 'credit_card') setPaymentMethod('credit_card')
            else setPaymentMethod('debit')
            setInstallmentCount(1)
            return
        }

        const defaultExpenseAccount = getPreselectedExpenseAccount('debit')

        reset({
            type: 'expense',
            amount: 0,
            currency: getPrimaryCurrency(defaultExpenseAccount),
            date: new Date(),
            description: '',
            categoryId: undefined,
            sourceAccountId: defaultExpenseAccount?._id.toString(),
            destinationAccountId: undefined,
            destinationAmount: undefined,
            destinationCurrency: undefined,
            exchangeRate: undefined,
            notes: '',
            merchant: '',
        })
        setShowMoreOptions(false)
        setInstallmentCount(1)
        setInstallmentQuoteAmount(0)
        setAdjustmentSign('+')
        setPaymentMethod('debit')
    }, [open, transaction, reset, accounts, getPreselectedExpenseAccount])

    // Clear category when type doesn't support it
    useEffect(() => {
        if (!showCategory) setValue('categoryId', undefined, { shouldValidate: true })
    }, [showCategory, setValue])

    useEffect(() => {
        if (type !== 'credit_card_payment' || !destinationAccountId || !paymentMonth) {
            setPaymentSummary(null)
            return
        }

        let cancelled = false

        const fetchPaymentSummary = async () => {
            try {
                const res = await fetch(`/api/credit-cards/payment-summary?cardId=${destinationAccountId}&month=${paymentMonth}&currency=${currency}`)
                const data = await res.json()
                if (!res.ok) return
                if (!cancelled) {
                    setPaymentSummary(data.summary ?? null)
                }
            } catch {
                if (!cancelled) setPaymentSummary(null)
            }
        }

        fetchPaymentSummary()

        return () => {
            cancelled = true
        }
    }, [currency, destinationAccountId, paymentMonth, type])

    // Clear accounts when type changes
    useEffect(() => {
        if (!showSource) setValue('sourceAccountId', undefined, { shouldValidate: true })
        if (!showDestination) setValue('destinationAccountId', undefined, { shouldValidate: true })
        if (type !== 'exchange') {
            setValue('destinationAmount', undefined, { shouldValidate: true })
            setValue('destinationCurrency', undefined, { shouldValidate: true })
            setValue('exchangeRate', undefined, { shouldValidate: true })
        }
    }, [showSource, showDestination, setValue, type])

    // When payment method changes, keep or restore the account that fits that flow.
    useEffect(() => {
        if (!isExpense) return
        const defaultExpenseAccount = getPreselectedExpenseAccount(paymentMethod)
        const compatible = expenseAccounts.some(a => a._id.toString() === sourceAccountId)

        if (!sourceAccountId) {
            if (defaultExpenseAccount) {
                setValue('sourceAccountId', defaultExpenseAccount._id.toString(), { shouldValidate: true })
            }
            return
        }

        if (!compatible) {
            setValue('sourceAccountId', defaultExpenseAccount?._id.toString() ?? undefined, { shouldValidate: true })
        }
    }, [paymentMethod, expenseAccounts, sourceAccountId, isExpense, setValue, getPreselectedExpenseAccount])

    useEffect(() => {
        if (allowedCurrencies.length > 0 && !allowedCurrencies.includes(currency)) {
            setValue('currency', allowedCurrencies[0], { shouldValidate: true })
        }
    }, [allowedCurrencies, currency, setValue])

    useEffect(() => {
        if (allowedCurrencies.length === 1 && currency !== allowedCurrencies[0]) {
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

    // Rule suggestions for description/merchant
    useEffect(() => {
        if (transaction) return
        if (!isQuickFlow) return
        if (categoryManuallySet) return

        const activeRules = rules.filter(r => r.isActive)
        if (activeRules.length === 0) return

        const { matched, rule } = evaluateRules(activeRules, { type, description, merchant })
        if (matched && rule) {
            const ruleCategoryId =
                (rule.categoryId as { _id?: { toString(): string } })?._id?.toString() ??
                rule.categoryId?.toString()
            if (ruleCategoryId) setValue('categoryId', ruleCategoryId, { shouldValidate: true })
            if (!merchant && rule.normalizeMerchant)
                setValue('merchant', rule.normalizeMerchant, { shouldValidate: true })
            setAppliedRuleName(rule.name)
        } else {
            setAppliedRuleName(null)
        }
    }, [description, merchant, type, rules, transaction, isQuickFlow, categoryManuallySet, setValue])

    // ─── Handlers ─────────────────────────────────────────────────────────────

    const handleDateChange = (selected: Date | undefined) => {
        if (!selected) return
        setValue('date', selected, { shouldValidate: true })
        // Auto-suggest first closing month for credit card when user picks a date
        if (isCardExpense && !firstClosingMonth) {
            const next = new Date(selected.getFullYear(), selected.getMonth() + 1, 1)
            const val = formatMonthValue(next)
            if (monthOptions.some(m => m.value === val)) setFirstClosingMonth(val)
        }
    }

    const handlePaymentMethodChange = (pm: PaymentMethod) => {
        setPaymentMethod(pm)
        const defaultExpenseAccount = getPreselectedExpenseAccount(pm)
        if (defaultExpenseAccount) {
            setValue('sourceAccountId', defaultExpenseAccount._id.toString(), {
                shouldValidate: true,
                shouldDirty: true,
            })
        }
        if (pm !== 'credit_card') {
            setInstallmentCount(1)
            setFirstClosingMonth('')
            setFirstMonthError(null)
            setInstallmentQuoteAmount(0)
        }
    }

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
            return
        }

        // Map expense + credit card payment method → credit_card_expense type
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
    }

    const fmtCurrency = (n: number, forcedCurrency?: TransactionFormInput['currency']) =>
        new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: forcedCurrency ?? currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(n)

    const handleApplyInstallmentQuoteAmount = () => {
        if (installmentCount <= 1 || installmentQuoteAmount <= 0) return
        setValue('amount', Number((installmentQuoteAmount * installmentCount).toFixed(2)), {
            shouldValidate: true,
            shouldDirty: true,
        })
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                variant="fullscreen-mobile"
                className="p-0 overflow-hidden sm:max-w-2xl"
            >
                <DialogHeader
                    className="shrink-0 px-5 pt-5 pb-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85"
                    style={{ borderColor: 'var(--border)' }}
                >
                        <DialogTitle className="text-[1.1rem] tracking-tight">
                            {transaction
                            ? `Editar · ${TRANSACTION_TYPE_LABELS[(normalizeLegacyTransactionType(transaction.type) ?? transaction.type) as TransactionFormInput['type']] ?? 'Transacción'}`
                            : usesCardExpensePlanFlow
                                ? installmentCount > 1
                                    ? 'Gasto en cuotas'
                                    : 'Gasto con tarjeta'
                                : 'Nueva transacción'}
                    </DialogTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-muted-foreground">{dialogContext}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span
                                className="inline-flex items-center rounded-full px-2 py-0.5"
                                style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                            >
                                {TRANSACTION_TYPE_LABELS[type] ?? type}
                            </span>
                            {showCategory && filteredCategories.length > 0 && (
                                <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5"
                                    style={{ background: 'var(--secondary)', color: 'var(--muted-foreground)' }}
                                >
                                    {filteredCategories.length} categorías
                                </span>
                            )}
                            {isCardExpense && (
                                <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5"
                                    style={{ background: 'rgba(56,189,248,0.10)', color: 'var(--sky)' }}
                                >
                                    {installmentCount} cuota{installmentCount === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit(handleFormSubmit)}
                    className="flex flex-col overflow-hidden flex-1 sm:max-h-[85vh]"
                >
                    <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-4 pb-24 sm:pb-28 space-y-5">

                        {/* ── Tipo ── */}
                        {isEditing ? (
                            // Read-only type badge when editing
                            <div
                                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium"
                                style={{
                                    background: isExpense
                                        ? 'rgba(239,68,68,0.10)'
                                        : type === 'income'
                                            ? 'rgba(16,185,129,0.10)'
                                            : 'rgba(99,102,241,0.10)',
                                    color: isExpense
                                        ? '#DC2626'
                                        : type === 'income'
                                            ? '#059669'
                                            : '#6366F1',
                                    borderColor: isExpense
                                        ? 'rgba(239,68,68,0.22)'
                                        : type === 'income'
                                            ? 'rgba(16,185,129,0.22)'
                                            : 'rgba(99,102,241,0.22)',
                                }}
                            >
                                {TRANSACTION_TYPE_LABELS[type] ?? type}
                            </div>
                        ) : (
                            <div className="space-y-2.5">
                                <div className="space-y-1">
                                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                        Tipo principal
                                    </p>
                                <div className="grid grid-cols-2 gap-2">
                                    {QUICK_TYPES.map(option => {
                                        const selected = type === option
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setValue('type', option, { shouldValidate: true })}
                                                className="rounded-xl border px-4 py-3 text-sm font-medium transition-colors"
                                                style={{
                                                    background: selected ? 'var(--sky)' : 'var(--secondary)',
                                                    color: selected ? '#fff' : 'var(--foreground)',
                                                    borderColor: selected ? 'var(--sky)' : 'var(--border)',
                                                }}
                                            >
                                                {TRANSACTION_TYPE_LABELS[option]}
                                            </button>
                                        )
                                    })}
                                </div>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                        Otros movimientos
                                    </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {SECONDARY_TYPES.map(option => {
                                        const selected = type === option
                                        return (
                                            <button
                                                key={option}
                                                type="button"
                                                onClick={() => setValue('type', option, { shouldValidate: true })}
                                                className="rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all"
                                                style={{
                                                    background: selected ? 'rgba(99,102,241,0.10)' : 'rgba(148,163,184,0.04)',
                                                    color: selected ? '#7C8CFF' : 'rgba(226,232,240,0.72)',
                                                    borderColor: selected ? 'rgba(99,102,241,0.32)' : 'rgba(148,163,184,0.12)',
                                                }}
                                            >
                                                {SECONDARY_TYPE_LABELS[option]}
                                            </button>
                                        )
                                    })}
                                </div>
                                </div>

                                {errors.type && (
                                    <p className="text-sm text-destructive">{errors.type.message}</p>
                                )}
                            </div>
                        )}

                        {/* ── Monto + Moneda ── */}
                        <div className={type === 'adjustment' ? 'space-y-3' : 'grid grid-cols-3 gap-3 items-start'}>
                            <div className={type === 'adjustment' ? '' : 'col-span-2'}>
                                <FormattedAmountInput
                                    id="amount"
                                    label={isExchange ? 'Monto origen' : 'Monto'}
                                    value={type === 'adjustment' && adjustmentSign === '-' ? -amount : amount}
                                    currency={currency}
                                    error={errors.amount?.message}
                                    allowNegative={type === 'adjustment'}
                                    onNegativeInputDetectedAction={() => {
                                        if (type === 'adjustment') setAdjustmentSign('-')
                                    }}
                                    onValueChangeAction={nextAmount => {
                                        const normalizedAmount =
                                            type === 'adjustment'
                                                ? Math.abs(nextAmount)
                                                : nextAmount

                                        setValue('amount', normalizedAmount, {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                        })
                                    }}
                                />
                            </div>
                            {type === 'adjustment' && (
                                <div
                                    className="rounded-xl border px-3 py-2.5"
                                    style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm">Impacto del ajuste</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Positivo suma saldo. Negativo descuenta saldo.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span
                                                className="text-xs font-medium transition-colors"
                                                style={{
                                                    color: adjustmentSign === '-'
                                                        ? 'var(--destructive)'
                                                        : 'var(--muted-foreground)',
                                                }}
                                            >
                                                Negativo
                                            </span>
                                            <Switch
                                                checked={adjustmentSign === '+'}
                                                onCheckedChange={(checked) => setAdjustmentSign(checked ? '+' : '-')}
                                                aria-label="Cambiar impacto del ajuste"
                                            />
                                            <span
                                                className="text-xs font-medium transition-colors"
                                                style={{
                                                    color: adjustmentSign === '+'
                                                        ? '#059669'
                                                        : 'var(--muted-foreground)',
                                                }}
                                            >
                                                Positivo
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className={type === 'adjustment' ? 'max-w-[180px] space-y-2' : 'space-y-2'}>
                                <Label>{isExchange ? 'Moneda origen' : 'Moneda'}</Label>
                                <Select
                                    value={currency}
                                    onValueChange={v =>
                                        setValue('currency', v as TransactionFormInput['currency'], { shouldValidate: true })
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
                                    <p className="text-xs text-muted-foreground">
                                        Se fija automáticamente según la cuenta seleccionada.
                                    </p>
                                )}
                                {errors.currency && (
                                    <p className="text-sm text-destructive">{errors.currency.message}</p>
                                )}
                            </div>
                        </div>

                        {isExchange && (
                            <div
                                className="rounded-xl border p-4 space-y-4"
                                style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                                        Cambio manual ARS / USD
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                                            style={{
                                                borderColor:
                                                    exchangeRecalcMode === 'destinationAmount'
                                                        ? 'rgba(74,158,204,0.35)'
                                                        : 'var(--border)',
                                                background:
                                                    exchangeRecalcMode === 'destinationAmount'
                                                        ? 'rgba(74,158,204,0.10)'
                                                        : 'transparent',
                                            }}
                                            onClick={() => setExchangeRecalcMode('destinationAmount')}
                                        >
                                            Recalcular destino
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
                                            style={{
                                                borderColor:
                                                    exchangeRecalcMode === 'exchangeRate'
                                                        ? 'rgba(74,158,204,0.35)'
                                                        : 'var(--border)',
                                                background:
                                                    exchangeRecalcMode === 'exchangeRate'
                                                        ? 'rgba(74,158,204,0.10)'
                                                        : 'transparent',
                                            }}
                                            onClick={() => setExchangeRecalcMode('exchangeRate')}
                                        >
                                            Recalcular cotización
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    {exchangeRecalcMode === 'destinationAmount'
                                        ? 'Si cambiás el monto origen o la cotización, actualizamos el monto destino.'
                                        : 'Si cambiás el monto origen o destino, actualizamos la cotización manual.'}
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                                    <div className="sm:col-span-2">
                                        <FormattedAmountInput
                                            id="destinationAmount"
                                            label="Monto destino"
                                            value={exchangeDestinationAmount}
                                            currency={exchangeDestinationCurrency}
                                            error={errors.destinationAmount?.message}
                                            onValueChangeAction={(nextAmount) => {
                                                setExchangeRecalcMode('exchangeRate')
                                                setExchangeDestinationAmount(nextAmount)
                                                setValue('destinationAmount', nextAmount, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })

                                                if (amount > 0 && nextAmount > 0 && exchangeDestinationCurrency !== currency) {
                                                    const nextRate = getArsPerUsdRate({
                                                        sourceCurrency: currency,
                                                        sourceAmount: amount,
                                                        destinationCurrency: exchangeDestinationCurrency,
                                                        destinationAmount: nextAmount,
                                                    })
                                                    setExchangeRate(nextRate)
                                                    setValue('exchangeRate', nextRate, {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    })
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Moneda destino</Label>
                                        <Select
                                            value={exchangeDestinationCurrency}
                                            onValueChange={(value) => {
                                                const nextCurrency = value as TransactionFormInput['currency']
                                                setExchangeRecalcMode('destinationAmount')
                                                setExchangeDestinationCurrency(nextCurrency)
                                                setValue('destinationCurrency', nextCurrency, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
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
                                        {errors.destinationCurrency && (
                                            <p className="text-sm text-destructive">
                                                {errors.destinationCurrency.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="exchangeRate">Cotización manual</Label>
                                    <Input
                                        id="exchangeRate"
                                        type="number"
                                        step="0.01"
                                        placeholder="Ej: 1.250"
                                        value={exchangeRate || ''}
                                        onChange={(event) => {
                                            const nextRate = event.target.value === '' ? 0 : Number(event.target.value)
                                            setExchangeRecalcMode('destinationAmount')
                                            setExchangeRate(nextRate)
                                            setValue('exchangeRate', nextRate || undefined, {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            })

                                            if (amount > 0 && nextRate > 0 && exchangeDestinationCurrency !== currency) {
                                                const destinationAmount =
                                                    currency === 'ARS'
                                                        ? amount / nextRate
                                                        : amount * nextRate
                                                setExchangeDestinationAmount(destinationAmount)
                                                setValue('destinationAmount', destinationAmount, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Guardamos la cotización usada para reconstruir el cambio en el futuro.
                                    </p>
                                    {errors.exchangeRate && (
                                        <p className="text-sm text-destructive">{errors.exchangeRate.message}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {!descriptionIsOptional && (
                            <div className="space-y-2">
                                <Label htmlFor="description">Descripción</Label>
                                <Input
                                    id="description"
                                    value={description}
                                    onChange={e =>
                                        setValue('description', e.target.value, { shouldValidate: true, shouldDirty: true })
                                    }
                                    placeholder={isExchange ? 'Ej: Cambio ahorro marzo' : 'Ej: Compra en kiosco'}
                                />
                                {errors.description ? (
                                    <p className="text-sm text-destructive">{errors.description.message}</p>
                                ) : isQuickFlow && !transaction && rules.length > 0 ? (
                                    <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        <Wand2 size={10} className="shrink-0" />
                                        La descripción puede disparar reglas automáticas
                                    </p>
                                ) : null}
                            </div>
                        )}

                        {/* ── Fecha — siempre visible ── */}
                        <div className="space-y-2">
                            <Label>Fecha</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start text-left">
                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                        {date instanceof Date
                                            ? date.toLocaleDateString('es-AR')
                                            : 'Seleccioná fecha'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={handleDateChange}
                                    />
                                </PopoverContent>
                            </Popover>
                            {errors.date && (
                                <p className="text-sm text-destructive">{errors.date.message}</p>
                            )}
                        </div>

                        {/* ── MEDIO DE PAGO (expense nuevo) ── */}
                        {showPaymentMethod && (
                            <div className="space-y-3">
                                <Label>Medio de pago</Label>

                                {/* chips */}
                                <div className="grid grid-cols-3 gap-2">
                                    {PAYMENT_METHODS.map(pm => {
                                        const selected = paymentMethod === pm.value
                                        return (
                                            <button
                                                key={pm.value}
                                                type="button"
                                                onClick={() => handlePaymentMethodChange(pm.value)}
                                                className="flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors"
                                                style={{
                                                    background: selected ? 'var(--sky)' : 'var(--secondary)',
                                                    color: selected ? '#fff' : 'var(--muted-foreground)',
                                                    borderColor: selected ? 'var(--sky)' : 'var(--border)',
                                                }}
                                            >
                                                {pm.icon}
                                                {pm.label}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* ── Tarjeta de crédito ── */}
                                {isCardExpense ? (
                                    <div
                                        className="space-y-4 rounded-xl border p-4"
                                        style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                                    >
                                        {/* Tarjeta selector */}
                                        <div className="space-y-2">
                                            <Label>Tarjeta</Label>
                                            <Select
                                                value={sourceAccountId}
                                                onValueChange={v =>
                                                    setValue('sourceAccountId', v || undefined, { shouldValidate: true })
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccioná tarjeta" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {expenseAccounts.map(account => (
                                                        <SelectItem
                                                            key={account._id.toString()}
                                                            value={account._id.toString()}
                                                        >
                                                            {account.name} · {getAccountCurrencyLabel(account)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.sourceAccountId && (
                                                <p className="text-sm text-destructive">
                                                    {errors.sourceAccountId.message}
                                                </p>
                                            )}
                                        </div>

                                        {/* Cuotas stepper + Primera cuota */}
                                        {!isEditing && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                                <div className="space-y-2">
                                                    <Label>Cuotas</Label>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setInstallmentCount(c => Math.max(1, c - 1))}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
                                                            style={{ borderColor: 'var(--border)' }}
                                                            aria-label="Reducir cuotas"
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={installmentCount}
                                                            onChange={e =>
                                                                setInstallmentCount(Math.max(1, parseInt(e.target.value) || 1))
                                                            }
                                                            className="text-center"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setInstallmentCount(c => c + 1)}
                                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
                                                            style={{ borderColor: 'var(--border)' }}
                                                            aria-label="Aumentar cuotas"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Primera cuota</Label>
                                                    <Select
                                                        value={firstClosingMonth}
                                                        onValueChange={v => {
                                                            setFirstClosingMonth(v)
                                                            setFirstMonthError(null)
                                                        }}
                                                    >
                                                        <SelectTrigger
                                                            style={{
                                                                borderColor: firstMonthError
                                                                    ? 'var(--destructive)'
                                                                    : undefined,
                                                            }}
                                                        >
                                                            <SelectValue placeholder="Mes" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {monthOptions.map(m => (
                                                                <SelectItem key={m.value} value={m.value}>
                                                                    {m.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    {firstMonthError && (
                                                        <p className="text-sm text-destructive">{firstMonthError}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {!isEditing && (
                                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
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
                                                    className="gap-2"
                                                    onClick={handleApplyInstallmentQuoteAmount}
                                                    disabled={installmentQuoteAmount <= 0}
                                                >
                                                    <Wand2 className="w-4 h-4" />
                                                    {installmentCount > 1 ? 'Calcular total' : 'Usar como monto'}
                                                </Button>
                                            </div>
                                        )}

                                        {/* Plan de cuotas preview */}
                                        {!isEditing && installmentAmount > 0 && (
                                            <div
                                                className="rounded-lg border px-3 py-2.5"
                                                style={{
                                                    borderColor: 'var(--border)',
                                                    background: 'var(--background)',
                                                }}
                                            >
                                                <p className="text-xs text-muted-foreground mb-0.5">Plan de cuotas</p>
                                                <p className="text-sm font-semibold">
                                                    {installmentCount} × {fmtCurrency(installmentAmount)}
                                                </p>
                                                {planMonthsLabel && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {planMonthsLabel}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* ── Efectivo / Débito: cuenta selector ── */
                                    <div className="space-y-2">
                                        <Label>Cuenta</Label>
                                        <Select
                                            value={sourceAccountId}
                                            onValueChange={v =>
                                                setValue('sourceAccountId', v || undefined, { shouldValidate: true })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={
                                                        paymentMethod === 'cash'
                                                            ? 'Seleccioná cuenta de efectivo'
                                                            : 'Seleccioná cuenta'
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {expenseAccounts.map(account => (
                                                    <SelectItem
                                                        key={account._id.toString()}
                                                        value={account._id.toString()}
                                                    >
                                                        {account.name} · {getAccountCurrencyLabel(account)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.sourceAccountId && (
                                            <p className="text-sm text-destructive">
                                                {errors.sourceAccountId.message}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Cuenta origen (otros tipos, no expense) ── */}
                        {!isExpense && showSource && (
                            <div className="space-y-2">
                                <Label>{isExchange ? 'Cuenta origen' : 'Cuenta de origen'}</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={v =>
                                        setValue('sourceAccountId', v || undefined, { shouldValidate: true })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná cuenta de origen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suggestedAccounts.map(account => (
                                            <SelectItem
                                                key={account._id.toString()}
                                                value={account._id.toString()}
                                            >
                                                {account.name} · {getAccountCurrencyLabel(account)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.sourceAccountId && (
                                    <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p>
                                )}
                            </div>
                        )}

                        {/* ── Cuenta destino (income) ── */}
                        {showDestination && type === 'income' && (
                            <div className="space-y-2">
                                <Label>Cuenta destino</Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={v =>
                                        setValue('destinationAccountId', v || undefined, { shouldValidate: true })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná cuenta destino" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinationAccounts.map(account => (
                                            <SelectItem
                                                key={account._id.toString()}
                                                value={account._id.toString()}
                                            >
                                                {account.name} · {getAccountCurrencyLabel(account)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.destinationAccountId && (
                                    <p className="text-sm text-destructive">{errors.destinationAccountId.message}</p>
                                )}
                            </div>
                        )}

                        {/* ── Categoría ── */}
                        {showCategory && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Categoría</Label>
                                    {appliedRuleName && !transaction && (
                                        <span
                                            className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
                                            style={{ background: 'rgba(56,189,248,0.10)', color: 'var(--sky)' }}
                                        >
                                            <Wand2 size={10} />
                                            {appliedRuleName}
                                        </span>
                                    )}
                                </div>

                                {filteredCategories.length > 8 && (
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="relative sm:max-w-xs">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={categoryQuery}
                                                onChange={(event) => setCategoryQuery(event.target.value)}
                                                placeholder="Buscar categoría"
                                                className="pl-9 h-9"
                                            />
                                        </div>
                                        {filteredCategories.length > 10 && normalizedCategoryQuery.length === 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2.5 text-xs self-start sm:self-auto"
                                                onClick={() => setShowAllCategories((prev) => !prev)}
                                            >
                                                {showAllCategories ? 'Ver menos' : `Ver todas (${filteredCategories.length})`}
                                            </Button>
                                        )}
                                    </div>
                                )}

                                {visibleCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {visibleCategories.map(category => {
                                            const selected = categoryId === category._id.toString()
                                            return (
                                                <button
                                                    key={category._id.toString()}
                                                    type="button"
                                                    onClick={() => {
                                                        setValue('categoryId', category._id.toString(), {
                                                            shouldValidate: true,
                                                        })
                                                        setCategoryManuallySet(true)
                                                        setAppliedRuleName(null)
                                                    }}
                                                    className="rounded-full border px-3 py-2 text-xs font-medium transition-colors"
                                                    style={{
                                                        background: selected
                                                            ? category.color || 'var(--sky)'
                                                            : category.type === 'income'
                                                                ? 'rgba(16,185,129,0.10)'
                                                                : 'rgba(239,68,68,0.10)',
                                                        color: selected
                                                            ? '#fff'
                                                            : category.type === 'income'
                                                                ? '#059669'
                                                                : '#DC2626',
                                                        borderColor: selected
                                                            ? category.color || 'var(--sky)'
                                                            : category.type === 'income'
                                                                ? 'rgba(16,185,129,0.22)'
                                                                : 'rgba(239,68,68,0.22)',
                                                    }}
                                                >
                                                    {category.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : filteredCategories.length > 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No encontramos categorías para “{categoryQuery}”.
                                    </p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No hay categorías para este tipo.
                                    </p>
                                )}

                                {hiddenCategoryCount > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Mostrando {visibleCategories.length} de {filteredCategories.length} categorías.
                                    </p>
                                )}

                                {errors.categoryId && (
                                    <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                                )}
                            </div>
                        )}

                        {/* ── Cuenta destino (transfer / cc_payment / no income) ── */}
                        {showDestination && type !== 'income' && (
                            <div className="space-y-2">
                                <Label>
                                    {type === 'credit_card_payment'
                                        ? 'Tarjeta a pagar'
                                        : type === 'exchange'
                                            ? 'Cuenta destino'
                                        : 'Cuenta destino'}
                                </Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={v =>
                                        setValue('destinationAccountId', v || undefined, { shouldValidate: true })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue
                                            placeholder={
                                                type === 'credit_card_payment'
                                                    ? 'Seleccioná tarjeta'
                                                    : 'Seleccioná cuenta destino'
                                            }
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinationAccounts.map(account => (
                                            <SelectItem
                                                key={account._id.toString()}
                                                value={account._id.toString()}
                                            >
                                                {account.name} · {getAccountCurrencyLabel(account)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.destinationAccountId && (
                                    <p className="text-sm text-destructive">
                                        {errors.destinationAccountId.message}
                                    </p>
                                )}

                                {hasCrossCurrencyTransferConflict && (
                                    <div
                                        className="rounded-xl border px-3 py-2.5 text-sm space-y-2"
                                        style={{ borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.10)' }}
                                    >
                                        <p className="text-amber-700 dark:text-amber-300">
                                            Estas cuentas no comparten moneda. Registralo como un cambio manual para guardar la cotización usada.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => setValue('type', 'exchange', { shouldValidate: true, shouldDirty: true })}
                                        >
                                            Pasar a cambio manual
                                        </Button>
                                    </div>
                                )}

                                {type === 'credit_card_payment' && paymentSummary && destinationAccountId && (
                                    <div
                                        className="rounded-xl border p-3 space-y-2"
                                        style={{ borderColor: 'var(--border)', background: 'var(--secondary)' }}
                                    >
                                        {(Object.values(paymentSummary.byCurrency ?? {
                                            [paymentSummary.currency as 'ARS' | 'USD']: paymentSummary,
                                        }) as Array<{ due: number; paid: number; pending: number; currency: string }>).map((summaryItem) => {
                                            const active = summaryItem.currency === currency

                                            return (
                                                <div
                                                    key={summaryItem.currency}
                                                    className="rounded-lg border p-2.5 space-y-1.5"
                                                    style={{
                                                        borderColor: active ? 'rgba(74,158,204,0.35)' : 'var(--border)',
                                                        background: active ? 'rgba(74,158,204,0.08)' : 'transparent',
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="font-medium">{summaryItem.currency}</span>
                                                        {active && (
                                                            <span className="text-[11px] text-muted-foreground">moneda elegida</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-muted-foreground">Corresponde pagar este mes</span>
                                                        <span className="font-medium">{fmtCurrency(summaryItem.due, summaryItem.currency as TransactionFormInput['currency'])}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-muted-foreground">Ya pagado</span>
                                                        <span className="font-medium">{fmtCurrency(summaryItem.paid, summaryItem.currency as TransactionFormInput['currency'])}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-muted-foreground">Pendiente</span>
                                                        <span className="font-medium">{fmtCurrency(summaryItem.pending, summaryItem.currency as TransactionFormInput['currency'])}</span>
                                                    </div>
                                                    {summaryItem.pending > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 text-xs"
                                                            onClick={() => {
                                                                if (summaryItem.currency === currency) {
                                                                    setValue('amount', summaryItem.pending, {
                                                                        shouldValidate: true,
                                                                        shouldDirty: true,
                                                                    })
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
                                            <div
                                                className="rounded-lg border p-3 space-y-3"
                                                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-medium">Pago dual en una sola confirmación</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Sumá también un pago en {secondaryCardPaymentCurrency} sin salir de este flujo.
                                                        </p>
                                                    </div>
                                                    <Switch
                                                        checked={additionalCardPaymentEnabled}
                                                        onCheckedChange={setAdditionalCardPaymentEnabled}
                                                    />
                                                </div>

                                                {additionalCardPaymentEnabled && (
                                                    <div className="space-y-2">
                                                        <FormattedAmountInput
                                                            id="secondaryCardPaymentAmount"
                                                            label={`Monto adicional en ${secondaryCardPaymentCurrency}`}
                                                            value={secondaryCardPaymentAmount}
                                                            currency={secondaryCardPaymentCurrency}
                                                            placeholder="0"
                                                            onValueChangeAction={setSecondaryCardPaymentAmount}
                                                        />
                                                        {secondaryCardPaymentSummary && (
                                                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                                <span>Pendiente {secondaryCardPaymentCurrency}</span>
                                                                <span className="font-medium">
                                                                    {fmtCurrency(
                                                                        secondaryCardPaymentSummary.pending,
                                                                        secondaryCardPaymentCurrency
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {transaction?.paymentGroupId && (
                                            <p className="text-xs text-muted-foreground">
                                                Este movimiento pertenece a un pago dual relacionado.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Más opciones (comercio + notas) ── */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setShowMoreOptions(prev => !prev)}
                                className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"
                                style={{ borderColor: 'var(--border)' }}
                            >
                                <span>Más opciones</span>
                                {showMoreOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {showMoreOptions && (
                                <div
                                    className="space-y-4 rounded-xl border p-3"
                                    style={{ borderColor: 'var(--border)' }}
                                >
                                    {descriptionIsOptional && (
                                        <div className="space-y-2">
                                            <Label htmlFor="descriptionOptional">Descripción (opcional)</Label>
                                            <Input
                                                id="descriptionOptional"
                                                value={description}
                                                placeholder={
                                                    type === 'credit_card_payment'
                                                        ? 'Ej: Pago resumen marzo'
                                                        : type === 'transfer'
                                                            ? 'Ej: Pase a ahorro'
                                                            : type === 'exchange'
                                                                ? 'Ej: Compra de USD'
                                                                : 'Descripción'
                                                }
                                                onChange={e =>
                                                    setValue('description', e.target.value, {
                                                        shouldValidate: true,
                                                        shouldDirty: true,
                                                    })
                                                }
                                            />
                                            {errors.description && (
                                                <p className="text-sm text-destructive">{errors.description.message}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                                        <Input
                                            id="merchant"
                                            value={merchant}
                                            onChange={e =>
                                                setValue('merchant', e.target.value, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                        {errors.merchant && (
                                            <p className="text-sm text-destructive">{errors.merchant.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Notas (opcional)</Label>
                                        <Input
                                            id="notes"
                                            value={notes}
                                            onChange={e =>
                                                setValue('notes', e.target.value, {
                                                    shouldValidate: true,
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                        {errors.notes && (
                                            <p className="text-sm text-destructive">{errors.notes.message}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div
                        className="shrink-0 border-t px-4 pt-3 pb-4 sm:px-5 sm:py-4 flex gap-2 bg-background"
                        style={{
                            borderColor: 'var(--border)',
                            boxShadow: '0 -10px 24px rgba(0,0,0,0.14)',
                        }}
                    >
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1 h-10 sm:h-10"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" className="flex-1 h-10 sm:h-10" disabled={isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Spinner className="mr-2" />
                                    Guardando...
                                </>
                            ) : transaction ? (
                                'Guardar cambios'
                            ) : usesCardExpensePlanFlow ? (
                                installmentCount > 1 ? 'Registrar en cuotas' : 'Registrar gasto con TC'
                            ) : (
                                'Crear transacción'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
