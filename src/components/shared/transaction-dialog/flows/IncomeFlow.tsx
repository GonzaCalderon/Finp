import { motion } from 'framer-motion'
import { Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount } from '@/types'
import { SURFACE, getTypeSurface } from '../shared-ui'
import { AccountSelectorField } from '../fields/AccountSelectorField'
import { DatePickerField } from '../fields/DatePickerField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const SURFACE_ACCENT = getTypeSurface('income', false)

interface IncomeFlowProps {
    destinationAccountId: string | undefined
    destinationAccounts: IAccount[]
    destinationAccountIdError: string | undefined
    date: Date | undefined
    dateError: string | undefined
    isDatePopoverOpen: boolean
    amount: number
    amountError: string | undefined
    currency: TransactionFormInput['currency']
    allowedCurrencies: TransactionFormInput['currency'][]
    description: string
    descriptionError: string | undefined
    appliedRuleName: string | null
    hasCategoryRules: boolean
    isEditing: boolean
    showErrors: boolean
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onDestinationAccountChange: (id: string | undefined) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onAmountChange: (amount: number) => void
    onCurrencyChange: (currency: TransactionFormInput['currency']) => void
    onDescriptionChange: (value: string) => void
}

export function IncomeFlow({
    destinationAccountId,
    destinationAccounts,
    destinationAccountIdError,
    date,
    dateError,
    isDatePopoverOpen,
    amount,
    amountError,
    currency,
    allowedCurrencies,
    description,
    descriptionError,
    appliedRuleName,
    hasCategoryRules,
    isEditing,
    showErrors,
    onDestinationAccountChange,
    onDateChange,
    onDatePopoverOpenChange,
    onAmountChange,
    onCurrencyChange,
    onDescriptionChange,
}: IncomeFlowProps) {
    return (
        <motion.div
            className="space-y-3.5 rounded-[1.85rem] border p-3.5 md:space-y-4 md:p-5"
            variants={staggerItem}
            style={{ borderColor: SURFACE_ACCENT.borderColor, background: SURFACE_ACCENT.background, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[0.82rem] font-semibold uppercase tracking-[0.1em]" style={{ color: SURFACE_ACCENT.color }}>Ingreso</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
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
                        <Select
                            value={currency}
                            onValueChange={(value) => onCurrencyChange(value as TransactionFormInput['currency'])}
                            disabled={allowedCurrencies.length === 1}
                        >
                            <SelectTrigger className="h-10 rounded-[1rem]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allowedCurrencies.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {allowedCurrencies.length === 1 && (
                            <p className="text-xs text-muted-foreground">Se fija automaticamente segun la cuenta elegida.</p>
                        )}
                    </div>
                </div>

                {showErrors && amountError && <p className="text-sm text-destructive">{amountError}</p>}

                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <Label htmlFor="incomeDescription">Descripcion</Label>
                            <p className="text-xs text-muted-foreground">Una frase corta alcanza y ayuda a sugerir mejor la categoria.</p>
                        </div>
                        {hasCategoryRules && !isEditing && (
                            <span
                                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground"
                                style={{ borderColor: 'var(--border)', background: SURFACE.hover.background }}
                            >
                                <Wand2 className="h-3 w-3" />
                                Reglas
                            </span>
                        )}
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
        </motion.div>
    )
}
