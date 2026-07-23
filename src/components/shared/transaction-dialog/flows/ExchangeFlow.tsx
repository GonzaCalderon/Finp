import { motion } from 'framer-motion'
import { ArrowDownUp, ArrowRight, CircleDollarSign, RefreshCw } from 'lucide-react'

import { CurrencyFlagIcon } from '@/components/shared/CurrencyFlagIcon'
import { CurrencyPillSelector } from '@/components/shared/CurrencyPillSelector'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { Button } from '@/components/ui/button'
import { staggerItem } from '@/lib/utils/animations'
import {
    getQuoteRateForDirection,
    type DolarApiQuoteHouse,
    type ExchangeRateQuote,
} from '@/lib/utils/exchange-rates'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { SURFACE, getTypeSurface } from '../shared-ui'
import { AccountSelectorField } from '../fields/AccountSelectorField'
import { DatePickerField } from '../fields/DatePickerField'

const SURFACE_ACCENT = getTypeSurface('exchange', false)
const EXCHANGE_SOURCE_CURRENCIES = ['ARS', 'USD'] as const

interface ExchangeFlowProps {
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
    exchangeDestinationAmount: number
    exchangeDestinationCurrency: TransactionFormInput['currency']
    exchangeRate: number
    exchangeRateMode: 'automatic' | 'manual'
    exchangeRateQuotes: ExchangeRateQuote[]
    selectedExchangeRateHouse: DolarApiQuoteHouse
    isExchangeRateLoading: boolean
    exchangeRateLoadError: string | null
    exchangeRateError: string | undefined
    destinationAmountError: string | undefined
    exchangeConfigurationError: string | null
    exchangeBalanceError: string | null
    exchangeOperationLabel: string
    exchangeSourceBalance: number | null
    exchangeDestinationBalance: number | null
    exchangeSourceResultingBalance: number | null
    exchangeDestinationResultingBalance: number | null
    canSwapExchangeDirection: boolean
    showErrors: boolean
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onSourceAccountChange: (id: string | undefined) => void
    onDestinationAccountChange: (id: string | undefined) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onAmountChange: (amount: number) => void
    onDestinationAmountChange: (amount: number) => void
    onExchangeRateChange: (rate: number) => void
    onExchangeRateHouseChange: (house: DolarApiQuoteHouse) => void
    onRefreshExchangeRates: () => void
    onSwapExchangeDirection: () => void
}

