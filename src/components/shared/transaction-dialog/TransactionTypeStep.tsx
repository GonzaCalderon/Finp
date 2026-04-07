import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { TransactionFormInput } from '@/lib/validations'
import { staggerContainer, staggerItem } from '@/lib/utils/animations'
import { StepSection } from './StepSection'
import { ChoiceCard, subtlePanelStyle, getSubtleSelectedStyle, getTypeSurface } from './shared-ui'

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
const SECONDARY_TYPES: TransactionFormInput['type'][] = ['transfer', 'exchange', 'credit_card_payment', 'adjustment']
const SECONDARY_TYPE_LABELS: Partial<Record<TransactionFormInput['type'], string>> = {
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}

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
            <StepSection
                eyebrow="Paso 2"
                title={primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                subtitle="En la edicion mantenemos este tipo fijo para no romper el historial."
            >
                <motion.div
                    variants={staggerItem}
                    className="rounded-3xl border p-5"
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
            <StepSection
                eyebrow="Paso 1"
                title="Elegi el tipo de transaccion"
                subtitle="Arrancamos por la decision principal para que el resto del flujo se adapte solo."
        >
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
                        const selected = type === option
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => onTypeSelect(option)}
                                aria-pressed={selected}
                                className="rounded-[1rem] border px-3 py-2.5 text-left transition-colors"
                                data-testid={`transaction-type-${option}`}
                                style={{
                                    ...getSubtleSelectedStyle(selected),
                                    borderColor: selected
                                        ? 'color-mix(in srgb, var(--border) 72%, var(--foreground) 16%)'
                                        : subtlePanelStyle.borderColor,
                                    background: selected
                                        ? 'color-mix(in srgb, var(--card) 94%, var(--foreground) 6%)'
                                        : subtlePanelStyle.background,
                                }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[0.94rem] font-medium leading-tight">{SECONDARY_TYPE_LABELS[option]}</p>
                                    </div>
                                    {selected && (
                                        <span
                                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                                            style={{
                                                borderColor: 'color-mix(in srgb, var(--border) 84%, transparent)',
                                                background: 'color-mix(in srgb, var(--background) 88%, var(--card) 12%)',
                                            }}
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
