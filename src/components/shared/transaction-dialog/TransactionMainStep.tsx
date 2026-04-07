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
import { FormattedAmountInput } from '@/components/shared/FormattedAmountInput'
import { DURATION, easeSmooth, easeSoft, staggerContainer, staggerItem } from '@/lib/utils/animations'
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
    appliedRuleName: string | null
    transaction: ITransaction | null
    rules: ITransactionRule[]
    isDatePopoverOpen: boolean
    descriptionError: string | undefined
    amountError: string | undefined
    onDescriptionChange: (value: string) => void
    onAmountChange: (nextAmount: number) => void
    onCurrencyChange: (value: TransactionFormInput['currency']) => void
    onDateChange: (date: Date | undefined) => void
    onDatePopoverOpenChange: (open: boolean) => void
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
    appliedRuleName,
    transaction,
    rules,
    isDatePopoverOpen,
    descriptionError,
    amountError,
    onDescriptionChange,
    onAmountChange,
    onCurrencyChange,
    onDateChange,
    onDatePopoverOpenChange,
}: TransactionMainStepProps) {
    const title = descriptionIsOptional ? 'Cuanto fue y cuando paso' : 'Cuanto fue, que fue y cuando'
    const subtitle = descriptionIsOptional
        ? 'Este tipo no necesita descripcion. Solo completa monto, moneda y fecha.'
        : 'Esta es la pantalla central de la carga: monto, descripcion y fecha en un solo lugar.'

    return (
        <StepSection
            eyebrow="Paso 2"
            title={title}
            subtitle={subtitle}
        >
            <motion.div
                className="space-y-4"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                {!descriptionIsOptional && (
                    <motion.div variants={staggerItem} className="space-y-2 rounded-3xl border p-4" style={subtlePanelStyle}>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <Label htmlFor="description">Descripcion</Label>
                                <p className="text-xs text-muted-foreground">
                                    Una frase corta alcanza y nos ayuda a sugerir mejor la categoria.
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
                    </motion.div>
                )}

                <motion.div
                    variants={staggerItem}
                    className="space-y-3 rounded-[1.35rem] border p-3.5 md:p-4"
                    style={{
                        borderColor: 'color-mix(in srgb, var(--border) 88%, transparent)',
                        background: 'color-mix(in srgb, var(--background) 82%, var(--card) 18%)',
                    }}
                >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_176px] md:items-start">
                        <FormattedAmountInput
                            id="amount"
                            label={isExchange ? 'Monto origen' : 'Monto'}
                            value={amount}
                            currency={currency}
                            error={undefined}
                            autoFocus
                            wrapperClassName="space-y-1.5"
                            inputClassName="h-10 rounded-[1rem] text-[1.1rem] font-semibold tracking-tight"
                            prefixClassName="text-[14px]"
                            onValueChangeAction={onAmountChange}
                        />

                        <div className="space-y-1.5 md:self-start">
                            <Label>{isExchange ? 'Moneda origen' : 'Moneda'}</Label>
                            <Select
                                value={currency}
                                onValueChange={(value) => onCurrencyChange(value as TransactionFormInput['currency'])}
                                disabled={allowedCurrencies.length === 1}
                            >
                                <SelectTrigger className="h-10 rounded-[1rem]">
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
                    </div>

                    {amountError ? <p className="text-sm text-destructive">{amountError}</p> : null}

                    <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover open={isDatePopoverOpen} onOpenChange={onDatePopoverOpenChange}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-10 w-full justify-start rounded-[1rem] text-left font-medium">
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
                </motion.div>
            </motion.div>
        </StepSection>
    )
}
