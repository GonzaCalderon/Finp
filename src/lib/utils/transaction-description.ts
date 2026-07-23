import type { IAccount } from '@/types'
import { getExchangeOperationLabel } from '@/lib/utils/exchange'

type TransactionDescriptionInput = {
    type: string
    description?: string
    amount: number
    currency: 'ARS' | 'USD'
    destinationCurrency?: 'ARS' | 'USD'
    sourceAccount?: Pick<IAccount, 'name'> | null
    destinationAccount?: Pick<IAccount, 'name'> | null
}

function trimDescription(value?: string) {
    return value?.trim() ?? ''
}

export function resolveTransactionDescription(input: TransactionDescriptionInput): string {
    const explicitDescription = trimDescription(input.description)
    if (explicitDescription) return explicitDescription

    switch (input.type) {
        case 'transfer':
            if (input.sourceAccount?.name && input.destinationAccount?.name) {
                return `Transferencia ${input.sourceAccount.name} -> ${input.destinationAccount.name}`
            }
            return 'Transferencia entre cuentas'
        case 'exchange':
            return input.destinationCurrency
                ? getExchangeOperationLabel(input.currency, input.destinationCurrency)
                : `Cambio ${input.currency}`
        case 'credit_card_payment':
        case 'debt_payment':
            if (input.destinationAccount?.name) {
                return `Pago de tarjeta ${input.destinationAccount.name}`
            }
            return 'Pago de tarjeta'
        case 'adjustment':
            return input.amount < 0 ? 'Ajuste positivo' : 'Ajuste negativo'
        default:
            return explicitDescription
    }
}
