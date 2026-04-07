import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { TransactionFormInput } from '@/lib/validations'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import { StepSection } from './StepSection'
import { ChoiceCard, SURFACE, getTypeSurface } from './shared-ui'

const TRANSACTION_TYPE_LABELS: Record<TransactionFormInput['type'], string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    credit_card_expense: 'Gasto con TC',
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}

const QUICK_TYPES: TransactionFormInput['type'][] = ['expense', 'income']
const SECONDARY_TYPES: Array<{ value: TransactionFormInput['type']; label: string; description: string }> = [
    { value: 'transfer', label: 'Transferencia', description: 'Mover plata entre tus cuentas.' },
    { value: 'exchange', label: 'Cambio', description: 'Compra o venta de divisas.' },
    { value: 'credit_card_payment', label: 'Pago de tarjeta', description: 'Cancelar el saldo de una tarjeta.' },
    { value: 'adjustment', label: 'Ajuste', description: 'Corregir el saldo de una cuenta.' },
]

interface TransactionTypeStepProps {
    type: TransactionFormInput['type']
    primaryFlowType: TransactionFormInput['type']
    isEditing: boolean
    isExpense: boolean
    paymentMethodLabel: string
    existingInstallmentCount: number | undefined
    headerSurface: { background: string; borderColor: string; color: string }
    onTypeSelect: (type: TransactionFormInput['type']) => void
}

export function TransactionTypeStep({
    type,
    primaryFlowType,
    isEditing,
    isExpense,
    paymentMethodLabel,
    existingInstallmentCount,
    headerSurface,
    onTypeSelect,
}: TransactionTypeStepProps) {
    if (isEditing) {
        return (
            <StepSection>
                <motion.div
                    variants={staggerItem}
                    className="rounded-[1.6rem] border p-5"
                    style={{ background: headerSurface.background, borderColor: headerSurface.borderColor }}
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
                            style={{ color: headerSurface.color, borderColor: headerSurface.borderColor }}
                        >
                            {primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                        </span>
                        {isExpense && (
                            <span className="inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                                {paymentMethodLabel}
                            </span>
                        )}
                        {type === 'credit_card_expense' && existingInstallmentCount && (
                            <span className="inline-flex items-center rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                                {existingInstallmentCount} cuota{existingInstallmentCount === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>
                </motion.div>
            </StepSection>
        )
    }

    return (
        <StepSection>
            <motion.div
                className="space-y-3.5"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                <motion.div variants={staggerItem} className="grid grid-cols-2 gap-3">
                    {QUICK_TYPES.map((option) => {
                        const selected = primaryFlowType === option
                        const surface = getTypeSurface(option, option === 'expense')

                        return (
                            <ChoiceCard
                                key={option}
                                title={TRANSACTION_TYPE_LABELS[option]}
                                description={
                                    option === 'expense'
                                        ? 'Compra, pago o salida habitual.'
                                        : 'Entrada de dinero a una cuenta.'
                                }
                                selected={selected}
                                onClick={() => onTypeSelect(option)}
                                dataTestId={`transaction-type-${option}`}
                                surface={surface}
                            />
                        )
                    })}
                </motion.div>

                <motion.div variants={staggerItem} className="grid grid-cols-2 gap-2" data-testid="transaction-more-types">
                    {SECONDARY_TYPES.map((option) => {
                        const selected = type === option.value
                        const surface = getTypeSurface(option.value, false)
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onTypeSelect(option.value)}
                                aria-pressed={selected}
                                className="rounded-[1.6rem] border px-3.5 py-3 text-left transition-all duration-200"
                                data-testid={`transaction-type-${option.value}`}
                                style={{
                                    borderColor: selected ? surface.borderColor : SURFACE.panel.borderColor,
                                    background: selected ? surface.background : SURFACE.panel.background,
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p
                                            className="text-[0.94rem] font-semibold leading-tight"
                                            style={{ color: selected ? surface.color : 'var(--foreground)' }}
                                        >
                                            {option.label}
                                        </p>
                                        <p className="mt-0.5 text-[0.78rem] leading-tight text-muted-foreground">{option.description}</p>
                                    </div>
                                    {selected && (
                                        <span
                                            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                                            style={{ background: surface.color, color: '#fff' }}
                                        >
                                            <Check className="h-3 w-3" />
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </motion.div>
            </motion.div>
        </StepSection>
    )
}
