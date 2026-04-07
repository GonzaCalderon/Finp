import { Check } from 'lucide-react'
import type { TransactionFormInput } from '@/lib/validations'
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
                <div
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
                </div>
            </StepSection>
        )
    }

    return (
        <StepSection
            eyebrow="Paso 2"
            title="Que queres registrar"
            subtitle="Ahora elegi el tipo del movimiento."
        >
            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            <div
                className="space-y-3 rounded-3xl border p-4"
                data-testid="transaction-more-types"
                style={subtlePanelStyle}
            >
                <div className="border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Otros movimientos</p>
                    <p className="mt-1 text-sm text-muted-foreground">Siguen disponibles, solo con menos protagonismo visual.</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                    {SECONDARY_TYPES.map((option) => {
                        const selected = type === option
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => onTypeSelect(option)}
                                aria-pressed={selected}
                                className="rounded-2xl border px-4 py-3 text-left transition-colors"
                                data-testid={`transaction-type-${option}`}
                                style={{
                                    ...getSubtleSelectedStyle(selected),
                                    outline: selected ? '2px solid var(--sky)' : 'none',
                                    outlineOffset: '2px',
                                }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium">{SECONDARY_TYPE_LABELS[option]}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {option === 'transfer' && 'Mover entre cuentas propias.'}
                                            {option === 'exchange' && 'Registrar ARS/USD con cotizacion.'}
                                            {option === 'credit_card_payment' && 'Pagar resumen o deuda asociada.'}
                                            {option === 'adjustment' && 'Corregir un saldo puntual.'}
                                        </p>
                                    </div>
                                    {selected && (
                                        <span
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border"
                                            style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </span>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </StepSection>
    )
}
