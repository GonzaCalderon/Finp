import type { IAccount } from '@/types'

type TransactionDescriptionInput = {
    type: string
    description?: string
    amount: number
    currency: 'ARS' | 'USD'
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
            return `Cambio ${input.currency}`
        case 'credit_card_payment':
        case 'debt_payment':
            if (input.destinationAccount?.name) {
                return `Pago de tarjeta ${input.destinationAccount.name}`
            }
            return 'Pago de tarjeta'
        case 'adjustment':
            return input.amount < 0 ? 'Ajuste negativo' : 'Ajuste positivo'
        default:
            return explicitDescription
    }
}
