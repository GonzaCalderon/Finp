import type { TransactionFormInput } from '@/lib/validations'

export const TRANSACTION_FORM_TYPE_LABELS: Record<
    TransactionFormInput['type'],
    string
> = {
    income: 'Ingreso',
    expense: 'Gasto',
    credit_card_expense: 'Gasto con TC',
    transfer: 'Transferencia',
    exchange: 'Cambio',
    credit_card_payment: 'Pago de tarjeta',
    debt_payment: 'Pago de tarjeta',
    adjustment: 'Ajuste',
}
