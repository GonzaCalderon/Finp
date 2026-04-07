import { motion } from 'framer-motion'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { staggerItem } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { SURFACE, getTypeSurface } from '../shared-ui'

const SURFACE_ACCENT = getTypeSurface('adjustment', false)
import { AccountSelectorField } from '../fields/AccountSelectorField'
import { DatePickerField } from '../fields/DatePickerField'
import { CurrencyToggleButtons } from '../fields/CurrencyToggleButtons'

interface AdjustmentFlowProps {
    sourceAccountId: string | undefined
    suggestedAccounts: IAccount[]
    sourceAccountIdError: string | undefined
    date: Date | undefined
    dateError: string | undefined
    isDatePopoverOpen: boolean
    amount: number
    amountError: string | undefined
    currency: TransactionFormInput['currency']
    allowedCurrencies: TransactionFormInput['currency'][]
    adjustmentSign: '+' | '-'
    showErrors: boolean
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onSourceAccountChange: (id: string | undefined) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onAmountChange: (amount: number) => void
    onCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onAdjustmentSignChange: (sign: '+' | '-') => void
}

export function AdjustmentFlow({
    sourceAccountId,
    suggestedAccounts,
    sourceAccountIdError,
    date,
    dateError,
    isDatePopoverOpen,
    amount,
    amountError,
    currency,
    allowedCurrencies,
    adjustmentSign,
    showErrors,
    onSourceAccountChange,
    onDateChange,
    onDatePopoverOpenChange,
    onAmountChange,
    onCurrencyChange,
    onAdjustmentSignChange,
}: AdjustmentFlowProps) {
    return (
        <motion.div
            variants={staggerItem}
            className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
            style={{ borderColor: SURFACE_ACCENT.borderColor, background: SURFACE_ACCENT.background, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
        >
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.1em]" style={{ color: SURFACE_ACCENT.color }}>Ajuste</p>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                <AccountSelectorField
                    label="Cuenta a ajustar"
                    value={sourceAccountId}
                    accounts={suggestedAccounts}
                    error={sourceAccountIdError}
                    showErrors={showErrors}
                    placeholder="Selecciona cuenta"
                    onChange={onSourceAccountChange}
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

                    <CurrencyToggleButtons
                        value={currency}
                        allowed={allowedCurrencies}
                        onChange={onCurrencyChange}
                    />
                </div>

                {showErrors && amountError && <p className="text-sm text-destructive">{amountError}</p>}

                <div className="space-y-1.5">
                    <div>
                        <p className="text-sm font-semibold">Impacto del ajuste</p>
                        <p className="mt-1 text-xs text-muted-foreground">Defini si esta correccion suma o descuenta saldo.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {([
                            { sign: '-', label: 'Descuenta', color: 'var(--destructive)' },
                            { sign: '+', label: 'Suma', color: '#059669' },
                        ] as const).map((option) => {
                            const selected = adjustmentSign === option.sign
                            return (
                                <button
                                    key={option.sign}
                                    type="button"
                                    className="rounded-[1rem] border px-3 py-2 text-sm font-medium transition-colors"
                                    style={{
                                        borderColor: selected ? SURFACE.selected.borderColor : SURFACE.inner.borderColor,
                                        background: selected ? SURFACE.selected.background : 'transparent',
                                        color: selected ? option.color : 'var(--foreground)',
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
        </motion.div>
    )
}
