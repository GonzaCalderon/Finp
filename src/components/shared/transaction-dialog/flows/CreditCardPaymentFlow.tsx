import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DURATION, easeSmooth, easeSoft, staggerItem } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { SURFACE, getTypeSurface } from '../shared-ui'

const SURFACE_ACCENT = getTypeSurface('credit_card_payment', false)
import { AccountSelectorField } from '../fields/AccountSelectorField'
import { DatePickerField } from '../fields/DatePickerField'

type CardPaymentMode = 'full' | 'partial'
type CardPaymentSelection = 'ars' | 'usd' | 'ars_usd'

type PaymentSummaryItem = { due: number; paid: number; pending: number; currency: string }
type PaymentSummaryByCurrency = Partial<Record<string, PaymentSummaryItem>>

interface PaymentSummaryData {
    currency: string
    due: number
    paid: number
    pending: number
    byCurrency?: PaymentSummaryByCurrency
}

interface CreditCardPaymentFlowProps {
    sourceAccountId: string | undefined
    destinationAccountId: string | undefined
    suggestedAccounts: IAccount[]
    destinationAccounts: IAccount[]
    sourceAccountIdError: string | undefined
    destinationAccountIdError: string | undefined
    date: Date | undefined
    dateError: string | undefined
    isDatePopoverOpen: boolean
    amount: number
    amountError: string | undefined
    currency: TransactionFormInput['currency']
    allowedCurrencies: TransactionFormInput['currency'][]
    paymentSummary: PaymentSummaryData | null
    allowCardPaymentFullMode: boolean
    canUseDualCardPayment: boolean
    secondaryCardPaymentCurrency: TransactionFormInput['currency'] | undefined
    additionalCardPaymentEnabled: boolean
    secondaryCardPaymentAmount: number
    cardPaymentMode: CardPaymentMode
    cardPaymentSelection: CardPaymentSelection
    showErrors: boolean
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onSourceAccountChange: (id: string | undefined) => void
    onDestinationAccountChange: (id: string | undefined) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onAmountChange: (amount: number) => void
    onCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onCardPaymentModeChange: (mode: CardPaymentMode) => void
    onCardPaymentSelectionChange: (selection: CardPaymentSelection) => void
    onPartialCardPaymentAmountChange: (currency: TransactionFormInput['currency'], amount: number) => void
}

