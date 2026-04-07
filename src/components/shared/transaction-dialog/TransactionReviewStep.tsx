import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DURATION, easeSmooth, easeSoft, staggerContainer, staggerItem } from '@/lib/utils/animations'
import type { TransactionFormInput } from '@/lib/validations'
import type { IAccount, ICategory } from '@/types'
import { StepSection } from './StepSection'
import { SummaryCard, SummaryLine, subtlePanelStyle } from './shared-ui'

type CardPaymentMode = 'full' | 'partial'
type CardPaymentSelection = 'ars' | 'usd' | 'ars_usd'

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
    stepLabel: string
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
    transferBalanceCurrency: TransactionFormInput['currency'] | undefined
    transferSourceBalance: number | null
    transferDestinationBalance: number | null
    transferSourceResultingBalance: number | null
    transferDestinationResultingBalance: number | null
    paymentSummary: PaymentSummaryData | null
    cardPaymentMode: CardPaymentMode
    cardPaymentSelection: CardPaymentSelection
    secondaryCardPaymentCurrency: TransactionFormInput['currency'] | undefined
    additionalCardPaymentEnabled: boolean
    secondaryCardPaymentAmount: number
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
    showOptionalDescriptionField: boolean
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
    stepLabel,
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
    transferBalanceCurrency,
    transferSourceBalance,
    transferDestinationBalance,
    transferSourceResultingBalance,
    transferDestinationResultingBalance,
    paymentSummary,
    cardPaymentMode,
    cardPaymentSelection,
    secondaryCardPaymentCurrency,
    additionalCardPaymentEnabled,
    secondaryCardPaymentAmount,
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
    showOptionalDescriptionField,
    headerSurface,
    paymentMethodLabel,
    descriptionError,
    fmtCurrency,
    onToggleMoreOptions,
    onDescriptionChange,
    onMerchantChange,
    onNotesChange,
}: TransactionReviewStepProps) {
    const hasAdditionalCardPayment =
        type === 'credit_card_payment' &&
        additionalCardPaymentEnabled &&
        !!secondaryCardPaymentCurrency &&
        secondaryCardPaymentAmount > 0

    const cardPaymentLabel = type === 'credit_card_payment'
        ? (
            cardPaymentMode === 'full'
                ? cardPaymentSelection === 'ars'
                    ? 'Pago total ARS'
                    : cardPaymentSelection === 'usd'
                        ? 'Pago total USD'
                        : 'Pago total ARS + USD'
                : hasAdditionalCardPayment
                    ? `Pago parcial ${currency} + ${secondaryCardPaymentCurrency}`
                    : `Pago parcial ${currency}`
        )
        : ''

    const showTransferResultPreview =
        type === 'transfer' &&
        !isEditing &&
        !!transferBalanceCurrency &&
        transferSourceBalance !== null &&
        transferDestinationBalance !== null &&
        transferSourceResultingBalance !== null &&
        transferDestinationResultingBalance !== null

    return (
        <StepSection
            eyebrow={stepLabel}
            title={isEditing ? 'Resumen de la edicion' : 'Resumen antes de guardar'}
            subtitle="Un vistazo corto, claro y suficiente para confirmar con confianza."
        >
            <motion.div
                className="grid gap-4 lg:grid-cols-2"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
            >
                <motion.div variants={staggerItem} className="space-y-4 rounded-[2rem] border p-4" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--card) 88%, transparent)', boxShadow: 'var(--card-shadow)' }}>
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
                        {showSource && <SummaryCard title={type === 'adjustment' ? 'Cuenta' : 'Origen'} value={selectedSourceAccount?.name ?? 'Sin definir'} />}
                        {showDestination && <SummaryCard title={type === 'credit_card_payment' ? 'Tarjeta' : 'Destino'} value={selectedDestinationAccount?.name ?? 'Sin definir'} />}
                        {type === 'credit_card_payment' && <SummaryCard title="Pago" value={cardPaymentLabel} />}
                        {hasAdditionalCardPayment && secondaryCardPaymentCurrency && (
                            <SummaryCard
                                title={`Monto ${secondaryCardPaymentCurrency}`}
                                value={fmtCurrency(secondaryCardPaymentAmount, secondaryCardPaymentCurrency)}
                            />
                        )}
                        {showCategory && <SummaryCard title="Categoria" value={selectedCategory?.name ?? 'Sin categoria'} />}
                        {!descriptionIsOptional && <SummaryCard title="Descripcion" value={description || 'Sin descripcion'} />}
                        {usesCardExpensePlanFlow && <SummaryCard title="Plan" value={installmentPlanSummary} />}
                        {type === 'exchange' && (
                            <>
                                <SummaryCard title="Monto destino" value={fmtCurrency(exchangeDestinationAmount, exchangeDestinationCurrency)} />
                                <SummaryCard title="Cotizacion" value={exchangeRate > 0 ? String(exchangeRate) : 'Sin definir'} />
                            </>
                        )}
                        {type === 'credit_card_payment' && paymentSummary && !hasAdditionalCardPayment && cardPaymentSelection !== 'ars_usd' && (
                            <SummaryCard title="Pendiente de la moneda elegida" value={fmtCurrency(paymentSummary.pending, currency)} />
                        )}
                        {type === 'adjustment' && <SummaryCard title="Impacto" value={adjustmentSign === '+' ? 'Suma saldo' : 'Descuenta saldo'} />}
                        {type === 'credit_card_expense' && existingInstallmentCount && (
                            <SummaryCard title="Plan actual" value={`${existingInstallmentCount} cuota${existingInstallmentCount === 1 ? '' : 's'}`} />
                        )}
                    </div>

                    {showTransferResultPreview && (
                        <motion.div variants={staggerItem} className="rounded-[1.5rem] border p-4" style={subtlePanelStyle}>
                            <p className="text-sm font-semibold">Saldos resultantes</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {[
                                    {
                                        label: selectedSourceAccount?.name ?? 'Cuenta origen',
                                        current: transferSourceBalance,
                                        next: transferSourceResultingBalance,
                                    },
                                    {
                                        label: selectedDestinationAccount?.name ?? 'Cuenta destino',
                                        current: transferDestinationBalance,
                                        next: transferDestinationResultingBalance,
                                    },
                                ].map((item) => (
                                    <div
                                        key={item.label}
                                        className="rounded-2xl border p-3"
                                        style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
                                    >
                                        <p className="text-sm font-semibold">{item.label}</p>
                                        <SummaryLine label="Saldo actual" value={fmtCurrency(item.current, transferBalanceCurrency)} />
                                        <SummaryLine label="Luego" value={fmtCurrency(item.next, transferBalanceCurrency)} />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </motion.div>

                <motion.div variants={staggerItem} className="space-y-4">
                    <motion.div variants={staggerItem} className="min-h-[80px] rounded-[2rem] border p-4" style={subtlePanelStyle}>
                        <button
                            type="button"
                            onClick={onToggleMoreOptions}
                            className="flex w-full items-center justify-between text-left"
                            data-testid="transaction-more-options"
                        >
                            <div>
                                <p className="text-sm font-semibold">Opciones extra</p>
                                <p className="text-xs text-muted-foreground">Comercio, notas y otros ajustes menores viven aca para no ensuciar el flujo principal.</p>
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
                                    {showOptionalDescriptionField && (
                                        <div className="space-y-2">
                                            <Label htmlFor="descriptionOptional">Descripcion</Label>
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
                    </motion.div>

                    {usesCardExpensePlanFlow && (
                        <motion.div variants={staggerItem} className="rounded-[2rem] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                            <p className="text-sm font-semibold">Plan de cuotas</p>
                            <p className="mt-1 text-sm text-muted-foreground">{installmentPlanSummary}</p>
                            {installmentAmount > 0 && <p className="mt-2 text-sm">{installmentCount} x {fmtCurrency(installmentAmount)}</p>}
                            {planMonthsLabel && <p className="mt-1 text-xs text-muted-foreground">{planMonthsLabel}</p>}
                        </motion.div>
                    )}
                </motion.div>
            </motion.div>
        </StepSection>
    )
}
