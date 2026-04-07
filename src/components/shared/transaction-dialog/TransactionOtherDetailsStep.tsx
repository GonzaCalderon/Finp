import { ArrowLeftRight, CalendarIcon, Check, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { getAccountCurrencyLabel } from '@/lib/utils/accounts'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { StepSection } from './StepSection'
import { subtlePanelStyle } from './shared-ui'

type PaymentSummaryItem = { due: number; paid: number; pending: number; currency: string }
type PaymentSummaryByCurrency = Partial<Record<string, PaymentSummaryItem>>
type CardPaymentMode = 'full' | 'partial'
type CardPaymentSelection = 'ars' | 'usd' | 'ars_usd'

interface PaymentSummaryData {
    currency: string
    due: number
    paid: number
    pending: number
    byCurrency?: PaymentSummaryByCurrency
}

interface TransactionOtherDetailsStepProps {
    type: TransactionFormInput['type']
    showSource: boolean
    showDestination: boolean
    sourceAccountId: string | undefined
    destinationAccountId: string | undefined
    suggestedAccounts: IAccount[]
    destinationAccounts: IAccount[]
    sourceAccountIdError: string | undefined
    destinationAccountIdError: string | undefined
    hasCrossCurrencyTransferConflict: boolean
    description: string
    descriptionError: string | undefined
    appliedRuleName: string | null
    hasCategoryRules: boolean
    // exchange
    exchangeDestinationAmount: number
    exchangeDestinationCurrency: TransactionFormInput['currency']
    exchangeRate: number
    currency: TransactionFormInput['currency']
    destinationAmountError: string | undefined
    exchangeRateError: string | undefined
    // card payment
    paymentSummary: PaymentSummaryData | null
    allowCardPaymentFullMode: boolean
    canUseDualCardPayment: boolean
    secondaryCardPaymentCurrency: TransactionFormInput['currency'] | undefined
    additionalCardPaymentEnabled: boolean
    secondaryCardPaymentAmount: number
    cardPaymentMode: CardPaymentMode
    cardPaymentSelection: CardPaymentSelection
    isEditing: boolean
    amount: number
    date: Date | undefined
    isDatePopoverOpen: boolean
    amountError: string | undefined
    dateError: string | undefined
    exchangeConfigurationError: string | null
    canSwapExchangeDirection: boolean
    showErrors: boolean
    transferSourceLabel: string | undefined
    transferDestinationLabel: string | undefined
    transferBalanceCurrency: TransactionFormInput['currency'] | undefined
    transferSourceBalance: number | null
    transferDestinationBalance: number | null
    transferSourceResultingBalance: number | null
    transferDestinationResultingBalance: number | null
    transferBalanceError: string | null
    allowedCurrencies: TransactionFormInput['currency'][]
    adjustmentSign: '+' | '-'
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    // callbacks
    onAmountChange: (amount: number) => void
    onCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onDescriptionChange: (value: string) => void
    onCardPaymentModeChange: (mode: CardPaymentMode) => void
    onCardPaymentSelectionChange: (selection: CardPaymentSelection) => void
    onPartialCardPaymentAmountChange: (currency: TransactionFormInput['currency'], amount: number) => void
    onSourceAccountChange: (id: string | undefined) => void
    onDestinationAccountChange: (id: string | undefined) => void
    onSwitchToExchange: () => void
    onDestinationAmountChange: (amount: number) => void
    onExchangeRateChange: (rate: number) => void
    onSwapExchangeDirection: () => void
    onAdjustmentSignChange: (sign: '+' | '-') => void
}

export function TransactionOtherDetailsStep({
    type,
    showSource,
    showDestination,
    sourceAccountId,
    destinationAccountId,
    suggestedAccounts,
    destinationAccounts,
    sourceAccountIdError,
    destinationAccountIdError,
    hasCrossCurrencyTransferConflict,
    description,
    descriptionError,
    appliedRuleName,
    hasCategoryRules,
    exchangeDestinationAmount,
    exchangeDestinationCurrency,
    exchangeRate,
    currency,
    destinationAmountError,
    exchangeRateError,
    paymentSummary,
    allowCardPaymentFullMode,
    canUseDualCardPayment,
    secondaryCardPaymentCurrency,
    additionalCardPaymentEnabled,
    secondaryCardPaymentAmount,
    cardPaymentMode,
    cardPaymentSelection,
    isEditing,
    amount,
    date,
    isDatePopoverOpen,
    amountError,
    dateError,
    exchangeConfigurationError,
    canSwapExchangeDirection,
    showErrors,
    transferSourceLabel,
    transferDestinationLabel,
    transferBalanceCurrency,
    transferSourceBalance,
    transferDestinationBalance,
    transferSourceResultingBalance,
    transferDestinationResultingBalance,
    transferBalanceError,
    allowedCurrencies,
    adjustmentSign,
    fmtCurrency,
    onAmountChange,
    onCurrencyChange,
    onDateChange,
    onDatePopoverOpenChange,
    onDescriptionChange,
    onCardPaymentModeChange,
    onCardPaymentSelectionChange,
    onPartialCardPaymentAmountChange,
    onSourceAccountChange,
    onDestinationAccountChange,
    onSwitchToExchange,
    onDestinationAmountChange,
    onExchangeRateChange,
    onSwapExchangeDirection,
    onAdjustmentSignChange,
}: TransactionOtherDetailsStepProps) {
    const title =
        type === 'income'
            ? 'Donde entra'
            : type === 'transfer'
                ? 'Entre que cuentas'
                : type === 'exchange'
                    ? 'Como fue el cambio'
                    : type === 'credit_card_payment'
                        ? 'Que tarjeta pagaste'
                        : 'Donde impacta'

    const subtitle =
        type === 'income'
            ? 'Elegi la cuenta que recibe este ingreso.'
            : type === 'transfer'
                ? 'Elegi origen y destino. Si cambia la moneda, te proponemos usar cambio manual.'
                : type === 'exchange'
                    ? 'Guardamos origen, destino y cotizacion para que quede bien registrado.'
                    : type === 'credit_card_payment'
                        ? 'Elegi desde que cuenta pagas y que tarjeta estas cancelando.'
                        : 'Elegi la cuenta y defini si el ajuste suma o descuenta saldo.'

    const summaryItems = paymentSummary
        ? (['ARS', 'USD']
            .map((code) => paymentSummary.byCurrency?.[code] ?? (paymentSummary.currency === code ? paymentSummary : null))
            .filter((item): item is PaymentSummaryItem => Boolean(item)))
        : []
    const arsSummaryItem = summaryItems.find((summaryItem) => summaryItem.currency === 'ARS') ?? null
    const usdSummaryItem = summaryItems.find((summaryItem) => summaryItem.currency === 'USD') ?? null
    const selectedSummaryItem = summaryItems.find((summaryItem) => summaryItem.currency === currency) ?? null
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
        allowCardPaymentFullMode &&
        canUseDualCardPayment &&
        arsSummaryItem &&
        usdSummaryItem &&
        arsSummaryItem.pending > 0 &&
        usdSummaryItem.pending > 0
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
        <StepSection eyebrow="Paso 3" title={title} subtitle={subtitle}>
            <div className="space-y-4">
                {showSource && type !== 'credit_card_payment' && type !== 'exchange' && type !== 'transfer' && type !== 'adjustment' && (
                    <div className="space-y-2">
                        <Label>Cuenta de origen</Label>
                        <Select
                            value={sourceAccountId}
                            onValueChange={(value) => onSourceAccountChange(value || undefined)}
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
                        {showErrors && sourceAccountIdError && <p className="text-sm text-destructive">{sourceAccountIdError}</p>}
                    </div>
                )}

                {type === 'income' && (
                    <div
                        className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
                        style={{
                            ...subtlePanelStyle,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                            <div className="space-y-1.5">
                                <Label>Cuenta destino</Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={(value) => onDestinationAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
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
                                {showErrors && destinationAccountIdError ? <p className="text-sm text-destructive">{destinationAccountIdError}</p> : null}
                            </div>

                            <div className="w-full space-y-1.5 xl:max-w-[220px]">
                                <Label>Fecha</Label>
                                <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
                                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                            {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={onDateChange} />
                                    </PopoverContent>
                                </Popover>
                                {showErrors && dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
                            </div>
                        </div>

                        <div
                            className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
                            }}
                        >
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_176px] md:items-start">
                                <FormattedAmountInput
                                    id="incomeAmount"
                                    label="Monto"
                                    value={amount}
                                    currency={currency}
                                    error={undefined}
                                    wrapperClassName="space-y-1.5"
                                    inputClassName="h-10 rounded-[1rem] text-[1.1rem] font-semibold tracking-tight"
                                    prefixClassName="text-[14px]"
                                    onValueChangeAction={onAmountChange}
                                />

                                <div className="space-y-1.5 md:self-start">
                                    <Label>Moneda</Label>
                                    {allowedCurrencies.length > 1 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {allowedCurrencies.map((allowedCurrency) => {
                                                const selected = currency === allowedCurrency
                                                return (
                                                    <button
                                                        key={allowedCurrency}
                                                        type="button"
                                                        className="h-10 rounded-[1rem] border px-3 text-sm font-medium transition-colors"
                                                        style={{
                                                            borderColor: selected
                                                                ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                                : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                            background: selected
                                                                ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                                : 'transparent',
                                                        }}
                                                        onClick={() => onCurrencyChange(allowedCurrency)}
                                                    >
                                                        {allowedCurrency}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div
                                            className="flex h-10 items-center rounded-[1rem] border px-3 text-sm font-medium"
                                            style={{
                                                borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                background: 'color-mix(in srgb, var(--background) 88%, var(--card) 12%)',
                                            }}
                                        >
                                            {allowedCurrencies[0] ?? currency}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {showErrors && amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <Label htmlFor="incomeDescription">Descripcion</Label>
                                        <p className="text-xs text-muted-foreground">Una frase corta alcanza y ayuda a sugerir mejor la categoria.</p>
                                    </div>
                                    {hasCategoryRules && !isEditing ? (
                                        <span
                                            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground"
                                            style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 92%, transparent)' }}
                                        >
                                            <Wand2 className="h-3 w-3" />
                                            Reglas
                                        </span>
                                    ) : null}
                                </div>

                                <Input
                                    id="incomeDescription"
                                    value={description}
                                    onChange={(event) => onDescriptionChange(event.target.value)}
                                    placeholder="Ej: Sueldo marzo"
                                    aria-invalid={Boolean(descriptionError)}
                                    className="h-10 rounded-[1rem]"
                                />

                                {descriptionError ? (
                                    <p className="text-sm text-destructive">{descriptionError}</p>
                                ) : appliedRuleName && !isEditing ? (
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <Wand2 className="h-3 w-3" />
                                        Regla aplicada: {appliedRuleName}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}

                {showDestination && type !== 'income' && type !== 'credit_card_payment' && type !== 'exchange' && type !== 'transfer' && (
                    <div className="space-y-2">
                        <Label>Cuenta destino</Label>
                        <Select
                            value={destinationAccountId}
                            onValueChange={(value) => onDestinationAccountChange(value || undefined)}
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
                        {showErrors && destinationAccountIdError && <p className="text-sm text-destructive">{destinationAccountIdError}</p>}
                    </div>
                )}

                {type === 'transfer' && (
                    <div
                        className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
                        style={{
                            ...subtlePanelStyle,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] xl:items-end">
                            <div className="space-y-1.5">
                                <Label>Cuenta origen</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={(value) => onSourceAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
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
                                {showErrors && sourceAccountIdError ? <p className="text-sm text-destructive">{sourceAccountIdError}</p> : null}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Cuenta destino</Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={(value) => onDestinationAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
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
                                {showErrors && destinationAccountIdError ? <p className="text-sm text-destructive">{destinationAccountIdError}</p> : null}
                            </div>

                            <div className="w-full space-y-1.5 xl:max-w-[220px]">
                                <Label>Fecha</Label>
                                <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
                                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                            {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={onDateChange} />
                                    </PopoverContent>
                                </Popover>
                                {showErrors && dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
                            </div>
                        </div>

                        {hasCrossCurrencyTransferConflict ? (
                            <div
                                className="rounded-[1.2rem] border px-4 py-3 text-sm"
                                style={{ borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.10)' }}
                            >
                                <p className="text-amber-700 dark:text-amber-300">
                                    Estas cuentas no comparten moneda. Conviene registrarlo como cambio manual para guardar la cotizacion usada.
                                </p>
                                <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onSwitchToExchange}>
                                    Pasar a cambio manual
                                </Button>
                            </div>
                        ) : (
                            <div
                                className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                                style={{
                                    borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                    background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
                                }}
                            >
                                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_176px] md:items-start">
                                    <FormattedAmountInput
                                        id="transferAmount"
                                        label="Monto a transferir"
                                        value={amount}
                                        currency={transferBalanceCurrency ?? currency}
                                        error={undefined}
                                        wrapperClassName="space-y-1.5"
                                        inputClassName="h-10 rounded-[1rem] text-[1.1rem] font-semibold tracking-tight"
                                        prefixClassName="text-[14px]"
                                        onValueChangeAction={onAmountChange}
                                    />

                                    <div className="space-y-1.5 md:self-start">
                                        <Label>Moneda</Label>
                                        {allowedCurrencies.length > 1 ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {allowedCurrencies.map((allowedCurrency) => {
                                                    const selected = currency === allowedCurrency
                                                    return (
                                                        <button
                                                            key={allowedCurrency}
                                                            type="button"
                                                            className="h-10 rounded-[1rem] border px-3 text-sm font-medium transition-colors"
                                                            style={{
                                                                borderColor: selected
                                                                    ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                                    : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                                background: selected
                                                                    ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                                    : 'transparent',
                                                            }}
                                                            onClick={() => onCurrencyChange(allowedCurrency)}
                                                        >
                                                            {allowedCurrency}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <div
                                                className="flex h-10 items-center rounded-[1rem] border px-3 text-sm font-medium"
                                                style={{
                                                    borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                    background: 'color-mix(in srgb, var(--background) 88%, var(--card) 12%)',
                                                }}
                                            >
                                                {allowedCurrencies[0] ?? currency}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {showErrors && amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}

                                {transferBalanceCurrency && transferSourceBalance !== null && transferDestinationBalance !== null ? (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {[
                                            {
                                                title: 'Origen',
                                                account: transferSourceLabel ?? 'Cuenta origen',
                                                current: transferSourceBalance,
                                                next: transferSourceResultingBalance,
                                            },
                                            {
                                                title: 'Destino',
                                                account: transferDestinationLabel ?? 'Cuenta destino',
                                                current: transferDestinationBalance,
                                                next: transferDestinationResultingBalance,
                                            },
                                        ].map((item) => (
                                            <div
                                                key={item.title}
                                                className="rounded-[1rem] border p-3"
                                                style={{
                                                    borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                    background: 'color-mix(in srgb, var(--background) 88%, var(--card) 12%)',
                                                }}
                                            >
                                                <p className="text-sm font-semibold">{item.title}</p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">{item.account}</p>

                                                <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                                                    <span className="text-muted-foreground">Saldo actual</span>
                                                    <span className="font-semibold tabular-nums">{fmtCurrency(item.current, transferBalanceCurrency)}</span>
                                                </div>

                                                {!isEditing && item.next !== null ? (
                                                    <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                                                        <span className="text-muted-foreground">Luego</span>
                                                        <span
                                                            className="font-semibold tabular-nums"
                                                            style={{ color: item.next < 0 ? 'var(--destructive)' : 'var(--foreground)' }}
                                                        >
                                                            {fmtCurrency(item.next, transferBalanceCurrency)}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {transferBalanceError ? (
                                    <div
                                        className="rounded-[1rem] border px-3 py-2 text-sm text-destructive"
                                        style={{
                                            borderColor: 'color-mix(in srgb, var(--destructive) 28%, transparent)',
                                            background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                                        }}
                                    >
                                        {transferBalanceError}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                )}

                {type === 'exchange' && (
                    <div
                        className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
                        style={{
                            ...subtlePanelStyle,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] xl:items-end">
                            <div className="space-y-1.5">
                                <Label>Cuenta origen</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={(value) => onSourceAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
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
                                {showErrors && sourceAccountIdError && <p className="text-sm text-destructive">{sourceAccountIdError}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Cuenta destino</Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={(value) => onDestinationAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
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
                                {showErrors && destinationAccountIdError && <p className="text-sm text-destructive">{destinationAccountIdError}</p>}
                            </div>

                            <div className="w-full space-y-1.5 xl:max-w-[220px]">
                                <Label>Fecha</Label>
                                <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
                                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                            {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={onDateChange} />
                                    </PopoverContent>
                                </Popover>
                                {showErrors && dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
                            </div>
                        </div>

                        <div
                            className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
                            }}
                        >
                            <div>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                                    Cambio {currency} / {exchangeDestinationCurrency}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Primero define la cotizacion y despues ajusta los montos si hace falta.
                                </p>
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
                                        onExchangeRateChange(nextRate)
                                    }}
                                    className="h-10 rounded-[1rem]"
                                />
                                <p className="text-xs text-muted-foreground">
                                    1 USD = {exchangeRate > 0 ? fmtCurrency(exchangeRate, 'ARS') : '$ 0'}
                                </p>
                                {showErrors && exchangeRateError && <p className="text-sm text-destructive">{exchangeRateError}</p>}
                            </div>

                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)] md:items-end">
                                <FormattedAmountInput
                                    id="exchangeSourceAmount"
                                    label={currency}
                                    value={amount}
                                    currency={currency}
                                    error={showErrors ? amountError : undefined}
                                    wrapperClassName="space-y-1.5"
                                    inputClassName="h-10 rounded-[1rem] text-[1.2rem] font-semibold tracking-tight md:text-[1.1rem]"
                                    prefixClassName="text-[14px]"
                                    onValueChangeAction={onAmountChange}
                                />

                                <div className="flex justify-center md:pb-1.5">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 rounded-full border-border/80 bg-transparent"
                                        onClick={onSwapExchangeDirection}
                                        disabled={!sourceAccountId || !destinationAccountId || !canSwapExchangeDirection}
                                        aria-label={`Invertir cambio a ${exchangeDestinationCurrency} / ${currency}`}
                                    >
                                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </div>

                                <FormattedAmountInput
                                    id="destinationAmount"
                                    label={exchangeDestinationCurrency}
                                    value={exchangeDestinationAmount}
                                    currency={exchangeDestinationCurrency}
                                    error={showErrors ? destinationAmountError : undefined}
                                    wrapperClassName="space-y-1.5"
                                    inputClassName="h-10 rounded-[1rem] text-[1.2rem] font-semibold tracking-tight md:text-[1.1rem]"
                                    prefixClassName="text-[14px]"
                                    onValueChangeAction={onDestinationAmountChange}
                                />
                            </div>

                            {exchangeConfigurationError ? (
                                <div
                                    className="rounded-[1rem] border px-3 py-2 text-sm text-destructive"
                                    style={{
                                        borderColor: 'color-mix(in srgb, var(--destructive) 28%, transparent)',
                                        background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                                    }}
                                >
                                    {exchangeConfigurationError}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}

                {type === 'credit_card_payment' && (
                    <div
                        className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
                        style={{
                            ...subtlePanelStyle,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] xl:items-end">
                            <div className="space-y-1.5">
                                <Label>Cuenta desde la que pagas</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={(value) => onSourceAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
                                        <SelectValue placeholder="Selecciona cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suggestedAccounts.map((account) => (
                                            <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                                {account.name} · {getAccountCurrencyLabel(account)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {showErrors && sourceAccountIdError && <p className="text-sm text-destructive">{sourceAccountIdError}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Tarjeta a pagar</Label>
                                <Select
                                    value={destinationAccountId}
                                    onValueChange={(value) => onDestinationAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
                                        <SelectValue placeholder="Selecciona tarjeta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinationAccounts.map((account) => (
                                            <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                                {account.name} · {getAccountCurrencyLabel(account)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {showErrors && destinationAccountIdError && <p className="text-sm text-destructive">{destinationAccountIdError}</p>}
                            </div>

                            <div className="w-full space-y-1.5 xl:max-w-[220px]">
                                <Label>Fecha</Label>
                                <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
                                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                            {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={onDateChange} />
                                    </PopoverContent>
                                </Popover>
                                {showErrors && dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
                            </div>
                        </div>

                        <div
                            className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
                            }}
                        >
                            <div className="space-y-1.5">
                                <Label>Que queres pagar</Label>
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
                                                    className="rounded-[0.95rem] border px-3 py-2 text-sm font-medium transition-colors"
                                                    style={{
                                                        borderColor: selected
                                                            ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                            : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                        background: selected
                                                            ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                            : 'transparent',
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

                            {allowCardPaymentFullMode && cardPaymentMode === 'full' ? (
                                fullPaymentOptions.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {fullPaymentOptions.map((option) => {
                                            const selected = cardPaymentSelection === option.id
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    className={`rounded-[1rem] border p-3 text-left transition-colors ${option.wide ? 'col-span-2' : ''}`}
                                                    style={{
                                                        borderColor: selected
                                                            ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                            : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                        background: selected
                                                            ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                            : 'color-mix(in srgb, var(--background) 86%, var(--card) 14%)',
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
                                                                    borderColor: 'color-mix(in srgb, var(--border) 84%, transparent)',
                                                                    background: 'color-mix(in srgb, var(--background) 88%, var(--card) 12%)',
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
                                )
                            ) : (
                                <div className="space-y-3">
                                    {canUseDualCardPayment && dualPartialInputs.length > 1 ? (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {dualPartialInputs.map((option) => (
                                                <div
                                                    key={option.currency}
                                                    className="min-w-0 space-y-1.5 rounded-[0.9rem] border p-2.5 sm:space-y-2 sm:rounded-[1rem] sm:p-3"
                                                    style={{
                                                        borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                        background: 'color-mix(in srgb, var(--background) 86%, var(--card) 14%)',
                                                    }}
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
                                                    {allowedCurrencies.map((allowedCurrency) => {
                                                        const selected = currency === allowedCurrency
                                                        return (
                                                            <button
                                                                key={allowedCurrency}
                                                                type="button"
                                                                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                                                                style={{
                                                                    borderColor: selected
                                                                        ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                                        : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                                    background: selected
                                                                        ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                                        : 'transparent',
                                                                }}
                                                                onClick={() => onCurrencyChange(allowedCurrency)}
                                                            >
                                                                {allowedCurrency}
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
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {type === 'adjustment' && (
                    <div
                        className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
                        style={{
                            ...subtlePanelStyle,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                        }}
                    >
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                            <div className="space-y-1.5">
                                <Label>Cuenta a ajustar</Label>
                                <Select
                                    value={sourceAccountId}
                                    onValueChange={(value) => onSourceAccountChange(value || undefined)}
                                >
                                    <SelectTrigger className="h-10 w-full rounded-[1rem]">
                                        <SelectValue placeholder="Selecciona cuenta" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suggestedAccounts.map((account) => (
                                            <SelectItem key={account._id.toString()} value={account._id.toString()}>
                                                {account.name} · {getAccountCurrencyLabel(account)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {showErrors && sourceAccountIdError ? <p className="text-sm text-destructive">{sourceAccountIdError}</p> : null}
                            </div>

                            <div className="w-full space-y-1.5 xl:max-w-[220px]">
                                <Label>Fecha</Label>
                                <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
                                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                                            {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={date} onSelect={onDateChange} />
                                    </PopoverContent>
                                </Popover>
                                {showErrors && dateError ? <p className="text-sm text-destructive">{dateError}</p> : null}
                            </div>
                        </div>

                        <div
                            className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
                            }}
                        >
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_176px] md:items-start">
                                <FormattedAmountInput
                                    id="adjustmentAmount"
                                    label="Monto del ajuste"
                                    value={amount}
                                    currency={currency}
                                    error={undefined}
                                    wrapperClassName="space-y-1.5"
                                    inputClassName="h-10 rounded-[1rem] text-[1.1rem] font-semibold tracking-tight"
                                    prefixClassName="text-[14px]"
                                    onValueChangeAction={onAmountChange}
                                />

                                <div className="space-y-1.5 md:self-start">
                                    <Label>Moneda</Label>
                                    {allowedCurrencies.length > 1 ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {allowedCurrencies.map((allowedCurrency) => {
                                                const selected = currency === allowedCurrency
                                                return (
                                                    <button
                                                        key={allowedCurrency}
                                                        type="button"
                                                        className="h-10 rounded-[1rem] border px-3 text-sm font-medium transition-colors"
                                                        style={{
                                                            borderColor: selected
                                                                ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                                : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                            background: selected
                                                                ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                                : 'transparent',
                                                        }}
                                                        onClick={() => onCurrencyChange(allowedCurrency)}
                                                    >
                                                        {allowedCurrency}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div
                                            className="flex h-10 items-center rounded-[1rem] border px-3 text-sm font-medium"
                                            style={{
                                                borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                background: 'color-mix(in srgb, var(--background) 88%, var(--card) 12%)',
                                            }}
                                        >
                                            {allowedCurrencies[0] ?? currency}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {showErrors && amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}

                            <div className="space-y-1.5">
                                <div>
                                    <p className="text-sm font-semibold">Impacto del ajuste</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Defini si esta correccion suma o descuenta saldo.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {([
                                        { sign: '-', label: 'Descuenta', tone: 'var(--destructive)' },
                                        { sign: '+', label: 'Suma', tone: '#059669' },
                                    ] as const).map((option) => {
                                        const selected = adjustmentSign === option.sign
                                        return (
                                            <button
                                                key={option.sign}
                                                type="button"
                                                className="rounded-[1rem] border px-3 py-2 text-sm font-medium transition-colors"
                                                style={{
                                                    borderColor: selected
                                                        ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                                        : 'color-mix(in srgb, var(--border) 88%, transparent)',
                                                    background: selected
                                                        ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                                        : 'transparent',
                                                    color: selected ? option.tone : 'var(--foreground)',
                                                }}
                                                onClick={() => onAdjustmentSignChange(option.sign)}
                                            >
                                                {option.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </StepSection>
    )
}
