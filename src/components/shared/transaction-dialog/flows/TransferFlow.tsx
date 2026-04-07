import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { staggerItem } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { SURFACE, getTypeSurface } from '../shared-ui'

const SURFACE_ACCENT = getTypeSurface('transfer', false)
import { AccountSelectorField } from '../fields/AccountSelectorField'
import { DatePickerField } from '../fields/DatePickerField'
import { CurrencyToggleButtons } from '../fields/CurrencyToggleButtons'

interface TransferFlowProps {
    sourceAccountId: string | undefined
    destinationAccountId: string | undefined
    suggestedAccounts: IAccount[]
    destinationAccounts: IAccount[]
    sourceAccountIdError: string | undefined
    destinationAccountIdError: string | undefined
    hasCrossCurrencyTransferConflict: boolean
    date: Date | undefined
    dateError: string | undefined
    isDatePopoverOpen: boolean
    amount: number
    amountError: string | undefined
    currency: TransactionFormInput['currency']
    allowedCurrencies: TransactionFormInput['currency'][]
    transferSourceLabel: string | undefined
    transferDestinationLabel: string | undefined
    transferBalanceCurrency: TransactionFormInput['currency'] | undefined
    transferSourceBalance: number | null
    transferDestinationBalance: number | null
    transferSourceResultingBalance: number | null
    transferDestinationResultingBalance: number | null
    transferBalanceError: string | null
    isEditing: boolean
    showErrors: boolean
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onSourceAccountChange: (id: string | undefined) => void
    onDestinationAccountChange: (id: string | undefined) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onAmountChange: (amount: number) => void
    onCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onSwitchToExchange: () => void
}

export function TransferFlow({
    sourceAccountId,
    destinationAccountId,
    suggestedAccounts,
    destinationAccounts,
    sourceAccountIdError,
    destinationAccountIdError,
    hasCrossCurrencyTransferConflict,
    date,
    dateError,
    isDatePopoverOpen,
    amount,
    amountError,
    currency,
    allowedCurrencies,
    transferSourceLabel,
    transferDestinationLabel,
    transferBalanceCurrency,
    transferSourceBalance,
    transferDestinationBalance,
    transferSourceResultingBalance,
    transferDestinationResultingBalance,
    transferBalanceError,
    isEditing,
    showErrors,
    fmtCurrency,
    onSourceAccountChange,
    onDestinationAccountChange,
    onDateChange,
    onDatePopoverOpenChange,
    onAmountChange,
    onCurrencyChange,
    onSwitchToExchange,
}: TransferFlowProps) {
    return (
        <motion.div
            variants={staggerItem}
            className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
            style={{ borderColor: SURFACE_ACCENT.borderColor, background: SURFACE_ACCENT.background, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
        >
            <p className="text-[0.82rem] font-semibold uppercase tracking-[0.1em]" style={{ color: SURFACE_ACCENT.color }}>Transferencia</p>
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
                <div className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4" style={SURFACE.inner}>
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

                        <CurrencyToggleButtons
                            value={currency}
                            allowed={allowedCurrencies}
                            onChange={onCurrencyChange}
                        />
                    </div>

                    {showErrors && amountError && <p className="text-sm text-destructive">{amountError}</p>}

                    {transferBalanceCurrency && transferSourceBalance !== null && transferDestinationBalance !== null && (
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
                                    style={SURFACE.inner}
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
                    )}

                    {transferBalanceError && (
                        <div
                            className="rounded-[1rem] border px-3 py-2 text-sm text-destructive"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--destructive) 28%, transparent)',
                                background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
                            }}
                        >
                            {transferBalanceError}
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    )
}
