import { motion } from 'framer-motion'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { staggerItem } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { SURFACE, getTypeSurface } from '../shared-ui'

const SURFACE_ACCENT = getTypeSurface('exchange', false)
import { AccountSelectorField } from '../fields/AccountSelectorField'
import { DatePickerField } from '../fields/DatePickerField'

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
    exchangeRateError: string | undefined
    destinationAmountError: string | undefined
    exchangeConfigurationError: string | null
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
    exchangeRateError,
    destinationAmountError,
    exchangeConfigurationError,
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
    onSwapExchangeDirection,
}: ExchangeFlowProps) {
    return (
        <motion.div
            variants={staggerItem}
            className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
            style={{ borderColor: SURFACE_ACCENT.borderColor, background: SURFACE_ACCENT.background, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
        >
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.1em]" style={{ color: SURFACE_ACCENT.color }}>Cambio manual</p>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] xl:items-end">
                <AccountSelectorField
                    label="Cuenta origen"
                    value={sourceAccountId}
                    accounts={suggestedAccounts}
                    error={sourceAccountIdError}
                    showErrors={showErrors}
                    placeholder="Selecciona cuenta de origen"
                    onChange={onSourceAccountChange}
                />

                <AccountSelectorField
                    label="Cuenta destino"
                    value={destinationAccountId}
                    accounts={destinationAccounts}
                    error={destinationAccountIdError}
                    showErrors={showErrors}
                    placeholder="Selecciona cuenta destino"
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

                {exchangeConfigurationError && (
                    <div
                        className="rounded-[1rem] border px-3 py-2 text-sm text-destructive"
                        style={{
                            borderColor: 'color-mix(in srgb, var(--destructive) 28%, transparent)',
                            background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                        }}
                    >
                        {exchangeConfigurationError}
                    </div>
                )}
            </div>
        </motion.div>
    )
}
