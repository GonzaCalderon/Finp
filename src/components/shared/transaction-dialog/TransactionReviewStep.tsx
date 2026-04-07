import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DURATION, easeSmooth, easeSoft } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount, ICategory } from '@/types'
import { StepSection } from './StepSection'
import { SummaryCard, subtlePanelStyle } from './shared-ui'

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

interface PaymentSummaryData {
    currency: string
    pending: number
}

interface TransactionReviewStepProps {
    type: TransactionFormInput['type']
    primaryFlowType: TransactionFormInput['type']
    isExpense: boolean
    isEditing: boolean
    amount: number
    date: Date | undefined
    description: string
    currency: TransactionFormInput['currency']
    showSource: boolean
    showDestination: boolean
    showCategory: boolean
    descriptionIsOptional: boolean
    selectedSourceAccount: IAccount | undefined
    selectedDestinationAccount: IAccount | undefined
    selectedCategory: ICategory | undefined
    exchangeDestinationAmount: number
    exchangeDestinationCurrency: TransactionFormInput['currency']
    exchangeRate: number
    paymentSummary: PaymentSummaryData | null
    adjustmentSign: '+' | '-'
    usesCardExpensePlanFlow: boolean
    existingInstallmentCount: number | undefined
    installmentPlanSummary: string
    installmentCount: number
    installmentAmount: number
    planMonthsLabel: string
    merchant: string
    notes: string
    showMoreOptions: boolean
    headerSurface: { background: string; borderColor: string; color: string }
    paymentMethodLabel: string
    descriptionError: string | undefined
    fmtCurrency: (value: number, currency?: TransactionFormInput['currency']) => string
    onToggleMoreOptions: () => void
    onDescriptionChange: (value: string) => void
    onMerchantChange: (value: string) => void
    onNotesChange: (value: string) => void
}

export function TransactionReviewStep({
    type,
    primaryFlowType,
    isExpense,
    isEditing,
    amount,
    date,
    description,
    currency,
    showSource,
    showDestination,
    showCategory,
    descriptionIsOptional,
    selectedSourceAccount,
    selectedDestinationAccount,
    selectedCategory,
    exchangeDestinationAmount,
    exchangeDestinationCurrency,
    exchangeRate,
    paymentSummary,
    adjustmentSign,
    usesCardExpensePlanFlow,
    existingInstallmentCount,
    installmentPlanSummary,
    installmentCount,
    installmentAmount,
    planMonthsLabel,
    merchant,
    notes,
    showMoreOptions,
    headerSurface,
    paymentMethodLabel,
    descriptionError,
    fmtCurrency,
    onToggleMoreOptions,
    onDescriptionChange,
    onMerchantChange,
    onNotesChange,
}: TransactionReviewStepProps) {
    return (
        <StepSection
            eyebrow={isEditing ? 'Ultimo paso' : 'Antes de guardar'}
            title={isEditing ? 'Revisa el cambio antes de confirmar' : 'Revisa antes de guardar'}
            subtitle="Chequea lo importante y, si queres, completa las opciones extra abajo."
        >
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4 rounded-[2rem] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 88%, transparent)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                            style={{ borderColor: headerSurface.borderColor, color: headerSurface.color, background: headerSurface.background }}
                        >
                            {primaryFlowType === 'expense' ? 'Gasto' : TRANSACTION_TYPE_LABELS[type]}
                        </span>
                        {isExpense && <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{paymentMethodLabel}</span>}
                        {usesCardExpensePlanFlow && <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{installmentPlanSummary}</span>}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <SummaryCard title="Monto" value={fmtCurrency(type === 'adjustment' ? Math.abs(amount) : amount)} />
                        <SummaryCard title="Fecha" value={date ? date.toLocaleDateString('es-AR') : '-'} />
                        {showSource && <SummaryCard title="Origen" value={selectedSourceAccount?.name ?? 'Sin definir'} />}
                        {showDestination && <SummaryCard title={type === 'credit_card_payment' ? 'Tarjeta' : 'Destino'} value={selectedDestinationAccount?.name ?? 'Sin definir'} />}
                        {showCategory && <SummaryCard title="Categoria" value={selectedCategory?.name ?? 'Sin categoria'} />}
                        {!descriptionIsOptional && <SummaryCard title="Descripcion" value={description || 'Sin descripcion'} />}
                        {type === 'exchange' && (
                            <>
                                <SummaryCard title="Monto destino" value={fmtCurrency(exchangeDestinationAmount, exchangeDestinationCurrency)} />
                                <SummaryCard title="Cotizacion" value={exchangeRate > 0 ? String(exchangeRate) : 'Sin definir'} />
                            </>
                        )}
                        {type === 'credit_card_payment' && paymentSummary && <SummaryCard title="Pendiente del mes" value={fmtCurrency(paymentSummary.pending, currency)} />}
                        {type === 'adjustment' && <SummaryCard title="Impacto" value={adjustmentSign === '+' ? 'Suma saldo' : 'Descuenta saldo'} />}
                        {type === 'credit_card_expense' && existingInstallmentCount && (
                            <SummaryCard title="Plan actual" value={`${existingInstallmentCount} cuota${existingInstallmentCount === 1 ? '' : 's'}`} />
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="min-h-[80px] rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        <button
                            type="button"
                            onClick={onToggleMoreOptions}
                            className="flex w-full items-center justify-between text-left"
                            data-testid="transaction-more-options"
                        >
                            <div>
                                <p className="text-sm font-semibold">Mas opciones</p>
                                <p className="text-xs text-muted-foreground">Comercio, notas y descripcion opcional viven aca para no distraer antes.</p>
                            </div>
                            {showMoreOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        <AnimatePresence initial={false}>
                            {showMoreOptions && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto', transition: { duration: DURATION.normal, ease: easeSmooth } }}
                                    exit={{ opacity: 0, height: 0, transition: { duration: DURATION.fast, ease: easeSoft } }}
                                    className="mt-4 space-y-4 overflow-hidden"
                                >
                                    {descriptionIsOptional && (
                                        <div className="space-y-2">
                                            <Label htmlFor="descriptionOptional">Descripcion (opcional)</Label>
                                            <Input
                                                id="descriptionOptional"
                                                value={description}
                                                placeholder={type === 'credit_card_payment' ? 'Ej: Pago resumen marzo' : type === 'transfer' ? 'Ej: Pase a ahorro' : type === 'exchange' ? 'Ej: Compra de USD' : 'Descripcion'}
                                                onChange={(event) => onDescriptionChange(event.target.value)}
                                            />
                                            {descriptionError && <p className="text-sm text-destructive">{descriptionError}</p>}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="merchant">Comercio (opcional)</Label>
                                        <Input
                                            id="merchant"
                                            value={merchant}
                                            onChange={(event) => onMerchantChange(event.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="notes">Notas (opcional)</Label>
                                        <Input
                                            id="notes"
                                            value={notes}
                                            onChange={(event) => onNotesChange(event.target.value)}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {usesCardExpensePlanFlow && (
                        <div className="rounded-[2rem] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                            <p className="text-sm font-semibold">Plan de cuotas</p>
                            <p className="mt-1 text-sm text-muted-foreground">{installmentPlanSummary}</p>
                            {installmentAmount > 0 && <p className="mt-2 text-sm">{installmentCount} x {fmtCurrency(installmentAmount)}</p>}
                            {planMonthsLabel && <p className="mt-1 text-xs text-muted-foreground">{planMonthsLabel}</p>}
                        </div>
                    )}
                </div>
            </div>
        </StepSection>
    )
}