export function ExchangeFlow({
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
    exchangeDestinationAmount,
    exchangeDestinationCurrency,
    exchangeRate,
    exchangeRateMode,
    exchangeRateQuotes,
    selectedExchangeRateHouse,
    isExchangeRateLoading,
    exchangeRateLoadError,
    exchangeRateError,
    destinationAmountError,
    exchangeConfigurationError,
    exchangeBalanceError,
    exchangeOperationLabel,
    exchangeSourceBalance,
    exchangeDestinationBalance,
    exchangeSourceResultingBalance,
    exchangeDestinationResultingBalance,
    canSwapExchangeDirection,
    showErrors,
    fmtCurrency,
    onSourceAccountChange,
    onDestinationAccountChange,
    onDateChange,
    onDatePopoverOpenChange,
    onAmountChange,
    onDestinationAmountChange,
    onExchangeRateChange,
    onExchangeRateHouseChange,
    onRefreshExchangeRates,
    onSwapExchangeDirection,
}: ExchangeFlowProps) {
    const selectedQuote =
        exchangeRateQuotes.find((quote) => quote.house === selectedExchangeRateHouse) ?? null
    const rateSide = currency === 'ARS' ? 'venta' : 'compra'
    const quoteUpdatedLabel = selectedQuote
        ? new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(selectedQuote.updatedAt))
        : null

    return (
        <motion.div
            variants={staggerItem}
            className="space-y-4 rounded-[1.85rem] border p-3.5 md:p-5"
            style={{
                borderColor: SURFACE_ACCENT.borderColor,
                background: SURFACE_ACCENT.background,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
            }}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
                        style={{ background: SURFACE_ACCENT.background, color: SURFACE_ACCENT.color }}
                    >
                        <CircleDollarSign className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-base font-semibold">{exchangeOperationLabel}</p>
                        <p className="text-xs text-muted-foreground">
                            Indicá qué saldo entregás y cuánto recibís. Finp registra ambos impactos juntos.
                        </p>
                    </div>
                </div>
                <div className="w-full space-y-1 sm:w-44">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        Moneda que entregás
                    </p>
                    <CurrencyPillSelector
                        value={currency}
                        options={EXCHANGE_SOURCE_CURRENCIES}
                        compact
                        disabled={!sourceAccountId || !destinationAccountId || !canSwapExchangeDirection}
                        onValueChange={(nextCurrency) => {
                            if (nextCurrency !== currency) onSwapExchangeDirection()
                        }}
                    />
                </div>
            </div>

            <div
                className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                style={SURFACE.inner}
            >
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold">Cotización</p>
                        <p className="text-xs text-muted-foreground">
                            Elegí una referencia o escribí el valor que acordaste.
                        </p>
                    </div>
                    <span className="rounded-full border border-border/80 bg-background/75 px-2.5 py-1 text-[0.68rem] font-semibold text-muted-foreground">
                        {exchangeRateMode === 'automatic' ? 'Referencia automática' : 'Valor manual'}
                    </span>
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de cotización">
                    {exchangeRateQuotes.map((quote) => {
                        const selected =
                            exchangeRateMode === 'automatic' &&
                            quote.house === selectedExchangeRateHouse
                        const referenceRate = getQuoteRateForDirection(
                            quote,
                            currency,
                            exchangeDestinationCurrency
                        )

                        return (
                            <Button
                                key={quote.house}
                                type="button"
                                variant={selected ? 'default' : 'outline'}
                                size="sm"
                                role="radio"
                                aria-checked={selected}
                                className="h-8 rounded-full px-3 text-xs"
                                onClick={() => onExchangeRateHouseChange(quote.house)}
                            >
                                {quote.name} · {fmtCurrency(referenceRate, 'ARS')}
                            </Button>
                        )
                    })}
                    {isExchangeRateLoading && exchangeRateQuotes.length === 0 ? (
                        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border/80 px-3 text-xs text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Buscando cotización
                        </span>
                    ) : null}
                </div>

                <FormattedAmountInput
                    id="exchangeRate"
                    label="ARS por 1 USD"
                    value={exchangeRate}
                    currency="ARS"
                    showCurrencyFlag
                    error={showErrors ? exchangeRateError : undefined}
                    wrapperClassName="space-y-1.5"
                    inputClassName="h-11 rounded-[1rem] font-semibold"
                    helperText={
                        exchangeRateMode === 'automatic' && selectedQuote
                            ? `${selectedQuote.name} · ${rateSide}${quoteUpdatedLabel ? ` · actualizada ${quoteUpdatedLabel}` : ''}. Fuente: DolarAPI.`
                            : 'Al editar este valor pasa a modo manual. Los montos se recalculan al instante.'
                    }
                    onValueChangeAction={onExchangeRateChange}
                />

                {exchangeRateLoadError ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <span>{exchangeRateLoadError}</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-lg px-2 text-xs"
                            disabled={isExchangeRateLoading}
                            onClick={onRefreshExchangeRates}
                        >
                            <RefreshCw className={isExchangeRateLoading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
                            Reintentar
                        </Button>
                    </div>
                ) : null}
            </div>

            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:items-stretch">
                <div className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4" style={SURFACE.inner}>
                    <div className="flex items-center gap-2.5">
                        <CurrencyFlagIcon currency={currency} className="h-7 w-7" />
                        <div>
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Entregás · {currency}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Se descuenta de esta cuenta</p>
                        </div>
                    </div>

                    <AccountSelectorField
                        label="Cuenta"
                        value={sourceAccountId}
                        accounts={suggestedAccounts}
                        error={sourceAccountIdError}
                        showErrors={showErrors}
                        placeholder="Elegí la cuenta"
                        onChange={onSourceAccountChange}
                    />

                    <FormattedAmountInput
                        id="exchangeSourceAmount"
                        label={`Monto en ${currency}`}
                        value={amount}
                        currency={currency}
                        showCurrencyFlag
                        error={showErrors ? amountError : undefined}
                        wrapperClassName="space-y-1.5"
                        inputClassName="h-12 rounded-[1rem] text-[1.35rem] font-semibold tracking-tight"
                        prefixClassName="text-[14px]"
                        onValueChangeAction={onAmountChange}
                    />

                    {exchangeSourceBalance !== null && exchangeSourceResultingBalance !== null && (
                        <div
                            className="flex items-center justify-between gap-2 border-t pt-3 text-xs"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <span className="text-muted-foreground">Saldo</span>
                            <span className="flex items-center gap-1.5 font-medium">
                                {fmtCurrency(exchangeSourceBalance, currency)}
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className={exchangeBalanceError ? 'text-destructive' : ''}>
                                    {fmtCurrency(exchangeSourceResultingBalance, currency)}
                                </span>
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-center">
                    <div className="h-px flex-1 bg-border md:hidden" />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mx-2 h-10 w-10 shrink-0 rounded-full border-border/80 bg-background shadow-sm"
                        onClick={onSwapExchangeDirection}
                        disabled={!sourceAccountId || !destinationAccountId || !canSwapExchangeDirection}
                        aria-label="Invertir operación: intercambiar cuentas, monedas y montos"
                    >
                        <ArrowDownUp className="h-4 w-4 text-muted-foreground md:-rotate-90" />
                    </Button>
                    <div className="h-px flex-1 bg-border md:hidden" />
                </div>

                <div className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4" style={SURFACE.inner}>
                    <div className="flex items-center gap-2.5">
                        <CurrencyFlagIcon currency={exchangeDestinationCurrency} className="h-7 w-7" />
                        <div>
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Recibís · {exchangeDestinationCurrency}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Se acredita en esta cuenta</p>
                        </div>
                    </div>

                    <AccountSelectorField
                        label="Cuenta"
                        value={destinationAccountId}
                        accounts={destinationAccounts}
                        error={destinationAccountIdError}
                        showErrors={showErrors}
                        placeholder="Elegí la cuenta"
                        onChange={onDestinationAccountChange}
                    />

                    <FormattedAmountInput
                        id="destinationAmount"
                        label={`Monto en ${exchangeDestinationCurrency}`}
                        value={exchangeDestinationAmount}
                        currency={exchangeDestinationCurrency}
                        showCurrencyFlag
                        error={showErrors ? destinationAmountError : undefined}
                        wrapperClassName="space-y-1.5"
                        inputClassName="h-12 rounded-[1rem] text-[1.35rem] font-semibold tracking-tight"
                        prefixClassName="text-[14px]"
                        onValueChangeAction={onDestinationAmountChange}
                    />

                    {exchangeDestinationBalance !== null && exchangeDestinationResultingBalance !== null && (
                        <div
                            className="flex items-center justify-between gap-2 border-t pt-3 text-xs"
                            style={{ borderColor: 'var(--border)' }}
                        >
                            <span className="text-muted-foreground">Saldo</span>
                            <span className="flex items-center gap-1.5 font-medium">
                                {fmtCurrency(exchangeDestinationBalance, exchangeDestinationCurrency)}
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                {fmtCurrency(exchangeDestinationResultingBalance, exchangeDestinationCurrency)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-[1.35rem] border p-3.5 md:p-4" style={SURFACE.inner}>
                <DatePickerField
                    value={date}
                    error={dateError}
                    showErrors={showErrors}
                    isOpen={isDatePopoverOpen}
                    onOpenChange={onDatePopoverOpenChange}
                    onChange={onDateChange}
                    className="w-full space-y-1.5"
                />
            </div>

            {(exchangeConfigurationError || exchangeBalanceError) && (
                <div
                    className="rounded-[1rem] border px-3 py-2 text-sm text-destructive"
                    style={{
                        borderColor: 'color-mix(in srgb, var(--destructive) 28%, transparent)',
                        background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                    }}
                >
                    {exchangeConfigurationError ?? exchangeBalanceError}
                </div>
            )}
        </motion.div>
    )
}
