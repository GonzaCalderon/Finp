import { ArrowLeftRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { getAccountCurrencyLabel } from '@/lib/utils/accounts'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { StepSection } from './StepSection'
import { SummaryLine, subtlePanelStyle } from './shared-ui'

type PaymentSummaryItem = { due: number; paid: number; pending: number; currency: string }
type PaymentSummaryByCurrency = Partial<Record<string, PaymentSummaryItem>>

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
    // exchange
    exchangeDestinationAmount: number
    exchangeDestinationCurrency: TransactionFormInput['currency']
    exchangeRate: number
    exchangeRecalcMode: 'destinationAmount' | 'exchangeRate'
    allowedExchangeDestinationCurrencies: TransactionFormInput['currency'][]
    currency: TransactionFormInput['currency']
    destinationAmountError: string | undefined
    exchangeRateError: string | undefined
    // card payment
    paymentSummary: PaymentSummaryData | null
    canUseDualCardPayment: boolean
    secondaryCardPaymentCurrency: TransactionFormInput['currency'] | undefined
    additionalCardPaymentEnabled: boolean
    secondaryCardPaymentAmount: number
    secondaryCardPaymentSummary: PaymentSummaryItem | null
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    // callbacks
    onSourceAccountChange: (id: string | undefined) => void
    onDestinationAccountChange: (id: string | undefined) => void
    onSwitchToExchange: () => void
    onDestinationAmountChange: (amount: number) => void
    onExchangeDestinationCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onExchangeRateChange: (rate: number) => void
    onRecalcModeChange: (mode: 'destinationAmount' | 'exchangeRate') => void
    onUseAmountFromSummary: (amount: number, currency: string) => void
    onAdditionalCardPaymentToggle: (enabled: boolean) => void
    onSecondaryCardPaymentAmountChange: (amount: number) => void
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
    exchangeDestinationAmount,
    exchangeDestinationCurrency,
    exchangeRate,
    exchangeRecalcMode,
    allowedExchangeDestinationCurrencies,
    currency,
    destinationAmountError,
    exchangeRateError,
    paymentSummary,
    canUseDualCardPayment,
    secondaryCardPaymentCurrency,
    additionalCardPaymentEnabled,
    secondaryCardPaymentAmount,
    secondaryCardPaymentSummary,
    fmtCurrency,
    onSourceAccountChange,
    onDestinationAccountChange,
    onSwitchToExchange,
    onDestinationAmountChange,
    onExchangeDestinationCurrencyChange,
    onExchangeRateChange,
    onRecalcModeChange,
    onUseAmountFromSummary,
    onAdditionalCardPaymentToggle,
    onSecondaryCardPaymentAmountChange,
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
                        ? 'Tomamos el saldo del mes y, si hace falta, te dejamos sumar un segundo pago.'
                        : 'Defini en que cuenta impacta este ajuste.'

    const summaryItems = paymentSummary
        ? (Object.values(paymentSummary.byCurrency ?? {
            [paymentSummary.currency]: paymentSummary,
        }) as PaymentSummaryItem[])
        : []

    return (
        <StepSection eyebrow="Paso 3" title={title} subtitle={subtitle}>
            <div className="space-y-4">
                {showSource && (
                    <div className="space-y-2">
                        <Label>{type === 'exchange' ? 'Cuenta origen' : 'Cuenta de origen'}</Label>
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
                        {sourceAccountIdError && <p className="text-sm text-destructive">{sourceAccountIdError}</p>}
                    </div>
                )}

                {showDestination && type === 'income' && (
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
                        {destinationAccountIdError && <p className="text-sm text-destructive">{destinationAccountIdError}</p>}
                    </div>
                )}

                {showDestination && type !== 'income' && (
                    <div className="space-y-2">
                        <Label>{type === 'credit_card_payment' ? 'Tarjeta a pagar' : 'Cuenta destino'}</Label>
                        <Select
                            value={destinationAccountId}
                            onValueChange={(value) => onDestinationAccountChange(value || undefined)}
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
                        {destinationAccountIdError && <p className="text-sm text-destructive">{destinationAccountIdError}</p>}
                    </div>
                )}

                {hasCrossCurrencyTransferConflict && (
                    <div className="rounded-3xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.10)' }}>
                        <p className="text-amber-700 dark:text-amber-300">
                            Estas cuentas no comparten moneda. Conviene registrarlo como cambio manual para guardar la cotizacion usada.
                        </p>
                        <Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onSwitchToExchange}>
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
                                    onClick={() => onRecalcModeChange('destinationAmount')}
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
                                    onClick={() => onRecalcModeChange('exchangeRate')}
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
                                error={destinationAmountError}
                                onValueChangeAction={onDestinationAmountChange}
                            />

                            <div className="space-y-2">
                                <Label>Moneda destino</Label>
                                <Select
                                    value={exchangeDestinationCurrency}
                                    onValueChange={(value) => onExchangeDestinationCurrencyChange(value as TransactionFormInput['currency'])}
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
                                    onExchangeRateChange(nextRate)
                                }}
                            />
                            <p className="text-xs text-muted-foreground">Guardamos la cotizacion usada para reconstruir el cambio en el futuro.</p>
                            {exchangeRateError && <p className="text-sm text-destructive">{exchangeRateError}</p>}
                        </div>
                    </div>
                )}

                {type === 'credit_card_payment' && paymentSummary && destinationAccountId && (
                    <div className="space-y-3 rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        {summaryItems.map((summaryItem) => {
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
                                            onClick={() => onUseAmountFromSummary(summaryItem.pending, summaryItem.currency)}
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
                                    <Switch checked={additionalCardPaymentEnabled} onCheckedChange={onAdditionalCardPaymentToggle} />
                                </div>

                                {additionalCardPaymentEnabled && (
                                    <div className="mt-3 space-y-2">
                                        <FormattedAmountInput
                                            id="secondaryCardPaymentAmount"
                                            label={`Monto adicional en ${secondaryCardPaymentCurrency}`}
                                            value={secondaryCardPaymentAmount}
                                            currency={secondaryCardPaymentCurrency}
                                            placeholder="0"
                                            onValueChangeAction={onSecondaryCardPaymentAmountChange}
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
}
