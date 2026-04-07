import { AnimatePresence, motion } from 'framer-motion'
import { CalendarIcon, Wand2 } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DURATION, easeSmooth, easeSoft } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { ITransaction, ITransactionRule } from '@/types'
import { StepSection } from './StepSection'
import { subtlePanelStyle } from './shared-ui'

interface TransactionMainStepProps {
    type: TransactionFormInput['type']
    amount: number
    currency: TransactionFormInput['currency']
    date: Date | undefined
    description: string
    isExchange: boolean
    descriptionIsOptional: boolean
    allowedCurrencies: TransactionFormInput['currency'][]
    adjustmentSign: '+' | '-'
    headerSurface: { background: string; borderColor: string; color: string }
    appliedRuleName: string | null
    transaction: ITransaction | null
    rules: ITransactionRule[]
    isDatePopoverOpen: boolean
    descriptionError: string | undefined
    amountError: string | undefined
    onDescriptionChange: (value: string) => void
    onAmountChange: (nextAmount: number) => void
    onNegativeInputDetected: () => void
    onCurrencyChange: (value: TransactionFormInput['currency']) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
    onAdjustmentSignChange: (sign: '+' | '-') => void
}

export function TransactionMainStep({
    type,
    amount,
    currency,
    date,
    description,
    isExchange,
    descriptionIsOptional,
    allowedCurrencies,
    adjustmentSign,
    headerSurface,
    appliedRuleName,
    transaction,
    rules,
    isDatePopoverOpen,
    descriptionError,
    amountError,
    onDescriptionChange,
    onAmountChange,
    onNegativeInputDetected,
    onCurrencyChange,
    onDateChange,
    onDatePopoverOpenChange,
    onAdjustmentSignChange,
}: TransactionMainStepProps) {
    return (
        <StepSection
            eyebrow="Paso 1"
            title="Descripcion, monto y fecha"
            subtitle="Arrancamos con el dato principal para que las reglas lleguen antes."
        >
            <div className="space-y-4">
                {!descriptionIsOptional && (
                    <div className="space-y-2 rounded-3xl border p-4" style={subtlePanelStyle}>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <Label htmlFor="description">Descripcion</Label>
                                <p className="text-xs text-muted-foreground">
                                    Es obligatoria. Una frase corta alcanza y nos ayuda a sugerir mejor la categoria.
                                </p>
                            </div>
                            {rules.length > 0 && !transaction && (
                                <span
                                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                                    style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 92%, transparent)' }}
                                >
                                    <Wand2 className="h-3 w-3" />
                                    Reglas automaticas
                                </span>
                            )}
                        </div>

                        <Input
                            id="description"
                            value={description}
                            onChange={(event) => onDescriptionChange(event.target.value)}
                            placeholder={type === 'income' ? 'Ej: Sueldo marzo' : 'Ej: Compra en kiosco'}
                            aria-invalid={Boolean(descriptionError)}
                        />

                        {descriptionError ? (
                            <p className="text-sm text-destructive">{descriptionError}</p>
                        ) : appliedRuleName && !transaction ? (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Wand2 className="h-3 w-3" />
                                Regla aplicada: {appliedRuleName}
                            </p>
                        ) : null}
                    </div>
                )}

                <div
                    className="rounded-[2rem] border p-5"
                    style={{
                        borderColor: headerSurface.borderColor,
                        background: 'color-mix(in srgb, var(--card) 88%, transparent)',
                        boxShadow: 'var(--card-shadow)',
                    }}
                >
                    <FormattedAmountInput
                        id="amount"
                        label={isExchange ? 'Monto origen' : 'Monto'}
                        value={type === 'adjustment' && adjustmentSign === '-' ? -amount : amount}
                        currency={currency}
                        error={amountError}
                        autoFocus
                        allowNegative={type === 'adjustment'}
                        inputClassName="text-3xl font-semibold tracking-tight"
                        onNegativeInputDetectedAction={onNegativeInputDetected}
                        onValueChangeAction={onAmountChange}
                    />
                </div>

                <div className={`grid gap-3 ${type === 'adjustment' ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]'}`}>
                    <div className="space-y-2">
                        <Label>{isExchange ? 'Moneda origen' : 'Moneda'}</Label>
                        <Select
                            value={currency}
                            onValueChange={(value) => onCurrencyChange(value as TransactionFormInput['currency'])}
                            disabled={allowedCurrencies.length === 1}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allowedCurrencies.map((allowedCurrency) => (
                                    <SelectItem key={allowedCurrency} value={allowedCurrency}>
                                        {allowedCurrency}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {allowedCurrencies.length === 1 && (
                            <p className="text-xs text-muted-foreground">Se fija automaticamente segun la cuenta elegida.</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start text-left font-medium">
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    {date instanceof Date ? date.toLocaleDateString('es-AR') : 'Selecciona fecha'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent forceMount className="w-auto p-0">
                                <AnimatePresence initial={false}>
                                    {isDatePopoverOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DURATION.normal, ease: easeSmooth } }}
                                            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: DURATION.fast, ease: easeSoft } }}
                                        >
                                            <Calendar mode="single" selected={date} onSelect={onDateChange} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {type === 'adjustment' && (
                    <div className="rounded-3xl border p-4" style={subtlePanelStyle}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold">Impacto del ajuste</p>
                                <p className="text-xs text-muted-foreground">Positivo suma saldo. Negativo descuenta saldo.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium" style={{ color: adjustmentSign === '-' ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                                    Negativo
                                </span>
                                <Switch
                                    checked={adjustmentSign === '+'}
                                    onCheckedChange={(checked) => onAdjustmentSignChange(checked ? '+' : '-')}
                                    aria-label="Cambiar impacto del ajuste"
                                />
                                <span className="text-xs font-medium" style={{ color: adjustmentSign === '+' ? '#059669' : 'var(--muted-foreground)' }}>
                                    Positivo
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </StepSection>
    )
}
