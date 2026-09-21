'use client'

import { Minus, Plus, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { MonthPickerField } from '@/components/shared/MonthPickerField'
import { formatCurrencyAmount } from '@/lib/utils/currency-format'
import {
    getInstallmentMonthOptions,
    getInstallmentPlanPeriodLabel,
} from '@/lib/utils/installments'

export function SpaceCreditCardPlanFields({
    idPrefix,
    purchaseDate,
    currency,
    totalAmount,
    operationalAmount,
    installmentCount,
    firstClosingMonth,
    installmentQuoteAmount,
    allowTotalCalculation = false,
    error,
    onInstallmentCountChange,
    onFirstClosingMonthChange,
    onInstallmentQuoteAmountChange,
    onTotalAmountChange,
}: {
    idPrefix: string
    purchaseDate: Date
    currency: string
    totalAmount: number
    operationalAmount?: number
    installmentCount: number
    firstClosingMonth: string
    installmentQuoteAmount?: number
    allowTotalCalculation?: boolean
    error?: string
    onInstallmentCountChange: (count: number) => void
    onFirstClosingMonthChange: (value: string) => void
    onInstallmentQuoteAmountChange?: (amount: number | undefined) => void
    onTotalAmountChange?: (amount: number) => void
}) {
    const count = Math.max(1, installmentCount)
    const installmentAmount = totalAmount > 0 ? totalAmount / count : 0
    const operationalInstallmentAmount =
        typeof operationalAmount === 'number' && operationalAmount >= 0
            ? operationalAmount / count
            : undefined
    const monthOptions = getInstallmentMonthOptions(purchaseDate, firstClosingMonth)
    const periodLabel = getInstallmentPlanPeriodLabel(firstClosingMonth, count)

    return (
        <div className="space-y-4 rounded-[1.4rem] border border-primary/15 bg-primary/5 p-4">
            <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Plan de la tarjeta</p>
                <p className="text-xs text-muted-foreground">
                    Es privado: no divide ni cambia el movimiento compartido.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-installment-count`}>Cuotas</Label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onInstallmentCountChange(Math.max(1, count - 1))}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background transition-colors hover:bg-muted"
                            aria-label="Reducir cuotas"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <Input
                            id={`${idPrefix}-installment-count`}
                            type="number"
                            min={1}
                            value={count}
                            onChange={(event) =>
                                onInstallmentCountChange(Math.max(1, Number.parseInt(event.target.value, 10) || 1))
                            }
                            className="text-center text-lg font-semibold"
                        />
                        <button
                            type="button"
                            onClick={() => onInstallmentCountChange(count + 1)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background transition-colors hover:bg-muted"
                            aria-label="Aumentar cuotas"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <MonthPickerField
                    label="Primera cuota"
                    value={firstClosingMonth}
                    options={monthOptions}
                    onValueChange={onFirstClosingMonthChange}
                    error={error}
                />
            </div>

            {allowTotalCalculation && onInstallmentQuoteAmountChange && onTotalAmountChange ? (
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="space-y-1">
                        <FormattedAmountInput
                            id={`${idPrefix}-installment-amount`}
                            label="Valor de cuota"
                            value={installmentQuoteAmount}
                            currency={currency}
                            showCurrencyFlag
                            placeholder="Ej. valor del resumen"
                            onValueChangeAction={onInstallmentQuoteAmountChange}
                        />
                        <p className="text-xs text-muted-foreground">
                            Ingresá una cuota y calculamos el total del movimiento.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 self-end"
                        onClick={() => {
                            if (installmentQuoteAmount && installmentQuoteAmount > 0) {
                                onTotalAmountChange(Number((installmentQuoteAmount * count).toFixed(2)))
                            }
                        }}
                        disabled={!installmentQuoteAmount || installmentQuoteAmount <= 0}
                    >
                        <Wand2 className="mr-2 h-4 w-4" />
                        Calcular total
                    </Button>
                </div>
            ) : null}

            <div className="rounded-[1.2rem] border border-border bg-background px-3 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Resumen</p>
                <p className="mt-1 font-semibold text-foreground">
                    {count} {count === 1 ? 'cuota' : 'cuotas'} × {formatCurrencyAmount(installmentAmount, currency)}
                </p>
                {periodLabel ? <p className="mt-1 text-xs text-muted-foreground">{periodLabel}</p> : null}
                {operationalInstallmentAmount !== undefined &&
                Math.abs(operationalInstallmentAmount - installmentAmount) > 0.001 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Tu parte: {formatCurrencyAmount(operationalInstallmentAmount, currency)} por cuota.
                    </p>
                ) : null}
            </div>
        </div>
    )
}
