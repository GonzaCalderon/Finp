import type { ReactNode } from 'react'
import { Banknote, Building2, CreditCard, Minus, Plus, Wand2 } from 'lucide-react'

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
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { getAccountCurrencyLabel } from '@/lib/utils/accounts'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import type { PaymentMethod } from '@/components/shared/transaction-dialog-prefs'
import { StepSection } from './StepSection'
import { subtlePanelStyle, getSubtleSelectedStyle } from './shared-ui'

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string; icon: ReactNode }> = [
    { value: 'cash', label: 'Efectivo', icon: <Banknote className="h-4 w-4" /> },
    { value: 'debit', label: 'Debito / transferencia', icon: <Building2 className="h-4 w-4" /> },
    { value: 'credit_card', label: 'Tarjeta', icon: <CreditCard className="h-4 w-4" /> },
]

interface TransactionExpenseDetailsStepProps {
    paymentMethod: PaymentMethod
    isCardExpense: boolean
    sourceAccountId: string | undefined
    expenseAccounts: IAccount[]
    sourceAccountIdError: string | undefined
    isEditing: boolean
    installmentCount: number
    firstClosingMonth: string
    firstMonthError: string | null
    monthOptions: Array<{ value: string; label: string }>
    installmentQuoteAmount: number
    installmentPlanSummary: string
    installmentAmount: number
    planMonthsLabel: string
    currency: TransactionFormInput['currency']
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onPaymentMethodChange: (method: PaymentMethod) => void
    onSourceAccountChange: (id: string | undefined) => void
    onInstallmentCountChange: (count: number) => void
    onFirstClosingMonthChange: (value: string) => void
    onInstallmentQuoteAmountChange: (amount: number) => void
    onApplyInstallmentQuoteAmount: () => void
}

export function TransactionExpenseDetailsStep({
    paymentMethod,
    isCardExpense,
    sourceAccountId,
    expenseAccounts,
    sourceAccountIdError,
    isEditing,
    installmentCount,
    firstClosingMonth,
    firstMonthError,
    monthOptions,
    installmentQuoteAmount,
    installmentPlanSummary,
    installmentAmount,
    planMonthsLabel,
    currency,
    fmtCurrency,
    onPaymentMethodChange,
    onSourceAccountChange,
    onInstallmentCountChange,
    onFirstClosingMonthChange,
    onInstallmentQuoteAmountChange,
    onApplyInstallmentQuoteAmount,
}: TransactionExpenseDetailsStepProps) {
    return (
        <StepSection
            eyebrow="Paso 3"
            title="Como lo pagaste"
            subtitle="Primero elegi el medio de pago. Despues aparece solo lo que hace falta para ese caso."
        >
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                        const selected = paymentMethod === method.value
                        return (
                            <button
                                key={method.value}
                                type="button"
                                onClick={() => onPaymentMethodChange(method.value)}
                                className="rounded-2xl border px-3 py-3 text-left transition-colors"
                                data-testid={`transaction-payment-${method.value}`}
                                style={{
                                    ...getSubtleSelectedStyle(selected),
                                    background: selected ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)' : 'var(--background)',
                                }}
                            >
                                <div className="flex flex-col items-start gap-2 text-sm font-medium sm:flex-row sm:items-center">
                                    {method.icon}
                                    <span className="leading-tight">{method.label}</span>
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
                                onValueChange={(value) => onSourceAccountChange(value || undefined)}
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
                            {sourceAccountIdError && <p className="text-sm text-destructive">{sourceAccountIdError}</p>}
                        </div>
                        {!isEditing && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label>Cuotas</Label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onInstallmentCountChange(Math.max(1, installmentCount - 1))}
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
                                                    onInstallmentCountChange(Math.max(1, parseInt(event.target.value, 10) || 1))
                                                }
                                                className="text-center text-xl font-semibold"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => onInstallmentCountChange(installmentCount + 1)}
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
                                            onValueChange={onFirstClosingMonthChange}
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
                                    <div className="space-y-1">
                                        <FormattedAmountInput
                                            id="installmentQuoteAmount"
                                            label="Valor de cuota"
                                            value={installmentQuoteAmount}
                                            currency={currency}
                                            placeholder="Ej. valor del resumen"
                                            onValueChangeAction={onInstallmentQuoteAmountChange}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Ingresa el valor de una cuota y calculamos el total automaticamente.
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="h-11 self-end"
                                        onClick={onApplyInstallmentQuoteAmount}
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
                            <p className="mt-1 text-lg font-semibold">{installmentPlanSummary}</p>
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
                            onValueChange={(value) => onSourceAccountChange(value || undefined)}
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
                        {sourceAccountIdError && <p className="text-sm text-destructive">{sourceAccountIdError}</p>}
                    </div>
                )}
            </div>
        </StepSection>
    )
}