export function CreditCardPaymentFlow({
    sourceAccountId,
    destinationAccountId,
    suggestedAccounts,
    destinationAccounts,
    sourceAccountIdError,
    destinationAccountIdError,
    date,
    dateError,
    isDatePopoverOpen,
    amount,
    amountError,
    currency,
    allowedCurrencies,
    paymentSummary,
    allowCardPaymentFullMode,
    canUseDualCardPayment,
    secondaryCardPaymentCurrency,
    additionalCardPaymentEnabled,
    secondaryCardPaymentAmount,
    cardPaymentMode,
    cardPaymentSelection,
    showErrors,
    fmtCurrency,
    onSourceAccountChange,
    onDestinationAccountChange,
    onDateChange,
    onDatePopoverOpenChange,
    onAmountChange,
    onCurrencyChange,
    onCardPaymentModeChange,
    onCardPaymentSelectionChange,
    onPartialCardPaymentAmountChange,
}: CreditCardPaymentFlowProps) {
    // Derive payment summary items
    const summaryItems = paymentSummary
        ? (['ARS', 'USD']
            .map((code) => paymentSummary.byCurrency?.[code] ?? (paymentSummary.currency === code ? paymentSummary : null))
            .filter((item): item is PaymentSummaryItem => Boolean(item)))
        : []
    const arsSummaryItem = summaryItems.find((item) => item.currency === 'ARS') ?? null
    const usdSummaryItem = summaryItems.find((item) => item.currency === 'USD') ?? null
    const selectedSummaryItem = summaryItems.find((item) => item.currency === currency) ?? null

    const arsPartialAmount =
        currency === 'ARS'
            ? amount
            : additionalCardPaymentEnabled && secondaryCardPaymentCurrency === 'ARS'
                ? secondaryCardPaymentAmount
                : 0
    const usdPartialAmount =
        currency === 'USD'
            ? amount
            : additionalCardPaymentEnabled && secondaryCardPaymentCurrency === 'USD'
                ? secondaryCardPaymentAmount
                : 0

    const dualPartialInputs = [
        arsSummaryItem && allowedCurrencies.includes('ARS') && (arsSummaryItem.pending > 0 || arsPartialAmount > 0)
            ? { currency: 'ARS' as TransactionFormInput['currency'], pending: arsSummaryItem.pending, value: arsPartialAmount }
            : null,
        usdSummaryItem && allowedCurrencies.includes('USD') && (usdSummaryItem.pending > 0 || usdPartialAmount > 0)
            ? { currency: 'USD' as TransactionFormInput['currency'], pending: usdSummaryItem.pending, value: usdPartialAmount }
            : null,
    ].filter((item): item is { currency: TransactionFormInput['currency']; pending: number; value: number } => Boolean(item))

    const fullPaymentOptions = [
        allowCardPaymentFullMode && arsSummaryItem && allowedCurrencies.includes('ARS') && arsSummaryItem.pending > 0
            ? {
                id: 'ars' as CardPaymentSelection,
                title: 'Solo ARS',
                value: fmtCurrency(arsSummaryItem.pending, 'ARS'),
                note: arsSummaryItem.paid > 0 ? `Ya pagado ${fmtCurrency(arsSummaryItem.paid, 'ARS')}` : 'Paga el pendiente en pesos.',
                wide: false,
            }
            : null,
        allowCardPaymentFullMode && usdSummaryItem && allowedCurrencies.includes('USD') && usdSummaryItem.pending > 0
            ? {
                id: 'usd' as CardPaymentSelection,
                title: 'Solo USD',
                value: fmtCurrency(usdSummaryItem.pending, 'USD'),
                note: usdSummaryItem.paid > 0 ? `Ya pagado ${fmtCurrency(usdSummaryItem.paid, 'USD')}` : 'Paga el pendiente en dolares.',
                wide: false,
            }
            : null,
        allowCardPaymentFullMode && canUseDualCardPayment && arsSummaryItem && usdSummaryItem && arsSummaryItem.pending > 0 && usdSummaryItem.pending > 0
            ? {
                id: 'ars_usd' as CardPaymentSelection,
                title: 'ARS + USD',
                value: `${fmtCurrency(arsSummaryItem.pending, 'ARS')} + ${fmtCurrency(usdSummaryItem.pending, 'USD')}`,
                note: 'Registra ambas monedas en una sola confirmacion.',
                wide: true,
            }
            : null,
    ].filter((option): option is { id: CardPaymentSelection; title: string; value: string; note: string; wide: boolean } => Boolean(option))

    return (
        <motion.div
            variants={staggerItem}
            className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
            style={{ borderColor: SURFACE_ACCENT.borderColor, background: SURFACE_ACCENT.background, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
        >
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.1em]" style={{ color: SURFACE_ACCENT.color }}>Pago de tarjeta</p>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] xl:items-end">
                <AccountSelectorField
                    label="Cuenta desde la que pagas"
                    value={sourceAccountId}
                    accounts={suggestedAccounts}
                    error={sourceAccountIdError}
                    showErrors={showErrors}
                    placeholder="Selecciona cuenta"
                    onChange={onSourceAccountChange}
                />

                <AccountSelectorField
                    label="Tarjeta a pagar"
                    value={destinationAccountId}
                    accounts={destinationAccounts}
                    error={destinationAccountIdError}
                    showErrors={showErrors}
                    placeholder="Selecciona tarjeta"
                    onChange={onDestinationAccountChange}
                />

                <DatePickerField
                    value={date}
                    error={dateError}
                    showErrors={showErrors}
                    isOpen={isDatePopoverOpen}
                    onOpenChange={onDatePopoverOpenChange}
                    onChange={onDateChange}
                    className="w-full space-y-1.5 xl:max-w-[220px]"
                />
            </div>

            <div className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4" style={SURFACE.inner}>
                <div className="space-y-1.5">
                    <p className="text-sm font-semibold">Que queres pagar</p>
                    {allowCardPaymentFullMode ? (
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { id: 'full', label: 'Pago total' },
                                { id: 'partial', label: 'Pago parcial' },
                            ] as const).map((option) => {
                                const selected = cardPaymentMode === option.id
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className="rounded-[1rem] border px-3 py-2 text-sm font-medium transition-colors"
                                        style={{
                                            borderColor: selected ? SURFACE.selected.borderColor : SURFACE.inner.borderColor,
                                            background: selected ? SURFACE.selected.background : 'transparent',
                                        }}
                                        onClick={() => onCardPaymentModeChange(option.id)}
                                    >
                                        {option.label}
                                    </button>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            En la edicion mantenemos el monto manual para no recalcular el pendiente automaticamente.
                        </p>
                    )}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                    {allowCardPaymentFullMode && cardPaymentMode === 'full' ? (
                        <motion.div
                            key="card-payment-full"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: easeSmooth } }}
                            exit={{ opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: easeSoft } }}
                        >
                            {fullPaymentOptions.length > 0 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {fullPaymentOptions.map((option) => {
                                        const selected = cardPaymentSelection === option.id
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                className={`rounded-[1rem] border p-3 text-left transition-colors ${option.wide ? 'col-span-2' : ''}`}
                                                style={{
                                                    borderColor: selected ? SURFACE.selected.borderColor : SURFACE.inner.borderColor,
                                                    background: selected ? SURFACE.selected.background : SURFACE.inner.background,
                                                }}
                                                onClick={() => onCardPaymentSelectionChange(option.id)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold">{option.title}</p>
                                                        <p className="mt-1 text-sm font-semibold tabular-nums">{option.value}</p>
                                                    </div>
                                                    {selected && (
                                                        <span
                                                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                                                            style={{
                                                                borderColor: SURFACE.panel.borderColor,
                                                                background: SURFACE.inner.background,
                                                            }}
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-[11px] text-muted-foreground">{option.note}</p>
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    No queda saldo pendiente para un pago total. Si hace falta, podes registrar un pago parcial.
                                </p>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="card-payment-partial"
                            className="space-y-3"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: easeSmooth } }}
                            exit={{ opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: easeSoft } }}
                        >
                            {canUseDualCardPayment && dualPartialInputs.length > 1 ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {dualPartialInputs.map((option) => (
                                        <div
                                            key={option.currency}
                                            className="min-w-0 space-y-1.5 rounded-[0.9rem] border p-2.5 sm:space-y-2 sm:rounded-[1rem] sm:p-3"
                                            style={SURFACE.inner}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="pt-0.5 text-[0.95rem] font-semibold leading-none sm:text-sm">{option.currency}</p>
                                                <p className="min-w-0 text-right text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                                                    <span className="sm:hidden">{fmtCurrency(option.pending, option.currency)}</span>
                                                    <span className="hidden sm:inline">Pendiente {fmtCurrency(option.pending, option.currency)}</span>
                                                </p>
                                            </div>

                                            <FormattedAmountInput
                                                id={`creditCardPaymentAmount${option.currency}`}
                                                label={`Monto parcial ${option.currency}`}
                                                value={option.value}
                                                currency={option.currency}
                                                placeholder="0"
                                                labelClassName="sr-only"
                                                wrapperClassName="min-w-0 space-y-0"
                                                inputClassName="h-9 rounded-[0.85rem] pl-8 text-[1rem] font-semibold tracking-tight sm:h-10 sm:rounded-[0.95rem] sm:pl-9 sm:text-[1.05rem]"
                                                prefixClassName="left-2.5 text-[11px] sm:left-3 sm:text-[13px]"
                                                onValueChangeAction={(nextAmount) => onPartialCardPaymentAmountChange(option.currency, nextAmount)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    {allowedCurrencies.length > 1 && (
                                        <div className="flex flex-wrap gap-2">
                                            {allowedCurrencies.map((c) => {
                                                const selected = currency === c
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                                                        style={{
                                                            borderColor: selected ? SURFACE.selected.borderColor : SURFACE.inner.borderColor,
                                                            background: selected ? SURFACE.selected.background : 'transparent',
                                                        }}
                                                        onClick={() => onCurrencyChange(c)}
                                                    >
                                                        {c}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}

                                    <FormattedAmountInput
                                        id="creditCardPaymentAmount"
                                        label="Monto parcial"
                                        value={amount}
                                        currency={currency}
                                        error={showErrors ? amountError : undefined}
                                        wrapperClassName="space-y-1.5"
                                        inputClassName="h-10 rounded-[1rem] text-[1.2rem] font-semibold tracking-tight md:text-[1.1rem]"
                                        prefixClassName="text-[14px]"
                                        helperText={
                                            selectedSummaryItem
                                                ? `Pendiente ${selectedSummaryItem.currency}: ${fmtCurrency(selectedSummaryItem.pending, selectedSummaryItem.currency as TransactionFormInput['currency'])}`
                                                : undefined
                                        }
                                        onValueChangeAction={onAmountChange}
                                    />
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    )
}
